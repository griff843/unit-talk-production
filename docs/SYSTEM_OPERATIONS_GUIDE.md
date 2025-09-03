# 🚀 Unit Talk System Operations Guide

**Real-World Production Operations & E2E Testing**

## 🎯 **ESSENTIAL OPERATIONS** (Only 8 Core Scripts Needed)

### 1. **System Startup** - Get Everything Running

```bash
# Start infrastructure services
npm run dev:services              # Redis + Temporal + PostgreSQL

# Start core platform (3 terminals)
npm run start:dev                 # Terminal 1: Main platform
npm run worker:dev                # Terminal 2: Temporal worker
npm run elite:monitor             # Terminal 3: Credit monitoring
```

### 2. **Health Check** - Verify Everything Works

```bash
npm run health:check              # Full system health validation
npm run agents:status             # All 27 agents status
npm run metrics:show              # Current performance metrics
```

### 3. **Real-World E2E Testing** - Props to Discord to Recaps

```bash
npm run test:real-world           # Complete e2e with live data
npm run test:production-pipeline  # Full pipeline validation
npm run qa:e2e                    # End-to-end with Playwright
```

### 4. **Elite System Deployment**

```bash
npm run elite:deploy              # Deploy complete elite system
npm run elite:test                # Validate dual-API integration
npm run settlement:test           # Test automated settlement
```

---

## 🔥 **REAL-WORLD E2E TESTING WORKFLOW**

### **Complete Pipeline: Props → Discord → Recaps**

**Step 1: Start Real Data Flow**

```bash
# 1. Start infrastructure
npm run dev:services

# 2. Start platform (3 terminals)
npm run start:dev        # Main platform
npm run worker:dev       # Temporal worker
npm run syndicate:start  # 1-minute scheduler with real data

# 3. Monitor in real-time
npm run odds-api:monitor # Credit usage + API calls
npm run agents:monitor   # Agent performance
```

**Step 2: Validate Data Ingestion**

```bash
# Verify live data coming in
npm run test:data-ingestion --live
# Expected: NFL/NCAAF/NBA/WNBA props flowing into database

# Check database
npm run db:check-live-data
# Expected: Fresh props updated within last 2 minutes
```

**Step 3: Validate Grading & Scoring**

```bash
# Test grading agent with live data
npm run agents:grading --live
# Expected: Props scored and tiered (Elite/Premium/Standard/Value/Avoid)

# Verify scoring algorithms
npm run scoring:validate --real-data
# Expected: Edge scores, line values, trend analysis complete
```

**Step 4: Validate Discord Alerts**

```bash
# Test alert generation with live picks
npm run alerts:test --live-picks
# Expected: Discord threads created, tier-based formatting

# Verify Discord bot integration
npm run discord:test-alerts --real-picks
# Expected: Alerts posted to appropriate channels
```

**Step 5: Validate Recap Generation**

```bash
# Generate daily recap with real data
npm run recap:generate --date=today
# Expected: Performance summary, ROI tracking, tier analysis

# Test recap posting
npm run recap:post --channel=daily-recap
# Expected: Formatted recap posted to Discord
```

**Step 6: Complete E2E Validation**

```bash
# Run complete real-world pipeline test
npm run test:complete-e2e --duration=30min
# Expected: Full cycle from props to recap in 30 minutes
```

---

## 📊 **HISTORICAL DATA SYSTEM** (For Enhanced Grading)

### **Create Historical Analysis Script**

```bash
# Import historical prop data (last 2 years)
npm run history:import --sports=all --years=2

# Analyze head-to-head performance
npm run history:analyze-h2h --capper-comparison

# Generate DVP (Defense vs Position) data
npm run history:dvp-analysis --all-sports

# Validate grading improvements
npm run grading:backtest --historical-data
```

---

## 🏆 **AGENT SYSTEM OPERATIONS**

### **Start All 27 Agents**

```bash
# Method 1: All agents at once
npm run agents:start-all

# Method 2: Core business agents first
npm run agents:start-core        # Grading, Ingestion, Feed, Alert, Analytics
npm run agents:start-intelligence # Predictive, Risk, Performance, Retention
npm run agents:start-operational # Notification, Contest, Onboarding, Audit
```

### **Agent Health Monitoring**

```bash
# Real-time agent monitoring dashboard
npm run agents:dashboard

# Individual agent testing
npm run agent:test --name=GradingAgent --live-data
npm run agent:test --name=AlertAgent --real-picks
npm run agent:test --name=RecapAgent --today

# Agent performance analysis
npm run agents:performance --timeframe=24h
```

---

## ⚡ **TEMPORAL WORKFLOWS**

### **Start Temporal Services**

```bash
# Start Temporal server (separate terminal)
temporal server start-dev

# Start Temporal worker
npm run worker:dev

# Monitor workflows
npm run temporal:monitor
```

### **Workflow Testing**

```bash
# Test analytics workflow
npm run workflow:test --name=analytics --live-data

# Test e2e props workflow
npm run workflow:test --name=e2e-props --real-props

# Test recap workflow
npm run workflow:test --name=recap --today
```

---

## 🧪 **TESTING STRATEGY** (Streamlined)

### **Essential Test Categories**

```bash
# 1. Unit Tests (Agent Logic)
npm run test:unit --agents-only
# Expected: 80%+ coverage on business logic

# 2. Integration Tests (Agent Communication)
npm run test:integration --real-env
# Expected: Agent workflows complete successfully

# 3. E2E Tests (Complete User Journeys)
npm run test:e2e --live-data --duration=1hour
# Expected: Props → Discord → Recaps working

# 4. Performance Tests (Load Testing)
npm run test:performance --peak-load
# Expected: System handles 10,000+ picks/day
```

### **Real-World Test Scenarios**

```bash
# Scenario 1: NFL Sunday (Peak Load)
npm run test:nfl-sunday --simulate-peak

# Scenario 2: NCAAF Saturday (College Football)
npm run test:ncaaf-saturday --live-games

# Scenario 3: Multi-Sport Day
npm run test:multi-sport --nfl-nba-mlb

# Scenario 4: Settlement Processing
npm run test:settlement --post-game-automation
```

---

## 📈 **SCORING ALGORITHM VALIDATION**

### **Beat the Best Human Cappers**

```bash
# Import top capper performance data
npm run cappers:import-benchmarks --top-10-worldwide

# Analyze our algorithm performance
npm run scoring:analyze-performance --vs-human-cappers

# Historical backtest vs cappers
npm run scoring:backtest --vs-cappers --timeframe=2years

# Generate performance comparison report
npm run scoring:capper-comparison-report
```

### **Algorithm Enhancement**

```bash
# Analyze current scoring components
npm run scoring:component-analysis
# Components: Edge Score, Line Value, Trend Analysis, DVP, H2H

# Test algorithm improvements
npm run scoring:test-improvements --new-factors

# Validate enhanced performance
npm run scoring:validate-enhancement --backtest-period=1year
```

---

## 🛠️ **ESSENTIAL SCRIPTS ONLY** (Eliminate 40+ Redundant Scripts)

### **Keep These 8 Core Scripts:**

1. `start-system.ts` - Complete system startup
2. `test-real-world-e2e.ts` - Props to Discord to Recaps
3. `health-check.ts` - System health validation
4. `deploy-production.ts` - Production deployment
5. `agents-monitor.ts` - Agent health monitoring
6. `historical-import.ts` - Historical data for grading
7. `scoring-analysis.ts` - Algorithm performance vs cappers
8. `emergency-shutdown.ts` - Safe system shutdown

### **Scripts to Delete/Consolidate:**

- All migration scripts (one-time use)
- Duplicate testing scripts
- Legacy scripts
- Type system repair scripts
- Individual agent test scripts (use agents-monitor instead)

---

## 🚨 **PRODUCTION READINESS CHECKLIST**

### **Before Going Live:**

```bash
# 1. Infrastructure Health
npm run health:infrastructure
✅ PostgreSQL connected and optimized
✅ Redis cluster operational
✅ Temporal workflows registered
✅ Discord bot authenticated

# 2. Agent Validation
npm run agents:production-ready
✅ All 27 agents healthy
✅ Error handling tested
✅ Retry logic validated
✅ Metrics collection active

# 3. Data Pipeline
npm run pipeline:validate-live
✅ Elite dual-API working (1-minute updates)
✅ Props ingestion operational
✅ Grading algorithms active
✅ Discord posting functional

# 4. Performance Validation
npm run performance:production-ready
✅ <50s processing cycles
✅ <500ms API responses
✅ 10,000+ picks/day capacity
✅ Memory usage optimized
```

---

## 🎯 **DAILY OPERATIONS WORKFLOW**

### **Morning Startup (Game Day)**

```bash
# 1. System health check
npm run health:morning-check

# 2. Start elite system
npm run elite:start-gameday

# 3. Verify data flow
npm run data:verify-live-feed

# 4. Monitor dashboard
npm run dashboard:gameday
```

### **During Games (Live Monitoring)**

```bash
# Real-time monitoring
npm run monitor:live-games

# Performance tracking
npm run performance:live-tracking

# Alert system validation
npm run alerts:verify-posting
```

### **Post-Game (Settlement & Recap)**

```bash
# Automated settlement
npm run settlement:post-game-auto

# Generate recaps
npm run recap:generate-and-post

# Performance analysis
npm run analysis:daily-performance
```

---

## 🏆 **SUCCESS METRICS**

### **System Performance Targets:**

- ⚡ **Update Speed**: 1-minute real-time (industry leading)
- 🎯 **Accuracy**: Beat top human cappers by 5%+ ROI
- 📊 **Volume**: Process 10,000+ picks/day
- ⏱️ **Response**: <500ms API responses
- 🔄 **Uptime**: 99.9% availability
- 💰 **Efficiency**: $118/month total API costs

### **Validation Commands:**

```bash
npm run metrics:success-validation
npm run performance:benchmark-vs-competitors
npm run roi:compare-to-human-cappers
```

---

**Next Steps:**

1. ✅ Eliminate redundant scripts (keep only 8 essential)
2. ✅ Create real-world e2e testing script
3. ✅ Build historical data import for enhanced grading
4. ✅ Validate scoring algorithm vs human cappers

This guide provides everything needed for real-world operations without the
clutter of 50+ scripts!
