# Phase 6c API test harness — Bottleneck Detector, Deadline Predictor, Risk Analyzer.
#
# Checklist:
#   1. bottleneck-detect surfaces overdue/unassigned issues from real task data
#   2. deadline-predict references real metrics when timeline is set
#   3. risk-analysis returns categorized risks
#   4. Non-member -> 403 on all three endpoints
#   5. Zero-task project -> sensible insufficientData response (no 502)
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

Write-Host "`n== Phase 6c: signup users A + B ==" -ForegroundColor Cyan
$signupA = Try-Rest POST "$BASE/auth/signup" $null @{
    name = "Phase6c A"; email = "phase6c-a-$suffix@test.com"; password = "TestPass123!"
}
$signupB = Try-Rest POST "$BASE/auth/signup" $null @{
    name = "Phase6c B"; email = "phase6c-b-$suffix@test.com"; password = "TestPass123!"
}
Assert-Status "signup A" $signupA 201
Assert-Status "signup B" $signupB 201
$tokenA = $signupA.Data.data.token
$tokenB = $signupB.Data.data.token
$userAId = $signupA.Data.data.user.id

Write-Host "`n== Create project with timeline + tasks (overdue + unassigned) ==" -ForegroundColor Cyan
$proj = Try-Rest POST "$BASE/projects" $tokenA @{
    title = "Phase6c Health Test"
    description = "Backend auth APIs and payment integration"
    techStack = @("React", "Node.js", "Stripe")
    timeline = "2026-08-15"
}
Assert-Status "create project" $proj 201
$projectId = $proj.Data.data._id
if (-not $projectId) { $projectId = $proj.Data.data.id }

$overdue = (Get-Date).AddDays(-3).ToUniversalTime().ToString("o")
$future = (Get-Date).AddDays(7).ToUniversalTime().ToString("o")

Try-Rest POST "$BASE/tasks" $tokenA @{
    title = "Finish authentication APIs"
    project = $projectId
    status = "in-progress"
    deadline = $overdue
    assignedTo = $userAId
} | Out-Null
Try-Rest POST "$BASE/tasks" $tokenA @{
    title = "Unassigned payment hook"
    project = $projectId
    status = "todo"
    deadline = $future
} | Out-Null
Try-Rest POST "$BASE/tasks" $tokenA @{
    title = "Write API docs"
    project = $projectId
    status = "done"
    assignedTo = $userAId
} | Out-Null

Write-Host "`n== 1. POST /api/ai/bottleneck-detect as A ==" -ForegroundColor Cyan
$bn = Try-Rest POST "$BASE/ai/bottleneck-detect" $tokenA @{ projectId = $projectId }
Assert-Status "bottleneck-detect 200" $bn 200
$bnData = $bn.Data.data
Assert-True "bottlenecks is array" ($bnData.bottlenecks -is [array])
Assert-True "summary is string" ($bnData.summary -is [string])
$bnText = ($bnData | ConvertTo-Json -Compress).ToLower()
Assert-True "mentions overdue or auth task" (
    ($bnText -match "overdue") -or ($bnText -match "authentication") -or ($bnText -match "unassigned")
) "response: $bnText"

Write-Host "`n== 2. POST /api/ai/deadline-predict as A ==" -ForegroundColor Cyan
$dp = Try-Rest POST "$BASE/ai/deadline-predict" $tokenA @{ projectId = $projectId }
Assert-Status "deadline-predict 200" $dp 200
$dpData = $dp.Data.data
Assert-True "completionProbability is number" ($dpData.completionProbability -is [int] -or $dpData.completionProbability -is [double])
Assert-True "reasoning references metrics" (
    ($dpData.reasoning -match "\d") -or ($dpData.reasoning -match "overdue") -or ($dpData.reasoning -match "task")
) "reasoning: $($dpData.reasoning)"

Write-Host "`n== 3. POST /api/ai/risk-analysis as A ==" -ForegroundColor Cyan
$risk = Try-Rest POST "$BASE/ai/risk-analysis" $tokenA @{ projectId = $projectId }
Assert-Status "risk-analysis 200" $risk 200
$riskData = $risk.Data.data
Assert-True "risks is array" ($riskData.risks -is [array])
Assert-True "has at least one risk" ($riskData.risks.Count -ge 1)
$categories = @($riskData.risks | ForEach-Object { $_.category })
Assert-True "valid categories" (
    ($categories | Where-Object { $_ -in @("technical","team","timeline") }).Count -ge 1
)

Write-Host "`n== 4. Non-member B -> 403 on all three ==" -ForegroundColor Cyan
$bn403 = Try-Rest POST "$BASE/ai/bottleneck-detect" $tokenB @{ projectId = $projectId }
$dp403 = Try-Rest POST "$BASE/ai/deadline-predict" $tokenB @{ projectId = $projectId }
$r403 = Try-Rest POST "$BASE/ai/risk-analysis" $tokenB @{ projectId = $projectId }
Assert-Status "bottleneck 403" $bn403 403
Assert-Status "deadline 403" $dp403 403
Assert-Status "risk 403" $r403 403

Write-Host "`n== 5. Zero-task project -> insufficientData ==" -ForegroundColor Cyan
$emptyProj = Try-Rest POST "$BASE/projects" $tokenA @{
    title = "Empty Phase6c"
    description = "No tasks yet"
    techStack = @("React")
    timeline = "2026-09-01"
}
$emptyId = $emptyProj.Data.data._id
if (-not $emptyId) { $emptyId = $emptyProj.Data.data.id }
$emptyBn = Try-Rest POST "$BASE/ai/bottleneck-detect" $tokenA @{ projectId = $emptyId }
Assert-Status "empty bottleneck 200" $emptyBn 200
Assert-True "insufficientData flag" ($emptyBn.Data.data.insufficientData -eq $true)
Assert-True "empty bottlenecks array" ($emptyBn.Data.data.bottlenecks.Count -eq 0)

Write-Host "`n== Cleanup ==" -ForegroundColor Cyan
Try-Rest DELETE "$BASE/projects/$projectId" $tokenA | Out-Null
Try-Rest DELETE "$BASE/projects/$emptyId" $tokenA | Out-Null
Write-Host "  deleted test projects" -ForegroundColor DarkGray

Write-Host ""
if ($script:AllPass) {
    Write-Host "PHASE 6C CHECKS PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "PHASE 6C CHECKS FAILED" -ForegroundColor Red
    exit 1
}
