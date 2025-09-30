#!/bin/bash

# Advanced Features Complete Rollback Script
# Unit Talk Platform - Emergency Rollback Procedure
# Version: 1.0
# Date: 2025-09-23

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Check if running in correct directory
if [ ! -f "package.json" ] || [ ! -d "apps/api" ]; then
    error "Please run this script from the Unit Talk platform root directory"
    exit 1
fi

# Confirm rollback intent
echo ""
echo "🚨🚨🚨 ADVANCED FEATURES ROLLBACK PROCEDURE 🚨🚨🚨"
echo ""
echo "This script will completely remove all advanced features integrations:"
echo "  • Steam Detection Engine"
echo "  • Line Shopping Engine"
echo "  • Enhanced Injury Analysis"
echo "  • Settlement Automation"
echo "  • API Quota Coordinator"
echo "  • Advanced Discord Integration"
echo "  • Advanced Health Monitoring"
echo "  • Database Schema (steam_moves, best_odds, etc.)"
echo ""
read -p "Are you sure you want to proceed? (type 'ROLLBACK' to confirm): " confirm

if [ "$confirm" != "ROLLBACK" ]; then
    log "Rollback cancelled by user"
    exit 0
fi

echo ""
log "🚀 Starting advanced features rollback procedure..."

# Create backup timestamp
BACKUP_TIMESTAMP=$(date +'%Y%m%d_%H%M%S')
BACKUP_DIR="./backups/rollback_${BACKUP_TIMESTAMP}"

log "📦 Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Backup current state before rollback
log "💾 Backing up current integration files..."
cp apps/api/src/agents/AlertAgent/SteamDetectionIntegrator.ts "$BACKUP_DIR/" 2>/dev/null || true
cp apps/api/src/services/APIQuotaCoordinator.ts "$BACKUP_DIR/" 2>/dev/null || true
cp apps/api/src/activities/settlementActivities.ts "$BACKUP_DIR/" 2>/dev/null || true
cp apps/api/migrations/025_api_quota_management.sql "$BACKUP_DIR/" 2>/dev/null || true

# 1. STOP SERVICES GRACEFULLY
log "⏸️ Stopping services gracefully..."
docker-compose stop api || warn "API service stop failed (may already be stopped)"
docker-compose stop discord-bot || warn "Discord bot stop failed (may already be stopped)"

# 2. DATABASE SCHEMA ROLLBACK
log "📊 Rolling back database schema..."

# Create rollback migration file
cat > apps/api/migrations/rollback_024_advanced_features_schema.sql << 'EOF'
-- Advanced Features Schema Rollback Migration
-- Generated: 2025-09-23
-- Purpose: Remove all advanced features database schema

BEGIN;

-- Drop advanced features tables in reverse dependency order
DROP TABLE IF EXISTS arbitrage_opportunities CASCADE;
DROP TABLE IF EXISTS injury_impacts CASCADE;
DROP TABLE IF EXISTS best_odds CASCADE;
DROP TABLE IF EXISTS steam_moves CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- Drop API quota management tables
DROP TABLE IF EXISTS api_emergency_states CASCADE;
DROP TABLE IF EXISTS api_quota_usage CASCADE;
DROP TABLE IF EXISTS api_quota_configs CASCADE;

-- Drop views if they exist
DROP VIEW IF EXISTS daily_quota_usage CASCADE;
DROP VIEW IF EXISTS monthly_quota_usage CASCADE;
DROP VIEW IF EXISTS current_quota_status CASCADE;

COMMIT;
EOF

# Execute database rollback
if [ -n "$DATABASE_URL" ] || [ -n "$SUPABASE_URL" ]; then
    log "Executing database schema rollback..."
    docker-compose run --rm api npx tsx -e "
        import { createClient } from '@supabase/supabase-js';
        import { readFileSync } from 'fs';

        const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const rollbackSQL = readFileSync('apps/api/migrations/rollback_024_advanced_features_schema.sql', 'utf8');

        async function executeRollback() {
            try {
                const { error } = await supabase.rpc('exec', { sql: rollbackSQL });
                if (error) {
                    console.error('Database rollback failed:', error);
                    process.exit(1);
                }
                console.log('✅ Database schema rollback completed');
            } catch (e) {
                console.error('Database rollback error:', e);
                process.exit(1);
            }
        }

        executeRollback();
    " || warn "Database rollback may have failed - check manually"
else
    warn "No database connection configured - skipping schema rollback"
fi

# 3. CODE ROLLBACKS
log "🔄 Rolling back code changes..."

# Get the commit hash before advanced features integration
INTEGRATION_COMMIT=$(git log --oneline --grep="Advanced features integration" -1 --format="%H" 2>/dev/null || echo "")

if [ -n "$INTEGRATION_COMMIT" ]; then
    ROLLBACK_TARGET="${INTEGRATION_COMMIT}^"
    log "Found integration commit: $INTEGRATION_COMMIT, rolling back to: $ROLLBACK_TARGET"
else
    ROLLBACK_TARGET="HEAD^"
    warn "Integration commit not found, using HEAD^ as rollback target"
fi

# Rollback specific files to pre-integration state
FILES_TO_ROLLBACK=(
    "apps/api/src/agents/AlertAgent/index.ts"
    "apps/api/src/services/LineShoppingEngine.ts"
    "apps/api/src/agents/AlertAgent/activities/index.ts"
    "apps/api/src/workflows/index.ts"
    "apps/api/src/agents/AlertAgent/embedBuilder.ts"
    "apps/api/src/monitoring/enhanced-health-checks.ts"
    "apps/api/src/routes/health.ts"
    "apps/api/src/agents/FeedAgent/activities/fetchFromProvider.ts"
)

for file in "${FILES_TO_ROLLBACK[@]}"; do
    if [ -f "$file" ]; then
        log "Rolling back $file..."
        git checkout "$ROLLBACK_TARGET" -- "$file" 2>/dev/null || warn "Could not rollback $file from git"
    else
        warn "File not found for rollback: $file"
    fi
done

# 4. REMOVE INTEGRATION FILES
log "🗑️ Removing integration files..."

FILES_TO_REMOVE=(
    "apps/api/src/agents/AlertAgent/SteamDetectionIntegrator.ts"
    "apps/api/src/services/APIQuotaCoordinator.ts"
    "apps/api/src/activities/settlementActivities.ts"
    "apps/api/migrations/025_api_quota_management.sql"
    "apps/api/migrations/rollback_024_advanced_features_schema.sql"
)

for file in "${FILES_TO_REMOVE[@]}"; do
    if [ -f "$file" ]; then
        log "Removing $file..."
        rm -f "$file"
        success "Removed $file"
    else
        warn "File not found for removal: $file"
    fi
done

# 5. CLEAN TYPESCRIPT COMPILATION
log "🧹 Cleaning TypeScript compilation artifacts..."
rm -rf apps/api/dist || true
rm -rf apps/api/dist-test || true

# 6. RESTART SERVICES
log "♻️ Restarting services..."
docker-compose up -d api
docker-compose up -d discord-bot

# Wait for services to start
log "⏳ Waiting for services to start..."
sleep 15

# 7. RESTART TEMPORAL WORKERS
log "🔄 Restarting Temporal workers..."
docker-compose exec -T api npm run temporal:worker:restart || warn "Temporal worker restart may have failed"

# 8. VALIDATION
log "✅ Validating rollback..."

# Health check validation
log "Testing API health endpoint..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")

if [ "$HEALTH_CHECK" = "200" ]; then
    success "✅ API health check passed"
else
    error "❌ API health check failed (HTTP $HEALTH_CHECK)"
fi

# Database validation
log "Testing database connectivity..."
DB_CHECK=$(docker-compose exec -T api npx tsx -e "
    import { createClient } from '@supabase/supabase-js';

    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!
    );

    async function testDB() {
        try {
            const { data, error } = await supabase.from('raw_props').select('count').limit(1);
            if (error) throw error;
            console.log('DB_OK');
        } catch (e) {
            console.log('DB_ERROR');
        }
    }

    testDB();
" 2>/dev/null || echo "DB_ERROR")

if [ "$DB_CHECK" = "DB_OK" ]; then
    success "✅ Database connectivity validated"
else
    error "❌ Database connectivity validation failed"
fi

# Check for advanced features tables (should not exist)
log "Verifying advanced features tables removed..."
ADVANCED_TABLES=$(docker-compose exec -T postgres psql -U postgres -d unittalk -tAc "
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_name IN ('steam_moves', 'best_odds', 'injury_impacts', 'arbitrage_opportunities', 'api_quota_configs');
" 2>/dev/null || echo "ERROR")

if [ "$ADVANCED_TABLES" = "0" ]; then
    success "✅ Advanced features tables successfully removed"
else
    warn "⚠️ Some advanced features tables may still exist (found: $ADVANCED_TABLES)"
fi

# Log analysis
log "Analyzing application logs for errors..."
ERROR_COUNT=$(docker-compose logs --tail=100 api 2>/dev/null | grep -i -E "(error|fail|exception)" | wc -l || echo "0")

if [ "$ERROR_COUNT" -lt "5" ]; then
    success "✅ Low error count in logs ($ERROR_COUNT errors)"
else
    warn "⚠️ Elevated error count in logs ($ERROR_COUNT errors) - manual review recommended"
fi

# 9. GENERATE ROLLBACK REPORT
log "📝 Generating rollback report..."

REPORT_FILE="$BACKUP_DIR/rollback_report.txt"
cat > "$REPORT_FILE" << EOF
Advanced Features Rollback Report
================================
Date: $(date)
Rollback ID: ${BACKUP_TIMESTAMP}
Executed by: $(whoami)
Platform: $(uname -a)

Rollback Status:
- Database Schema: $([ "$ADVANCED_TABLES" = "0" ] && echo "SUCCESS" || echo "PARTIAL")
- API Health: $([ "$HEALTH_CHECK" = "200" ] && echo "SUCCESS" || echo "FAILED")
- Database Connectivity: $([ "$DB_CHECK" = "DB_OK" ] && echo "SUCCESS" || echo "FAILED")
- Error Count: $ERROR_COUNT

Files Rolled Back:
$(printf "  - %s\n" "${FILES_TO_ROLLBACK[@]}")

Files Removed:
$(printf "  - %s\n" "${FILES_TO_REMOVE[@]}")

Backup Location: $BACKUP_DIR

Next Steps:
1. Monitor system performance for 30 minutes
2. Verify all core functionality operational
3. Check Enhanced45FactorEngine operates normally
4. Validate Discord integration works with standard alerts
5. Confirm no advanced features errors in logs

EOF

success "📄 Rollback report generated: $REPORT_FILE"

# 10. FINAL STATUS
echo ""
echo "=================================================================="
echo "        ADVANCED FEATURES ROLLBACK COMPLETED"
echo "=================================================================="
echo ""

if [ "$HEALTH_CHECK" = "200" ] && [ "$DB_CHECK" = "DB_OK" ] && [ "$ADVANCED_TABLES" = "0" ]; then
    success "🎉 ROLLBACK SUCCESSFUL"
    echo ""
    echo "✅ All advanced features have been successfully removed"
    echo "✅ System health validated"
    echo "✅ Database schema cleaned"
    echo "✅ Core functionality preserved"
    echo ""
    echo "📍 System Status: OPERATIONAL (Pre-Integration State)"
    echo "📍 Backup Location: $BACKUP_DIR"
    echo "📍 Report: $REPORT_FILE"
    echo ""
    echo "🔍 Recommended Next Steps:"
    echo "  1. Monitor system for 30 minutes"
    echo "  2. Run Enhanced45FactorEngine validation"
    echo "  3. Test Discord integration"
    echo "  4. Verify agent processing works normally"
    echo ""

    exit 0
else
    error "⚠️ ROLLBACK COMPLETED WITH WARNINGS"
    echo ""
    echo "The rollback procedure has been executed, but some validations failed:"
    [ "$HEALTH_CHECK" != "200" ] && echo "❌ API health check failed"
    [ "$DB_CHECK" != "DB_OK" ] && echo "❌ Database connectivity issues"
    [ "$ADVANCED_TABLES" != "0" ] && echo "❌ Advanced features tables may still exist"
    echo ""
    echo "📍 Manual intervention may be required"
    echo "📍 Check logs: docker-compose logs api"
    echo "📍 Backup Location: $BACKUP_DIR"
    echo "📍 Report: $REPORT_FILE"
    echo ""

    exit 1
fi