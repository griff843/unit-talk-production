# PHASE 5 - Monitor Workflow Execution
# Polls GitHub API for workflow status and downloads artifacts when complete

param(
    [string]$GitHubToken = $env:GITHUB_TOKEN,
    [string]$RepoOwner = "your-org",
    [string]$RepoName = "unit-talk-production-main",
    [string]$RunId
)

$ErrorActionPreference = "Stop"

Write-Host "📊 PHASE 5 - Monitoring Workflow Execution" -ForegroundColor Cyan
Write-Host ""

# Check for GitHub token
if (-not $GitHubToken) {
    Write-Host "❌ ERROR: GITHUB_TOKEN environment variable not set" -ForegroundColor Red
    exit 1
}

# Load run ID if not provided
if (-not $RunId) {
    if (Test-Path ".\out\phase5-run-id.txt") {
        $RunId = Get-Content ".\out\phase5-run-id.txt"
        Write-Host "✅ Loaded Run ID: $RunId" -ForegroundColor Green
    } else {
        Write-Host "❌ ERROR: No run ID provided and .\out\phase5-run-id.txt not found" -ForegroundColor Red
        Write-Host ""
        Write-Host "Usage: .\scripts\phase5-monitor.ps1 -RunId <run-id>" -ForegroundColor Yellow
        exit 1
    }
}
Write-Host ""

$apiBase = "https://api.github.com"
$headers = @{
    "Authorization" = "token $GitHubToken"
    "Accept" = "application/vnd.github.v3+json"
}

$runUrl = "$apiBase/repos/$RepoOwner/$RepoName/actions/runs/$RunId"
$jobsUrl = "$apiBase/repos/$RepoOwner/$RepoName/actions/runs/$RunId/jobs"

Write-Host "Monitoring run: $RunId" -ForegroundColor Cyan
Write-Host "View in browser: https://github.com/$RepoOwner/$RepoName/actions/runs/$RunId" -ForegroundColor Yellow
Write-Host ""

$statusEmoji = @{
    "queued" = "⏳"
    "in_progress" = "🔄"
    "completed" = "✅"
    "failed" = "❌"
    "cancelled" = "🚫"
}

$conclusionEmoji = @{
    "success" = "✅"
    "failure" = "❌"
    "cancelled" = "🚫"
    "skipped" = "⏭️"
}

# Poll until complete
$maxPolls = 120  # 120 * 15s = 30 minutes max
$pollCount = 0
$lastStatus = ""

while ($pollCount -lt $maxPolls) {
    try {
        $run = Invoke-RestMethod -Uri $runUrl -Headers $headers -Method Get
        $jobs = Invoke-RestMethod -Uri $jobsUrl -Headers $headers -Method Get

        $status = $run.status
        $conclusion = $run.conclusion

        # Only print update if status changed
        if ($status -ne $lastStatus) {
            $emoji = $statusEmoji[$status]
            Write-Host "$emoji Status: $status" -ForegroundColor Cyan

            foreach ($job in $jobs.jobs) {
                $jobEmoji = if ($job.conclusion) { $conclusionEmoji[$job.conclusion] } else { $statusEmoji[$job.status] }
                $jobStatus = if ($job.conclusion) { $job.conclusion } else { $job.status }
                Write-Host "   $jobEmoji $($job.name): $jobStatus" -ForegroundColor Gray
            }
            Write-Host ""
            $lastStatus = $status
        }

        # Check if workflow completed
        if ($status -eq "completed") {
            Write-Host ""
            Write-Host "🎉 Workflow completed!" -ForegroundColor Green
            Write-Host "   Conclusion: $conclusion" -ForegroundColor $(if ($conclusion -eq "success") { "Green" } else { "Red" })
            Write-Host ""

            # Show job details
            Write-Host "📊 Job Summary:" -ForegroundColor Cyan
            foreach ($job in $jobs.jobs) {
                $emoji = $conclusionEmoji[$job.conclusion]
                Write-Host "   $emoji $($job.name): $($job.conclusion)" -ForegroundColor $(if ($job.conclusion -eq "success") { "Green" } else { "Red" })
            }
            Write-Host ""

            # Download artifacts
            Write-Host "📦 Downloading artifacts..." -ForegroundColor Cyan
            $artifactsUrl = "$apiBase/repos/$RepoOwner/$RepoName/actions/runs/$RunId/artifacts"
            $artifacts = Invoke-RestMethod -Uri $artifactsUrl -Headers $headers -Method Get

            $outputDir = ".\out\phase5-prod-validation\$RunId"
            New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

            if ($artifacts.artifacts.Count -eq 0) {
                Write-Host "   ⚠️  No artifacts found" -ForegroundColor Yellow
            } else {
                foreach ($artifact in $artifacts.artifacts) {
                    Write-Host "   Downloading: $($artifact.name)" -ForegroundColor Gray
                    $downloadUrl = "$apiBase/repos/$RepoOwner/$RepoName/actions/artifacts/$($artifact.id)/zip"
                    $zipPath = "$outputDir\$($artifact.name).zip"

                    Invoke-RestMethod -Uri $downloadUrl -Headers $headers -Method Get -OutFile $zipPath

                    # Extract zip
                    $extractPath = "$outputDir\$($artifact.name)"
                    Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
                    Remove-Item $zipPath

                    Write-Host "      ✅ Extracted to: $extractPath" -ForegroundColor Green
                }
            }

            Write-Host ""
            Write-Host "✅ Artifacts downloaded to: $outputDir" -ForegroundColor Green
            Write-Host ""

            # Save summary
            $summary = @{
                run_id = $RunId
                status = $status
                conclusion = $conclusion
                started_at = $run.created_at
                completed_at = $run.updated_at
                url = $run.html_url
                jobs = $jobs.jobs | ForEach-Object {
                    @{
                        name = $_.name
                        conclusion = $_.conclusion
                        started_at = $_.started_at
                        completed_at = $_.completed_at
                    }
                }
                artifacts_dir = $outputDir
            } | ConvertTo-Json -Depth 10

            $summary | Out-File -FilePath "$outputDir\workflow-summary.json"
            Write-Host "📄 Summary saved to: $outputDir\workflow-summary.json" -ForegroundColor Cyan
            Write-Host ""

            if ($conclusion -eq "success") {
                Write-Host "✅ WORKFLOW SUCCEEDED" -ForegroundColor Green
                exit 0
            } else {
                Write-Host "❌ WORKFLOW FAILED" -ForegroundColor Red
                Write-Host ""
                Write-Host "Failed jobs:" -ForegroundColor Red
                foreach ($job in $jobs.jobs | Where-Object { $_.conclusion -ne "success" }) {
                    Write-Host "   - $($job.name): $($job.conclusion)" -ForegroundColor Red
                    Write-Host "     Log: $($job.html_url)" -ForegroundColor Gray
                }
                exit 1
            }
        }

        # Wait before next poll
        Start-Sleep -Seconds 15
        $pollCount++

    } catch {
        Write-Host "❌ Error polling workflow status: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host "⏰ Timeout: Workflow did not complete within 30 minutes" -ForegroundColor Red
exit 1
