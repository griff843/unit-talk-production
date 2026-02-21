# Local Development Runbook

**Sprint**: SPRINT-OPS-DAY-CROSS-SHELL-ENTRYPOINT-100A **Date**: 2026-02-21

---

## THE ONE TRUE WAY

There is exactly ONE canonical command to start a production workday locally:

```bash
pnpm ops:day
```

**This command works from ANY shell on ANY platform:**

| Shell      | Platform    | Works? |
| ---------- | ----------- | ------ |
| PowerShell | Windows     | YES    |
| CMD        | Windows     | YES    |
| Git Bash   | Windows     | YES    |
| bash       | macOS/Linux | YES    |

This command:

1. Enforces DB truth (DB_MODE cloud|local, fail-closed)
2. Brings up the correct Docker Compose stack
3. Waits for all services to become healthy
4. Asserts /ops/status is healthy with no mismatches
5. Runs required E2E proofs
6. Exits non-zero on ANY failure

### Usage

```bash
# Cloud mode (default) - uses Supabase
pnpm ops:day

# Local mode - uses local postgres container
pnpm ops:day local
```

### Cross-Platform Implementation

The `pnpm ops:day` command uses a Node.js wrapper (`ops/day.mjs`) that:

- Detects the OS via `process.platform`
- On Windows: invokes `ops/day.ps1` via PowerShell
- On Unix: invokes `ops/day.sh` via bash
- Forwards arguments correctly to both scripts
- Exits non-zero if the underlying script fails (fail-closed)

**You no longer need to run different commands on Windows vs Unix.** Just use
`pnpm ops:day` from any shell.

---

## DEPRECATED Entrypoints

The following are **DEPRECATED** and will be removed:

| Script                       | Status      | Replacement    |
| ---------------------------- | ----------- | -------------- |
| `dev.sh`                     | DEPRECATED  | `pnpm ops:day` |
| `npm run dev:all`            | DEPRECATED  | `pnpm ops:day` |
| `.\ops\day.ps1` (direct)     | DISCOURAGED | `pnpm ops:day` |
| `bash ops/day.sh` (direct)   | DISCOURAGED | `pnpm ops:day` |
| `docker compose up` (direct) | DISCOURAGED | `pnpm ops:day` |

**DO NOT** use these scripts directly. Always use `pnpm ops:day` for:

- Consistent cross-platform behavior
- DB truth enforcement
- Required E2E proofs

---

## DB_MODE Explained

The platform runs in exactly ONE database mode at a time:

| Mode    | Description                   | When to Use                     |
| ------- | ----------------------------- | ------------------------------- |
| `cloud` | Connects to Supabase cloud    | Production-like development     |
| `local` | Runs local postgres container | Offline development, migrations |

### How DB_MODE is Enforced

1. `pnpm ops:day` sets `DB_MODE` environment variable
2. Docker Compose passes `DB_MODE` to all services
3. API validates `DB_MODE` at boot (fail-closed)
4. `/ops/status` reports current mode
5. Any mismatch = boot failure

### Mismatch Examples (Will Fail)

- `DB_MODE=cloud` but `DATABASE_URL` points to localhost → FAIL
- `DB_MODE=local` but `SUPABASE_URL` points to cloud → FAIL
- Workers have different DB_MODE than API → FAIL

---

## Service URLs

After `pnpm ops:day` completes successfully:

| Service        | Port | URL                   |
| -------------- | ---- | --------------------- |
| Smart Form     | 3002 | http://localhost:3002 |
| Command Center | 3004 | http://localhost:3004 |
| Dashboard      | 3003 | http://localhost:3003 |
| API            | 3010 | http://localhost:3010 |
| Workers        | 3021 | http://localhost:3021 |
| Grafana        | 3001 | http://localhost:3001 |
| Prometheus     | 9090 | http://localhost:9090 |
| Temporal UI    | 8088 | http://localhost:8088 |

---

## Understanding /ops/status

The `/ops/status` endpoint reports system health:

```bash
curl http://localhost:3010/ops/status | jq .
```

### Key Fields

```json
{
  "overall_ready": true,
  "reasons": [],
  "components": {
    "db": {
      "mode": "cloud",
      "target": "xxxx.supabase.co/supabase",
      "mismatchDetected": false
    },
    "discord": {
      "ready": true,
      "worker_healthy": true,
      "last_post_at": "2026-02-21T..."
    },
    "outbox": {
      "pending_count": 0,
      "failed_count": 0
    }
  }
}
```

### Interpreting Status

| Field                    | Meaning                             |
| ------------------------ | ----------------------------------- |
| `overall_ready`          | All systems go                      |
| `db.mismatchDetected`    | CRITICAL: DB configuration conflict |
| `discord.worker_healthy` | Discord ticket worker is running    |
| `outbox.failed_count`    | Number of failed Discord posts      |

---

## Running Proofs Manually

To re-run proof scripts:

```bash
# Required: E2E receipt proof
node scripts/e2e-receipt-proof.mjs

# Recommended: DB mode proof
node scripts/proof-db-mode-095a.mjs
```

Proof bundles are stored in:

```
out/sprints/<SPRINT-ID>/<DATE>/proofs/
```

---

## Troubleshooting

### "DB MODE MISMATCH" Error

**Cause**: Environment variables point to different databases.

**Fix**:

1. Check `.env` - ensure consistent SUPABASE_URL / DATABASE_URL
2. Run `pnpm ops:day` again with correct mode
3. For local: ensure `docker-compose.local.yml` exists

### "Services did not become healthy"

**Cause**: Docker containers failing to start.

**Fix**:

```bash
docker compose ps
docker compose logs api
docker compose logs workers
```

### "/ops/status unreachable"

**Cause**: API not responding.

**Fix**:

```bash
docker compose logs api
# Check for boot failures (DB mismatch, missing env)
```

### Temporal UI Degraded

**Note**: Temporal health issues do NOT block the Discord ticket pipeline. The
warning is informational only.

---

## Environment Variables

### Required (Cloud Mode)

| Key                                 | Description               |
| ----------------------------------- | ------------------------- |
| `SUPABASE_URL`                      | Supabase project URL      |
| `SUPABASE_SERVICE_ROLE_KEY`         | Service role key          |
| `DISCORD_WEBHOOK_URL`               | Discord webhook for posts |
| `DEFAULT_DISCORD_TICKET_CHANNEL_ID` | Target channel            |
| `ENABLE_DISCORD_TICKET_WORKER`      | Must be `true`            |

### Required (Local Mode)

| Key            | Description               |
| -------------- | ------------------------- |
| `DATABASE_URL` | Local postgres connection |

---

## Sprint Reference

- **SPRINT-OPS-DAY-CROSS-SHELL-ENTRYPOINT-100A**: Cross-platform entrypoint
- **SPRINT-ENTRYPOINT-CANONICALIZATION-097A**: Original ops:day scripts
- **SPRINT-DB-MODE-TRUTH-LOCK-095A**: DB mode enforcement
- **SPRINT-FOUNDATION-TRUTH-LOCK-094A**: Runtime truth lock
- **SPRINT-END-TO-END-TICKET-LIFECYCLE-TRUTH-093**: Worker heartbeats
