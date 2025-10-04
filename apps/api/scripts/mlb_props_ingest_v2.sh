#!/usr/bin/env bash
set -euo pipefail

# Add local bin to PATH for jq
export PATH="$(pwd)/bin:$PATH"

# Check args
if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ] || [ -z "${ODDS_API_KEY:-}" ]; then
  echo "ERROR: Required env vars not set. Please source .env files before running."
  exit 1
fi

RUNID=$(date -u +"%Y-%m-%dT%H-%M-%S")
OUTDIR="apps/api/out/ops/ingest"
mkdir -p "$OUTDIR"

REGIONS="${ODDS_FEED_REGIONS:-us}"
BOOKS="${ODDS_FEED_BOOKMAKERS:-dk,caesars,betmgm,fd}"
LOOK="${ODDS_FEED_LOOKAHEAD_HOURS:-72}"
PROP_KEYS="${ODDS_MLB_PROP_KEYS:-batter_hits,batter_total_bases,batter_home_runs,batter_rbis,batter_runs_scored}"
SYS_UID="${SYSTEM_USER_ID:-00000000-0000-0000-0000-000000000001}"

echo "=== MLB Props Ingest Run $RUNID ==="
echo "Props: $PROP_KEYS"
echo "Books: $BOOKS"

# 2A) list MLB events
echo "Fetching MLB events..."
curl -sS "https://api.the-odds-api.com/v4/sports/baseball_mlb/events?apiKey=${ODDS_API_KEY}" > "$OUTDIR/mlb_events_${RUNID}.json"

# 2B) keep only events in next LOOK hours
CUTOFF=$(date -u -d "+${LOOK} hours" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v+${LOOK}H +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")
jq --arg cutoff "$CUTOFF" '[ .[] | select(.commence_time <= $cutoff) ]' "$OUTDIR/mlb_events_${RUNID}.json" > "$OUTDIR/mlb_events_window_${RUNID}.json"
jq -r '.[].id' "$OUTDIR/mlb_events_window_${RUNID}.json" > "$OUTDIR/mlb_event_ids_${RUNID}.txt"
EVENT_COUNT=$(wc -l < "$OUTDIR/mlb_event_ids_${RUNID}.txt" | tr -d ' ')
echo "Found $EVENT_COUNT events within ${LOOK}h window"

if [ "$EVENT_COUNT" = "0" ]; then
  echo "No events to process. Exiting."
  echo "{\"runId\":\"$RUNID\",\"events\":0,\"rows\":0}" > "$OUTDIR/mlb_props_counts_${RUNID}.json"
  exit 0
fi

# 2C) fetch per-event props (rate-limit friendly)
echo "Fetching props for each event..."
> "$OUTDIR/mlb_props_rows_${RUNID}.ndjson"
while read -r EID; do
  URL="https://api.the-odds-api.com/v4/sports/baseball_mlb/events/${EID}/odds?regions=${REGIONS}&bookmakers=${BOOKS}&markets=${PROP_KEYS}&oddsFormat=american&dateFormat=iso&apiKey=${ODDS_API_KEY}"
  RESP="$OUTDIR/event_${EID}_props_${RUNID}.json"
  curl -sS "$URL" > "$RESP"

  # Map to unified_picks rows as NDJSON
  jq --arg sys "$SYS_UID" --arg gid "$EID" '
    def am_payout(odds; stake):
      if (odds|tonumber) >= 100 then (stake * ( (odds|tonumber) / 100.0 ) ) + stake
      elif (odds|tonumber) <= -100 then (stake * ( 100.0 / ((-1 * (odds|tonumber))) )) + stake
      else stake end;

    . as $root
    | ($root.id // $gid) as $game_id
    | ($root.commence_time) as $gtime
    | ($root.bookmakers // [])[]
    | {bm: .key, markets: (.markets // [])}
    | .markets[]
    | . as $m
    | ($m.outcomes // [])[]
    | {
        sport: "mlb",
        source: "odds-api",
        market: "player_props",
        selection: (.name // .description // ""),
        odds: ((.price // .odds // 0)|tonumber|round),
        line: ( (if has("point") then .point else if has("line") then .line else null end end) // null | if . then tonumber else null end ),
        bookmaker_key: $bm,
        game_id: $game_id,
        game_date: $gtime,
        posted_at: (now|todate),
        user_id: $sys,
        pick_type: "automated",
        stake: 1,
        potential_payout: (am_payout((.price // .odds // 0)|tonumber; 1))
      }
    ' "$RESP" >> "$OUTDIR/mlb_props_rows_${RUNID}.ndjson" 2>/dev/null || true

  # polite pacing for API
  sleep 0.35
done < "$OUTDIR/mlb_event_ids_${RUNID}.txt"

ROW_COUNT=$(wc -l < "$OUTDIR/mlb_props_rows_${RUNID}.ndjson" | tr -d ' ')
echo "{\"runId\":\"$RUNID\",\"events\":$EVENT_COUNT,\"rows\":$ROW_COUNT}" | tee "$OUTDIR/mlb_props_counts_${RUNID}.json"

if [ "$ROW_COUNT" = "0" ]; then
  echo "No prop rows generated. Check API responses in $OUTDIR/event_*_props_${RUNID}.json"
  exit 0
fi

# 2D) POST to Supabase REST in batches (upsert via on_conflict)
echo "Uploading $ROW_COUNT rows to Supabase..."
BATCH=200
i=0
INSERTED=0
SKIPPED=0
ERRORS=0

while IFS= read -r line; do
  if [ $((i % BATCH)) -eq 0 ]; then
    batch_file="$OUTDIR/batch_${RUNID}_$((i / BATCH)).json"
    echo "[" > "$batch_file"
    echo "$line" >> "$batch_file"
  else
    echo "," >> "$batch_file"
    echo "$line" >> "$batch_file"
  fi
  
  i=$((i + 1))
  
  # Send batch when full or at end
  if [ $((i % BATCH)) -eq 0 ] || [ "$i" -eq "$ROW_COUNT" ]; then
    echo "]" >> "$batch_file"
    
    HTTP_CODE=$(curl -sS -o "$batch_file.out" -w "%{http_code}" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" \
      -H "Prefer: resolution=ignore-duplicates,return=representation" \
      --data @"$batch_file" \
      "${SUPABASE_URL}/rest/v1/unified_picks")
    
    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
      ADDED=$(jq 'length' "$batch_file.out" 2>/dev/null || echo "0")
      INSERTED=$((INSERTED + ADDED))
      BATCH_SIZE=$(jq 'length' "$batch_file" 2>/dev/null || echo "0")
      SKIPPED=$((SKIPPED + (BATCH_SIZE - ADDED)))
      echo "Batch $((i / BATCH)): HTTP $HTTP_CODE, inserted $ADDED, skipped $((BATCH_SIZE - ADDED))"
    else
      BATCH_SIZE=$(jq 'length' "$batch_file" 2>/dev/null || echo "0")
      ERRORS=$((ERRORS + BATCH_SIZE))
      mv "$batch_file.out" "$batch_file.err"
      echo "Batch $((i / BATCH)) failed with HTTP $HTTP_CODE"
      head -20 "$batch_file.err"
    fi
  fi
done < "$OUTDIR/mlb_props_rows_${RUNID}.ndjson"

echo "{\"runId\":\"$RUNID\",\"events\":$EVENT_COUNT,\"attempted\":$ROW_COUNT,\"inserted\":$INSERTED,\"skippedDedup\":$SKIPPED,\"errors\":$ERRORS}" \
  | tee "$OUTDIR/mlb_props_ingest_summary_${RUNID}.json"

echo "=== Ingest Complete ==="
