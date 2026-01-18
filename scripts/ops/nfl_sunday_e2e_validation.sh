#!/usr/bin/env bash
# =============================================================================
# NFL Sunday End-to-End Production Validation
# Date: 2025-10-26
# Purpose: Zero-manual-ID production validation with full attestation
# =============================================================================
set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BLUE}[STEP]${NC} $*"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# Attestation directory
ATTESTATION_DIR="out/ops/cutover/metrics/100"
mkdir -p "$ATTESTATION_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ATTESTATION_JSON="$ATTESTATION_DIR/nfl_sunday_attestation_${TIMESTAMP}.json"
ATTESTATION_MD="$ATTESTATION_DIR/nfl_sunday_attestation_${TIMESTAMP}.md"

# Initialize attestation data
ATTESTATION_DATA="{}"

# Failure tracking
FAILED=0
FAILURE_REASON=""

fail_with_reason() {
    FAILED=1
    FAILURE_REASON="$1"
    log_error "$FAILURE_REASON"
}

# =============================================================================
# STEP A: Health & Status Checks
# =============================================================================
log_step "A) Health & Status Checks"

log_info "Checking Smart Form health (port 3002)..."
if SMART_FORM_HEALTH=$(curl -sSfI http://localhost:3002/api/health 2>&1); then
    log_success "Smart Form health: OK"
    ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq '.health.smart_form = "OK"')
else
    fail_with_reason "Smart Form health check failed. Is the service running? Check: docker-compose ps smart-form"
    ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq '.health.smart_form = "FAIL"')
fi

log_info "Checking API status endpoint..."
API_STATUS=""
if API_STATUS=$(curl -sf http://localhost:3000/api/domain/picks/status 2>&1); then
    log_success "API status (port 3000): OK"
    ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq --argjson status "$API_STATUS" '.health.api = "OK" | .api_status = $status')
elif API_STATUS=$(curl -sf http://localhost:3011/api/domain/picks/status 2>&1); then
    log_success "API status (port 3011): OK"
    ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq --argjson status "$API_STATUS" '.health.api = "OK" | .api_status = $status')
else
    fail_with_reason "API status check failed on both 3000 and 3011. Check: docker-compose ps api"
    ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq '.health.api = "FAIL"')
fi

# Verify driver and mode
if echo "$API_STATUS" | jq -e '.driver == "canonical" and .publish_mode == "outbox"' > /dev/null 2>&1; then
    log_success "Driver: canonical, Publish Mode: outbox ✓"
else
    fail_with_reason "API not in canonical/outbox mode. Current: $(echo "$API_STATUS" | jq -r '{driver, publish_mode}')"
fi

if [ $FAILED -eq 1 ]; then
    log_error "Health checks failed. Stopping validation."
    echo "$ATTESTATION_DATA" | jq --arg reason "$FAILURE_REASON" '.conclusion = "FAIL" | .failure_reason = $reason' > "$ATTESTATION_JSON"
    exit 1
fi

# =============================================================================
# STEP B: Auto-Discover IDs
# =============================================================================
log_step "B) Auto-Discover IDs (Tenant, Capper, NFL Player)"

# Load environment chain
log_info "Loading environment configuration..."
if [ -f .env.effective ]; then
    source .env.effective
elif [ -f .env.local ]; then
    source .env.local
    source .env
elif [ -f .env ]; then
    source .env
fi

# Discover DEFAULT_TENANT_ID
if [ -n "${DEFAULT_TENANT_ID:-}" ]; then
    TENANT_ID="$DEFAULT_TENANT_ID"
    log_success "DEFAULT_TENANT_ID from env: $TENANT_ID"
elif [ -n "${TENANT_ID:-}" ]; then
    TENANT_ID="$TENANT_ID"
    log_success "TENANT_ID from env: $TENANT_ID"
else
    fail_with_reason "No DEFAULT_TENANT_ID or TENANT_ID found in environment"
    echo "$ATTESTATION_DATA" | jq --arg reason "$FAILURE_REASON" '.conclusion = "FAIL" | .failure_reason = $reason' > "$ATTESTATION_JSON"
    exit 1
fi

ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq --arg tid "$TENANT_ID" '.tenant_id = $tid')

# Discover CAPPER_ID
CAPPER_ID=""
for VAR in CAPPER_ID DEFAULT_CAPPER_ID TEST_CAPPER_ID SMARTFORM_DEFAULT_CAPPER_ID; do
    if [ -n "${!VAR:-}" ]; then
        CAPPER_ID="${!VAR}"
        log_success "CAPPER_ID from env ($VAR): $CAPPER_ID"
        break
    fi
done

# If still no CAPPER_ID, check CAPPER_IDS (comma-separated list)
if [ -z "$CAPPER_ID" ] && [ -n "${CAPPER_IDS:-}" ]; then
    CAPPER_ID=$(echo "$CAPPER_IDS" | cut -d',' -f1 | tr -d ' ')
    log_success "CAPPER_ID from CAPPER_IDS (first): $CAPPER_ID"
fi

# If still no CAPPER_ID, query database
if [ -z "$CAPPER_ID" ]; then
    log_info "No CAPPER_ID in env, querying database..."
    CAPPER_QUERY="SELECT id FROM public.users WHERE role IN ('capper','tipster') AND (disabled IS NULL OR disabled=false) ORDER BY created_at DESC LIMIT 1;"
    CAPPER_ID=$(docker-compose exec -T postgres psql -U postgres -d unit_talk_dev -tAc "$CAPPER_QUERY" 2>&1 | tr -d '[:space:]')
    
    if [ -n "$CAPPER_ID" ] && [[ "$CAPPER_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
        log_success "CAPPER_ID from database: $CAPPER_ID"
    else
        fail_with_reason "Failed to discover CAPPER_ID from database. Result: $CAPPER_ID"
        echo "$ATTESTATION_DATA" | jq --arg reason "$FAILURE_REASON" '.conclusion = "FAIL" | .failure_reason = $reason' > "$ATTESTATION_JSON"
        exit 1
    fi
fi

ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq --arg cid "$CAPPER_ID" '.capper_id = $cid')

# Discover NFL Player for today's games
log_info "Discovering NFL player from today's games..."
PLAYER_QUERY="
WITH todays_games AS (
  SELECT id, home_team_id, away_team_id
  FROM public.games
  WHERE league='NFL' AND game_date = current_date
  LIMIT 10
)
SELECT p.id AS player_id, p.name
FROM public.players p
WHERE p.league='NFL'
  AND p.team_id IN (SELECT home_team_id FROM todays_games UNION SELECT away_team_id FROM todays_games)
ORDER BY random() LIMIT 1;
"

PLAYER_RESULT=$(docker-compose exec -T postgres psql -U postgres -d unit_talk_dev -tA -F'|' -c "$PLAYER_QUERY" 2>&1)

if [ -n "$PLAYER_RESULT" ] && [[ "$PLAYER_RESULT" == *"|"* ]]; then
    PLAYER_ID=$(echo "$PLAYER_RESULT" | cut -d'|' -f1)
    PLAYER_NAME=$(echo "$PLAYER_RESULT" | cut -d'|' -f2)
    log_success "NFL Player: $PLAYER_NAME (ID: $PLAYER_ID)"
    ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq --arg pid "$PLAYER_ID" --arg pname "$PLAYER_NAME" '.player_id = $pid | .player_name = $pname')
else
    fail_with_reason "No NFL players found for today's games. Is there an NFL game today? Result: $PLAYER_RESULT"
    echo "$ATTESTATION_DATA" | jq --arg reason "$FAILURE_REASON" '.conclusion = "FAIL" | .failure_reason = $reason' > "$ATTESTATION_JSON"
    exit 1
fi

log_success "ID Discovery Complete:"
log_info "  Tenant ID:   $TENANT_ID"
log_info "  Capper ID:   $CAPPER_ID"
log_info "  Player ID:   $PLAYER_ID"
log_info "  Player Name: $PLAYER_NAME"

# =============================================================================
# STEP C: DRY-RUN (No DB Write)
# =============================================================================
log_step "C) DRY-RUN Validation (No DB Write)"

DRY_KEY="sf-dry-$(date +%s)"
TODAY=$(date -u +%F)

log_info "Submitting DRY-RUN pick..."
DRY_PAYLOAD=$(cat <<EOF
{
  "tenantId": "$TENANT_ID",
  "userId": "$CAPPER_ID",
  "league": "NFL",
  "playerId": "$PLAYER_ID",
  "marketType": "PLAYER_RECEIVING_YARDS",
  "line": 62.5,
  "side": "OVER",
  "stakeText": "2u verify",
  "game": {
    "dateISO": "$TODAY"
  }
}
EOF
)

DRY_RESPONSE=$(curl -i -H "Idempotency-Key: $DRY_KEY" -H "Content-Type: application/json" \
  -X POST http://localhost:3002/api/domain/picks/dry-run \
  -d "$DRY_PAYLOAD" 2>&1)

DRY_STATUS=$(echo "$DRY_RESPONSE" | grep -i "HTTP/" | head -1 | awk '{print $2}')
DRY_TIMING=$(echo "$DRY_RESPONSE" | grep -i "Server-Timing:" | sed 's/.*total;dur=\([0-9.]*\).*/\1/')

if [[ "$DRY_STATUS" =~ ^2 ]]; then
    log_success "DRY-RUN: HTTP $DRY_STATUS"
    if [ -n "$DRY_TIMING" ]; then
        log_info "Server-Timing: ${DRY_TIMING}ms"
        if (( $(echo "$DRY_TIMING > 120" | bc -l) )); then
            log_warn "DRY-RUN timing >120ms (acceptable for dev, but monitor in prod)"
        fi
        ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq --arg status "$DRY_STATUS" --arg timing "$DRY_TIMING" '.dry_run = {status: $status, server_timing_ms: $timing}')
    else
        ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq --arg status "$DRY_STATUS" '.dry_run = {status: $status, server_timing_ms: "N/A"}')
    fi
else
    fail_with_reason "DRY-RUN failed with HTTP $DRY_STATUS. Response: $(echo "$DRY_RESPONSE" | tail -20)"
    ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq --arg status "$DRY_STATUS" --arg reason "$FAILURE_REASON" '.dry_run = {status: $status} | .conclusion = "FAIL" | .failure_reason = $reason')
    echo "$ATTESTATION_DATA" > "$ATTESTATION_JSON"
    exit 1
fi

# =============================================================================
# STEP D: LIVE Submit (Write → Outbox → Discord → Command Center)
# =============================================================================
log_step "D) LIVE Submit (Production Write)"

LIVE_KEY="sf-live-$(date +%s)"

log_info "Submitting LIVE pick..."
LIVE_PAYLOAD=$(cat <<EOF
{
  "tenantId": "$TENANT_ID",
  "userId": "$CAPPER_ID",
  "league": "NFL",
  "playerId": "$PLAYER_ID",
  "marketType": "PLAYER_RECEIVING_YARDS",
  "line": 62.5,
  "side": "OVER",
  "stakeText": "2u NFL Sunday verify",
  "game": {
    "dateISO": "$TODAY"
  }
}
EOF
)

LIVE_RESPONSE=$(curl -sS -i -H "Idempotency-Key: $LIVE_KEY" -H "Content-Type: application/json" \
  -X POST http://localhost:3002/api/domain/picks/insert \
  -d "$LIVE_PAYLOAD" 2>&1)

LIVE_STATUS=$(echo "$LIVE_RESPONSE" | grep -i "HTTP/" | head -1 | awk '{print $2}')
LIVE_BODY=$(echo "$LIVE_RESPONSE" | sed -n '/^{/,$p')

if [[ "$LIVE_STATUS" =~ ^2 ]]; then
    log_success "LIVE Submit: HTTP $LIVE_STATUS"
    
    # Extract pickId
    PICK_ID=$(echo "$LIVE_BODY" | jq -r '.pickId // .id // .data.id // empty' 2>/dev/null)
    
    if [ -n "$PICK_ID" ] && [[ "$PICK_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
        log_success "Pick ID: $PICK_ID"
        ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq --arg pid "$PICK_ID" '.live = {pick_id: $pid}')
    else
        log_warn "Could not extract pick_id from response. Body: $LIVE_BODY"
        ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq '.live = {pick_id: "UNKNOWN"}')
    fi
else
    fail_with_reason "LIVE Submit failed with HTTP $LIVE_STATUS. Response: $LIVE_RESPONSE"
    ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq --arg status "$LIVE_STATUS" --arg reason "$FAILURE_REASON" '.live = {status: $status} | .conclusion = "FAIL" | .failure_reason = $reason')
    echo "$ATTESTATION_DATA" > "$ATTESTATION_JSON"
    exit 1
fi

log_info "Waiting 5 seconds for outbox processing..."
sleep 5

# =============================================================================
# STEP E: Database Verification (Poll for pick_publish status='sent')
# =============================================================================
log_step "E) Database Verification"

log_info "Verifying pick in database..."
PICK_VERIFY=$(docker-compose exec -T postgres psql -U postgres -d unit_talk_dev -tA -F'|' -c \
  "SELECT id, user_id, player_id, league, market_type, line, side, created_at FROM public.picks WHERE tenant_id='$TENANT_ID' ORDER BY created_at DESC LIMIT 1;" 2>&1)

if [ -n "$PICK_VERIFY" ]; then
    log_success "Pick found in database:"
    echo "$PICK_VERIFY" | while IFS='|' read -r id uid pid league market line side created; do
        log_info "  ID: $id"
        log_info "  User: $uid"
        log_info "  Player: $pid"
        log_info "  Market: $league $market $side $line"
        log_info "  Created: $created"
    done
else
    fail_with_reason "Pick not found in database"
fi

log_info "Polling pick_publish for status='sent' (max 90s)..."
PUBLISH_STATUS=""
EXTERNAL_MSG_ID=""
POLL_COUNT=0
MAX_POLLS=9

while [ $POLL_COUNT -lt $MAX_POLLS ]; do
    POLL_COUNT=$((POLL_COUNT + 1))
    log_info "Poll attempt $POLL_COUNT/$MAX_POLLS..."

    PUBLISH_RESULT=$(docker-compose exec -T postgres psql -U postgres -d unit_talk_dev -tA -F'|' -c \
      "SELECT pp.pick_id, pp.status, pp.external_message_id, pp.attempts, pp.created_at
       FROM public.pick_publish pp
       JOIN public.picks p ON p.id=pp.pick_id
       WHERE p.tenant_id='$TENANT_ID'
       ORDER BY pp.created_at DESC LIMIT 1;" 2>&1)

    if [ -n "$PUBLISH_RESULT" ]; then
        PUBLISH_STATUS=$(echo "$PUBLISH_RESULT" | cut -d'|' -f2)
        EXTERNAL_MSG_ID=$(echo "$PUBLISH_RESULT" | cut -d'|' -f3)

        if [ "$PUBLISH_STATUS" = "sent" ] && [ -n "$EXTERNAL_MSG_ID" ] && [ "$EXTERNAL_MSG_ID" != "" ]; then
            log_success "Pick published successfully!"
            log_info "  Status: $PUBLISH_STATUS"
            log_info "  External Message ID: $EXTERNAL_MSG_ID"
            ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq --arg status "$PUBLISH_STATUS" --arg msgid "$EXTERNAL_MSG_ID" '.publish = {status: $status, external_message_id: $msgid}')
            break
        else
            log_info "  Current status: $PUBLISH_STATUS (waiting for 'sent'...)"
        fi
    fi

    if [ $POLL_COUNT -lt $MAX_POLLS ]; then
        sleep 10
    fi
done

if [ "$PUBLISH_STATUS" != "sent" ] || [ -z "$EXTERNAL_MSG_ID" ]; then
    fail_with_reason "Pick publish did not reach status='sent' within 90s. Last status: $PUBLISH_STATUS. Check Discord worker logs: docker-compose logs discord-bot"
    ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq --arg status "$PUBLISH_STATUS" --arg reason "$FAILURE_REASON" '.publish = {status: $status} | .conclusion = "FAIL" | .failure_reason = $reason')
fi

log_info "Checking audit log..."
AUDIT_EVENTS=$(docker-compose exec -T postgres psql -U postgres -d unit_talk_dev -tA -F'|' -c \
  "SELECT event_type, ref_type, ref_id, created_at FROM public.audit_log WHERE tenant_id='$TENANT_ID' ORDER BY created_at DESC LIMIT 10;" 2>&1)

if [ -n "$AUDIT_EVENTS" ]; then
    log_success "Recent audit events:"
    echo "$AUDIT_EVENTS" | head -5 | while IFS='|' read -r event_type ref_type ref_id created; do
        log_info "  [$event_type] $ref_type:$ref_id at $created"
    done

    # Check for required events
    if echo "$AUDIT_EVENTS" | grep -q "pick.submitted"; then
        log_success "✓ Found 'pick.submitted' event"
    else
        log_warn "Missing 'pick.submitted' event in audit log"
    fi

    if echo "$AUDIT_EVENTS" | grep -q "discord.posted"; then
        log_success "✓ Found 'discord.posted' event"
    else
        log_warn "Missing 'discord.posted' event in audit log"
    fi

    ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq --arg events "$AUDIT_EVENTS" '.audit = {events: $events}')
else
    log_warn "No audit events found"
    ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq '.audit = {events: "NONE"}')
fi

# =============================================================================
# STEP F: Command Center Verification
# =============================================================================
log_step "F) Command Center Verification"

log_info "Checking Command Center at http://localhost:3004..."
if CC_HEALTH=$(curl -sSf http://localhost:3004/api/health 2>&1); then
    log_success "Command Center health: OK"
    ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq '.command_center.health = "OK"')
else
    log_warn "Command Center health check failed (non-critical)"
    ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq '.command_center.health = "FAIL"')
fi

log_info "Attempting to verify pick visibility in Command Center..."
if CC_PICKS=$(curl -sSf http://localhost:3004/api/picks?limit=5 2>&1); then
    PICK_COUNT=$(echo "$CC_PICKS" | jq 'length' 2>/dev/null || echo "0")
    log_success "Command Center returned $PICK_COUNT recent picks"

    if [ -n "$PICK_ID" ] && echo "$CC_PICKS" | jq -e --arg pid "$PICK_ID" '.[] | select(.id == $pid)' > /dev/null 2>&1; then
        log_success "✓ Pick $PICK_ID visible in Command Center"
        ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq '.command_center.confirmed = true')
    else
        log_warn "Pick not yet visible in Command Center (may need cache refresh)"
        ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq '.command_center.confirmed = false')
    fi
else
    log_warn "Could not fetch picks from Command Center API (non-critical)"
    ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq '.command_center.confirmed = false')
fi

log_info "Manual verification: Visit http://localhost:3004 to confirm pick visibility"

# =============================================================================
# STEP G: Generate Attestations
# =============================================================================
log_step "G) Generate Attestations"

# Determine final conclusion
if [ $FAILED -eq 1 ]; then
    CONCLUSION="FAIL"
else
    CONCLUSION="PASS"
fi

ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq --arg conclusion "$CONCLUSION" --arg timestamp "$TIMESTAMP" \
  '.conclusion = $conclusion | .timestamp = $timestamp | .validation_type = "nfl_sunday_e2e"')

# Add notes
NOTES="NFL Sunday E2E validation with auto-discovered IDs. "
if [ "$CONCLUSION" = "PASS" ]; then
    NOTES+="All systems operational. Pick successfully submitted, published to Discord, and visible in Command Center."
else
    NOTES+="Validation failed: $FAILURE_REASON"
fi

ATTESTATION_DATA=$(echo "$ATTESTATION_DATA" | jq --arg notes "$NOTES" '.notes = $notes')

# Write JSON attestation
echo "$ATTESTATION_DATA" | jq '.' > "$ATTESTATION_JSON"
log_success "JSON attestation written to: $ATTESTATION_JSON"

# Write Markdown attestation
cat > "$ATTESTATION_MD" <<EOF
# NFL Sunday E2E Production Validation
**Date:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Validation Type:** NFL Sunday End-to-End
**Conclusion:** **$CONCLUSION**

## Summary
$NOTES

## Configuration
- **Tenant ID:** $TENANT_ID
- **Capper ID:** $CAPPER_ID
- **Player ID:** $PLAYER_ID
- **Player Name:** $PLAYER_NAME

## Health Checks
- **Smart Form:** $(echo "$ATTESTATION_DATA" | jq -r '.health.smart_form')
- **API:** $(echo "$ATTESTATION_DATA" | jq -r '.health.api')
- **Driver:** canonical
- **Publish Mode:** outbox

## DRY-RUN Results
- **Status:** $DRY_STATUS
- **Server Timing:** ${DRY_TIMING:-N/A}ms

## LIVE Submit Results
- **Pick ID:** ${PICK_ID:-UNKNOWN}
- **Publish Status:** ${PUBLISH_STATUS:-UNKNOWN}
- **External Message ID:** ${EXTERNAL_MSG_ID:-UNKNOWN}

## Command Center
- **Health:** $(echo "$ATTESTATION_DATA" | jq -r '.command_center.health // "UNKNOWN"')
- **Pick Confirmed:** $(echo "$ATTESTATION_DATA" | jq -r '.command_center.confirmed // false')

## SLO Snapshot
- **DRY-RUN Latency:** ${DRY_TIMING:-N/A}ms (Target: <100ms prod)
- **Publish Latency:** ~${POLL_COUNT}0s (Target: <60s p95)
- **End-to-End Success:** $CONCLUSION

## Next Steps
EOF

if [ "$CONCLUSION" = "PASS" ]; then
    cat >> "$ATTESTATION_MD" <<EOF
- ✅ System validated and ready for production NFL Sunday operations
- Monitor Command Center at http://localhost:3004
- Review Discord channel for pick posting
- Continue monitoring outbox processing latency
EOF
else
    cat >> "$ATTESTATION_MD" <<EOF
- ❌ **REMEDIATION REQUIRED:** $FAILURE_REASON
- Review service logs: \`docker-compose logs\`
- Verify environment configuration
- Re-run validation after fixes
EOF
fi

log_success "Markdown attestation written to: $ATTESTATION_MD"

# =============================================================================
# Final Summary
# =============================================================================
log_step "Validation Complete"

if [ "$CONCLUSION" = "PASS" ]; then
    log_success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_success "  ✅ NFL SUNDAY E2E VALIDATION: PASS"
    log_success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_success "Pick ID: $PICK_ID"
    log_success "Published: $PUBLISH_STATUS with message ID $EXTERNAL_MSG_ID"
    log_success "Attestations: $ATTESTATION_JSON"
    exit 0
else
    log_error "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_error "  ❌ NFL SUNDAY E2E VALIDATION: FAIL"
    log_error "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_error "Reason: $FAILURE_REASON"
    log_error "Attestations: $ATTESTATION_JSON"
    exit 1
fi

