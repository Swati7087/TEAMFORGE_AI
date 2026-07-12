# Phase 5a API test harness — GitHub Connection + Data Fetching.
#
# Walks the 6-point checklist:
#   1. Connect with real PAT + repo (optional — skipped if env vars missing)
#   2. Garbage token -> clean error, nothing saved
#   3. GET /api/github/:projectId -> real GitHub data (if step 1 ran)
#   4. Non-member fetch -> 403
#   5. Non-owner member connect -> 403
#   6. Disconnect -> doc removed, re-fetch -> 404
#
# Optional live GitHub test env vars (in backend/.env):
#   GITHUB_TEST_TOKEN   — PAT with repo read access
#   GITHUB_TEST_REPO_URL — e.g. https://github.com/owner/repo
#
# Requires:
#   * backend running on 127.0.0.1:5000
#   * GITHUB_TOKEN_ENCRYPTION_KEY populated in backend/.env
#   * MongoDB reachable

$ErrorActionPreference = "Stop"
$BASE = "http://127.0.0.1:5000/api"

function Try-Rest {
    param(
        [string]$Method,
        [string]$Url,
        [string]$Token = $null,
        $Body = $null,
        [int]$TimeoutSec = 60
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

# ---- Setup: signup owner A, member B, outsider C ----------------------------
$suffix = Get-Random -Minimum 10000 -Maximum 99999
$users = @{
    A = @{ email = "phase5a-a-$suffix@test.com"; name = "Ava";  password = "SecretPass1!" }
    B = @{ email = "phase5a-b-$suffix@test.com"; name = "Ben";  password = "SecretPass1!" }
    C = @{ email = "phase5a-c-$suffix@test.com"; name = "Cal";  password = "SecretPass1!" }
}

Write-Host "`n== Setup: signup 3 users ==" -ForegroundColor Cyan
foreach ($key in @("A","B","C")) {
    $u = $users[$key]
    $signup = Try-Rest -Method POST -Url "$BASE/auth/signup" -Body @{ name = $u.name; email = $u.email; password = $u.password }
    if ($signup.Status -ne 201) {
        Write-Host "  Signup for $key failed: $($signup.Status)" -ForegroundColor Red
        exit 1
    }
    $u.token = $signup.Data.data.token
    $u.id    = $signup.Data.data.user.id
    Write-Host "  ok  $key = $($u.email)"
}
$A = $users.A; $B = $users.B; $C = $users.C

Write-Host "`n== Setup: project + team (A owner, B member) ==" -ForegroundColor Cyan
$create = Try-Rest -Method POST -Url "$BASE/projects" -Token $A.token -Body @{
    title = "Phase 5a GitHub Test"; description = "GitHub connect harness"; techStack = @("Node"); timeline = "2 weeks"
}
Assert-Status "createProject" $create 201
$projectId = $create.Data.data._id

$invite = Try-Rest -Method POST -Url "$BASE/teams/$projectId/invite" -Token $A.token -Body @{ userId = $B.id; role = "developer" }
Assert-Status "invite B" $invite 200
$accept = Try-Rest -Method PATCH -Url "$BASE/teams/$projectId/respond" -Token $B.token -Body @{ userId = $B.id; status = "accepted" }
Assert-Status "B accepts invite" $accept 200

# ---- 1. Garbage token -> clean error, nothing saved -------------------------
Write-Host "`n== 1. Garbage token connect -> 400, nothing saved ==" -ForegroundColor Cyan
$bad = Try-Rest -Method POST -Url "$BASE/github/connect" -Token $A.token -Body @{
    projectId = $projectId
    repoUrl   = "https://github.com/octocat/Hello-World"
    token     = "ghp_garbage_token_12345"
}
Assert-Status "connect with garbage token" $bad 400
Assert-True "error message is user-friendly" ($bad.Data.message -like "*Invalid token or repository*") "message=$($bad.Data.message)"

$peek = Try-Rest -Method GET -Url "$BASE/github/$projectId" -Token $A.token
Assert-Status "no repo saved after bad connect" $peek 404

# ---- 2. Non-owner member tries connect -> 403 -------------------------------
Write-Host "`n== 2. Member B tries connect -> 403 ==" -ForegroundColor Cyan
$memberConnect = Try-Rest -Method POST -Url "$BASE/github/connect" -Token $B.token -Body @{
    projectId = $projectId
    repoUrl   = "https://github.com/octocat/Hello-World"
    token     = "ghp_anything"
}
Assert-Status "member connect forbidden" $memberConnect 403

# ---- 3. Live connect + fetch (optional) -------------------------------------
$liveRan = $false
if ($ghTestToken -and $ghTestRepoUrl) {
    Write-Host "`n== 3. Live connect with real PAT + repo ==" -ForegroundColor Cyan
    $live = Try-Rest -Method POST -Url "$BASE/github/connect" -Token $A.token -Body @{
        projectId = $projectId
        repoUrl   = $ghTestRepoUrl
        token     = $ghTestToken
    } -TimeoutSec 90
    Assert-Status "live connect" $live 201

    if ($live.Status -eq 201) {
        $repo = $live.Data.data
        Assert-True "response has no encryptedToken" (-not $repo.PSObject.Properties.Name.Contains("encryptedToken")) "keys=$($repo.PSObject.Properties.Name -join ',')"
        Assert-True "response has no tokenIv" (-not $repo.PSObject.Properties.Name.Contains("tokenIv")) "keys=$($repo.PSObject.Properties.Name -join ',')"
        Assert-True "repoUrl present" ([bool]$repo.repoUrl) "repoUrl=$($repo.repoUrl)"
        Assert-True "owner present" ([bool]$repo.owner) "owner=$($repo.owner)"
        Assert-True "repoName present" ([bool]$repo.repoName) "repoName=$($repo.repoName)"
        $liveRan = $true

        Write-Host "`n== 4. GET repository data (owner A) ==" -ForegroundColor Cyan
        $fetch = Try-Rest -Method GET -Url "$BASE/github/$projectId" -Token $A.token -TimeoutSec 90
        Assert-Status "getRepositoryData" $fetch 200
        if ($fetch.Status -eq 200) {
            $d = $fetch.Data.data
            Assert-True "commits is array" ([bool]($d.commits -is [System.Array])) "type=$($d.commits.GetType().Name)"
            Assert-True "pullRequests is array" ([bool]($d.pullRequests -is [System.Array])) "type=$($d.pullRequests.GetType().Name)"
            Assert-True "contributors is array" ([bool]($d.contributors -is [System.Array])) "type=$($d.contributors.GetType().Name)"
            Assert-True "issues is array" ([bool]($d.issues -is [System.Array])) "type=$($d.issues.GetType().Name)"
            Assert-True "branches is array" ([bool]($d.branches -is [System.Array])) "type=$($d.branches.GetType().Name)"
            Assert-True "lastSyncedAt updated on repository" ([bool]$d.repository.lastSyncedAt) "lastSyncedAt=$($d.repository.lastSyncedAt)"
        }
    }
} else {
    Write-Host "`n== 3-4. Live GitHub connect/fetch SKIPPED ==" -ForegroundColor Yellow
    Write-Host "        Set GITHUB_TEST_TOKEN + GITHUB_TEST_REPO_URL in backend/.env to run live checks." -ForegroundColor DarkGray
}

# ---- 5. Non-member fetch -> 403 ---------------------------------------------
Write-Host "`n== 5. Outsider C fetch -> 403 ==" -ForegroundColor Cyan
if ($liveRan) {
    $outsider = Try-Rest -Method GET -Url "$BASE/github/$projectId" -Token $C.token
    Assert-Status "non-member fetch forbidden" $outsider 403
} else {
    Write-Host "  SKIP  non-member fetch (no connected repo)" -ForegroundColor DarkGray
}

# ---- 6. Disconnect + re-fetch 404 -------------------------------------------
Write-Host "`n== 6. Owner disconnect + re-fetch 404 ==" -ForegroundColor Cyan
if ($liveRan) {
    $del = Try-Rest -Method DELETE -Url "$BASE/github/$projectId" -Token $A.token
    Assert-Status "disconnect" $del 200
    $after = Try-Rest -Method GET -Url "$BASE/github/$projectId" -Token $A.token
    Assert-Status "re-fetch after disconnect" $after 404
} else {
    Write-Host "  SKIP  disconnect (no connected repo)" -ForegroundColor DarkGray
}

# ---- Cleanup ----------------------------------------------------------------
Write-Host "`n== Cleanup: delete test project ==" -ForegroundColor Cyan
$delProj = Try-Rest -Method DELETE -Url "$BASE/projects/$projectId" -Token $A.token
Assert-Status "deleteProject" $delProj 200

# ---- Summary ----------------------------------------------------------------
Write-Host ""
if ($AllPass) {
    Write-Host "PHASE 5a CHECKS PASSED" -ForegroundColor Green -BackgroundColor DarkGreen
    if (-not $liveRan) {
        Write-Host "Note: live GitHub connect/fetch skipped - add GITHUB_TEST_TOKEN + GITHUB_TEST_REPO_URL to .env and re-run for full coverage." -ForegroundColor DarkGray
    } else {
        Write-Host "Also verify in MongoDB Compass: encryptedToken should be random hex, NOT your plain PAT." -ForegroundColor DarkGray
    }
    exit 0
} else {
    Write-Host "PHASE 5a CHECKS FAILED" -ForegroundColor White -BackgroundColor DarkRed
    exit 1
}
