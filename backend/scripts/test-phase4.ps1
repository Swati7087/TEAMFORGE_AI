# Phase 4 API test harness — Smart Dashboard + AI Weekly Summary.
#
# Signs up 2 fresh users, creates a project as A, populates 3 tasks (one
# to-do with a near deadline, one in-progress, one already done). Then walks:
#   1. GET /api/dashboard/summary       -> 200, numbers match what we just set
#   2. GET /api/dashboard/productivity  -> 200, 7 daily buckets returned
#   3. POST /api/ai/productivity-report -> 200 with the expected schema
#   4. POST /api/ai/productivity-report as non-member B -> 403
#   5. Cleanup: delete the test project
#
# Requires:
#   * backend running on 127.0.0.1:5000
#   * GEMINI_API_KEY populated in backend/.env
#   * MongoDB reachable

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
    A = @{ email = "phase4-a-$suffix@test.com"; name = "Ada";  password = "SecretPass1!" }
    B = @{ email = "phase4-b-$suffix@test.com"; name = "Boe";  password = "SecretPass1!" }
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

# ---- Setup: A creates a project + 3 tasks -----------------------------------
Write-Host "`n== Setup: A creates project + 3 tasks (todo/in-progress/done) ==" -ForegroundColor Cyan
$create = Try-Rest -Method POST -Url "$BASE/projects" -Token $A.token -Body @{
    title       = "Phase 4 Dashboard Test"
    description = "Used to exercise dashboard aggregation."
    techStack   = @("React","Node","MongoDB")
    timeline    = "1 week"
}
Assert-Status "createProject" $create 201
$projectId = $create.Data.data._id

# Task 1 — todo, due in 3 days
$deadline3d = (Get-Date).ToUniversalTime().AddDays(3).ToString("o")
$t1 = Try-Rest -Method POST -Url "$BASE/tasks" -Token $A.token -Body @{
    title = "Wire the auth flow"; project = $projectId; assignedTo = $A.id;
    priority = "high"; deadline = $deadline3d
}
Assert-Status "createTask #1 (todo, due 3d)" $t1 201
$t1Id = $t1.Data.data._id

# Task 2 — in progress
$t2 = Try-Rest -Method POST -Url "$BASE/tasks" -Token $A.token -Body @{
    title = "Design the dashboard"; project = $projectId; assignedTo = $A.id;
    priority = "medium"
}
Assert-Status "createTask #2 (in progress)" $t2 201
$t2Id = $t2.Data.data._id
$null = Try-Rest -Method PATCH -Url "$BASE/tasks/$t2Id/status" -Token $A.token -Body @{ status = "in-progress" }

# Task 3 — done
$t3 = Try-Rest -Method POST -Url "$BASE/tasks" -Token $A.token -Body @{
    title = "Set up the repo"; project = $projectId; assignedTo = $A.id;
    priority = "low"
}
Assert-Status "createTask #3 (done)" $t3 201
$t3Id = $t3.Data.data._id
$null = Try-Rest -Method PATCH -Url "$BASE/tasks/$t3Id/status" -Token $A.token -Body @{ status = "done" }

# ---- 1. Summary endpoint ----------------------------------------------------
Write-Host "`n== 1. GET /api/dashboard/summary as A ==" -ForegroundColor Cyan
$sum = Try-Rest -Method GET -Url "$BASE/dashboard/summary" -Token $A.token
Assert-Status "getSummary" $sum 200

if ($sum.Status -eq 200) {
    $s = $sum.Data.data
    Assert-True "activeProjects >= 1"    ([bool]($s.activeProjects -ge 1))     "activeProjects=$($s.activeProjects)"
    Assert-True "totalTasks >= 3"        ([bool]($s.totalTasks -ge 3))         "totalTasks=$($s.totalTasks)"
    Assert-True "pendingTasks >= 2"      ([bool]($s.pendingTasks -ge 2))       "pendingTasks=$($s.pendingTasks)"
    Assert-True "completedTasks >= 1"    ([bool]($s.completedTasks -ge 1))     "completedTasks=$($s.completedTasks)"
    Assert-True "tasksByStatus.todo >= 1" ([bool]($s.tasksByStatus.todo -ge 1))
    Assert-True "tasksByStatus.in-progress >= 1" ([bool]($s.tasksByStatus."in-progress" -ge 1))
    Assert-True "tasksByStatus.done >= 1" ([bool]($s.tasksByStatus.done -ge 1))

    $hasT1 = $s.upcomingDeadlines | Where-Object { $_.taskId -eq $t1Id }
    Assert-True "upcomingDeadlines includes the 3-day task" ([bool]$hasT1) "count=$($s.upcomingDeadlines.Count)"

    $recentHit = $s.recentProjects | Where-Object { $_._id -eq $projectId }
    Assert-True "recentProjects includes the test project" ([bool]$recentHit)
}

# ---- 2. Productivity endpoint ----------------------------------------------
Write-Host "`n== 2. GET /api/dashboard/productivity as A ==" -ForegroundColor Cyan
$prod = Try-Rest -Method GET -Url "$BASE/dashboard/productivity" -Token $A.token
Assert-Status "getProductivity" $prod 200

if ($prod.Status -eq 200) {
    $p = $prod.Data.data
    Assert-True "returns array of 7 daily buckets" ([bool]($p.Count -eq 7)) "count=$($p.Count)"
    if ($p.Count -gt 0) {
        Assert-True "each bucket has date + tasksCompleted" ([bool]($p[0].date -and $p[0].tasksCompleted -ge 0)) "sample=$($p[0] | ConvertTo-Json -Compress)"
        $todayTotal = ($p | Measure-Object -Property tasksCompleted -Sum).Sum
        Assert-True "at least 1 task counted this week" ([bool]($todayTotal -ge 1)) "sum=$todayTotal"
    }
}

# ---- 3. Weekly summary AI ---------------------------------------------------
Write-Host "`n== 3. POST /api/ai/productivity-report as A ==" -ForegroundColor Cyan
$rep = Try-Rest -Method POST -Url "$BASE/ai/productivity-report" -Token $A.token -Body @{ projectId = $projectId }
Assert-Status "productivityReport (as A)" $rep 200

if ($rep.Status -eq 200) {
    $r = $rep.Data.data
    Assert-True "response.summary is non-empty string" ([bool]($r.summary -and $r.summary.Trim())) "summary=$($r.summary)"
    Assert-True "response.highlights is array" ([bool]($r.highlights -is [System.Array]))
    Assert-True "response.concerns is array" ([bool]($r.concerns -is [System.Array]))
    Assert-True "response.suggestedNextSteps is array with >=1 item" ([bool]($r.suggestedNextSteps -is [System.Array] -and $r.suggestedNextSteps.Count -ge 1)) "count=$($r.suggestedNextSteps.Count)"
}

# ---- 4. Non-member gets 403 -------------------------------------------------
Write-Host "`n== 4. POST /api/ai/productivity-report as B (non-member) -> 403 ==" -ForegroundColor Cyan
$bRep = Try-Rest -Method POST -Url "$BASE/ai/productivity-report" -Token $B.token -Body @{ projectId = $projectId }
Assert-Status "productivityReport (as non-member B) -> forbidden" $bRep 403

# ---- 5. Cleanup -------------------------------------------------------------
Write-Host "`n== 5. Cleanup ==" -ForegroundColor Cyan
$del = Try-Rest -Method DELETE -Url "$BASE/projects/$projectId" -Token $A.token
Assert-Status "deleteProject (owner A)" $del 200

# ---- Summary ----------------------------------------------------------------
Write-Host ""
if ($AllPass) {
    Write-Host "PHASE 4 CHECKS PASSED" -ForegroundColor Green -BackgroundColor DarkGreen
    exit 0
} else {
    Write-Host "PHASE 4 CHECKS FAILED" -ForegroundColor White -BackgroundColor DarkRed
    exit 1
}
