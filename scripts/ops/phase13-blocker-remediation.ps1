# Phase 13 Blocker Remediation Script
# Automatically resolves critical blockers identified in cutover validation
# Date: 2025-10-31

param(
    [switch]$DryRun = $false,
    [switch]$SkipRebuild = $false,
    [switch]$SkipMigration = $false
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logFile = "out/ops/cutover/metrics/phase13/remediation_$timestamp.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $logMessage = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$Level] $Message"
    Write-Host $logMessage
    Add-Content -Path $logFile -Value $logMessage
}

function Test-ApiRoutes {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3010/api/domain/picks/preflight" -UseBasicParsing -ErrorAction SilentlyContinue
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Test-OutboxPublisher {
    try {
        $logs = docker-compose logs api --tail=50 2>&1 | Select-String "next_attempt_at does not exist"
        return $logs.Count -eq 0
    } catch {
        return $false
    }
}

Write-Log "╔════════════════════════════════════════════════════════════════════════════╗" "INFO"
Write-Log "║              PHASE 13 BLOCKER REMEDIATION                                  ║" "INFO"
Write-Log "║              Date: 2025-10-31                                              ║" "INFO"
Write-Log "╚════════════════════════════════════════════════════════════════════════════╝" "INFO"
Write-Log ""

if ($DryRun) {
    Write-Log "🔍 DRY-RUN MODE: No changes will be made" "WARN"
    Write-Log ""
}

# Step 1: Pre-Remediation Checks
Write-Log "Step 1: Pre-Remediation Checks" "INFO"
Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "INFO"

$apiRoutesOk = Test-ApiRoutes
$outboxOk = Test-OutboxPublisher

Write-Log "  API Routes Available: $apiRoutesOk" "INFO"
Write-Log "  Outbox Publisher OK: $outboxOk" "INFO"
Write-Log ""

if ($apiRoutesOk -and $outboxOk) {
    Write-Log "✅ All blockers already resolved! No remediation needed." "INFO"
    exit 0
}

# Step 2: Blocker 1 - API Server Rebuild
if (-not $apiRoutesOk -and -not $SkipRebuild) {
    Write-Log "Step 2: Resolving BLOCKER-1 (API Server Route Mismatch)" "INFO"
    Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "INFO"

    if ($DryRun) {
        Write-Log "  [DRY-RUN] Would stop API container" "WARN"
        Write-Log "  [DRY-RUN] Would rebuild API container with --no-cache" "WARN"
        Write-Log "  [DRY-RUN] Would start API container" "WARN"
    } else {
        Write-Log "  Stopping API container..." "INFO"
        docker-compose stop api
        if ($LASTEXITCODE -ne 0) {
            Write-Log "  ❌ Failed to stop API container" "ERROR"
            exit 1
        }

        Write-Log "  Rebuilding API container (this may take 2-5 minutes)..." "INFO"
        docker-compose build --no-cache api
        if ($LASTEXITCODE -ne 0) {
            Write-Log "  ❌ Failed to rebuild API container" "ERROR"
            exit 1
        }

        Write-Log "  Starting API container..." "INFO"
        docker-compose up -d api
        if ($LASTEXITCODE -ne 0) {
            Write-Log "  ❌ Failed to start API container" "ERROR"
            exit 1
        }

        Write-Log "  Waiting 15 seconds for API to initialize..." "INFO"
        Start-Sleep -Seconds 15

        # Verify routes
        $apiRoutesOk = Test-ApiRoutes
        if ($apiRoutesOk) {
            Write-Log "  ✅ BLOCKER-1 RESOLVED: API routes now available" "INFO"
        } else {
            Write-Log "  ❌ BLOCKER-1 STILL PRESENT: API routes unavailable after rebuild" "ERROR"
            Write-Log "  Check logs: docker-compose logs api --tail=100" "ERROR"
            exit 1
        }
    }
    Write-Log ""
} elseif ($SkipRebuild) {
    Write-Log "Step 2: Skipping API rebuild (--SkipRebuild flag)" "WARN"
    Write-Log ""
}

# Step 3: Blocker 2 - Database Schema Fix
if (-not $outboxOk -and -not $SkipMigration) {
    Write-Log "Step 3: Resolving BLOCKER-2 (Database Schema Drift)" "INFO"
    Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "INFO"

    if ($DryRun) {
        Write-Log "  [DRY-RUN] Would check for missing migration" "WARN"
        Write-Log "  [DRY-RUN] Would apply migration" "WARN"
        Write-Log "  [DRY-RUN] Would reload PostgREST schema" "WARN"
    } else {
        # Check if migration file exists
        $migrationFiles = Get-ChildItem -Path "supabase/migrations" -Filter "*next_retry*.sql" -ErrorAction SilentlyContinue
        
        if ($migrationFiles.Count -eq 0) {
            Write-Log "  ⚠️  No migration file found for next_retry_at column" "WARN"
            Write-Log "  Creating migration inline..." "INFO"
            
            # Apply migration directly via Supabase client
            Write-Log "  Applying migration via Node script..." "INFO"
            $migrationScript = @"
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function applyMigration() {
  console.log('[Migration] Adding next_retry_at column to pick_publish...');
  
  const { error } = await supabase.rpc('exec_sql', {
    sql_query: ``
      ALTER TABLE pick_publish 
      ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
      
      CREATE INDEX IF NOT EXISTS idx_pick_publish_next_retry 
      ON pick_publish(next_retry_at) 
      WHERE status = 'pending';
    ``
  });
  
  if (error) {
    console.error('[Migration] Error:', error);
    process.exit(1);
  }
  
  console.log('[Migration] ✅ Migration applied successfully');
}

applyMigration();
"@
            $migrationScript | Out-File -FilePath "scripts/ops/temp_migration_$timestamp.js" -Encoding UTF8
            node "scripts/ops/temp_migration_$timestamp.js"
            
            if ($LASTEXITCODE -ne 0) {
                Write-Log "  ❌ Migration failed" "ERROR"
                exit 1
            }
            
            Remove-Item "scripts/ops/temp_migration_$timestamp.js" -Force
        } else {
            Write-Log "  Found migration file: $($migrationFiles[0].Name)" "INFO"
            # Apply via Supabase CLI or direct SQL
        }

        # Force PostgREST reload
        Write-Log "  Forcing PostgREST schema reload..." "INFO"
        node scripts/ops/force-postgrest-reload.ts
        
        if ($LASTEXITCODE -ne 0) {
            Write-Log "  ⚠️  PostgREST reload script failed, but continuing..." "WARN"
        }

        Write-Log "  Waiting 10 seconds for schema propagation..." "INFO"
        Start-Sleep -Seconds 10

        # Verify outbox publisher
        $outboxOk = Test-OutboxPublisher
        if ($outboxOk) {
            Write-Log "  ✅ BLOCKER-2 RESOLVED: Outbox publisher operational" "INFO"
        } else {
            Write-Log "  ⚠️  BLOCKER-2 MAY STILL BE PRESENT: Check outbox logs" "WARN"
            Write-Log "  Verify manually: docker-compose logs api --tail=50 | grep next_attempt_at" "WARN"
        }
    }
    Write-Log ""
} elseif ($SkipMigration) {
    Write-Log "Step 3: Skipping database migration (--SkipMigration flag)" "WARN"
    Write-Log ""
}

# Step 4: Post-Remediation Validation
Write-Log "Step 4: Post-Remediation Validation" "INFO"
Write-Log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "INFO"

if (-not $DryRun) {
    $apiRoutesOk = Test-ApiRoutes
    $outboxOk = Test-OutboxPublisher

    Write-Log "  API Routes Available: $apiRoutesOk" "INFO"
    Write-Log "  Outbox Publisher OK: $outboxOk" "INFO"
    Write-Log ""

    if ($apiRoutesOk -and $outboxOk) {
        Write-Log "✅ ALL BLOCKERS RESOLVED!" "INFO"
        Write-Log ""
        Write-Log "Next Steps:" "INFO"
        Write-Log "  1. Run E2E validation: node scripts/ops/phase13-manual-e2e.js" "INFO"
        Write-Log "  2. If E2E passes, proceed with canary deployment" "INFO"
        Write-Log "  3. Re-run full cutover validation" "INFO"
        Write-Log ""
        exit 0
    } else {
        Write-Log "⚠️  PARTIAL RESOLUTION" "WARN"
        Write-Log ""
        Write-Log "Remaining Issues:" "WARN"
        if (-not $apiRoutesOk) {
            Write-Log "  - API routes still unavailable" "WARN"
        }
        if (-not $outboxOk) {
            Write-Log "  - Outbox publisher still failing" "WARN"
        }
        Write-Log ""
        Write-Log "Manual intervention required. Check logs:" "WARN"
        Write-Log "  docker-compose logs api --tail=100" "WARN"
        Write-Log ""
        exit 1
    }
} else {
    Write-Log "✅ DRY-RUN COMPLETE" "INFO"
    Write-Log ""
    Write-Log "Run without --DryRun flag to apply changes" "INFO"
    Write-Log ""
    exit 0
}

