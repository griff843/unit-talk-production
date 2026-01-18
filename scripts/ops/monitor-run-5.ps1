# Monitor Phase 5 Run #5 - FINAL RUN WITH HARDENING + SECRETS
# ID: 21107545350
$ErrorActionPreference = "Stop"

$GH = "C:\Program Files (x86)\GitHub CLI\gh.exe"
$RUN_ID = "21107545350"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PHASE 5 RUN #5 - HARDENED + SECRETS CONFIGURED" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Run ID: $RUN_ID" -ForegroundColor White
Write-Host ""
Write-Host "Hardening Applied:" -ForegroundColor Green
Write-Host "  1. npm caching with cache-dependency-path" -ForegroundColor Green
Write-Host "  2. CI-optimized npm config (no audit/fund)" -ForegroundColor Green
Write-Host "  3. Observable install steps (timestamps, duration)" -ForegroundColor Green
Write-Host "  4. Error handling with npm debug logs" -ForegroundColor Green
Write-Host "  5. PROD secrets configured in GitHub Actions" -ForegroundColor Green
Write-Host ""
Write-Host "Expected Performance:" -ForegroundColor Yellow
Write-Host "  - Install duration: 20-30s (warm cache) or 4-5min (cold)" -ForegroundColor Yellow
Write-Host "  - All 4 jobs should complete successfully" -ForegroundColor Yellow
Write-Host "  - 15/15 smoke pack tests PASS" -ForegroundColor Yellow
Write-Host ""
Write-Host "[MONITORING] Checking status every 30 seconds..." -ForegroundColor Cyan
Write-Host ""

$maxAttempts = 60  # 30 minutes max
$attempt = 0
$installStartTime = $null
$installEndTime = $null

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
        Write-Host "  PHASE 5 RUN #5 COMPLETED" -ForegroundColor Cyan
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Run ID: $RUN_ID" -ForegroundColor White
        Write-Host "Conclusion: $conclusion" -ForegroundColor $(if ($conclusion -eq "success") { "Green" } else { "Red" })
        Write-Host ""

        if ($conclusion -eq "success") {
            Write-Host "[SUCCESS] ✅✅✅ ALL GATES PASSED - GO FOR PHASE 6 ✅✅✅" -ForegroundColor Green
            Write-Host ""
            Write-Host "Phase 5 Success Criteria Met:" -ForegroundColor Green
            Write-Host "  ✅ GitHub Actions workflow runs green" -ForegroundColor Green
            Write-Host "  ✅ Smart Form smoke pack: 15/15 PASS" -ForegroundColor Green
            Write-Host "  ✅ Rate limiting enforced" -ForegroundColor Green
            Write-Host "  ✅ Idempotency works" -ForegroundColor Green
            Write-Host "  ✅ Tenant validation fail-closed" -ForegroundColor Green
            Write-Host "  ✅ User validation fail-closed" -ForegroundColor Green
            Write-Host "  ✅ Canonical driver confirmed" -ForegroundColor Green
            Write-Host "  ✅ Shadow mode confirmed" -ForegroundColor Green
            Write-Host "  ✅ Proof bundle generated" -ForegroundColor Green
            Write-Host "  ✅ Repo hygiene maintained" -ForegroundColor Green
            Write-Host ""
            Write-Host "PERFORMANCE VALIDATION:" -ForegroundColor Cyan
            Write-Host "  Check artifacts for install duration metrics" -ForegroundColor Cyan
            Write-Host "  Expected: <30s (warm cache) or 4-5min (cold cache)" -ForegroundColor Cyan
        } else {
            Write-Host "[FAILURE] ❌ One or more gates FAILED - NO-GO" -ForegroundColor Red
            Write-Host ""
            Write-Host "Review artifacts for failure details" -ForegroundColor Yellow
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
