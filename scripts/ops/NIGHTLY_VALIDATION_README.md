# Nightly Canonical Validation System

**Date:** 2025-10-30  
**Charter:** v3.0  
**Status:** ✅ Production Ready

---

## 📋 Overview

Automated nightly validation system that ensures Charter v3.0 compliance with intelligent alerting, trend analysis, and ML-driven anomaly detection.

### Key Features

- ✅ **Canonical Schema Validation** - Verifies picks, pick_publish, unified_picks visibility
- ✅ **SLO Monitoring** - Publish lag p95 < 60s, API p95 < 150ms, DB p95 < 50ms
- ✅ **Agent Health Tracking** - Real-time monitoring of all system agents
- ✅ **Intelligent Alerting** - Slack + Discord webhooks on FAIL/WARN
- ✅ **7-Day Trend Analysis** - Rolling window metrics with ASCII charts
- ✅ **ML Anomaly Detection** - Statistical analysis (Z-score, IQR, moving average)
- ✅ **Comprehensive Artifacts** - JSON, Markdown, trend data, anomaly reports

---

## 🚀 Quick Start

### Prerequisites

```bash
# Required environment variables in .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SLACK_ALERTS_WEBHOOK=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
DISCORD_OPERATOR_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR/WEBHOOK
PROMETHEUS_URL=http://localhost:9090
```

### Run Nightly Validation

```bash
# Docker-first approach (MANDATORY)
docker-compose exec api node scripts/ops/nightly-canonical-validation.js

# Or via npm script
docker-compose exec api npm run ops:nightly-validation
```

### Run Individual Components

```bash
# Trend analysis only
docker-compose exec api node scripts/ops/trend-analysis.js

# Anomaly detection only
docker-compose exec api node scripts/ops/anomaly-detection.js
```

---

## 📊 Validation Checks

### 1. RLS Policies
- Verifies RLS policies exist for canonical tables
- Status: PASS (policies exist but disabled per Charter)

### 2. Picks Visibility
- Checks `picks`, `pick_publish`, `unified_picks` tables
- Validates PostgREST schema visibility
- Status: PASS if all tables accessible

### 3. Publish Lag (SLO)
- Measures p95 lag from `created_at` to `sent_at`
- Target: < 60 seconds
- Status: PASS if p95 < 60s, FAIL otherwise

### 4. Agent Health
- Queries `agent_health` table for all agents
- Checks for unhealthy/degraded agents
- Status: PASS if all agents healthy/idle

---

## 📈 Trend Analysis

### Metrics Tracked (7-Day Rolling Window)

1. **Publish Lag P95**
   - Min, max, avg over 7 days
   - Trend direction (increasing/decreasing/stable)
   - SLO compliance rate

2. **Error Rate**
   - Agent health error rate
   - Trend direction
   - Anomaly detection

3. **System Health Score**
   - Overall validation pass rate
   - Health score (0-100)
   - Trend direction

### Output

```
out/ops/cutover/metrics/nightly/
├── TREND_ANALYSIS_20251030.json
└── ASCII charts in console output
```

---

## 🔍 Anomaly Detection (Phase 14 Preview)

### Detection Methods

1. **Z-Score Analysis**
   - Detects values > 3 standard deviations from mean
   - Severity: critical (>4σ), high (>3.5σ), medium (>3σ)

2. **IQR (Interquartile Range)**
   - More robust to outliers
   - Detects values outside Q1-1.5×IQR to Q3+1.5×IQR

3. **Moving Average**
   - Detects sudden trend changes
   - Window size: 5 data points
   - Threshold: 30% deviation

### Prometheus Metrics Analyzed

- `api_p95_latency_ms` - API response time p95
- `db_p95_latency_ms` - Database query latency p95
- `error_rate_percent` - HTTP 5xx error rate

### Output

```
out/ops/cutover/metrics/nightly/
└── ANOMALY_DETECTION_20251030.json
```

---

## 🚨 Alerting

### Notification Triggers

Alerts are sent to Slack and Discord when:
- Overall status is **FAIL** (any validation failed)
- Overall status is **WARN** (degraded but not critical)

### Slack Alert Format

```json
{
  "text": "❌ Nightly Validation: FAIL",
  "attachments": [{
    "color": "danger",
    "title": "Unit Talk Nightly Validation - 20251030",
    "fields": [
      {"title": "RLS Policies", "value": "PASS"},
      {"title": "Picks Visibility", "value": "PASS"},
      {"title": "Publish Lag", "value": "FAIL"},
      {"title": "Alert Status", "value": "WARN"}
    ]
  }]
}
```

### Discord Alert Format

Rich embed with:
- Color-coded status (green/yellow/red)
- Emoji indicators (✅/⚠️/❌)
- Field breakdown for each validation
- Timestamp and footer

---

## 📁 Artifacts

All artifacts are saved to `out/ops/cutover/metrics/nightly/`:

```
out/ops/cutover/metrics/nightly/
├── NIGHTLY_STATUS_20251030.json       # Full validation results
├── NIGHTLY_STATUS_20251030.md         # Human-readable report
├── TREND_ANALYSIS_20251030.json       # 7-day trend data
└── ANOMALY_DETECTION_20251030.json    # ML anomaly report
```

### Artifact Retention

- Keep last 30 days of nightly reports
- Archive older reports to S3/cold storage
- Trend analysis requires minimum 3 days of data

---

## 🔧 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | ✅ | - | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | - | Service role key |
| `SLACK_ALERTS_WEBHOOK` | ⚠️ | - | Slack webhook for alerts |
| `DISCORD_OPERATOR_WEBHOOK_URL` | ⚠️ | - | Discord webhook for alerts |
| `PROMETHEUS_URL` | ⚠️ | `http://localhost:9090` | Prometheus endpoint |

### Scheduled Execution

Add to crontab for nightly execution:

```bash
# Run at 2 AM daily
0 2 * * * cd /path/to/unit-talk && docker-compose exec -T api node scripts/ops/nightly-canonical-validation.js >> /var/log/nightly-validation.log 2>&1
```

Or use GitHub Actions:

```yaml
name: Nightly Validation
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Nightly Validation
        run: |
          docker-compose up -d
          docker-compose exec -T api node scripts/ops/nightly-canonical-validation.js
```

---

## 🐛 Troubleshooting

### Issue: "agent_health table not accessible"

**Solution:** Run the schema fix migration:

```bash
docker-compose exec api npm run db:migrate
# Or manually apply:
docker-compose exec database psql -U postgres -f supabase/migrations/20251030_agent_health_schema_fix.sql
```

### Issue: "No historical data for trend analysis"

**Solution:** Run validation for at least 3 consecutive days to build trend data.

### Issue: "Prometheus metrics unavailable"

**Solution:** Ensure Prometheus is running and accessible:

```bash
curl http://localhost:9090/api/v1/query?query=up
```

### Issue: "Slack/Discord notifications not sending"

**Solution:** Verify webhook URLs are correct and accessible:

```bash
curl -X POST $SLACK_ALERTS_WEBHOOK -H 'Content-Type: application/json' -d '{"text":"Test"}'
```

---

## 📚 Related Documentation

- [Production Charter v3.0](../../docs/PRODUCTION_CHARTER.md)
- [System Alignment Spec](../../docs/SYSTEM_ALIGNMENT_SPEC.yml)
- [Agent Health Schema](../../supabase/migrations/20251030_agent_health_schema_fix.sql)
- [Prometheus Rules](../../infrastructure/monitoring/prometheus-rules.yaml)

---

## 🎯 Success Criteria

✅ **100% PASS Status**
- All validations return PASS
- No FAIL or WARN statuses
- All agents healthy

✅ **Alerts Fire Correctly**
- Slack notification received on FAIL/WARN
- Discord notification received on FAIL/WARN
- Notifications contain correct status

✅ **Trends Exported**
- 7-day trend JSON generated
- ASCII charts displayed
- Trend direction calculated

✅ **Agent Health OK**
- `agent_health` table accessible
- All agents in healthy/idle state
- No error messages

---

**Version:** 1.0.0  
**Last Updated:** 2025-10-30  
**Owner:** Engineering Team  
**Charter Compliance:** v3.0

