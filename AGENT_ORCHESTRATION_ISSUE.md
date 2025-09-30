# Agent Orchestration Issue - CRITICAL FINDING

**Date:** September 30, 2025
**Status:** ❌ NOT WORKING - Agents not running automatically
**Severity:** HIGH - Props not being scored

---

## 🚨 CRITICAL ISSUE

**YOU WERE RIGHT:** ScoringAgent is NOT running automatically when `dev.sh start` is executed.

### Current Situation:

1. ✅ `dev.sh start` successfully starts infrastructure:
   - Postgres (healthy)
   - Redis (healthy)
   - Temporal (healthy)
   - Prometheus/Grafana (healthy)

2. ❌ `dev.sh start` DOES NOT start:
   - API service
   - FeedAgent
   - ScoringAgent
   - Any other agents

3. ❌ Props are NOT being scored:
   - 3,570 MLB props ingested
   - 0 props have `professional_score` populated
   - Manual triggering required

---

## 📊 Evidence

### Infrastructure Running:
```bash
$ docker ps --filter "name=unit-talk"
unit-talk-postgres      Up 2 hours (healthy)
unit-talk-redis         Up 2 hours (healthy)
unit-talk-temporal      Up 2 hours (healthy)
unit-talk-prometheus    Up 2 hours (healthy)
unit-talk-grafana       Up 2 hours (healthy)
```

### API/Agents NOT Running:
```bash
$ docker ps --filter "name=unit-talk-api"
(no results)

$ docker ps --filter "name=agent"
(no results)
```

### Props Not Scored:
```sql
SELECT COUNT(*) FROM unified_picks WHERE professional_score IS NOT NULL;
-- Result: 0

SELECT COUNT(*) FROM unified_picks;
-- Result: 3570+ (all unscored)
```

---

## 🔍 Root Cause Analysis

### 1. docker-compose.yml Has API Service Defined

```yaml
  api:
    build:
      context: .
      dockerfile: ./apps/api/Dockerfile
    container_name: unit-talk-api
    ports:
      - "3000:3000"
    environment:
      - START_TEMPORAL_WORKER=true
    depends_on:
      - postgres
      - redis
      - temporal
```

**But:** Service is NOT being started by `dev.sh`

### 2. dev.sh Does NOT Start Application Services

Analysis of `dev.sh`:
- ❌ No references to `api` service
- ❌ No references to `scoringagent` or `feedagent`
- ✅ Only starts infrastructure services

### 3. Network Conflict When Trying Manual Start

```bash
$ docker-compose up -d api
ERROR: failed to create network: Pool overlaps with other one
```

**Issue:** Network from different docker-compose project already exists

---

## 💡 EXPECTED BEHAVIOR

When running `dev.sh start`, the system SHOULD:

1. ✅ Start infrastructure (Postgres, Redis, Temporal, etc.)
2. ✅ Start API service
3. ✅ Start Temporal workers (agents)
4. ✅ FeedAgent automatically ingests props
5. ✅ ScoringAgent automatically scores ingested props
6. ✅ All happens without manual intervention

---

## 🎯 REQUIRED FIXES

### Fix 1: Update dev.sh to Start All Services

```bash
# Current (only infrastructure):
docker-compose up -d postgres redis temporal prometheus grafana

# Required (all services):
docker-compose up -d
```

### Fix 2: Configure Temporal Workers in API

The API service should start Temporal workers that:
- Listen for `pick.created` events
- Automatically trigger ScoringAgent workflow
- Process props as they're ingested

### Fix 3: Event-Driven Architecture

```
FeedAgent ingests prop
    ↓
Emits pick.created event
    ↓
Temporal workflow triggered
    ↓
ScoringAgent processes prop
    ↓
Updates professional_score
```

**Current State:** ❌ None of this is happening
**Required State:** ✅ Fully automated pipeline

---

## 🔧 IMMEDIATE WORKAROUNDS

### Option 1: Manual ScoringAgent Execution

```bash
cd apps/api
npx tsx src/runner/runScoringAgent.ts
```

### Option 2: Start API Service Manually

```bash
# Clean up network conflict
docker network prune -f

# Start API with agents
cd apps/api
npm run dev
```

### Option 3: Process Props via Script

```bash
cd apps/api
npx tsx src/scripts/score-all-unscored-picks.ts
```

---

## 📋 VERIFICATION CHECKLIST

To confirm agents are working:

- [ ] API service running (`docker ps | grep unit-talk-api`)
- [ ] Temporal workers registered (`http://localhost:8088`)
- [ ] FeedAgent workflow executing (check Temporal UI)
- [ ] ScoringAgent workflow executing (check Temporal UI)
- [ ] Props have professional_score populated (query database)
- [ ] Automatic scoring on new props (ingest test prop, verify scored within 30s)

---

## 📊 IMPACT ASSESSMENT

### Current Impact:
- **3,570+ props unscored** (0% coverage)
- **Manual intervention required** for every batch
- **System NOT production-ready** (automation broken)
- **dev.sh misleading** (implies full system start)

### Required State:
- **100% automatic scoring** (no manual intervention)
- **Sub-30s scoring latency** (near real-time)
- **dev.sh starts everything** (true one-command setup)
- **Event-driven pipeline** (FeedAgent → ScoringAgent)

---

## 🚀 ACTION ITEMS

### Priority 1 (Immediate):
1. Score all existing 3,570 props manually
2. Verify ScoringAgent can handle volume
3. Document current manual process

### Priority 2 (Today):
4. Fix dev.sh to start API service
5. Verify Temporal workers start automatically
6. Test end-to-end automated pipeline

### Priority 3 (This Week):
7. Add health checks for agent orchestration
8. Create monitoring for scoring lag
9. Document production deployment process

---

## 📝 NOTES

- **Cache system**: ✅ Working (verified)
- **Player props**: ✅ Working (3,570 ingested)
- **Odds API**: ✅ Working (real data)
- **Agent orchestration**: ❌ NOT WORKING
- **Automatic scoring**: ❌ NOT WORKING

**Bottom Line:** We have great data ingestion, but zero automation on scoring. The system requires manual intervention at every step, which is not acceptable for production.

---

**Report By:** E2E System Audit
**Date:** 2025-09-30
**Status:** BLOCKING ISSUE - Requires immediate attention