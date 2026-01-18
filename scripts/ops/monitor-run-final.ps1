# Monitor Phase 5 Run #3 (FINAL) - ID: 21106577569
$ErrorActionPreference = "Stop"

$GH = "C:\Program Files (x86)\GitHub CLI\gh.exe"
$RUN_ID = "21106577569"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PHASE 5 RUN #3 - FINAL ATTEMPT" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Run ID: $RUN_ID" -ForegroundColor White
Write-Host "Fixes applied:" -ForegroundColor Yellow
Write-Host "  1. Monorepo install strategy (npm ci at root)" -ForegroundColor Green
Write-Host "  2. package-lock.json synced with package.json" -ForegroundColor Green
Write-Host ""
Write-Host "[MONITORING] Checking status every 30 seconds..." -ForegroundColor Cyan
Write-Host ""

$maxAttempts = 60  # 30 minutes max
$attempt = 0

while ($attempt -lt $maxAttempts) {
    $attempt++

    # Get run status
    $runJson = & $GH run list --workflow=phase5-prod-validation.yml --limit 5 --json databaseId,conclusion,status,updatedAt | ConvertFrom-Json | Where-Object { $_.databaseId -eq $RUN_ID }

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
        Write-Host "[$timestamp] [COMPLETED] Conclusion: $conclusion" -ForegroundColor $(if ($conclusion -eq "success") { "Green" } else { "Red" })

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
        Write-Host "  PHASE 5 RUN #3 COMPLETED" -ForegroundColor Cyan
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Run ID: $RUN_ID" -ForegroundColor White
        Write-Host "Conclusion: $conclusion" -ForegroundColor $(if ($conclusion -eq "success") { "Green" } else { "Red" })
        Write-Host ""

        if ($conclusion -eq "success") {
            Write-Host "[SUCCESS] All gates PASSED - GO FOR PHASE 6" -ForegroundColor Green
        } else {
            Write-Host "[FAILURE] One or more gates FAILED - NO-GO" -ForegroundColor Red
        }

        Write-Host ""
        Write-Host "Artifacts: $artifactDir" -ForegroundColor White
        Write-Host "Proof Bundle: $artifactDir\phase5-final-proof-bundle\PHASE5_PROD_PROOF_BUNDLE.md" -ForegroundColor White
        Write-Host "GitHub URL: https://github.com/griff843/unit-talk-production/actions/runs/$RUN_ID" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host ""

        exit 0
    }
    elseif ($status -eq "in_progress" -or $status -eq "queued") {
        Write-Host "[$timestamp] [RUNNING] Status: $status (elapsed: $($attempt * 30)s)" -ForegroundColor Yellow
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
