#!/usr/bin/env bash
set -euo pipefail

RUNID=$(date -u +"%Y-%m-%dT%H-%M-%S")
OUTDIR="apps/api/out/ops/ingest"; mkdir -p "$OUTDIR"

SUPABASE_URL="${SUPABASE_URL:?missing}"
SRK="${SUPABASE_SERVICE_ROLE_KEY:?missing}"
API_KEY="${ODDS_API_KEY:?missing}"
REGIONS="${ODDS_FEED_REGIONS:-us}"
BOOKS="${ODDS_FEED_BOOKMAKERS:-dk,caesars,betmgm,fd}"
LOOK="${ODDS_FEED_LOOKAHEAD_HOURS:-72}"
PROP_KEYS="${ODDS_MLB_PROP_KEYS:-batter_hits,batter_total_bases,batter_home_runs,batter_rbis,batter_runs_scored}"
SYS_UID="${SYSTEM_USER_ID:-00000000-0000-0000-0000-000000000001}"

# 1) List MLB events
curl -sS "https://api.the-odds-api.com/v4/sports/baseball_mlb/events?apiKey=${API_KEY}" > "$OUTDIR/mlb_events_${RUNID}.json"

# 2) Window next LOOK hours
CUTOFF=$(date -u -d "+${LOOK} hours" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v+${LOOK}H +"%Y-%m-%dT%H:%M:%SZ")
jq --arg cutoff "$CUTOFF" '[ .[] | select(.commence_time <= $cutoff) ]' "$OUTDIR/mlb_events_${RUNID}.json" > "$OUTDIR/mlb_events_window_${RUNID}.json"
jq -r '.[].id' "$OUTDIR/mlb_events_window_${RUNID}.json" > "$OUTDIR/mlb_event_ids_${RUNID}.txt"
EVENT_COUNT=$(wc -l < "$OUTDIR/mlb_event_ids_${RUNID}.txt" | tr -d ' ')

# 3) Per-event props (rate-limit friendly)
> "$OUTDIR/mlb_props_rows_${RUNID}.ndjson"
while read -r EID; do
  URL="https://api.the-odds-api.com/v4/sports/baseball_mlb/events/${EID}/odds?regions=${REGIONS}&bookmakers=${BOOKS}&markets=${PROP_KEYS}&oddsFormat=american&dateFormat=iso&apiKey=${API_KEY}"
  RESP="$OUTDIR/event_${EID}_props_${RUNID}.json"
  curl -sS "$URL" > "$RESP"

  jq --arg sys "$SYS_UID" '
    def am_payout(odds; stake):
      if (odds|tonumber) >= 100 then (stake * ((odds|tonumber)/100.0)) + stake
      elif (odds|tonumber) <= -100 then (stake * (100.0/((-1)*(odds|tonumber)))) + stake
      else stake end;

    . as $root
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
        odds: ((.price // .odds // 0)|tonumber),
        line: ( (if has("point") then .point else .line end) // null | tonumber? ),
        bookmaker_key: .bm,
        game_id: $root.id,
        game_date: $root.commence_time,
        posted_at: (now|todate),
        user_id: $sys,
        pick_type: "automated",
        stake: 1,
        potential_payout: (am_payout((.price // .odds // 0)|tonumber; 1))
      }
  ' "$RESP" >> "$OUTDIR/mlb_props_rows_${RUNID}.ndjson"

  sleep 0.35
done < "$OUTDIR/mlb_event_ids_${RUNID}.txt"

ROW_COUNT=$(wc -l < "$OUTDIR/mlb_props_rows_${RUNID}.ndjson" | tr -d ' ')
echo "{\"runId\":\"$RUNID\",\"events\":$EVENT_COUNT,\"rows\":$ROW_COUNT}" > "$OUTDIR/mlb_props_counts_${RUNID}.json"

# 4) Supabase REST upsert in batches (ignore duplicates)
BATCH=200
i=0; INSERTED=0; SKIPPED=0; ERRORS=0
while read -r; do
  batch_file="$OUTDIR/batch_${RUNID}_$i.json"
  echo "[" > "$batch_file"
  echo "$REPLY" >> "$batch_file"
  j=1
  while [ $j -lt $BATCH ] && read -r; do
    echo "," >> "$batch_file"
    echo "$REPLY" >> "$batch_file"
    j=$((j+1))
  done
  echo "]" >> "$batch_file"

  HTTP_CODE=$(curl -sS -o "$batch_file.out" -w "%{http_code}" \
    -H "apikey: $SRK" \
    -H "Authorization: Bearer $SRK" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=ignore-duplicates,return=representation" \
    --data @"$batch_file" \
    "${SUPABASE_URL}/rest/v1/unified_picks?on_conflict=sport,source,market,selection,bookmaker_key,game_date,line,game_id")

  if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    ADDED=$(jq 'length' "$batch_file.out")
    INSERTED=$((INSERTED + ADDED))
    SKIPPED=$((SKIPPED + (j - ADDED)))
  else
    ERRORS=$((ERRORS + j))
    mv "$batch_file.out" "$batch_file.err"
  fi
  i=$((i+1))
done < "$OUTDIR/mlb_props_rows_${RUNID}.ndjson"

SUMMARY="$OUTDIR/mlb_props_ingest_summary_${RUNID}.json"
echo "{\"runId\":\"$RUNID\",\"events\":$EVENT_COUNT,\"attempted\":$ROW_COUNT,\"inserted\":$INSERTED,\"skippedDedup\":$SKIPPED,\"errors\":$ERRORS}" | tee "$SUMMARY"
