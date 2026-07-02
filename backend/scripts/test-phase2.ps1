# Phase 2 API test harness.
# Signs up 3 users, walks the 8-point checklist, prints PASS/FAIL for each.

$ErrorActionPreference = "Stop"
$BASE = "http://127.0.0.1:5000/api"

function Try-Rest {
    param(
        [string]$Method,
        [string]$Url,
        [string]$Token = $null,
        $Body = $null
    )
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    try {
        if ($Body) {
            $json = $Body | ConvertTo-Json -Compress -Depth 5
            $resp = Invoke-WebRequest -Uri $Url -Method $Method -Headers $headers -Body $json -UseBasicParsing -TimeoutSec 15
        } else {
            $resp = Invoke-WebRequest -Uri $Url -Method $Method -Headers $headers -UseBasicParsing -TimeoutSec 15
        }
        return @{ Status = [int]$resp.StatusCode; Data = ($resp.Content | ConvertFrom-Json) }
    } catch [System.Net.WebException] {
        $streamReader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errBody = $streamReader.ReadToEnd() | ConvertFrom-Json
        return @{ Status = [int]$_.Exception.Response.StatusCode; Data = $errBody }
    } catch {
        # Invoke-WebRequest on modern PowerShell throws HttpResponseException
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

$script:AllPass = $true

# ---- Setup: signup 3 users, login all ----------------------------------------
$suffix = Get-Random -Minimum 10000 -Maximum 99999
$users = @{
    A = @{ email = "phase2-a-$suffix@test.com"; name = "Alice"; password = "SecretPass1!" }
    B = @{ email = "phase2-b-$suffix@test.com"; name = "Bob";   password = "SecretPass1!" }
    C = @{ email = "phase2-c-$suffix@test.com"; name = "Carol"; password = "SecretPass1!" }
}

Write-Host "`n== Setup: signup + login for 3 users ==" -ForegroundColor Cyan
foreach ($key in @("A","B","C")) {
    $u = $users[$key]
    $signup = Try-Rest -Method POST -Url "$BASE/auth/signup" -Body @{ name = $u.name; email = $u.email; password = $u.password }
    if ($signup.Status -ne 201) {
        Write-Host "  Signup for $key failed: $($signup.Status)" -ForegroundColor Red
        Write-Host "        body: $(($signup.Data | ConvertTo-Json -Compress -Depth 3))" -ForegroundColor DarkGray
        exit 1
    }
    $u.token = $signup.Data.data.token
    # The signup controller returns user.id (not _id) — see auth.controller.js
    $u.id    = $signup.Data.data.user.id
    Write-Host "  ok  $key = $($u.email)  id=$($u.id)"
}

$A = $users.A; $B = $users.B; $C = $users.C

# ---- 1. A creates a project ---------------------------------------------------
Write-Host "`n== 1. User A creates a project ==" -ForegroundColor Cyan
$create = Try-Rest -Method POST -Url "$BASE/projects" -Token $A.token -Body @{
    title       = "Phase 2 Test Project"
    description = "Automated test"
    techStack   = @("React","Node")
    timeline    = "2 weeks"
}
Assert-Status "createProject" $create 201
$projectId = $create.Data.data._id
if ($create.Data.data.owner -ne $A.id) {
    Write-Host "  FAIL  owner mismatch (got $($create.Data.data.owner), expected $($A.id))" -ForegroundColor Red
    $AllPass = $false
} else {
    Write-Host "  PASS  owner == A" -ForegroundColor Green
}

# ---- 2. A gets projects, sees the new one -------------------------------------
Write-Host "`n== 2. User A lists projects, includes the new one ==" -ForegroundColor Cyan
$list = Try-Rest -Method GET -Url "$BASE/projects" -Token $A.token
Assert-Status "getProjects" $list 200
$found = $list.Data.data | Where-Object { $_._id -eq $projectId }
if ($found) {
    Write-Host "  PASS  project $projectId present in list" -ForegroundColor Green
} else {
    Write-Host "  FAIL  project not in list" -ForegroundColor Red
    $AllPass = $false
}

# ---- 3. B requests to join ----------------------------------------------------
Write-Host "`n== 3. User B requests to join ==" -ForegroundColor Cyan
$req = Try-Rest -Method POST -Url "$BASE/teams/$projectId/request" -Token $B.token
Assert-Status "requestToJoin" $req 200
$bEntry = $req.Data.data.members | Where-Object { $_.user -eq $B.id }
if ($bEntry -and $bEntry.status -eq "requested") {
    Write-Host "  PASS  B team entry status='requested'" -ForegroundColor Green
} else {
    Write-Host "  FAIL  B team entry missing or wrong status" -ForegroundColor Red
    Write-Host "        entry: $(($bEntry | ConvertTo-Json -Compress))" -ForegroundColor DarkGray
    $AllPass = $false
}

# ---- 4. A accepts B's request ------------------------------------------------
Write-Host "`n== 4. User A accepts B's request ==" -ForegroundColor Cyan
$resp = Try-Rest -Method PATCH -Url "$BASE/teams/$projectId/respond" -Token $A.token -Body @{
    userId = $B.id; status = "accepted"
}
Assert-Status "respondToInvite(accepted)" $resp 200
$bEntry = $resp.Data.data.members | Where-Object { $_.user -eq $B.id }
if ($bEntry.status -eq "accepted") {
    Write-Host "  PASS  team entry flipped to 'accepted'" -ForegroundColor Green
} else {
    Write-Host "  FAIL  team entry status = $($bEntry.status)" -ForegroundColor Red
    $AllPass = $false
}
$refreshed = Try-Rest -Method GET -Url "$BASE/projects/$projectId" -Token $A.token
$isMember = $refreshed.Data.data.members | Where-Object { $_._id -eq $B.id }
if ($isMember) {
    Write-Host "  PASS  B now appears in Project.members" -ForegroundColor Green
} else {
    Write-Host "  FAIL  B missing from Project.members" -ForegroundColor Red
    $AllPass = $false
}

# ---- 5. B creates a task (assigned to B so B can update its status later) ----
Write-Host "`n== 5. User B creates a task ==" -ForegroundColor Cyan
$task = Try-Rest -Method POST -Url "$BASE/tasks" -Token $B.token -Body @{
    title      = "Write auth tests"
    project    = $projectId
    assignedTo = $B.id
    priority   = "high"
}
Assert-Status "createTask (as member B)" $task 201
$taskId = $task.Data.data._id

# ---- 6. C (non-member) tries to create a task -> 403 -------------------------
Write-Host "`n== 6. User C (not a member) tries to create a task ==" -ForegroundColor Cyan
$cTask = Try-Rest -Method POST -Url "$BASE/tasks" -Token $C.token -Body @{
    title   = "Illegal task"
    project = $projectId
}
Assert-Status "createTask (as non-member C) -> forbidden" $cTask 403

# ---- 7. B updates task status ------------------------------------------------
Write-Host "`n== 7. User B updates task status ==" -ForegroundColor Cyan
$statusRes = Try-Rest -Method PATCH -Url "$BASE/tasks/$taskId/status" -Token $B.token -Body @{
    status = "in-progress"
}
Assert-Status "updateTaskStatus (as assignee B)" $statusRes 200
if ($statusRes.Data.data.status -eq "in-progress") {
    Write-Host "  PASS  task.status = 'in-progress'" -ForegroundColor Green
} else {
    Write-Host "  FAIL  task.status = $($statusRes.Data.data.status)" -ForegroundColor Red
    $AllPass = $false
}

# ---- 8. Non-owner delete -> 403, then owner delete -> 200 --------------------
Write-Host "`n== 8. Delete permissions ==" -ForegroundColor Cyan
$bDel = Try-Rest -Method DELETE -Url "$BASE/projects/$projectId" -Token $B.token
Assert-Status "deleteProject (as non-owner B) -> forbidden" $bDel 403

$aDel = Try-Rest -Method DELETE -Url "$BASE/projects/$projectId" -Token $A.token
Assert-Status "deleteProject (as owner A)" $aDel 200

# ---- Summary -----------------------------------------------------------------
Write-Host ""
if ($AllPass) {
    Write-Host "ALL 8 CHECKS PASSED" -ForegroundColor Green -BackgroundColor DarkGreen
    exit 0
} else {
    Write-Host "SOME CHECKS FAILED" -ForegroundColor White -BackgroundColor DarkRed
    exit 1
}
