# PHASE 5 - PROD Validation Trigger Script
# Uses GitHub API directly since gh CLI may not be installed

param(
    [string]$GitHubToken = $env:GITHUB_TOKEN,
    [string]$RepoOwner = "your-org",
    [string]$RepoName = "unit-talk-production-main"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 PHASE 5 - PROD Smart Form Validation" -ForegroundColor Cyan
Write-Host ""

# Check for GitHub token
if (-not $GitHubToken) {
    Write-Host "❌ ERROR: GITHUB_TOKEN environment variable not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set your GitHub personal access token:" -ForegroundColor Yellow
    Write-Host "  `$env:GITHUB_TOKEN = 'your-token-here'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or create one at: https://github.com/settings/tokens" -ForegroundColor Yellow
    Write-Host "Required scopes: repo, workflow" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ GitHub token found (${GitHubToken.Substring(0, 4)}...)" -ForegroundColor Green
Write-Host ""

# GitHub API base URL
$apiBase = "https://api.github.com"
$headers = @{
    "Authorization" = "token $GitHubToken"
    "Accept" = "application/vnd.github.v3+json"
}

# Step 1: Verify repository access
Write-Host "1️⃣ Verifying repository access..." -ForegroundColor Cyan
try {
    $repoUrl = "$apiBase/repos/$RepoOwner/$RepoName"
    $repo = Invoke-RestMethod -Uri $repoUrl -Headers $headers -Method Get
    Write-Host "   ✅ Repository: $($repo.full_name)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed to access repository: $RepoOwner/$RepoName" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 2: Verify secrets (list names only, no values)
Write-Host "2️⃣ Verifying required secrets..." -ForegroundColor Cyan
$requiredSecrets = @(
    "SUPABASE_URL_PROD",
    "SUPABASE_SERVICE_ROLE_KEY_PROD",
    "SUPABASE_ANON_KEY_PROD",
    "SUPABASE_PROJECT_REF_PROD"
)

try {
    $secretsUrl = "$apiBase/repos/$RepoOwner/$RepoName/actions/secrets"
    $secrets = Invoke-RestMethod -Uri $secretsUrl -Headers $headers -Method Get
    $secretNames = $secrets.secrets | ForEach-Object { $_.name }

    $missingSecrets = @()
    foreach ($secretName in $requiredSecrets) {
        if ($secretNames -contains $secretName) {
            Write-Host "   ✅ $secretName" -ForegroundColor Green
        } else {
            Write-Host "   ❌ $secretName - MISSING" -ForegroundColor Red
            $missingSecrets += $secretName
        }
    }

    if ($missingSecrets.Count -gt 0) {
        Write-Host ""
        Write-Host "❌ BLOCKING: Missing required secrets:" -ForegroundColor Red
        $missingSecrets | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
        Write-Host ""
        Write-Host "Please configure these secrets in GitHub repository settings:" -ForegroundColor Yellow
        Write-Host "  https://github.com/$RepoOwner/$RepoName/settings/secrets/actions" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "   ⚠️  Warning: Could not verify secrets (may require admin access)" -ForegroundColor Yellow
    Write-Host "   Proceeding with workflow trigger..." -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Trigger workflow
Write-Host "3️⃣ Triggering workflow: phase5-prod-validation.yml..." -ForegroundColor Cyan
try {
    $triggerUrl = "$apiBase/repos/$RepoOwner/$RepoName/actions/workflows/phase5-prod-validation.yml/dispatches"
    $body = @{
        ref = "main"
        inputs = @{
            skip_test_data_creation = $false
            cleanup_test_data = $false
        }
    } | ConvertTo-Json

    Invoke-RestMethod -Uri $triggerUrl -Headers $headers -Method Post -Body $body -ContentType "application/json"
    Write-Host "   ✅ Workflow triggered successfully" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed to trigger workflow" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Wait for workflow run to appear
Write-Host "4️⃣ Waiting for workflow run to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

# Get latest workflow run
try {
    $runsUrl = "$apiBase/repos/$RepoOwner/$RepoName/actions/workflows/phase5-prod-validation.yml/runs?per_page=1"
    $runs = Invoke-RestMethod -Uri $runsUrl -Headers $headers -Method Get

    if ($runs.workflow_runs.Count -eq 0) {
        Write-Host "   ❌ No workflow runs found" -ForegroundColor Red
        exit 1
    }

    $run = $runs.workflow_runs[0]
    $runId = $run.id
    $runUrl = $run.html_url

    Write-Host "   ✅ Workflow run started" -ForegroundColor Green
    Write-Host "   Run ID: $runId" -ForegroundColor Cyan
    Write-Host "   URL: $runUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Monitor progress at: $runUrl" -ForegroundColor Yellow

    # Save run ID for artifact download
    $runId | Out-File -FilePath ".\out\phase5-run-id.txt" -NoNewline
    Write-Host "   ✅ Run ID saved to: .\out\phase5-run-id.txt" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed to get workflow run" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "✅ PHASE 5 workflow triggered successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Monitor workflow progress at: $runUrl" -ForegroundColor White
Write-Host "2. When complete, run artifact download script" -ForegroundColor White
Write-Host "3. Review results and generate final verdict" -ForegroundColor White
Write-Host ""
Write-Host "Estimated completion time: 20-25 minutes" -ForegroundColor Yellow
