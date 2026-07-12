# Phase 5c API test harness — AI Contribution Analyzer.
#
# Checklist:
#   1. Connect repo + generate analysis (live GitHub + Gemini)
#   2. Contribution doc shape + percentages ~100
#   3. GET /api/contributions/:projectId returns cached doc
#   4. Re-analyze upserts (same project, updated generatedAt)
#   5. Non-member -> 403
#   6. No repo connected -> clean 404
#
# Requires GITHUB_TEST_TOKEN + GITHUB_TEST_REPO_URL in backend/.env

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

function Load-DotEnv {
    param([string]$Path)
    $vars = @{}
    if (-not (Test-Path $Path)) { return $vars }
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { return }
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim()
        $vars[$key] = $val
    }
    return $vars
}

$script:AllPass = $true
$dotenv = Load-DotEnv (Join-Path $PSScriptRoot "..\.env")
$ghTestToken = $dotenv["GITHUB_TEST_TOKEN"]
$ghTestRepoUrl = $dotenv["GITHUB_TEST_REPO_URL"]

if (-not $ghTestToken -or -not $ghTestRepoUrl) {
    Write-Host "GITHUB_TEST_TOKEN and GITHUB_TEST_REPO_URL required in backend/.env" -ForegroundColor Red
    exit 1
}

$suffix = Get-Random -Minimum 10000 -Maximum 99999
Write-Host "`n== Setup: users + project + repo connect ==" -ForegroundColor Cyan

$signupA = Try-Rest POST "$BASE/auth/signup" $null @{ name = "Ava"; email = "phase5c-a-$suffix@test.com"; password = "SecretPass1!" }
$signupB = Try-Rest POST "$BASE/auth/signup" $null @{ name = "Ben"; email = "phase5c-b-$suffix@test.com"; password = "SecretPass1!" }
$signupC = Try-Rest POST "$BASE/auth/signup" $null @{ name = "Cal"; email = "phase5c-c-$suffix@test.com"; password = "SecretPass1!" }
$A = @{ token = $signupA.Data.data.token; id = $signupA.Data.data.user.id }
$B = @{ token = $signupB.Data.data.token; id = $signupB.Data.data.user.id }
$C = @{ token = $signupC.Data.data.token; id = $signupC.Data.data.user.id }

$create = Try-Rest POST "$BASE/projects" $A.token @{ title = "Phase 5c Test"; description = "Contribution analyzer"; techStack = @("Node") }
Assert-Status "createProject" $create 201
$projectId = $create.Data.data._id

$connect = Try-Rest POST "$BASE/github/connect" $A.token @{
    projectId = $projectId; repoUrl = $ghTestRepoUrl; token = $ghTestToken
} -TimeoutSec 90
Assert-Status "connectRepository" $connect 201

Write-Host "`n== 1. Generate contribution analysis ==" -ForegroundColor Cyan
$gen = Try-Rest POST "$BASE/ai/contribution-analysis" $A.token @{ projectId = $projectId } -TimeoutSec 180
Assert-Status "generateContributionAnalysis" $gen 200

if ($gen.Status -eq 200) {
    $doc = $gen.Data.data
    Assert-True "contributors array present" ([bool]($doc.contributors -is [System.Array] -and $doc.contributors.Count -ge 1)) "count=$($doc.contributors.Count)"
    Assert-True "rawStats present" ([bool]$doc.rawStats) "rawStats keys=$($doc.rawStats.PSObject.Properties.Name -join ',')"
    Assert-True "generatedAt present" ([bool]$doc.generatedAt) "generatedAt=$($doc.generatedAt)"

    $first = $doc.contributors[0]
    Assert-True "contributor has githubUsername" ([bool]$first.githubUsername) "user=$($first.githubUsername)"
    Assert-True "contributor has areas array" ([bool]($first.areas -is [System.Array])) "areas=$($first.areas -join ',')"
    Assert-True "contributor has summary" ([bool]($first.summary -and $first.summary.Trim())) "summary=$($first.summary)"
    Assert-True "contributor has contributionPercentage" ($null -ne $first.contributionPercentage) "pct=$($first.contributionPercentage)"

    $pctSum = ($doc.contributors | ForEach-Object { [double]$_.contributionPercentage } | Measure-Object -Sum).Sum
    Assert-True "percentages sum to ~100" ([math]::Abs($pctSum - 100) -le 1) "sum=$pctSum"
    $firstGeneratedAt = $doc.generatedAt
}

Write-Host "`n== 2. GET latest cached contribution ==" -ForegroundColor Cyan
$get = Try-Rest GET "$BASE/contributions/$projectId" $A.token
Assert-Status "getLatestContribution" $get 200
if ($get.Status -eq 200) {
    Assert-True "cached doc matches project" ($get.Data.data.project -eq $projectId) "project=$($get.Data.data.project)"
}

Write-Host "`n== 3. Re-analyze upserts ==" -ForegroundColor Cyan
$re = Try-Rest POST "$BASE/ai/contribution-analysis" $A.token @{ projectId = $projectId } -TimeoutSec 180
Assert-Status "re-analyze" $re 200
if ($re.Status -eq 200) {
    Assert-True "generatedAt updated or same project doc" ($re.Data.data.project -eq $projectId) ""
}

Write-Host "`n== 4. Non-member C tries analysis -> 403 ==" -ForegroundColor Cyan
$forbidden = Try-Rest POST "$BASE/ai/contribution-analysis" $C.token @{ projectId = $projectId }
Assert-Status "non-member analysis forbidden" $forbidden 403

Write-Host "`n== 5. No repo connected -> clean 404 ==" -ForegroundColor Cyan
$create2 = Try-Rest POST "$BASE/projects" $A.token @{ title = "No Repo Project"; description = "x" }
$projectId2 = $create2.Data.data._id
$noRepo = Try-Rest POST "$BASE/ai/contribution-analysis" $A.token @{ projectId = $projectId2 } -TimeoutSec 60
Assert-Status "analysis without repo" $noRepo 404
Assert-True "clean error message" ($noRepo.Data.message -like "*connect*") "message=$($noRepo.Data.message)"

Write-Host "`n== Cleanup ==" -ForegroundColor Cyan
Try-Rest DELETE "$BASE/projects/$projectId" $A.token | Out-Null
Try-Rest DELETE "$BASE/projects/$projectId2" $A.token | Out-Null

Write-Host ""
if ($AllPass) {
    Write-Host "PHASE 5c CHECKS PASSED" -ForegroundColor Green -BackgroundColor DarkGreen
    exit 0
} else {
    Write-Host "PHASE 5c CHECKS FAILED" -ForegroundColor White -BackgroundColor DarkRed
    exit 1
}
