# PHASE 5 - Analyze Results and Generate Verdict
# Examines downloaded artifacts and produces final GO/NO-GO verdict

param(
    [string]$RunId,
    [string]$ArtifactsDir
)

$ErrorActionPreference = "Stop"

Write-Host "🔍 PHASE 5 - Results Analysis" -ForegroundColor Cyan
Write-Host ""

# Load run ID if not provided
if (-not $RunId -and (Test-Path ".\out\phase5-run-id.txt")) {
    $RunId = Get-Content ".\out\phase5-run-id.txt"
}

# Determine artifacts directory
if (-not $ArtifactsDir) {
    if ($RunId) {
        $ArtifactsDir = ".\out\phase5-prod-validation\$RunId"
    } else {
        Write-Host "❌ ERROR: No run ID or artifacts directory provided" -ForegroundColor Red
        exit 1
    }
}

if (-not (Test-Path $ArtifactsDir)) {
    Write-Host "❌ ERROR: Artifacts directory not found: $ArtifactsDir" -ForegroundColor Red
    exit 1
}

Write-Host "Analyzing artifacts from: $ArtifactsDir" -ForegroundColor Cyan
Write-Host ""

# Initialize results
$results = @{
    run_id = $RunId
    timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC"
    checks = @{}
    verdict = "UNKNOWN"
    evidence = @()
}

# Check 1: Schema Parity
Write-Host "1️⃣ Checking schema parity..." -ForegroundColor Cyan
$schemaFile = Get-ChildItem -Path $ArtifactsDir -Filter "*schema*" -Recurse -File | Select-Object -First 1
if ($schemaFile) {
    $schemaContent = Get-Content $schemaFile.FullName -Raw
    $schemaPassed = $schemaContent -match "All 7 Smart Form tables exist"
    $results.checks.schema_parity = $schemaPassed
    Write-Host "   $(if ($schemaPassed) { '✅' } else { '❌' }) Schema parity: $(if ($schemaPassed) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($schemaPassed) { 'Green' } else { 'Red' })
    $results.evidence += "Schema verification: $($schemaFile.FullName)"
} else {
    $results.checks.schema_parity = $false
    Write-Host "   ❌ Schema parity: MISSING EVIDENCE" -ForegroundColor Red
}

# Check 2: Test Data Creation
Write-Host "2️⃣ Checking test data creation..." -ForegroundColor Cyan
$testDataFile = Get-ChildItem -Path $ArtifactsDir -Filter "*test-data*" -Recurse -File | Select-Object -First 1
if ($testDataFile) {
    $testDataContent = Get-Content $testDataFile.FullName -Raw
    $testDataPassed = $testDataContent -match "Tenant created" -and $testDataContent -match "User created"
    $results.checks.test_data = $testDataPassed
    Write-Host "   $(if ($testDataPassed) { '✅' } else { '❌' }) Test data: $(if ($testDataPassed) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($testDataPassed) { 'Green' } else { 'Red' })

    # Extract tenant and user IDs
    if ($testDataContent -match "Tenant ID:\s*([a-f0-9-]+)") {
        $tenantId = $Matches[1]
        $results.tenant_id = $tenantId
        Write-Host "      Tenant ID: $tenantId" -ForegroundColor Gray
    }
    if ($testDataContent -match "User ID:\s*([a-f0-9-]+)") {
        $userId = $Matches[1]
        $results.user_id = $userId
        Write-Host "      User ID: $userId" -ForegroundColor Gray
    }
} else {
    $results.checks.test_data = $false
    Write-Host "   ❌ Test data: MISSING EVIDENCE" -ForegroundColor Red
}

# Check 3: Smoke Pack Results (CRITICAL: Must be 15/15)
Write-Host "3️⃣ Checking smoke pack results..." -ForegroundColor Cyan
$smokePackFile = Get-ChildItem -Path $ArtifactsDir -Filter "*smoke-pack*" -Recurse -File | Select-Object -First 1
if ($smokePackFile) {
    $smokePackContent = Get-Content $smokePackFile.FullName -Raw

    # Parse test results
    if ($smokePackContent -match "(\d+) passed") {
        $passedTests = [int]$Matches[1]
        $results.smoke_pack_passed = $passedTests

        # HARD REQUIREMENT: Must be 15/15
        $smokePackPassed = $passedTests -eq 15

        Write-Host "   $(if ($smokePackPassed) { '✅' } else { '❌' }) Smoke pack: $passedTests/15 $(if ($smokePackPassed) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($smokePackPassed) { 'Green' } else { 'Red' })

        if (-not $smokePackPassed) {
            Write-Host "      ❌ BLOCKING: Requires 15/15 tests passing (got $passedTests/15)" -ForegroundColor Red
        }

        $results.checks.smoke_pack = $smokePackPassed
    } else {
        $results.checks.smoke_pack = $false
        Write-Host "   ❌ Smoke pack: COULD NOT PARSE RESULTS" -ForegroundColor Red
    }

    $results.evidence += "Smoke pack output: $($smokePackFile.FullName)"
} else {
    $results.checks.smoke_pack = $false
    Write-Host "   ❌ Smoke pack: MISSING EVIDENCE" -ForegroundColor Red
}

# Check 4: Canonical Driver
Write-Host "4️⃣ Checking canonical driver..." -ForegroundColor Cyan
if ($smokePackFile) {
    $canonicalPassed = $smokePackContent -match 'driver.*canonical'
    $results.checks.canonical_driver = $canonicalPassed
    Write-Host "   $(if ($canonicalPassed) { '✅' } else { '❌' }) Canonical driver: $(if ($canonicalPassed) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($canonicalPassed) { 'Green' } else { 'Red' })
} else {
    $results.checks.canonical_driver = $false
    Write-Host "   ❌ Canonical driver: NO EVIDENCE" -ForegroundColor Red
}

# Check 5: Shadow Mode (No Discord Publish)
Write-Host "5️⃣ Checking shadow mode..." -ForegroundColor Cyan
if ($smokePackFile) {
    $shadowPassed = $smokePackContent -match 'publishMode.*shadow' -or $smokePackContent -match 'autoPublish.*false'
    $results.checks.shadow_mode = $shadowPassed
    Write-Host "   $(if ($shadowPassed) { '✅' } else { '❌' }) Shadow mode: $(if ($shadowPassed) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($shadowPassed) { 'Green' } else { 'Red' })
} else {
    $results.checks.shadow_mode = $false
    Write-Host "   ❌ Shadow mode: NO EVIDENCE" -ForegroundColor Red
}

# Check 6: Rate Limiting
Write-Host "6️⃣ Checking rate limiting..." -ForegroundColor Cyan
if ($smokePackFile) {
    $rateLimitPassed = $smokePackContent -match '429.*Too Many Requests' -or $smokePackContent -match 'rateLimitedCount.*[1-9]'
    $results.checks.rate_limiting = $rateLimitPassed
    Write-Host "   $(if ($rateLimitPassed) { '✅' } else { '❌' }) Rate limiting: $(if ($rateLimitPassed) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($rateLimitPassed) { 'Green' } else { 'Red' })
} else {
    $results.checks.rate_limiting = $false
    Write-Host "   ❌ Rate limiting: NO EVIDENCE" -ForegroundColor Red
}

# Check 7: DB Isolation
Write-Host "7️⃣ Checking DB isolation..." -ForegroundColor Cyan
$isolationFile = Get-ChildItem -Path $ArtifactsDir -Filter "*isolation*" -Recurse -File | Select-Object -First 1
if ($isolationFile) {
    $isolationContent = Get-Content $isolationFile.FullName -Raw
    $isolationPassed = $isolationContent -match "DB ISOLATION VERIFIED"
    $results.checks.db_isolation = $isolationPassed
    Write-Host "   $(if ($isolationPassed) { '✅' } else { '❌' }) DB isolation: $(if ($isolationPassed) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($isolationPassed) { 'Green' } else { 'Red' })
    $results.evidence += "Isolation verification: $($isolationFile.FullName)"
} else {
    $results.checks.db_isolation = $false
    Write-Host "   ❌ DB isolation: MISSING EVIDENCE" -ForegroundColor Red
}

Write-Host ""

# Generate Final Verdict
$allChecksPassed = ($results.checks.Values | Where-Object { $_ -eq $false }).Count -eq 0

if ($allChecksPassed) {
    $results.verdict = "✅ GO - PROD READY"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "✅ VERDICT: GO - PROD READY" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    Write-Host "All validation gates passed:" -ForegroundColor Green
    Write-Host "  ✅ Schema parity verified (7 tables)" -ForegroundColor Green
    Write-Host "  ✅ Test data created successfully" -ForegroundColor Green
    Write-Host "  ✅ Smoke pack: 15/15 tests passed" -ForegroundColor Green
    Write-Host "  ✅ Canonical driver verified" -ForegroundColor Green
    Write-Host "  ✅ Shadow mode verified (no Discord)" -ForegroundColor Green
    Write-Host "  ✅ Rate limiting verified (429 responses)" -ForegroundColor Green
    Write-Host "  ✅ DB isolation verified" -ForegroundColor Green
    Write-Host ""
    Write-Host "Smart Form hardening is READY for production promotion." -ForegroundColor Green
} else {
    $results.verdict = "❌ NO-GO - ISSUES DETECTED"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
    Write-Host "❌ VERDICT: NO-GO - ISSUES DETECTED" -ForegroundColor Red
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
    Write-Host ""
    Write-Host "Failed checks:" -ForegroundColor Red
    foreach ($check in $results.checks.GetEnumerator()) {
        if (-not $check.Value) {
            Write-Host "  ❌ $($check.Key)" -ForegroundColor Red
        }
    }
    Write-Host ""
    Write-Host "Review artifacts in: $ArtifactsDir" -ForegroundColor Yellow
}
Write-Host ""

# Save results
$resultsFile = "$ArtifactsDir\phase5-verdict.json"
$results | ConvertTo-Json -Depth 10 | Out-File -FilePath $resultsFile
Write-Host "📄 Results saved to: $resultsFile" -ForegroundColor Cyan

exit $(if ($allChecksPassed) { 0 } else { 1 })
