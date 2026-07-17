# Phase 6b API test harness — AI Meeting Assistant + README Generator.
#
# Checklist:
#   1. meeting-summary returns summary + actionItems + nextMeetingGoals
#   2. Action items reference real team member names
#   3. meeting-history lists saved summaries
#   4. generate-readme returns markdown with real project title
#   5. Non-member -> 403 on both endpoints
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

Write-Host "`n== Setup: signup owner + outsider ==" -ForegroundColor Cyan
$signupA = Try-Rest POST "$BASE/auth/signup" $null @{ name = "Maya"; email = "phase6b-a-$suffix@test.com"; password = "SecretPass1!" }
$signupC = Try-Rest POST "$BASE/auth/signup" $null @{ name = "Zoe"; email = "phase6b-c-$suffix@test.com"; password = "SecretPass1!" }

$A = @{ token = $signupA.Data.data.token; id = $signupA.Data.data.user.id; name = "Maya" }
$C = @{ token = $signupC.Data.data.token; id = $signupC.Data.data.user.id }

$create = Try-Rest POST "$BASE/projects" $A.token @{
    title = "TeamForge Phase 6b"
    description = "Student collaboration platform with AI assistants for meetings and docs"
    techStack = @("React", "Node.js", "MongoDB", "Express")
}
Assert-Status "createProject" $create 201
$projectId = $create.Data.data._id

$task1 = Try-Rest POST "$BASE/tasks" $A.token @{
    project = $projectId
    title = "Build meeting notes UI"
    description = "Textarea + summarize button"
}
Assert-Status "create task 1" $task1 201
$t1Id = $task1.Data.data._id
$null = Try-Rest PATCH "$BASE/tasks/$t1Id/status" $A.token @{ status = "done" }

$task2 = Try-Rest POST "$BASE/tasks" $A.token @{
    project = $projectId
    title = "Add README generator"
    description = "Markdown export with copy/download"
}
Assert-Status "create task 2" $task2 201
$t2Id = $task2.Data.data._id
$null = Try-Rest PATCH "$BASE/tasks/$t2Id/status" $A.token @{ status = "in-progress" }

$rawNotes = "Sprint sync - Maya reported the kanban board is working. Maya will polish the README generator by Friday (high priority). We agreed to demo the meeting assistant next Tuesday. Need unit tests for AI routes before submission."

Write-Host "`n== 1. Owner: meeting-summary ==" -ForegroundColor Cyan
$summary = Try-Rest POST "$BASE/ai/meeting-summary" $A.token @{
    projectId = $projectId
    rawNotes = $rawNotes
} -TimeoutSec 180

if ($summary.Status -eq 502) {
    Write-Host "  RETRY meeting-summary after Gemini flake..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 3
    $summary = Try-Rest POST "$BASE/ai/meeting-summary" $A.token @{
        projectId = $projectId
        rawNotes = $rawNotes
    } -TimeoutSec 180
}
Assert-Status "summarizeMeeting" $summary 200

if ($summary.Status -eq 200) {
    $s = $summary.Data.data
    Assert-True "summary present" ([bool]($s.summary -and $s.summary.Trim())) "len=$($s.summary.Length)"
    Assert-True "actionItems is array" ([bool]($s.actionItems -is [System.Array])) "count=$($s.actionItems.Count)"
    Assert-True "nextMeetingGoals is array" ([bool]($s.nextMeetingGoals -is [System.Array])) "count=$($s.nextMeetingGoals.Count)"
    Assert-True "meetingId saved" ([bool]$s.meetingId) "id=$($s.meetingId)"

    $hasMayaAssignee = ($s.actionItems | Where-Object {
        $_.assignedTo -match "Maya"
    }).Count -gt 0
    $mentionsMaya = $hasMayaAssignee -or ($s.summary -match "Maya")
    Assert-True "references real team member Maya" $mentionsMaya "assignees=$($s.actionItems.assignedTo -join ', ')"
}

Write-Host "`n== 2. Owner: meeting-history ==" -ForegroundColor Cyan
$history = Try-Rest GET "$BASE/ai/meeting-history?projectId=$projectId" $A.token
Assert-Status "getMeetingHistory" $history 200
if ($history.Status -eq 200) {
    $items = $history.Data.data
    Assert-True "history is array" ([bool]($items -is [System.Array])) "count=$($items.Count)"
    Assert-True "history has at least one entry" ($items.Count -ge 1) "count=$($items.Count)"
}

Write-Host "`n== 3. Owner: generate-readme ==" -ForegroundColor Cyan
$readme = Try-Rest POST "$BASE/ai/generate-readme" $A.token @{
    projectId = $projectId
} -TimeoutSec 180

if ($readme.Status -eq 502) {
    Write-Host "  RETRY generate-readme after Gemini flake..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 3
    $readme = Try-Rest POST "$BASE/ai/generate-readme" $A.token @{
        projectId = $projectId
    } -TimeoutSec 180
}
Assert-Status "generateReadme" $readme 200

if ($readme.Status -eq 200) {
    $md = $readme.Data.data.markdown
    Assert-True "markdown present" ([bool]($md -and $md.Trim())) "len=$($md.Length)"
    Assert-True "markdown includes project title" ($md -match "TeamForge Phase 6b") "snippet=$($md.Substring(0, [Math]::Min(120, $md.Length)))"
    Assert-True "markdown has Overview section" ($md -match "## Overview") ""
    Assert-True "markdown has Tech Stack section" ($md -match "## Tech Stack") ""
}

Write-Host "`n== 4. Non-member: meeting-summary -> 403 ==" -ForegroundColor Cyan
$forbiddenSummary = Try-Rest POST "$BASE/ai/meeting-summary" $C.token @{
    projectId = $projectId
    rawNotes = "Should not work"
}
Assert-Status "non-member meeting-summary forbidden" $forbiddenSummary 403

Write-Host "`n== 5. Non-member: generate-readme -> 403 ==" -ForegroundColor Cyan
$forbiddenReadme = Try-Rest POST "$BASE/ai/generate-readme" $C.token @{
    projectId = $projectId
}
Assert-Status "non-member generate-readme forbidden" $forbiddenReadme 403

Write-Host "`n== Cleanup ==" -ForegroundColor Cyan
Try-Rest DELETE "$BASE/projects/$projectId" $A.token | Out-Null

Write-Host ""
if ($AllPass) {
    Write-Host "PHASE 6b CHECKS PASSED" -ForegroundColor Green -BackgroundColor DarkGreen
    exit 0
} else {
    Write-Host "PHASE 6b CHECKS FAILED" -ForegroundColor White -BackgroundColor DarkRed
    exit 1
}
