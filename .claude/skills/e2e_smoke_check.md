# Skill: E2E Smoke Check

> Model tier: **Haiku** — scripted test execution, pass/fail reporting

## Purpose

Run quick smoke tests to verify critical user flows are working.

## Invocation

```
/smoke-check [scope]
```

Scope: `all`, `api`, `smart-form`, `discord`, `pipeline`

## Procedure

### Step 1: Check Services Running

```bash
./dev.sh status
# or
docker-compose ps
```

All critical services must be running:

- api
- smart-form
- discord-bot (if testing Discord flows)

### Step 2: Health Checks

#### API Health

```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok"}`

#### Pipeline Health

```bash
curl http://localhost:3000/api/pipeline/health
```

Expected: `{"status":"ok","agents":{...}}`

### Step 3: Database Connectivity

```bash
docker-compose exec api npm run db:status
```

Expected: Connection successful, schema valid

### Step 4: Run E2E Tests

```bash
npm run test:e2e
```

Or specific suites:

```bash
# API endpoints
npm run test:e2e -- --testPathPattern="api"

# Smart Form flows
npm run test:e2e -- --testPathPattern="smart-form"

# Discord integration
npm run test:e2e -- --testPathPattern="discord"
```

### Step 5: Critical Flow Verification

#### Smart Form Submission Flow

1. Form renders
2. Validation works
3. Submission creates bridge_outbox entry
4. No direct unified_picks write

#### Grading Flow

1. GradingAgent picks up outbox entry
2. Processes and grades
3. Creates unified_pick via lifecycleInsert
4. Updates outbox entry

#### Discord Posting Flow

1. DiscordPromotionAgent finds promotable picks
2. Claims pick via atomicClaimForPost
3. Posts to Discord
4. Updates via lifecycleUpdate

### Step 6: Generate Report

```markdown
# E2E Smoke Check Report

**Date**: <date> **Scope**: <scope>

## Service Status

| Service     | Status       |
| ----------- | ------------ |
| API         | ✅ Running   |
| Smart Form  | ✅ Running   |
| Discord Bot | ✅ Running   |
| Database    | ✅ Connected |

## Health Checks

| Endpoint             | Status | Response |
| -------------------- | ------ | -------- |
| /health              | ✅     | ok       |
| /api/pipeline/health | ✅     | ok       |

## E2E Tests

| Suite      | Status | Tests |
| ---------- | ------ | ----- |
| API        | ✅     | X/X   |
| Smart Form | ✅     | X/X   |
| Discord    | ✅     | X/X   |

## Critical Flows

| Flow                | Status |
| ------------------- | ------ |
| Smart Form → Outbox | ✅     |
| Outbox → Grading    | ✅     |
| Grading → Discord   | ✅     |

## Smoke Check: ✅ PASSED
```

## Failure Response

If any check fails:

1. **Identify failure** - Which service/test/flow
2. **Check logs** - `./dev.sh logs <service>`
3. **Diagnose** - Network, database, code issue?
4. **Fix or escalate** - Address if possible

## Quick Commands

```bash
# Full smoke check
npm run test:e2e

# Just health checks
curl -s http://localhost:3000/health && \
curl -s http://localhost:3000/api/pipeline/health

# Check agent status
docker-compose exec api npm run agents:status

# View recent logs
./dev.sh logs --tail=100
```
