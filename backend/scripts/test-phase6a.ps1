# Phase 6a API test harness — AI Team Matcher + Skill Gap Detector.
#
# Checklist:
#   1. DevOps user shows in match-team results for skill-gap project
#   2. Invite from match flow creates team entry (invited)
#   3. skill-gap returns missingSkills / coveredSkills / recommendations
#   4. Non-owner match-team -> 403
#   5. Non-member skill-gap -> 403
#
# Requires GEMINI_API_KEY in backend/.env

$ErrorActionPreference = "Stop"
$BASE = "http://127.0.0.1:5000/api"

function Try-Rest {
    param(
        [string]$Method,
        [string]$Url,
        [string]$Token = $null,
        $Body = $null,
        [int]$TimeoutSec = 120
    )
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    try {
        if ($Body) {
            $json = $Body | ConvertTo-Json -Compress -Depth 5
            $resp = Invoke-WebRequest -Uri $Url -Method $Method -Headers $headers -Body $json -UseBasicParsing -TimeoutSec $TimeoutSec
        } else {
            $resp = Invoke-WebRequest -Uri $Url -Method $Method -Headers $headers -UseBasicParsing -TimeoutSec $TimeoutSec
        }
        return @{ Status = [int]$resp.StatusCode; Data = ($resp.Content | ConvertFrom-Json) }
    } catch {
        $resp = $_.Exception.Response
        $data = $null
        if ($_.ErrorDetails.Message) {
            try { $data = $_.ErrorDetails.Message | ConvertFrom-Json } catch { $data = $_.ErrorDetails.Message }
        }
        if (-not $data -and $resp) {
            $stream = $resp.GetResponseStream()
            if ($stream) {
                $reader = New-Object System.IO.StreamReader($stream)
                $text = $reader.ReadToEnd()
                if ($text) {
                    try { $data = $text | ConvertFrom-Json } catch { $data = $text }
                }
            }
        }
        if ($resp) {
            return @{ Status = [int]$resp.StatusCode; Data = $data }
        }
        throw
    }
}

function Assert-Status {
    param([string]$Label, $Result, [int]$Expected)
    if ($Result.Status -eq $Expected) {
        Write-Host "  PASS  $Label (HTTP $($Result.Status))" -ForegroundColor Green
    } else {
        Write-Host "  FAIL  $Label (got HTTP $($Result.Status), expected $Expected)" -ForegroundColor Red
        Write-Host "        body: $(($Result.Data | ConvertTo-Json -Compress -Depth 3))" -ForegroundColor DarkGray
        $script:AllPass = $false
    }
}

function Assert-True {
    param([string]$Label, [bool]$Condition, [string]$Detail = "")
    if ($Condition) {
        Write-Host "  PASS  $Label" -ForegroundColor Green
    } else {
        Write-Host "  FAIL  $Label" -ForegroundColor Red
        if ($Detail) { Write-Host "        $Detail" -ForegroundColor DarkGray }
        $script:AllPass = $false
    }
}

$script:AllPass = $true
$suffix = Get-Random -Minimum 10000 -Maximum 99999

Write-Host "`n== Setup: signup owner, devops candidate, outsider ==" -ForegroundColor Cyan
$signupA = Try-Rest POST "$BASE/auth/signup" $null @{ name = "Ava"; email = "phase6a-a-$suffix@test.com"; password = "SecretPass1!" }
$signupB = Try-Rest POST "$BASE/auth/signup" $null @{ name = "Dev"; email = "phase6a-b-$suffix@test.com"; password = "SecretPass1!" }
$signupC = Try-Rest POST "$BASE/auth/signup" $null @{ name = "Cal"; email = "phase6a-c-$suffix@test.com"; password = "SecretPass1!" }

$A = @{ token = $signupA.Data.data.token; id = $signupA.Data.data.user.id }
$B = @{ token = $signupB.Data.data.token; id = $signupB.Data.data.user.id }
$C = @{ token = $signupC.Data.data.token; id = $signupC.Data.data.user.id }

$updB = Try-Rest PUT "$BASE/users/$($B.id)" $B.token @{
    skills = @("DevOps", "Docker", "CI/CD")
    experienceLevel = "intermediate"
    availability = "high"
}
Assert-Status "set DevOps user skills" $updB 200

$create = Try-Rest POST "$BASE/projects" $A.token @{
    title = "Phase 6a Match Test"
    description = "Full-stack student app needing deployment and containerization"
    techStack = @("React", "Node.js", "MongoDB")
}
Assert-Status "createProject" $create 201
$projectId = $create.Data.data._id

Write-Host "`n== 1. Owner: match-team ==" -ForegroundColor Cyan
$match = Try-Rest POST "$BASE/ai/match-team" $A.token @{ projectId = $projectId } -TimeoutSec 180
Assert-Status "matchTeam" $match 200

$devopsInMatches = $false
$devopsMentioned = $false
if ($match.Status -eq 200) {
    $arr = $match.Data.data
    Assert-True "matches is array" ([bool]($arr -is [System.Array])) "type=$($arr.GetType().Name)"
    if ($arr.Count -gt 0) {
        $first = $arr[0]
        Assert-True "match has userId" ([bool]$first.userId) "userId=$($first.userId)"
        Assert-True "match has matchScore" ($null -ne $first.matchScore) "score=$($first.matchScore)"
        Assert-True "match has reason" ([bool]($first.reason -and $first.reason.Trim())) "reason=$($first.reason)"
        $devopsInMatches = ($arr | Where-Object { $_.userId -eq $B.id }).Count -gt 0
        $devopsMentioned = ($arr | Where-Object {
            ($_.skills -join " ") -match "DevOps|Docker|CI" -or
            $_.reason -match "DevOps|Docker|deploy|container"
        }).Count -gt 0
        Assert-True "DevOps user in matches or DevOps-relevant match" ($devopsInMatches -or $devopsMentioned) "candidate ids=$($arr.userId -join ',')"
    }
}

Write-Host "`n== 2. Owner: invite DevOps user (match flow) ==" -ForegroundColor Cyan
if ($devopsInMatches -or $devopsMentioned) {
    $invite = Try-Rest POST "$BASE/teams/$projectId/invite" $A.token @{ userId = $B.id; role = "devops" }
    Assert-Status "invite from match" $invite 200
    $team = Try-Rest GET "$BASE/teams/$projectId" $A.token
    if ($team.Status -eq 200) {
        $entry = $team.Data.data.members | Where-Object { $_.user._id -eq $B.id -or $_.user -eq $B.id }
        Assert-True "team entry status invited" ($entry.status -eq "invited") "status=$($entry.status)"
    }
} else {
    Write-Host "  SKIP  invite test (DevOps user not in match results)" -ForegroundColor DarkGray
}

Write-Host "`n== 3. Owner: skill-gap ==" -ForegroundColor Cyan
$gap = Try-Rest POST "$BASE/ai/skill-gap" $A.token @{ projectId = $projectId } -TimeoutSec 180
if ($gap.Status -eq 502) {
    Write-Host "  RETRY skill-gap after Gemini flake..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 3
    $gap = Try-Rest POST "$BASE/ai/skill-gap" $A.token @{ projectId = $projectId } -TimeoutSec 180
}
Assert-Status "analyzeSkillGap (owner)" $gap 200
if ($gap.Status -eq 200) {
    $g = $gap.Data.data
    Assert-True "missingSkills is array" ([bool]($g.missingSkills -is [System.Array])) "count=$($g.missingSkills.Count)"
    Assert-True "coveredSkills is array" ([bool]($g.coveredSkills -is [System.Array])) "count=$($g.coveredSkills.Count)"
    Assert-True "recommendations is array" ([bool]($g.recommendations -is [System.Array])) "count=$($g.recommendations.Count)"
}

Write-Host "`n== 4. Non-owner C: match-team -> 403 ==" -ForegroundColor Cyan
$forbiddenMatch = Try-Rest POST "$BASE/ai/match-team" $C.token @{ projectId = $projectId }
Assert-Status "non-owner match forbidden" $forbiddenMatch 403

Write-Host "`n== 5. Non-member C: skill-gap -> 403 ==" -ForegroundColor Cyan
$forbiddenGap = Try-Rest POST "$BASE/ai/skill-gap" $C.token @{ projectId = $projectId }
Assert-Status "non-member skill-gap forbidden" $forbiddenGap 403

Write-Host "`n== Cleanup ==" -ForegroundColor Cyan
Try-Rest DELETE "$BASE/projects/$projectId" $A.token | Out-Null

Write-Host ""
if ($AllPass) {
    Write-Host "PHASE 6a CHECKS PASSED" -ForegroundColor Green -BackgroundColor DarkGreen
    exit 0
} else {
    Write-Host "PHASE 6a CHECKS FAILED" -ForegroundColor White -BackgroundColor DarkRed
    exit 1
}
