# Journal Backup Procedure

**Sprint**: SPRINT-044-LAYER2-PHASE8-RECOVERY-REPLAY **Layer/Phase**: Layer 2 /
Phase 8 — Recovery & Replay **Date**: 2026-03-14 **Authority**: Primary
reference for event journal backup and restore operations

---

## Overview

The production event journal is a JSONL file maintained by
`ProductionEventRecorder`. It records every significant lifecycle event (pick
submitted, graded, posted, settled, recap triggered) as append-only, timestamped
entries. This journal is the source of truth for deterministic replay via
`ReplayOrchestrator`.

**Journal location** (default, set via `JOURNAL_PATH` env var):

```
/app/data/events/production.jsonl
```

**Journal format**: One JSON object per line. Each event has:

| Field            | Type   | Description                              |
| ---------------- | ------ | ---------------------------------------- |
| `eventId`        | string | UUID — unique per event                  |
| `eventType`      | string | `PICK_SUBMITTED`, `PICK_GRADED`, etc.    |
| `pickId`         | string | Pick UUID (absent for `RECAP_TRIGGERED`) |
| `timestamp`      | string | Virtual clock position (ISO 8601)        |
| `sequenceNumber` | number | Monotonic ordering key                   |
| `payload`        | object | Event-specific data                      |
| `producedAt`     | string | Wall clock when recorded (audit only)    |

---

## Backup Procedure

### Automated backup (recommended)

The API container should have a cron job or sidecar that copies the journal to
durable storage on a regular schedule:

```bash
# Example: copy to S3 every 15 minutes
aws s3 cp /app/data/events/production.jsonl \
  s3://unit-talk-backups/journals/production-$(date +%Y%m%d-%H%M).jsonl
```

### Manual backup (operator)

```bash
# 1. SSH or exec into the API container
docker-compose exec api bash

# 2. Verify journal exists and is non-empty
ls -lh /app/data/events/production.jsonl
wc -l /app/data/events/production.jsonl

# 3. Copy to a timestamped backup
cp /app/data/events/production.jsonl \
   /app/data/events/production-backup-$(date +%Y%m%d-%H%M%S).jsonl

# 4. (Optional) Copy to host machine
docker-compose cp api:/app/data/events/production.jsonl \
  ./backups/production-$(date +%Y%m%d-%H%M%S).jsonl
```

### Before any high-risk operation

Always take a manual backup before:

- Container restart or re-deploy
- Schema migrations affecting lifecycle tables
- Manual pick overrides affecting a large batch
- Incident recovery replay (the replay does NOT modify the journal)

---

## Restore Procedure

The journal is **append-only** — restoring means placing a backup file at the
expected path before the API container starts.

```bash
# 1. Stop the API container
docker-compose stop api

# 2. Copy backup into place
docker-compose cp ./backups/production-<TIMESTAMP>.jsonl \
  api:/app/data/events/production.jsonl

# 3. Verify line count matches expectation
docker-compose run --rm api \
  sh -c "wc -l /app/data/events/production.jsonl"

# 4. Start the API container
docker-compose start api
```

---

## Incident Recovery via Replay

Once a journal backup is in place, run a deterministic replay to verify the
event history produces consistent final state. See:

- `docs/ops/ON_CALL_RUNBOOK.md §Scenario 6 — Incident Recovery via Replay`
- API endpoint: `POST /ops/recovery/replay`

```bash
curl -X POST \
  -H "Authorization: Bearer admin-$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "journalPath": "/app/data/events/production.jsonl",
    "eventWindow": {
      "from": "2026-03-14T00:00:00.000Z",
      "to": "2026-03-14T23:59:59.999Z"
    }
  }' \
  $API_URL/ops/recovery/replay
```

**Success response**:

```json
{
  "success": true,
  "data": {
    "replayId": "replay-1710432000000-abc12345",
    "divergences": 0,
    "proofPath": "/app/out/replay-runs/replay-1710432000000-abc12345",
    "status": "PASS",
    "eventsProcessed": 142,
    "durationMs": 312,
    "determinismHash": "a1b2c3..."
  }
}
```

**`status: "FAIL"`** means `divergences > 0` — replay errors were detected.
Inspect the proof bundle at `proofPath/errors.jsonl` for details.

---

## Journal Health Checks

```bash
# Check journal file exists and is writable
docker-compose exec api \
  sh -c "test -f /app/data/events/production.jsonl && echo OK || echo MISSING"

# Count events in the last hour
docker-compose exec api \
  sh -c "grep -c '$(date -u -d '1 hour ago' +%Y-%m-%dT%H)' /app/data/events/production.jsonl || echo 0"

# Check for truncation (non-zero file, ends with newline)
docker-compose exec api \
  sh -c "tail -c 1 /app/data/events/production.jsonl | xxd | grep -q '0a' && echo INTACT || echo TRUNCATED"
```

---

## See Also

- `ProductionEventRecorder`:
  `apps/api/src/lib/verification/production-event-recorder.ts`
- `JournalEventStore`: `apps/api/src/lib/verification/event-store.ts`
- `ReplayOrchestrator`: `apps/api/src/lib/verification/replay-orchestrator.ts`
- Recovery API: `apps/api/src/routes/ops-recovery.ts`
- On-call runbook: `docs/ops/ON_CALL_RUNBOOK.md`
