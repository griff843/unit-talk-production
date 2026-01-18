# Monitor Phase 5 Run Until Completion
$ErrorActionPreference = "Stop"

$GH = "C:\Program Files (x86)\GitHub CLI\gh.exe"
$RUN_ID = "21106534314"

Write-Host "[MONITORING] Phase 5 Run ID: $RUN_ID" -ForegroundColor Cyan
Write-Host "[MONITORING] Checking status every 30 seconds..." -ForegroundColor Cyan
Write-Host ""

$maxAttempts = 60  # 30 minutes max
$attempt = 0

while ($attempt -lt $maxAttempts) {
    $attempt++

    # Get run status
    $runJson = & $GH run list --workflow=phase5-prod-validation.yml --limit 1 --json databaseId,conclusion,status,updatedAt | ConvertFrom-Json | Where-Object { $_.databaseId -eq $RUN_ID }

    if (-not $runJson) {
        Write-Host "[ERROR] Run $RUN_ID not found!" -ForegroundColor Red
        exit 1
    }

    $status = $runJson.status
    $conclusion = $runJson.conclusion
    $updated = $runJson.updatedAt

    $timestamp = Get-Date -Format "HH:mm:ss"

    if ($status -eq "completed") {
        Write-Host ""
        Write-Host "[$timestamp] [COMPLETED] Status: $status | Conclusion: $conclusion" -ForegroundColor Green

        # Download artifacts
        Write-Host ""
        Write-Host "[ARTIFACTS] Downloading artifacts..." -ForegroundColor Cyan
        $artifactDir = "out\phase5-prod-validation\$RUN_ID"
        New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null

        try {
            & $GH run download $RUN_ID --dir $artifactDir
            Write-Host "[ARTIFACTS] Downloaded to: $artifactDir" -ForegroundColor Green
        }
        catch {
            Write-Host "[WARNING] No artifacts available or download failed" -ForegroundColor Yellow
        }

        # Save run ID
        $RUN_ID | Out-File "out\phase5-prod-validation\latest-run-id.txt" -Encoding ASCII

        Write-Host ""
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host "  PHASE 5 COMPLETED" -ForegroundColor Cyan
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host "Run ID: $RUN_ID" -ForegroundColor White
        Write-Host "Conclusion: $conclusion" -ForegroundColor $(if ($conclusion -eq "success") { "Green" } else { "Red" })
        Write-Host "Artifacts: $artifactDir" -ForegroundColor White
        Write-Host "GitHub URL: https://github.com/griff843/unit-talk-production/actions/runs/$RUN_ID" -ForegroundColor Cyan
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host ""

        exit 0
    }
    elseif ($status -eq "in_progress" -or $status -eq "queued") {
        Write-Host "[$timestamp] [RUNNING] Status: $status | Updated: $updated" -ForegroundColor Yellow
        Start-Sleep -Seconds 30
    }
    else {
        Write-Host "[$timestamp] [UNKNOWN] Status: $status | Conclusion: $conclusion" -ForegroundColor Red
        Start-Sleep -Seconds 30
    }
}

Write-Host ""
Write-Host "[TIMEOUT] Workflow did not complete within 30 minutes" -ForegroundColor Red
exit 1
