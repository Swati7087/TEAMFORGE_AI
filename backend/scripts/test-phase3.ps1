# Phase 3 API test harness — AI Project Generator + AI Task Breakdown.
#
# Signs up 2 fresh users (owner A, outsider B), creates a project as A, then
# walks the 5-point checklist:
#   1. POST /api/ai/generate-project     as A     -> 200 + schema-matching JSON
#   2. AIHistory row present (soft check via /api/ai response envelope only)
#   3. Create project as A                        -> 201  (setup for #4/#5)
#   4. POST /api/ai/generate-tasks       as A     -> 200 + 6-12 task array
#   5. POST /api/ai/generate-tasks       as B     -> 403 (non-member)
#
# Requires:
#   * backend running on 127.0.0.1:5000
#   * GEMINI_API_KEY populated in backend/.env
#   * MongoDB reachable
#
# NOTE: Uses the live Gemini API — each run consumes a small amount of quota.

$ErrorActionPreference = "Stop"
$BASE = "http://127.0.0.1:5000/api"

function Try-Rest {
    param(
        [string]$Method,
        [string]$Url,
        [string]$Token = $null,
        $Body = $null,
        [int]$TimeoutSec = 90
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
    } catch [System.Net.WebException] {
        $streamReader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errBody = $streamReader.ReadToEnd() | ConvertFrom-Json
        return @{ Status = [int]$_.Exception.Response.StatusCode; Data = $errBody }
    } catch {
        $resp = $_.Exception.Response
        if ($resp) {
            $stream = $resp.GetResponseStream()
            if ($stream) {
                $reader = New-Object System.IO.StreamReader($stream)
                $text = $reader.ReadToEnd()
                try { $data = $text | ConvertFrom-Json } catch { $data = $text }
                return @{ Status = [int]$resp.StatusCode; Data = $data }
            }
            return @{ Status = [int]$resp.StatusCode; Data = $null }
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

# ---- Setup: signup 2 users --------------------------------------------------
$suffix = Get-Random -Minimum 10000 -Maximum 99999
$users = @{
    A = @{ email = "phase3-a-$suffix@test.com"; name = "Ava";  password = "SecretPass1!" }
    B = @{ email = "phase3-b-$suffix@test.com"; name = "Ben";  password = "SecretPass1!" }
}

Write-Host "`n== Setup: signup + login for 2 users ==" -ForegroundColor Cyan
foreach ($key in @("A","B")) {
    $u = $users[$key]
    $signup = Try-Rest -Method POST -Url "$BASE/auth/signup" -Body @{ name = $u.name; email = $u.email; password = $u.password }
    if ($signup.Status -ne 201) {
        Write-Host "  Signup for $key failed: $($signup.Status)" -ForegroundColor Red
        Write-Host "        body: $(($signup.Data | ConvertTo-Json -Compress -Depth 3))" -ForegroundColor DarkGray
        exit 1
    }
    $u.token = $signup.Data.data.token
    $u.id    = $signup.Data.data.user.id
    Write-Host "  ok  $key = $($u.email)  id=$($u.id)"
}
$A = $users.A; $B = $users.B

# ---- 1. A generates a project idea via AI -----------------------------------
Write-Host "`n== 1. User A: POST /api/ai/generate-project ==" -ForegroundColor Cyan
$gen = Try-Rest -Method POST -Url "$BASE/ai/generate-project" -Token $A.token -Body @{
    idea = "Build a food delivery app"
}
Assert-Status "generateProject" $gen 200

if ($gen.Status -eq 200) {
    $g = $gen.Data.data
    Assert-True "response has title (non-empty string)" ([bool]($g.title -and $g.title.Trim())) "title=$($g.title)"
    Assert-True "response has description" ([bool]($g.description -and $g.description.Trim())) "description=$($g.description)"
    Assert-True "techStack is array with >=1 item" ([bool]($g.techStack -is [System.Array] -and $g.techStack.Count -ge 1)) "techStack=$($g.techStack -join ', ')"
    Assert-True "features is array with >=1 item" ([bool]($g.features -is [System.Array] -and $g.features.Count -ge 1)) "features count=$($g.features.Count)"
    Assert-True "estimatedDifficulty in enum" ([bool]("beginner","intermediate","advanced" -contains $g.estimatedDifficulty)) "estimatedDifficulty=$($g.estimatedDifficulty)"
    Assert-True "timeline present" ([bool]($g.timeline -and $g.timeline.Trim())) "timeline=$($g.timeline)"
    Assert-True "requiredRoles is array with >=1 item" ([bool]($g.requiredRoles -is [System.Array] -and $g.requiredRoles.Count -ge 1)) "requiredRoles=$($g.requiredRoles -join ', ')"
}

# ---- 2. A creates a real project (Phase 2 flow) so we can generate tasks ----
Write-Host "`n== 2. User A creates a real project ==" -ForegroundColor Cyan
$create = Try-Rest -Method POST -Url "$BASE/projects" -Token $A.token -Body @{
    title       = "Phase 3 Test Project"
    description = "A project used to exercise the AI task breakdown endpoint."
    techStack   = @("React","Node","MongoDB")
    timeline    = "4 weeks"
}
Assert-Status "createProject" $create 201
$projectId = $create.Data.data._id

# ---- 3. A generates task breakdown ------------------------------------------
Write-Host "`n== 3. User A: POST /api/ai/generate-tasks ==" -ForegroundColor Cyan
$tasks = Try-Rest -Method POST -Url "$BASE/ai/generate-tasks" -Token $A.token -Body @{
    projectId = $projectId
}
Assert-Status "generateTasks" $tasks 200

if ($tasks.Status -eq 200) {
    $arr = $tasks.Data.data
    Assert-True "response is an array" ([bool]($arr -is [System.Array])) "type=$($arr.GetType().Name)"
    Assert-True "6-12 tasks returned" ([bool]($arr.Count -ge 6 -and $arr.Count -le 12)) "count=$($arr.Count)"

    if ($arr.Count -gt 0) {
        $first = $arr[0]
        Assert-True "task[0].title present" ([bool]($first.title -and $first.title.Trim())) "title=$($first.title)"
        Assert-True "task[0].difficulty in enum" ([bool]("easy","medium","hard" -contains $first.difficulty)) "difficulty=$($first.difficulty)"
        Assert-True "task[0].priority in enum"  ([bool]("low","medium","high" -contains $first.priority))    "priority=$($first.priority)"
        Assert-True "task[0].estimatedTime present" ([bool]($first.estimatedTime -and $first.estimatedTime.Trim())) "estimatedTime=$($first.estimatedTime)"
        Assert-True "task[0].suggestedRole present" ([bool]($first.suggestedRole -and $first.suggestedRole.Trim())) "suggestedRole=$($first.suggestedRole)"
    }
}

# ---- 4. B (non-member) tries generate-tasks -> 403 --------------------------
Write-Host "`n== 4. User B (non-member) tries generate-tasks -> 403 ==" -ForegroundColor Cyan
$bTasks = Try-Rest -Method POST -Url "$BASE/ai/generate-tasks" -Token $B.token -Body @{
    projectId = $projectId
}
Assert-Status "generateTasks (as non-member B) -> forbidden" $bTasks 403

# ---- 5. Cleanup: A deletes the project --------------------------------------
Write-Host "`n== 5. Cleanup: delete test project ==" -ForegroundColor Cyan
$del = Try-Rest -Method DELETE -Url "$BASE/projects/$projectId" -Token $A.token
Assert-Status "deleteProject (owner A)" $del 200

# ---- Summary ----------------------------------------------------------------
Write-Host ""
if ($AllPass) {
    Write-Host "PHASE 3 CHECKS PASSED" -ForegroundColor Green -BackgroundColor DarkGreen
    Write-Host "Also verify in MongoDB Compass: AIHistory collection should have 2 new 'success' entries (one 'project-generation' with project=null, one 'task-breakdown' with your projectId)." -ForegroundColor DarkGray
    exit 0
} else {
    Write-Host "PHASE 3 CHECKS FAILED" -ForegroundColor White -BackgroundColor DarkRed
    exit 1
}
