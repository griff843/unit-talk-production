# Local Development Runbook

**Sprint**: SPRINT-FOUNDATION-TRUTH-LOCK-094A **Date**: 2026-02-21

---

## Official Local Development Runtime

### Primary: Direct Node Mode

This repository supports **direct node mode** as the primary local development
runtime.

```bash
# One command brings up truth (recommended)
npm run dev:all

# Or start services individually:
npm run dev --workspace=apps/api        # API on port 3010
npm run dev --workspace=apps/smart-form # Smart Form on port 3021
npm run dev --workspace=apps/command-center # Command Center on port 3004
```

### Secondary: Docker Compose (Optional)

Docker Compose is available for full-stack testing but requires Docker Desktop:

```bash
# Start full stack
docker compose up -d

# Check status
docker compose ps

# Stop
docker compose down
```

---

## Environment Configuration

### Root .env (Required)

All apps load environment variables from the root `.env` file. Copy
`.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Required Keys

| Key                                 | Description          | Used By        |
| ----------------------------------- | -------------------- | -------------- |
| `SUPABASE_URL`                      | Supabase project URL | API, Workers   |
| `SUPABASE_SERVICE_ROLE_KEY`         | Service role key     | API, Workers   |
| `NEXT_PUBLIC_SUPABASE_URL`          | Public Supabase URL  | Smart Form, CC |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`     | Anon key             | Smart Form, CC |
| `DISCORD_WEBHOOK_URL`               | Discord webhook      | Worker         |
| `DEFAULT_DISCORD_TICKET_CHANNEL_ID` | Channel ID           | Smart Form     |
| `ENABLE_DISCORD_TICKET_WORKER`      | Worker toggle        | API            |

### App-Specific .env Files

For direct node development, apps may have their own `.env.local` files:

- `apps/smart-form/.env.local` - Smart Form overrides
- `apps/command-center/.env.local` - Command Center overrides

**IMPORTANT**: These MUST point to the SAME Supabase instance as root `.env`.

---

## Verification Commands

### Check Environment Health

```bash
# Run env audit (after Phase 2 implementation)
npm run env:audit

# Check API health
curl http://localhost:3010/api/health

# Check Discord routing status
curl http://localhost:3010/ops/discord-routing-status

# Check Smart Form
curl http://localhost:3021/api/health
```

### Check Supabase Connectivity

```bash
# All apps should connect to same Supabase
grep "SUPABASE_URL" .env apps/*/.env.local 2>/dev/null | sort -u
```

---

## Troubleshooting

### "Multiple Truths" Detection

If you see different Supabase URLs across apps:

1. Check root `.env` SUPABASE_URL
2. Check `apps/smart-form/.env.local`
3. Check `apps/command-center/.env.local`
4. Ensure all point to same instance

### Worker Not Running

1. Check `ENABLE_DISCORD_TICKET_WORKER=true` in root `.env`
2. Check `DISCORD_WEBHOOK_URL` is configured
3. Check `DEFAULT_DISCORD_TICKET_CHANNEL_ID` is set
4. Check worker heartbeats:
   `curl http://localhost:3010/ops/discord-routing-status`

---

## Port Reference

| Service        | Port | URL                   |
| -------------- | ---- | --------------------- |
| API            | 3010 | http://localhost:3010 |
| Smart Form     | 3021 | http://localhost:3021 |
| Command Center | 3004 | http://localhost:3004 |
| Grafana        | 3001 | http://localhost:3001 |
| Temporal UI    | 8088 | http://localhost:8088 |
| Prometheus     | 9090 | http://localhost:9090 |

---

## Sprint Reference

- SPRINT-FOUNDATION-TRUTH-LOCK-094A: Runtime truth lock
- SPRINT-END-TO-END-TICKET-LIFECYCLE-TRUTH-093: Worker heartbeats
- SPRINT-DISCORD-OUTBOX-ROUTING-CLAIM-092: Atomic claim
