# Phase 7 API test harness — Pending Invites + AI Engineering Manager.
#
# Checklist:
#   Part A — my-invites widget backend
#   1. User A invites User B -> B sees invite on GET /api/teams/my-invites
#   2. B accepts -> invite disappears from list (re-fetch empty for that project)
#   Part B — AI Manager + merged 6d routes
#   3. Manager chat "what's blocking" -> 200 + reply (may use bottleneck tool)
#   4. GET /api/ai/manager/suggestions -> 200 + array
#   5. Non-member -> 403 on manager chat + suggestions
#   6. duplicate-work + sprint-plan endpoints -> 200 shape (Gemini required)
#   7. conflict-resolve -> 200 shape (Gemini required)
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
            $json = $Body | ConvertTo-Json -Compress -Depth 8
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

Write-Host "`n== Phase 7: signup users A + B + C ==" -ForegroundColor Cyan
$signupA = Try-Rest POST "$BASE/auth/signup" $null @{
    name = "Phase7 A"; email = "phase7-a-$suffix@test.com"; password = "TestPass123!"
}
$signupB = Try-Rest POST "$BASE/auth/signup" $null @{
    name = "Phase7 B"; email = "phase7-b-$suffix@test.com"; password = "TestPass123!"
}
$signupC = Try-Rest POST "$BASE/auth/signup" $null @{
    name = "Phase7 C"; email = "phase7-c-$suffix@test.com"; password = "TestPass123!"
}
Assert-Status "signup A" $signupA 201
Assert-Status "signup B" $signupB 201
Assert-Status "signup C" $signupC 201
$tokenA = $signupA.Data.data.token
$tokenB = $signupB.Data.data.token
$tokenC = $signupC.Data.data.token
$userAId = $signupA.Data.data.user.id
$userBId = $signupB.Data.data.user.id

Write-Host "`n== Create project + tasks ==" -ForegroundColor Cyan
$proj = Try-Rest POST "$BASE/projects" $tokenA @{
    title = "Phase7 Manager Test"
    description = "Kanban board with auth and API tasks"
    techStack = @("React", "Node.js", "MongoDB")
    timeline = "8 weeks"
}
Assert-Status "create project" $proj 201
$projectId = [string]$proj.Data.data._id
if (-not $projectId) { $projectId = [string]$proj.Data.data.id }

$overdue = (Get-Date).AddDays(-2).ToUniversalTime().ToString("o")
Try-Rest POST "$BASE/tasks" $tokenA @{
    title = "Build login API"
    project = $projectId
    status = "in-progress"
    deadline = $overdue
    assignedTo = $userAId
} | Out-Null
Try-Rest POST "$BASE/tasks" $tokenA @{
    title = "Implement login UI"
    project = $projectId
    status = "todo"
    description = "Frontend login form and auth flow"
} | Out-Null
Try-Rest POST "$BASE/tasks" $tokenA @{
    title = "Create login page"
    project = $projectId
    status = "todo"
    description = "Build user login screen"
} | Out-Null

Write-Host "`n== Part A: invite flow ==" -ForegroundColor Cyan
$invite = Try-Rest POST "$BASE/teams/$projectId/invite" $tokenA @{ userId = $userBId; role = "developer" }
Assert-Status "A invites B" $invite 200

$invitesB = Try-Rest GET "$BASE/teams/my-invites" $tokenB
Assert-Status "B GET my-invites" $invitesB 200
$inviteList = @($invitesB.Data.data)
$pendingInvite = @(
    $inviteList | Where-Object {
        [string]$_.projectId -eq $projectId -and $_.status -eq "invited"
    }
)
Assert-True "B has pending invite" ($pendingInvite.Count -ge 1) "invites: $(($inviteList | ConvertTo-Json -Compress))"

$accept = Try-Rest PATCH "$BASE/teams/$projectId/respond" $tokenB @{
    userId = $userBId
    status = "accepted"
}
Assert-Status "B accepts invite" $accept 200

$invitesAfter = Try-Rest GET "$BASE/teams/my-invites" $tokenB
$stillPending = @(
    @($invitesAfter.Data.data) | Where-Object { [string]$_.projectId -eq $projectId }
).Count
Assert-True "invite removed after accept" ($stillPending -eq 0) "still pending: $stillPending"

Write-Host "`n== Part B: manager suggestions ==" -ForegroundColor Cyan
$sugg = Try-Rest GET "$BASE/ai/manager/suggestions?projectId=$projectId" $tokenB
Assert-Status "suggestions as member B" $sugg 200
Assert-True "suggestions is array" ($sugg.Data.data -is [array])
Assert-True "has quick actions" ($sugg.Data.data.Count -ge 4)

Write-Host "`n== Part B: manager chat (bottleneck question) ==" -ForegroundColor Cyan
$chat1 = Try-Rest POST "$BASE/ai/manager/chat" $tokenB @{
    projectId = $projectId
    message = "What's blocking this project?"
    conversationHistory = @()
}
Assert-Status "manager chat 200" $chat1 200
$chat1Data = $chat1.Data.data
Assert-True "reply is string" ($chat1Data.reply -is [string])
Assert-True "reply not empty" ($chat1Data.reply.Length -gt 10) "reply: $($chat1Data.reply)"

Write-Host "`n== Part B: manager chat (general overview) ==" -ForegroundColor Cyan
$chat2 = Try-Rest POST "$BASE/ai/manager/chat" $tokenA @{
    projectId = $projectId
    message = "How's the project going overall?"
    conversationHistory = @(
        @{ role = "user"; content = "What's blocking this project?" }
        @{ role = "assistant"; content = $chat1Data.reply }
    )
}
Assert-Status "general chat 200" $chat2 200
Assert-True "overview reply" ($chat2.Data.data.reply.Length -gt 10)

Write-Host "`n== Part B: non-member C -> 403 ==" -ForegroundColor Cyan
$chat403 = Try-Rest POST "$BASE/ai/manager/chat" $tokenC @{
    projectId = $projectId
    message = "What's blocking this project?"
}
$sugg403 = Try-Rest GET "$BASE/ai/manager/suggestions?projectId=$projectId" $tokenC
Assert-Status "manager chat 403" $chat403 403
Assert-Status "suggestions 403" $sugg403 403

Write-Host "`n== Part B: 6d routes ==" -ForegroundColor Cyan
$dup = Try-Rest POST "$BASE/ai/duplicate-work" $tokenA @{ projectId = $projectId }
Assert-Status "duplicate-work 200" $dup 200
Assert-True "duplicates array" ($dup.Data.data.duplicates -is [array])

$sprint = Try-Rest POST "$BASE/ai/sprint-plan" $tokenA @{ projectId = $projectId }
Assert-Status "sprint-plan 200" $sprint 200
Assert-True "sprints array" ($sprint.Data.data.sprints -is [array])

$conflict = Try-Rest POST "$BASE/ai/conflict-resolve" $tokenA @{
    projectId = $projectId
    conversationText = "Alice says we should use MongoDB. Bob insists on PostgreSQL and won't compromise."
}
Assert-Status "conflict-resolve 200" $conflict 200
$cData = $conflict.Data.data
Assert-True "mainIssue string" ($cData.mainIssue -is [string])
Assert-True "suggestedResolution string" ($cData.suggestedResolution -is [string])

Write-Host "`n== Cleanup ==" -ForegroundColor Cyan
Try-Rest DELETE "$BASE/projects/$projectId" $tokenA | Out-Null
Write-Host "  deleted test project" -ForegroundColor DarkGray

Write-Host ""
if ($script:AllPass) {
    Write-Host "PHASE 7 CHECKS PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "PHASE 7 CHECKS FAILED" -ForegroundColor Red
    exit 1
}
