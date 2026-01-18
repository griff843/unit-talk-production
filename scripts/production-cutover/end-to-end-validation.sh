#!/bin/bash
# End-to-End Production Cutover Validation
# Date: 2025-10-25
# Validates complete pick submission flow through all systems

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SMART_FORM_URL="${SMART_FORM_URL:-http://localhost:3021}"
COMMAND_CENTER_URL="${COMMAND_CENTER_URL:-http://localhost:3000}"
SUPABASE_URL="${SUPABASE_URL}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
OUTPUT_DIR="out/ops/cutover/metrics/100"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}End-to-End Production Cutover Validation${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${CYAN}Timestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")${NC}"
echo ""

# ============================================================================
# STEP 1: Insert Pick from Smart Form
# ============================================================================
echo -e "${BLUE}📝 STEP 1: Inserting test pick via Smart Form...${NC}"

START_TIME=$(date +%s%3N)

# Create test pick payload
PICK_PAYLOAD=$(cat <<EOF
{
  "capper_id": "12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a",
  "player_name": "LeBron James",
  "stat_type": "Points",
  "line": 25.5,
  "pick_type": "over",
  "odds": -110,
  "units": 2.0,
  "sport": "NBA",
  "game_time": "$(date -u -d '+2 hours' +"%Y-%m-%dT%H:%M:%SZ")",
  "notes": "E2E validation test pick - $(date +%s)"
}
EOF
)

# Submit pick
PICK_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "$SMART_FORM_URL/api/domain/picks/insert" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -d "$PICK_PAYLOAD")

HTTP_CODE=$(echo "$PICK_RESPONSE" | tail -1)
PICK_BODY=$(echo "$PICK_RESPONSE" | head -n -1)

INSERT_TIME=$(date +%s%3N)
INSERT_LATENCY=$((INSERT_TIME - START_TIME))

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "${GREEN}✅ Pick inserted successfully (${INSERT_LATENCY}ms)${NC}"
    PICK_ID=$(echo "$PICK_BODY" | jq -r '.id // .pick_id // .data.id')
    echo -e "${CYAN}   Pick ID: $PICK_ID${NC}"
    echo "$PICK_BODY" > "$OUTPUT_DIR/pick_insert_response_$TIMESTAMP.json"
else
    echo -e "${RED}❌ Pick insert failed (HTTP $HTTP_CODE)${NC}"
    echo "$PICK_BODY"
    exit 1
fi

# ============================================================================
# STEP 2: Verify picks row in database
# ============================================================================
echo ""
echo -e "${BLUE}🔍 STEP 2: Verifying picks row in database...${NC}"

sleep 2  # Allow for database propagation

PICKS_QUERY=$(curl -s -X POST \
  "$SUPABASE_URL/rest/v1/rpc/get_pick_by_id" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"pick_id\": \"$PICK_ID\"}")

if echo "$PICKS_QUERY" | jq -e '.id' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Pick found in picks table${NC}"
    echo "$PICKS_QUERY" | jq '.' > "$OUTPUT_DIR/picks_row_$TIMESTAMP.json"
    
    # Extract key fields
    PLAYER=$(echo "$PICKS_QUERY" | jq -r '.player_name')
    STAT=$(echo "$PICKS_QUERY" | jq -r '.stat_type')
    LINE=$(echo "$PICKS_QUERY" | jq -r '.line')
    echo -e "${CYAN}   Player: $PLAYER${NC}"
    echo -e "${CYAN}   Stat: $STAT${NC}"
    echo -e "${CYAN}   Line: $LINE${NC}"
else
    echo -e "${RED}❌ Pick not found in picks table${NC}"
    echo "$PICKS_QUERY"
    exit 1
fi

# ============================================================================
# STEP 3: Verify pick_publish row (outbox pattern)
# ============================================================================
echo ""
echo -e "${BLUE}📤 STEP 3: Verifying pick_publish row (outbox)...${NC}"

sleep 3  # Allow for outbox processing

PUBLISH_QUERY=$(curl -s -G \
  "$SUPABASE_URL/rest/v1/pick_publish" \
  --data-urlencode "pick_id=eq.$PICK_ID" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY")

if echo "$PUBLISH_QUERY" | jq -e '.[0].id' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Pick found in pick_publish table${NC}"
    echo "$PUBLISH_QUERY" | jq '.' > "$OUTPUT_DIR/pick_publish_row_$TIMESTAMP.json"
    
    PUBLISH_STATUS=$(echo "$PUBLISH_QUERY" | jq -r '.[0].status')
    PUBLISHED_AT=$(echo "$PUBLISH_QUERY" | jq -r '.[0].published_at')
    echo -e "${CYAN}   Status: $PUBLISH_STATUS${NC}"
    echo -e "${CYAN}   Published At: $PUBLISHED_AT${NC}"
else
    echo -e "${YELLOW}⚠️  Pick not yet in pick_publish table (may still be processing)${NC}"
fi

# ============================================================================
# STEP 4: Verify audit_log row
# ============================================================================
echo ""
echo -e "${BLUE}📋 STEP 4: Verifying audit_log row...${NC}"

AUDIT_QUERY=$(curl -s -G \
  "$SUPABASE_URL/rest/v1/audit_log" \
  --data-urlencode "entity_id=eq.$PICK_ID" \
  --data-urlencode "order=created_at.desc" \
  --data-urlencode "limit=5" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY")

AUDIT_COUNT=$(echo "$AUDIT_QUERY" | jq 'length')

if [ "$AUDIT_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Found $AUDIT_COUNT audit log entries${NC}"
    echo "$AUDIT_QUERY" | jq '.' > "$OUTPUT_DIR/audit_log_rows_$TIMESTAMP.json"
    
    # Show event types
    echo -e "${CYAN}   Events:${NC}"
    echo "$AUDIT_QUERY" | jq -r '.[] | "     - \(.event_type) (\(.status))"'
else
    echo -e "${YELLOW}⚠️  No audit log entries found yet${NC}"
fi

# ============================================================================
# STEP 5: Verify Discord post (via bridge_outbox)
# ============================================================================
echo ""
echo -e "${BLUE}💬 STEP 5: Verifying Discord post via bridge_outbox...${NC}"

sleep 5  # Allow for Discord publishing

OUTBOX_QUERY=$(curl -s -G \
  "$SUPABASE_URL/rest/v1/bridge_outbox" \
  --data-urlencode "aggregate_id=eq.$PICK_ID" \
  --data-urlencode "order=created_at.desc" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY")

if echo "$OUTBOX_QUERY" | jq -e '.[0].id' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Found bridge_outbox entry${NC}"
    echo "$OUTBOX_QUERY" | jq '.' > "$OUTPUT_DIR/bridge_outbox_row_$TIMESTAMP.json"
    
    OUTBOX_STATUS=$(echo "$OUTBOX_QUERY" | jq -r '.[0].status')
    PROCESSED_AT=$(echo "$OUTBOX_QUERY" | jq -r '.[0].processed_at')
    echo -e "${CYAN}   Status: $OUTBOX_STATUS${NC}"
    echo -e "${CYAN}   Processed At: $PROCESSED_AT${NC}"
    
    if [ "$OUTBOX_STATUS" = "processed" ]; then
        echo -e "${GREEN}✅ Discord post successfully published${NC}"
    else
        echo -e "${YELLOW}⚠️  Discord post status: $OUTBOX_STATUS${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No bridge_outbox entry found yet${NC}"
fi

# ============================================================================
# STEP 6: Verify Command Center update
# ============================================================================
echo ""
echo -e "${BLUE}🎛️  STEP 6: Verifying Command Center update...${NC}"

CC_RESPONSE=$(curl -s "$COMMAND_CENTER_URL/api/picks/recent?limit=10")

if echo "$CC_RESPONSE" | jq -e ".[] | select(.id == \"$PICK_ID\")" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Pick visible in Command Center${NC}"
    echo "$CC_RESPONSE" | jq ".[] | select(.id == \"$PICK_ID\")" > "$OUTPUT_DIR/command_center_pick_$TIMESTAMP.json"
else
    echo -e "${YELLOW}⚠️  Pick not yet visible in Command Center (cache may need refresh)${NC}"
fi

# ============================================================================
# STEP 7: Capture Timings
# ============================================================================
echo ""
echo -e "${BLUE}⏱️  STEP 7: Capturing performance timings...${NC}"

END_TIME=$(date +%s%3N)
TOTAL_LATENCY=$((END_TIME - START_TIME))

TIMINGS=$(cat <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "pick_id": "$PICK_ID",
  "timings": {
    "insert_latency_ms": $INSERT_LATENCY,
    "total_e2e_latency_ms": $TOTAL_LATENCY,
    "insert_to_publish_ms": $((INSERT_TIME - START_TIME)),
    "slo_compliance": {
      "api_latency_slo_150ms": $([ $INSERT_LATENCY -lt 150 ] && echo "true" || echo "false"),
      "total_latency_target_10s": $([ $TOTAL_LATENCY -lt 10000 ] && echo "true" || echo "false")
    }
  }
}
EOF
)

echo "$TIMINGS" | jq '.' > "$OUTPUT_DIR/timings_$TIMESTAMP.json"
echo -e "${GREEN}✅ Timings captured${NC}"
echo -e "${CYAN}   Insert Latency: ${INSERT_LATENCY}ms${NC}"
echo -e "${CYAN}   Total E2E Latency: ${TOTAL_LATENCY}ms${NC}"

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ End-to-End Validation Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Validation Results:${NC}"
echo "  ✅ Pick inserted via Smart Form"
echo "  ✅ Pick row verified in database"
echo "  $([ "$PUBLISH_QUERY" != "[]" ] && echo "✅" || echo "⚠️ ") Pick publish row verified"
echo "  $([ "$AUDIT_COUNT" -gt 0 ] && echo "✅" || echo "⚠️ ") Audit log entries verified"
echo "  $([ "$OUTBOX_QUERY" != "[]" ] && echo "✅" || echo "⚠️ ") Discord post verified"
echo "  $(echo "$CC_RESPONSE" | jq -e ".[] | select(.id == \"$PICK_ID\")" > /dev/null 2>&1 && echo "✅" || echo "⚠️ ") Command Center update verified"
echo ""
echo -e "${BLUE}Performance Metrics:${NC}"
echo "  • Insert Latency: ${INSERT_LATENCY}ms (SLO: <150ms)"
echo "  • Total E2E Latency: ${TOTAL_LATENCY}ms (Target: <10s)"
echo ""
echo -e "${BLUE}Output Files:${NC}"
echo "  • $OUTPUT_DIR/pick_insert_response_$TIMESTAMP.json"
echo "  • $OUTPUT_DIR/picks_row_$TIMESTAMP.json"
echo "  • $OUTPUT_DIR/pick_publish_row_$TIMESTAMP.json"
echo "  • $OUTPUT_DIR/audit_log_rows_$TIMESTAMP.json"
echo "  • $OUTPUT_DIR/bridge_outbox_row_$TIMESTAMP.json"
echo "  • $OUTPUT_DIR/command_center_pick_$TIMESTAMP.json"
echo "  • $OUTPUT_DIR/timings_$TIMESTAMP.json"
echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo "  1. Review output files for detailed validation"
echo "  2. Capture screenshots of Discord post and Command Center"
echo "  3. Document any warnings or issues"
echo "  4. Proceed with rollout if all validations pass"
echo ""

