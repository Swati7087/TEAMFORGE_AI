# Profile page API smoke test.
$ErrorActionPreference = "Stop"
$BASE = "http://127.0.0.1:5000/api"

function Try-Rest {
    param([string]$Method, [string]$Url, [string]$Token = $null, $Body = $null)
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    try {
        if ($Body) {
            $json = $Body | ConvertTo-Json -Compress -Depth 5
            $resp = Invoke-WebRequest -Uri $Url -Method $Method -Headers $headers -Body $json -UseBasicParsing -TimeoutSec 30
        } else {
            $resp = Invoke-WebRequest -Uri $Url -Method $Method -Headers $headers -UseBasicParsing -TimeoutSec 30
        }
        return @{ Status = [int]$resp.StatusCode; Data = ($resp.Content | ConvertFrom-Json) }
    } catch {
        $resp = $_.Exception.Response
        $data = $null
        if ($_.ErrorDetails.Message) {
            try { $data = $_.ErrorDetails.Message | ConvertFrom-Json } catch { $data = $_.ErrorDetails.Message }
        }
        if ($resp) { return @{ Status = [int]$resp.StatusCode; Data = $data } }
        throw
    }
}

$suffix = Get-Random -Minimum 10000 -Maximum 99999
$signup = Try-Rest POST "$BASE/auth/signup" $null @{
    name = "Profile Test"; email = "profile-$suffix@test.com"; password = "SecretPass1!"
}
$token = $signup.Data.data.token
$id = $signup.Data.data.user.id

Write-Host "== Save full profile =="
$save = Try-Rest PUT "$BASE/users/$id" $token @{
    name = "Profile Test Updated"
    phone = "9876543210"
    organization = "Test College"
    organizationType = "college"
    skills = @("React", "Node.js", "MongoDB")
    experienceLevel = "intermediate"
    availability = "high"
    bio = "I build full-stack student projects."
    githubProfile = "Swati7087"
    linkedinProfile = ""
}
Write-Host "  save: HTTP $($save.Status)"
if ($save.Status -ne 200) { exit 1 }

Write-Host "== Reload profile =="
$get = Try-Rest GET "$BASE/users/$id" $token
$u = $get.Data.data.user
$ok = ($u.phone -eq "9876543210") -and ($u.skills.Count -eq 3) -and ($u.githubProfile -eq "Swati7087")
Write-Host "  persist: $(if ($ok) { 'PASS' } else { 'FAIL' })"

Write-Host "== Email change blocked =="
$bad = Try-Rest PUT "$BASE/users/$id" $token @{ email = "hacked-$suffix@test.com" }
$get2 = Try-Rest GET "$BASE/users/$id" $token
$emailUnchanged = $get2.Data.data.user.email -eq "profile-$suffix@test.com"
Write-Host "  email unchanged: $(if ($emailUnchanged) { 'PASS' } else { 'FAIL' })"

Write-Host "PROFILE API CHECKS PASSED"
