# Unit Talk Syndicate System

## 🎯 2-Minute Maximum Interval Implementation

The Unit Talk Syndicate System delivers enterprise-grade betting automation with **guaranteed 2-minute maximum intervals** for data ingestion, processing, and Discord alerting during live games.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the syndicate system
npm run syndicate:start

# Monitor system status
npm run syndicate:status

# View active schedules
npm run syndicate:schedules

# Emergency controls
npm run syndicate:pause   # Pause all operations
npm run syndicate:resume  # Resume operations
npm run syndicate:stop    # Graceful shutdown
```

## 📊 System Architecture

### Core Workflows

1. **Main Syndicate Scheduler** (`syndicateSchedulerWorkflow`)
   - 2-minute intervals during live games
   - 10-minute intervals during off-peak hours
   - Parallel league ingestion across MLB, NBA, NFL, NHL, NCAAB, NCAAF
   - Real-time USP detection and alerting

2. **Live Game Detector** (`liveGameDetectorWorkflow`)
   - Monitors all leagues every 30 seconds
   - Automatically switches between live/off-peak modes
   - Triggers enhanced monitoring during peak hours

3. **API Quota Monitor** (`apiQuotaMonitorWorkflow`)
   - Tracks usage across Optimal, SGO, and OddsAPI
   - Automatic fallback activation at 95% quota
   - Real-time quota warnings at 80%

4. **System Health Monitor** (`systemHealthMonitorWorkflow`)
   - Database, API, and system metrics every 2 minutes
   - Health score calculation and alerting
   - Performance degradation detection

### USP Detection Coverage

The system monitors **7 critical USPs** in real-time:

1. **Steam Movement Detection**
   - Live: 0.5 point threshold
   - Off-peak: 1.0 point threshold
   - 2-minute time windows

2. **Line Movement Analysis**
   - Significant movement tracking
   - Direction and magnitude analysis
   - Historical pattern recognition

3. **Hedge Opportunities**
   - Minimum 5% profit margin detection
   - Cross-sportsbook arbitrage identification
   - Real-time profit calculations

4. **Middle Opportunities**
   - 2+ point gap detection
   - Win probability calculations
   - Risk assessment metrics

5. **Stale Line Detection**
   - Live: 5-minute staleness threshold
   - Off-peak: 10-minute threshold
   - Provider comparison analysis

6. **Injury Impact Analysis**
   - Multi-source injury monitoring (ESPN, RotoBaller, FantasyPros)
   - Player prop impact assessment
   - Severity classification

7. **Suspicious Activity Detection**
   - Unusual volume patterns
   - Coordinated betting detection
   - Line manipulation identification

## ⚡ Performance Guarantees

### Timing Targets
- **Live Mode Cycle**: ≤110 seconds (target: 90 seconds)
- **Discord Delivery**: ≤30 seconds (target: 15 seconds)
- **API Response**: ≤5 seconds per call
- **Database Queries**: ≤1 second response time

### Reliability Metrics
- **Uptime**: 99.9% target
- **Workflow Success Rate**: >90%
- **Alert Delivery Rate**: >99%
- **Data Accuracy**: >95%

## 🔧 Configuration

### Environment Variables

**Required:**
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
OPTIMAL_API_KEY=your_optimal_key
DISCORD_APPROVED_WEBHOOK_URL=your_discord_webhook
OPENAI_API_KEY=your_openai_key
TEMPORAL_TASK_QUEUE=syndicate-operations
```

**Optional:**
```bash
SGO_API_KEY=your_sgo_key
ODDS_API_KEY=your_odds_api_key
DISCORD_ALERTS_WEBHOOK_URL=your_alerts_webhook
DISCORD_HEALTH_WEBHOOK_URL=your_health_webhook
NOTION_API_KEY=your_notion_key
MONITOR_PORT=9090
HEALTH_CHECK_PORT=9091
```

### API Quota Management

The system automatically manages API quotas:

- **Optimal API**: 900 calls/hour (primary)
- **SGO API**: 500 calls/hour (fallback)
- **OddsAPI**: 500 calls/hour (fallback)

Fallback activation:
- Warning at 80% usage
- Critical alerts at 95% usage
- Automatic fallback at 95% usage

## 📈 Monitoring & Alerting

### Health Endpoints

```bash
# System health check
curl http://localhost:9091/health

# Active schedules status
curl http://localhost:9091/schedules

# Prometheus metrics
curl http://localhost:9090/metrics
```

### Discord Integration

The system delivers alerts through Discord with priority-based delivery:

- **Critical**: ≤15 seconds (individual delivery)
- **High**: ≤30 seconds (batch of 3)
- **Medium**: ≤60 seconds (batch of 5)

### Weekly Reports

Automated weekly performance reports include:
- Ingestion performance metrics
- Grading accuracy statistics
- Alert delivery times
- API usage patterns
- System health trends
- USP detection rates

## 🛠️ Emergency Controls

### Process Signals

```bash
# Emergency pause (SIGUSR1)
kill -USR1 $(pgrep -f start-syndicate)

# Emergency resume (SIGUSR2)
kill -USR2 $(pgrep -f start-syndicate)

# Graceful shutdown (SIGTERM)
kill -TERM $(pgrep -f start-syndicate)
```

### Automatic Safety Features

- **Auto-pause on consecutive failures** (5 failures = 10-minute pause)
- **Quota exhaustion protection** (automatic fallback)
- **Health degradation alerts** (health score <70%)
- **Performance warnings** (cycle time >target)

## 📋 Daily Operations

### Automated Maintenance

**Daily (2:00 AM):**
- Log cleanup (30-day retention)
- Metrics cleanup (90-day retention)
- Raw props cleanup (7-day retention)
- Database optimization
- Daily summary generation

**Weekly (Sunday 3:00 AM):**
- Comprehensive performance reports
- Discord delivery to stakeholders
- Notion documentation updates

### Manual Operations

```bash
# Check system status
npm run syndicate:status

# View current schedules
npm run syndicate:schedules

# Monitor real-time metrics
npm run syndicate:metrics

# Emergency pause for maintenance
npm run syndicate:pause

# Resume after maintenance
npm run syndicate:resume
```

## 🔍 Troubleshooting

### Common Issues

1. **High Cycle Times**
   - Check API response times
   - Verify database performance
   - Review Discord webhook status

2. **Quota Exhaustion**
   - Monitor hourly usage patterns
   - Verify fallback provider status
   - Adjust ingestion batch sizes

3. **Discord Delivery Delays**
   - Check webhook URL validity
   - Verify network connectivity
   - Review embed complexity

4. **Health Score Degradation**
   - Database connection issues
   - API endpoint failures
   - System resource constraints

### Log Analysis

```bash
# View recent logs
tail -f logs/syndicate-$(date +%Y-%m-%d).log

# Search for errors
grep "ERROR" logs/syndicate-*.log

# Monitor performance warnings
grep "PERFORMANCE" logs/syndicate-*.log
```

## 🎯 Success Metrics

The syndicate system tracks these key performance indicators:

### Operational Metrics
- **Cycle Completion Rate**: >95%
- **Average Cycle Time**: <90 seconds (live mode)
- **Discord Delivery Time**: <30 seconds
- **API Success Rate**: >98%

### Business Metrics
- **USP Detection Rate**: Tracked per type
- **Alert Accuracy**: >95%
- **System Uptime**: >99.9%
- **Data Freshness**: <2 minutes

### Quality Metrics
- **Grading Accuracy**: >95%
- **Duplicate Detection**: >99%
- **Data Normalization**: 100%
- **Error Recovery**: <5 minutes

## 🚨 Support & Escalation

### Alert Levels

1. **INFO**: Normal operations, metrics logging
2. **WARN**: Performance degradation, quota warnings
3. **ERROR**: Failed operations, retry attempts
4. **CRITICAL**: System failures, emergency stops

### Escalation Path

1. **Automated Recovery**: System attempts self-healing
2. **Alert Notifications**: Discord alerts to operations team
3. **Emergency Pause**: Automatic pause on critical failures
4. **Manual Intervention**: Operations team manual override

---

## 📞 Emergency Contacts

For critical system issues:
- **Operations Team**: Discord #syndicate-ops
- **Technical Lead**: Discord DM
- **Emergency Hotline**: [Phone number]

**System Status**: Always check `npm run syndicate:status` first!