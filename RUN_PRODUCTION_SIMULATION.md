# Production Day E2E Simulation - Quick Start Guide

## Prerequisites

1. **Start Docker Desktop**
   - Open Docker Desktop application
   - Wait for Docker to fully start (whale icon should be steady)

2. **Verify Environment Files**
   - `.env.shared` - Contains shared configuration
   - `.env.cloud` - Contains Supabase cloud credentials

## Running the Simulation

### Option 1: Full 10-Minute Simulation (Recommended)

```bash
# Start Docker services with cloud profile
docker-compose --profile cloud up -d redis temporal temporal-ui api-cloud

# Wait 30 seconds for services to be healthy
timeout /t 30

# Run the full production day simulation
npx tsx scripts/production-day-simulation.ts
```

### Option 2: Quick Validation (2-3 minutes)

```bash
# Start services
docker-compose --profile cloud up -d redis temporal temporal-ui api-cloud

# Run individual E2E tests
docker-compose exec api-cloud npx tsx src/scripts/e2e/runFeedAgent.ts
docker-compose exec api-cloud npx tsx src/scripts/e2e/runScoringAgent.ts
docker-compose exec api-cloud npx tsx src/scripts/e2e/runAlertAgent.ts
```

### Option 3: Using dev.sh (if configured for cloud profile)

```bash
# Update dev.sh to use cloud profile, then:
./dev.sh start
npx tsx scripts/production-day-simulation.ts
```

## What the Simulation Does

### 1. Environment Setup (30s)
- ✓ Verifies Docker is running
- ✓ Checks environment files exist
- ✓ Validates critical env vars (API keys, Discord tokens)
- ✓ Confirms production mode with Supabase cloud

### 2. Service Startup (45s)
- ✓ Starts Redis cache
- ✓ Starts Temporal orchestration
- ✓ Starts API with cloud profile (connects to Supabase)
- ✓ Waits for health checks to pass

### 3. Workflow Cycles (10 minutes)
Every 45 seconds, the simulation runs:
- ✓ API health check (http://localhost:3000/api/health)
- ✓ FeedAgent workflow (ingest props from Odds API)
- ✓ ScoringAgent workflow (score props with Enhanced45Factor)
- ✓ Counts props ingested and scored

### 4. Alert Verification (every 2 cycles)
- ✓ Triggers AlertAgent to send notifications
- ✓ Verifies alerts appear in Discord channels
- ✓ Checks for injury, line movement, and value alerts

### 5. GitHub CI Check
- ✓ Shows recent commits
- ✓ Detects uncommitted changes
- ✓ Identifies current branch

### 6. Prop Pipeline Validation
- ✓ Queries Supabase for prop statistics
- ✓ Validates props were ingested correctly
- ✓ Confirms scoring is working
- ✓ Checks for missing or duplicate props

## Expected Output

```
╔════════════════════════════════════════════════════════════╗
║     PRODUCTION DAY E2E SIMULATION - UNIT TALK PLATFORM     ║
╚════════════════════════════════════════════════════════════╝

=== 1. Environment Setup Verification ===
✓ Docker Desktop is running
✓ .env.shared exists
✓ .env.cloud exists
✓ ODDS_API_KEY is configured
✓ DISCORD_BOT_TOKEN is configured
✓ Environment setup complete - Production mode with Supabase cloud database

=== Starting Services with Cloud Profile ===
✓ All services started

=== 2. Running Workflow Cycles (every 45s) ===
Will run 13 workflow cycles over 10 minutes

=== Workflow Cycle #1 ===
✓ API responding
✓ Ingested 47 props
✓ Scored 47 props

=== 3. Alert System Verification ===
✓ Triggered 3 alerts
✓ injury alert detected
✓ line_movement alert detected

[... more cycles ...]

============================================================
PRODUCTION DAY SIMULATION - FINAL REPORT
============================================================

Simulation Duration: 10 minutes
Workflow Executions: 13
Alerts Triggered: 18
Props Ingested: 611
Props Scored: 611
GitHub Issues: 0

✓ No errors encountered

============================================================
SUMMARY: 13 workflows | 18 alerts | 611 props ingested | 611 props scored | 0 GitHub issues | 0 errors
============================================================
```

## Troubleshooting

### Docker Desktop Not Running
```
✗ FATAL ERROR: Docker Desktop is not running. Please start Docker Desktop first.
```
**Solution**: Open Docker Desktop and wait for it to fully start

### Services Not Starting
```
✗ Service startup failed
```
**Solution**:
```bash
docker-compose down
docker-compose --profile cloud up -d redis temporal temporal-ui api-cloud
```

### API Not Responding
```
✗ API not responding
```
**Solution**:
```bash
# Check API logs
docker-compose logs api-cloud

# Restart API
docker-compose restart api-cloud
```

### Supabase Connection Errors
```
✗ Database connection failed
```
**Solution**: Verify `.env.cloud` has correct Supabase credentials

## After Simulation

### View Service Logs
```bash
docker-compose logs -f api-cloud
docker-compose logs -f redis
docker-compose logs -f temporal
```

### Check Service Health
```bash
curl http://localhost:3000/api/health
curl http://localhost:9090  # Prometheus
curl http://localhost:8088  # Temporal UI
```

### Stop Services
```bash
docker-compose --profile cloud down
```

## Manual Verification

If you want to manually verify components:

### 1. Test API Health
```bash
curl http://localhost:3000/api/health
```

### 2. Test Prop Ingestion
```bash
docker-compose exec api-cloud npx tsx src/scripts/e2e/runFeedAgent.ts
```

### 3. Test Scoring
```bash
docker-compose exec api-cloud npx tsx src/scripts/e2e/runScoringAgent.ts
```

### 4. Test Alerts
```bash
docker-compose exec api-cloud npx tsx src/scripts/e2e/runAlertAgent.ts
```

### 5. Check Discord
- Open Discord
- Go to alert channel (ID: 1300411261854547968)
- Verify alerts are appearing

## Production Readiness Checklist

After simulation completes successfully:

- [ ] All workflow cycles completed without errors
- [ ] Props ingested > 0
- [ ] Props scored matches props ingested
- [ ] Alerts triggered > 0
- [ ] No GitHub CI issues
- [ ] API health check passes
- [ ] Discord notifications visible
- [ ] No critical errors in logs

## Next Steps

If simulation passes:
1. ✓ System is production-ready
2. ✓ All workflows are operational
3. ✓ Alerts are firing correctly
4. ✓ Database integration is working

If simulation fails:
1. Review error messages in final report
2. Check service logs for details
3. Verify environment configuration
4. Run individual E2E tests to isolate issue
