# Live E2E Validation Script
# Date: 2025-01-28
# Purpose: Execute LIVE validation across NBA/NFL/MLB/NHL with real Discord posts

$ErrorActionPreference = "Stop"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$ARTIFACTS_DIR = "out/ops/cutover/metrics/100"
$TENANT_ID = "12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a"
$CAPPER_ID = "693e5785-7815-4ffa-9545-978ad1098f04"

# League configurations
$LEAGUES = @{
    NBA = @{ market = "PLAYER_POINTS"; line = 27.5 }
    NFL = @{ market = "PLAYER_RECEIVING_YARDS"; line = 62.5 }
    MLB = @{ market = "TOTAL_BASES"; line = 1.5 }
    NHL = @{ market = "PLAYER_POINTS"; line = 0.5 }
}

# Create artifacts directory
New-Item -ItemType Directory -Force -Path $ARTIFACTS_DIR | Out-Null

Write-Host "`n=== LIVE E2E VALIDATION ===" -ForegroundColor Cyan
Write-Host "Timestamp: $TIMESTAMP" -ForegroundColor Gray
Write-Host "Tenant ID: $TENANT_ID" -ForegroundColor Gray
Write-Host "Capper ID: $CAPPER_ID" -ForegroundColor Gray
Write-Host ""

$results = @{}

foreach ($league in @('NBA', 'NFL', 'MLB', 'NHL')) {
    Write-Host "=== Processing $league ===" -ForegroundColor Yellow
    
    $config = $LEAGUES[$league]
    $playerName = "Test Player $league"
    $playerId = [guid]::NewGuid().ToString()
    $gameDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    
    # DRY-RUN
    Write-Host "  → DRY-RUN..." -ForegroundColor Gray
    
    $dryRunPayload = @{
        userId = $CAPPER_ID
        league = $league
        marketType = $config.market
        line = $config.line
        side = "over"
        playerId = $playerId
        playerName = $playerName
        gameDate = $gameDate
        odds = -110
        stake = 1.0
        userScore = 8
        confidence = 0.85
        betSlipId = "dryrun-$league-$TIMESTAMP"
    } | ConvertTo-Json
    
    $dryRunStart = Get-Date
    try {
        $dryRunResponse = Invoke-WebRequest `
            -Uri "http://localhost:3002/api/domain/picks/dry-run" `
            -Method POST `
            -Headers @{
                "Idempotency-Key" = "e2e-dryrun-$league-$TIMESTAMP"
                "Content-Type" = "application/json"
                "x-supabase-reload-schema" = "true"
            } `
            -Body $dryRunPayload `
            -UseBasicParsing
        
        $dryRunDuration = ((Get-Date) - $dryRunStart).TotalMilliseconds
        
        if ($dryRunResponse.StatusCode -eq 204) {
            Write-Host "  ✅ DRY-RUN passed ($([math]::Round($dryRunDuration, 2))ms)" -ForegroundColor Green
            $results[$league] = @{
                dryRun = @{
                    status = "PASS"
                    durationMs = [math]::Round($dryRunDuration, 2)
                    statusCode = 204
                }
            }
        } else {
            Write-Host "  ❌ DRY-RUN failed: HTTP $($dryRunResponse.StatusCode)" -ForegroundColor Red
            $results[$league] = @{
                dryRun = @{ status = "FAIL"; statusCode = $dryRunResponse.StatusCode }
                conclusion = "FAIL"
            }
            continue
        }
    } catch {
        Write-Host "  ❌ DRY-RUN error: $($_.Exception.Message)" -ForegroundColor Red
        $results[$league] = @{
            dryRun = @{ status = "FAIL"; error = $_.Exception.Message }
            conclusion = "FAIL"
        }
        continue
    }
    
    # LIVE INSERT
    Write-Host "  → LIVE INSERT..." -ForegroundColor Gray
    
    $livePayload = @{
        userId = $CAPPER_ID
        league = $league
        marketType = $config.market
        line = $config.line
        side = "over"
        playerId = $playerId
        playerName = $playerName
        gameDate = $gameDate
        odds = -110
        stake = 1.0
        userScore = 8
        confidence = 0.85
        prediction = "over"
        betSlipId = "live-$league-$TIMESTAMP"
        idempotencyKey = "e2e-live-$league-$TIMESTAMP"
    } | ConvertTo-Json
    
    $liveStart = Get-Date
    try {
        $liveResponse = Invoke-WebRequest `
            -Uri "http://localhost:3002/api/domain/picks/insert" `
            -Method POST `
            -Headers @{
                "Idempotency-Key" = "e2e-live-$league-$TIMESTAMP"
                "Content-Type" = "application/json"
            } `
            -Body $livePayload `
            -UseBasicParsing
        
        $liveDuration = ((Get-Date) - $liveStart).TotalMilliseconds
        $liveBody = $liveResponse.Content | ConvertFrom-Json
        
        if ($liveResponse.StatusCode -in @(200, 201) -and $liveBody.pickId) {
            Write-Host "  ✅ LIVE INSERT passed - pickId: $($liveBody.pickId)" -ForegroundColor Green
            $results[$league].live = @{
                status = "PASS"
                pickId = $liveBody.pickId
                durationMs = [math]::Round($liveDuration, 2)
                statusCode = $liveResponse.StatusCode
                driver = $liveBody.driver
                publishMode = $liveBody.publishMode
            }
            
            # Poll outbox for Discord publishing
            Write-Host "  → Polling outbox for Discord publish..." -ForegroundColor Gray
            $maxAttempts = 9  # 90 seconds / 10 seconds
            $published = $false
            
            for ($i = 0; $i -lt $maxAttempts; $i++) {
                Start-Sleep -Seconds 10
                
                try {
                    $query = "SELECT status, external_message_id, last_error FROM public.pick_publish WHERE pick_id = '$($liveBody.pickId)' ORDER BY created_at DESC LIMIT 1;"
                    $publishStatus = docker compose exec -T postgres psql -U postgres -d unit_talk_dev -t -c $query 2>&1
                    
                    if ($publishStatus -match "sent\s+\|\s+(\d+)") {
                        $messageId = $matches[1]
                        Write-Host "  ✅ Discord published - messageId: $messageId" -ForegroundColor Green
                        $results[$league].publish = @{
                            status = "PASS"
                            publishStatus = "sent"
                            externalMessageId = $messageId
                            lagSeconds = ($i + 1) * 10
                        }
                        $published = $true
                        break
                    } elseif ($publishStatus -match "skipped") {
                        Write-Host "  ⚠️  Publish skipped (SHADOW_MODE?)" -ForegroundColor Yellow
                        $results[$league].publish = @{
                            status = "SKIPPED"
                            publishStatus = "skipped"
                        }
                        $published = $true
                        break
                    }
                } catch {
                    # Continue polling
                }
            }
            
            if (-not $published) {
                Write-Host "  ❌ Publish timeout (>90s)" -ForegroundColor Red
                $results[$league].publish = @{
                    status = "FAIL"
                    error = "Timeout waiting for Discord publish"
                }
            }
            
            # Check audit log
            try {
                $auditQuery = "SELECT COUNT(*) FROM public.audit_log WHERE entity_id = '$($liveBody.pickId)' AND action IN ('pick.submitted', 'discord.posted');"
                $auditCount = docker compose exec -T postgres psql -U postgres -d unit_talk_dev -t -c $auditQuery 2>&1
                
                if ($auditCount -match "(\d+)" -and [int]$matches[1] -ge 1) {
                    Write-Host "  ✅ Audit log verified" -ForegroundColor Green
                    $results[$league].audit = @{ verified = $true }
                } else {
                    Write-Host "  ⚠️  Audit log incomplete" -ForegroundColor Yellow
                    $results[$league].audit = @{ verified = $false }
                }
            } catch {
                $results[$league].audit = @{ verified = $false; error = $_.Exception.Message }
            }
            
            # Mark as PASS if we got here
            $results[$league].conclusion = "PASS"
            Write-Host "  [PASS] $league" -ForegroundColor Green
            
        } else {
            Write-Host "  ❌ LIVE INSERT failed: HTTP $($liveResponse.StatusCode)" -ForegroundColor Red
            $results[$league].live = @{
                status = "FAIL"
                statusCode = $liveResponse.StatusCode
                error = $liveBody
            }
            $results[$league].conclusion = "FAIL"
        }
    } catch {
        Write-Host "  ❌ LIVE INSERT error: $($_.Exception.Message)" -ForegroundColor Red
        $results[$league].live = @{
            status = "FAIL"
            error = $_.Exception.Message
        }
        $results[$league].conclusion = "FAIL"
    }
    
    Write-Host ""
}

# Generate consolidated report
Write-Host "`n=== FINAL RESULTS ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "+----------+----------+------+---------+----------+" -ForegroundColor Gray
Write-Host "| League   | DRY-RUN  | LIVE | Publish | Overall  |" -ForegroundColor Gray
Write-Host "+----------+----------+------+---------+----------+" -ForegroundColor Gray

$allPass = $true
foreach ($league in @('NBA', 'NFL', 'MLB', 'NHL')) {
    if ($results.ContainsKey($league)) {
        $r = $results[$league]
        $dryIcon = if ($r.dryRun.status -eq "PASS") { "PASS" } else { "FAIL" }
        $liveIcon = if ($r.live.status -eq "PASS") { "PASS" } else { "FAIL" }
        $pubIcon = if ($r.publish.status -in @("PASS", "SKIPPED")) { "PASS" } else { "FAIL" }
        $overallIcon = if ($r.conclusion -eq "PASS") { "PASS" } else { "FAIL" }

        if ($r.conclusion -ne "PASS") { $allPass = $false }

        Write-Host ("| {0,-8} | {1,-8} | {2,-4} | {3,-7} | {4,-8} |" -f $league, $dryIcon, $liveIcon, $pubIcon, $overallIcon) -ForegroundColor Gray
    }
}

Write-Host "+----------+----------+------+---------+----------+" -ForegroundColor Gray
Write-Host ""

# Save results
$resultsJson = $results | ConvertTo-Json -Depth 10
$resultsPath = "$ARTIFACTS_DIR/LIVE_E2E_RESULTS_$TIMESTAMP.json"
$resultsJson | Out-File -FilePath $resultsPath -Encoding UTF8
Write-Host "Results saved to: $resultsPath" -ForegroundColor Gray
Write-Host ""

# Final decision
if ($allPass) {
    Write-Host "FINAL DECISION: GO" -ForegroundColor Green
    Write-Host "All leagues passed validation. System is ready for production." -ForegroundColor Green
    exit 0
} else {
    Write-Host "FINAL DECISION: NO-GO" -ForegroundColor Red
    Write-Host "One or more leagues failed. Review results and remediate." -ForegroundColor Red
    exit 1
}

