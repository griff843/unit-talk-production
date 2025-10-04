#!/usr/bin/env python3
import os
import json
import time
import requests
import uuid
import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Config
RUNID = datetime.utcnow().strftime("%Y-%m-%dT%H-%M-%S")
OUTDIR = Path("apps/api/out/ops/ingest")
OUTDIR.mkdir(parents=True, exist_ok=True)

# Load env
SUPABASE_URL = os.getenv("SUPABASE_URL")
SRK = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
API_KEY = os.getenv("ODDS_API_KEY")
REGIONS = os.getenv("ODDS_FEED_REGIONS", "us")
BOOKS = os.getenv("ODDS_FEED_BOOKMAKERS", "dk,caesars,betmgm,fd")
LOOK = int(os.getenv("ODDS_FEED_LOOKAHEAD_HOURS", "72"))
PROP_KEYS = os.getenv("ODDS_MLB_PROP_KEYS", "batter_hits,batter_total_bases,batter_home_runs,batter_rbis,batter_runs_scored")
SYS_UID = os.getenv("SYSTEM_USER_ID", "00000000-0000-0000-0000-000000000001")

print(f"=== MLB Props Ingest Run {RUNID} ===")
print(f"Props: {PROP_KEYS}")
print(f"Books: {BOOKS}")

# 2A) Fetch MLB events
print("Fetching MLB events...")
resp = requests.get(f"https://api.the-odds-api.com/v4/sports/baseball_mlb/events?apiKey={API_KEY}")
resp.raise_for_status()
events = resp.json()

# 2B) Filter to events within LOOK hours
cutoff = datetime.now(timezone.utc) + timedelta(hours=LOOK)
events_window = [e for e in events if datetime.fromisoformat(e["commence_time"].replace("Z", "+00:00")) <= cutoff]
print(f"Found {len(events_window)} events within {LOOK}h window")

if len(events_window) == 0:
    with open(OUTDIR / f"mlb_props_counts_{RUNID}.json", "w") as f:
        json.dump({"runId": RUNID, "events": 0, "rows": 0}, f)
    print("No events to process.")
    exit(0)

# 2C) Fetch props for each event
print("Fetching props for each event...")
all_rows = []
for event in events_window:
    eid = event["id"]
    url = f"https://api.the-odds-api.com/v4/sports/baseball_mlb/events/{eid}/odds"
    params = {
        "regions": REGIONS,
        "bookmakers": BOOKS,
        "markets": PROP_KEYS,
        "oddsFormat": "american",
        "dateFormat": "iso",
        "apiKey": API_KEY
    }
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    data = resp.json()
    
    # Transform to unified_picks rows
    for bookmaker in data.get("bookmakers", []):
        for market in bookmaker.get("markets", []):
            market_key = market.get("key", "")
            for outcome in market.get("outcomes", []):
                odds = int(round(outcome.get("price", outcome.get("odds", 0))))
                line = outcome.get("point", outcome.get("line"))
                if isinstance(line, str):
                    try:
                        line = float(line)
                    except:
                        line = None

                # Calculate potential payout (American odds)
                if odds >= 100:
                    potential_payout = 1 + (1 * (odds / 100.0))
                elif odds <= -100:
                    potential_payout = 1 + (1 * (100.0 / abs(odds)))
                else:
                    potential_payout = 1

                # Convert game_id to UUID via deterministic hash
                game_id_hash = hashlib.sha256(data["id"].encode()).digest()
                game_id_uuid = str(uuid.UUID(bytes=game_id_hash[:16]))

                # Build selection string: "Player Name market_key Over/Under"
                player_name = outcome.get("description", outcome.get("name", "Unknown"))
                direction = outcome.get("name", "")
                selection = f"{player_name} {market_key} {direction}" if direction else f"{player_name} {market_key}"

                row = {
                    "sport": "mlb",
                    "source": "odds-api",
                    "market": market_key,
                    "selection": selection,
                    "odds": odds,
                    "line": line,
                    "bookmaker_key": bookmaker["key"],
                    "game_id": game_id_uuid,
                    "game_date": data["commence_time"],
                    "posted_at": datetime.utcnow().isoformat() + "Z",
                    "user_id": SYS_UID,
                    "pick_type": "total",  # Try a different valid pick_type value
                    "stake": 1,
                    "potential_payout": potential_payout
                }
                all_rows.append(row)
    
    time.sleep(0.35)  # Rate limit

print(f"Generated {len(all_rows)} prop rows")
with open(OUTDIR / f"mlb_props_counts_{RUNID}.json", "w") as f:
    json.dump({"runId": RUNID, "events": len(events_window), "rows": len(all_rows)}, f)

if len(all_rows) == 0:
    print("No props found")
    exit(0)

# 2D) Upload to Supabase in batches
print(f"Uploading {len(all_rows)} rows to Supabase...")
BATCH = 200
inserted = 0
skipped = 0
errors = 0

for i in range(0, len(all_rows), BATCH):
    batch = all_rows[i:i+BATCH]
    headers = {
        "apikey": SRK,
        "Authorization": f"Bearer {SRK}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation"
    }

    resp = requests.post(f"{SUPABASE_URL}/rest/v1/unified_picks", json=batch, headers=headers)

    if resp.status_code >= 200 and resp.status_code < 300:
        added = len(resp.json()) if resp.text else 0
        inserted += added
        skipped += (len(batch) - added)
        print(f"Batch {i//BATCH}: HTTP {resp.status_code}, inserted {added}, skipped {len(batch) - added}")
    elif resp.status_code == 409:
        # Duplicate - treat as skipped
        skipped += len(batch)
        print(f"Batch {i//BATCH}: HTTP 409 (duplicates skipped), batch size {len(batch)}")
    else:
        errors += len(batch)
        print(f"Batch {i//BATCH} failed: HTTP {resp.status_code}")
        print(f"Full error: {resp.text[:500]}")
        # Save first failed row for debugging
        with open(OUTDIR / f"failed_batch_{i//BATCH}.json", "w") as f:
            json.dump(batch[0], f, indent=2)
        break  # Stop after first error to debug

summary = {
    "runId": RUNID,
    "events": len(events_window),
    "attempted": len(all_rows),
    "inserted": inserted,
    "skippedDedup": skipped,
    "errors": errors
}
with open(OUTDIR / f"mlb_props_ingest_summary_{RUNID}.json", "w") as f:
    json.dump(summary, f, indent=2)

print(json.dumps(summary, indent=2))
print("=== Ingest Complete ===")
