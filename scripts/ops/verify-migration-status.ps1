# verify-migration-status.ps1
# Purpose: Quick migration status verification for operators
# Usage: .\scripts\ops\verify-migration-status.ps1 [-Environment dev|staging|prod] [-Verbose]

param(
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment = 'dev',
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MIGRATION STATUS VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan

$script:Checks = 0
$script:Passed = 0
$script:Failed = 0

function Write-Check {
    param([string]$Name, [string]$Status, [string]$Message)

    $script:Checks++

    $icon = switch ($Status) {
        "PASS" { "✅"; $script:Passed++; $color = "Green" }
        "FAIL" { "❌"; $script:Failed++; $color = "Red" }
        "WARN" { "⚠️ "; $color = "Yellow" }
        default { "ℹ️ "; $color = "White" }
    }

    Write-Host "$icon $Name" -ForegroundColor $color -NoNewline
    Write-Host " - $Message" -ForegroundColor White
}

# ============================================================================
# CHECK 1: Local Migration Files
# ============================================================================

Write-Host "`n--- Local Migration Files ---`n" -ForegroundColor Cyan

$migrationPath = "supabase/migrations"

if (Test-Path $migrationPath) {
    $migrations = Get-ChildItem -Path $migrationPath -Filter "*.sql" | Sort-Object Name

    if ($migrations.Count -gt 0) {
        Write-Check "Migration files" "PASS" "Found $($migrations.Count) migration(s)"

        # Show latest 3 migrations
        $latest = $migrations | Select-Object -Last 3
        Write-Host "`nLatest migrations:" -ForegroundColor Gray
        foreach ($mig in $latest) {
            Write-Host "  - $($mig.Name)" -ForegroundColor DarkGray
        }
    } else {
        Write-Check "Migration files" "WARN" "No migrations found"
    }

    # Check naming convention
    $invalidNames = @()
    foreach ($mig in $migrations) {
        if ($mig.Name -notmatch '^\d{8}_.*\.sql$') {
            $invalidNames += $mig.Name
        }
    }

    if ($invalidNames.Count -eq 0) {
        Write-Check "Naming convention" "PASS" "All migrations follow YYYYMMDD format"
    } else {
        Write-Check "Naming convention" "FAIL" "$($invalidNames.Count) invalid name(s)"
        if ($Verbose) {
            foreach ($invalid in $invalidNames) {
                Write-Host "    Invalid: $invalid" -ForegroundColor Red
            }
        }
    }
} else {
    Write-Check "Migration directory" "FAIL" "supabase/migrations/ not found"
}

# ============================================================================
# CHECK 2: Schema Version (Remote)
# ============================================================================

Write-Host "`n--- Remote Schema Version ---`n" -ForegroundColor Cyan

try {
    # Check if schema_versions table exists
    $tableCheckQuery = @"
SELECT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'schema_versions'
) as exists
"@

    $tableResult = npx tsx scripts\ops\supabase-query.ts --env $Environment --output json "$tableCheckQuery" 2>&1

    if ($LASTEXITCODE -eq 0) {
        $tableExists = ($tableResult | ConvertFrom-Json)[0].exists

        if ($tableExists -eq $true) {
            Write-Check "schema_versions table" "PASS" "Table exists"

            # Get current version
            $currentVersionQuery = @"
SELECT version, applied_at, applied_by, environment, migrations
FROM schema_versions
WHERE environment = '$Environment'
ORDER BY applied_at DESC
LIMIT 1
"@

            $versionResult = npx tsx scripts\ops\supabase-query.ts --env $Environment --output json "$currentVersionQuery" 2>&1

            if ($LASTEXITCODE -eq 0 -and $versionResult) {
                $currentVersion = ($versionResult | ConvertFrom-Json)[0]

                if ($currentVersion) {
                    Write-Check "Current version" "PASS" "v$($currentVersion.version)"

                    Write-Host "`nVersion Details:" -ForegroundColor Gray
                    Write-Host "  Version: $($currentVersion.version)" -ForegroundColor DarkGray
                    Write-Host "  Applied: $($currentVersion.applied_at)" -ForegroundColor DarkGray
                    Write-Host "  Applied by: $($currentVersion.applied_by)" -ForegroundColor DarkGray

                    if ($Verbose -and $currentVersion.migrations) {
                        Write-Host "  Migrations:" -ForegroundColor DarkGray
                        $migList = $currentVersion.migrations -split ","
                        foreach ($m in $migList) {
                            Write-Host "    - $m" -ForegroundColor DarkGray
                        }
                    }
                } else {
                    Write-Check "Current version" "WARN" "No version recorded for $Environment"
                }
            }

            # Get version history
            $historyQuery = @"
SELECT version, applied_at, applied_by
FROM schema_versions
WHERE environment = '$Environment'
ORDER BY applied_at DESC
LIMIT 5
"@

            $historyResult = npx tsx scripts\ops\supabase-query.ts --env $Environment --output json "$historyQuery" 2>&1

            if ($LASTEXITCODE -eq 0 -and $historyResult) {
                $history = $historyResult | ConvertFrom-Json

                if ($history.Count -gt 0) {
                    Write-Host "`nRecent Versions:" -ForegroundColor Gray
                    foreach ($ver in $history) {
                        Write-Host "  $($ver.version) - $($ver.applied_at) by $($ver.applied_by)" -ForegroundColor DarkGray
                    }
                }
            }
        } else {
            Write-Check "schema_versions table" "WARN" "Table not found - version tracking not enabled"
            Write-Host "  Run enhanced CI workflow to enable version tracking" -ForegroundColor Yellow
        }
    } else {
        Write-Check "Database connection" "FAIL" "Could not query database"
    }
} catch {
    Write-Check "Schema version check" "FAIL" "Error: $_"
}

# ============================================================================
# CHECK 3: Migration Sync Status
# ============================================================================

Write-Host "`n--- Migration Sync Status ---`n" -ForegroundColor Cyan

if ($migrations -and $currentVersion -and $currentVersion.migrations) {
    $localMigrations = ($migrations | ForEach-Object { $_.Name }) -join ","
    $remoteMigrations = $currentVersion.migrations

    if ($localMigrations -eq $remoteMigrations) {
        Write-Check "Sync status" "PASS" "Local and remote migrations are in sync"
    } else {
        Write-Check "Sync status" "WARN" "Local and remote may be out of sync"

        if ($Verbose) {
            Write-Host "`nLocal migrations:" -ForegroundColor Gray
            Write-Host "  $localMigrations" -ForegroundColor DarkGray
            Write-Host "`nRemote migrations:" -ForegroundColor Gray
            Write-Host "  $remoteMigrations" -ForegroundColor DarkGray
        }
    }
} else {
    Write-Check "Sync status" "WARN" "Cannot verify sync - missing data"
}

# ============================================================================
# CHECK 4: Schema Integrity
# ============================================================================

Write-Host "`n--- Schema Integrity ---`n" -ForegroundColor Cyan

Write-Host "Running schema verification..." -ForegroundColor Gray
$verifyResult = npx tsx scripts\ops\verify-schema-post-migration.ts --env $Environment 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Check "Schema verification" "PASS" "All required tables exist"
} else {
    Write-Check "Schema verification" "FAIL" "Schema verification failed"

    if ($Verbose) {
        Write-Host "`nVerification output:" -ForegroundColor Gray
        Write-Host $verifyResult -ForegroundColor Red
    }
}

# ============================================================================
# CHECK 5: Rollback Availability
# ============================================================================

Write-Host "`n--- Rollback Availability ---`n" -ForegroundColor Cyan

$rollbackMigrations = Get-ChildItem -Path $migrationPath -Filter "rollback_*.sql" 2>$null | Sort-Object Name

if ($rollbackMigrations -and $rollbackMigrations.Count -gt 0) {
    Write-Check "Rollback migrations" "PASS" "Found $($rollbackMigrations.Count) rollback migration(s)"

    if ($Verbose) {
        Write-Host "`nAvailable rollbacks:" -ForegroundColor Gray
        foreach ($rb in $rollbackMigrations) {
            Write-Host "  - $($rb.Name)" -ForegroundColor DarkGray
        }
    }
} else {
    Write-Check "Rollback migrations" "WARN" "No rollback migrations found"
}

# Check for rollback scripts in artifacts (if CI has run)
$rollbackScripts = Get-ChildItem -Path . -Filter "rollback-*.sh" -Recurse -Depth 1 2>$null

if ($rollbackScripts -and $rollbackScripts.Count -gt 0) {
    Write-Check "Rollback scripts" "PASS" "Found $($rollbackScripts.Count) generated rollback script(s)"
} else {
    Write-Check "Rollback scripts" "INFO" "No generated rollback scripts found (run CI to generate)"
}

# ============================================================================
# SUMMARY
# ============================================================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total Checks: $script:Checks" -ForegroundColor White
Write-Host "Passed: $script:Passed" -ForegroundColor Green
Write-Host "Failed: $script:Failed" -ForegroundColor Red
Write-Host "========================================`n" -ForegroundColor Cyan

if ($script:Failed -eq 0) {
    Write-Host "✅ MIGRATION STATUS: HEALTHY" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ MIGRATION STATUS: ISSUES DETECTED" -ForegroundColor Red
    Write-Host "Review failed checks above and consult MIGRATION_RUNBOOK.md" -ForegroundColor Yellow
    exit 1
}
