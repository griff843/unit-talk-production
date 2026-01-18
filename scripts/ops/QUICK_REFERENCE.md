# Nightly Validation - Quick Reference Card

**Date:** 2025-10-30 | **Charter:** v3.0

---

## 🚀 Quick Commands

### Run Full Nightly Validation
```bash
docker-compose exec api node scripts/ops/nightly-canonical-validation.js
```

### Run Individual Components
```bash
# Trend analysis only
docker-compose exec api node scripts/ops/trend-analysis.js

# Anomaly detection only
docker-compose exec api node scripts/ops/anomaly-detection.js
```

### PowerShell Runner (Windows)
```powershell
.\scripts\ops\nightly-validation-runner.ps1
```

---

## 📁 Output Locations

```
out/ops/cutover/metrics/nightly/
├── NIGHTLY_STATUS_20251030.json       # Full results
├── NIGHTLY_STATUS_20251030.md         # Report
├── TREND_ANALYSIS_20251030.json       # Trends
└── ANOMALY_DETECTION_20251030.json    # Anomalies
```

---

## ✅ Validation Checks

| Check | Target | Status |
|-------|--------|--------|
| RLS Policies | Exist & accessible | PASS |
| Picks Visibility | All tables visible | PASS |
| Publish Lag | p95 < 60s | PASS |
| Agent Health | All healthy/idle | PASS |

---

## 🚨 Alert Triggers

**Slack + Discord notifications sent when:**
- Overall status: **FAIL** (red)
- Overall status: **WARN** (yellow)

**No alerts sent when:**
- Overall status: **PASS** (green)

---

## 🔧 Environment Variables

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key

# Optional (for alerts)
SLACK_ALERTS_WEBHOOK=https://hooks.slack.com/...
DISCORD_OPERATOR_WEBHOOK_URL=https://discord.com/api/webhooks/...
PROMETHEUS_URL=http://localhost:9090
```

---

## 🐛 Troubleshooting

### "agent_health table not accessible"
```bash
docker-compose exec database psql -U postgres -f supabase/migrations/20251030_agent_health_schema_fix.sql
```

### "No historical data for trends"
Run validation for 3+ consecutive days to build baseline.

### "Prometheus metrics unavailable"
```bash
curl http://localhost:9090/api/v1/query?query=up
```

### "Webhooks not sending"
```bash
# Test Slack
curl -X POST $SLACK_ALERTS_WEBHOOK -H 'Content-Type: application/json' -d '{"text":"Test"}'

# Test Discord
curl -X POST $DISCORD_OPERATOR_WEBHOOK_URL -H 'Content-Type: application/json' -d '{"content":"Test"}'
```

---

## 📊 Trend Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Publish Lag P95 | 95th percentile lag | < 60s |
| Error Rate | Agent health errors | < 0.5% |
| System Health | Overall pass rate | 100% |

**Trend Directions:**
- **Increasing** - Recent avg > older avg (by >5%)
- **Decreasing** - Recent avg < older avg (by >5%)
- **Stable** - Change < 5%

---

## 🔍 Anomaly Detection

**Methods:**
1. **Z-Score** - Values > 3σ from mean
2. **IQR** - Values outside Q1-1.5×IQR to Q3+1.5×IQR
3. **Moving Avg** - Deviation > 30% from 5-point MA

**Severity:**
- **Critical** - Z-score > 4σ
- **High** - Z-score > 3.5σ
- **Medium** - Z-score > 3σ

---

## 📚 Documentation

- [NIGHTLY_VALIDATION_README.md](./NIGHTLY_VALIDATION_README.md) - Full guide
- [Production Charter v3.0](../../docs/PRODUCTION_CHARTER.md) - Governance
- [Implementation Summary](../../out/ops/cutover/metrics/nightly/IMPLEMENTATION_SUMMARY.md) - Details

---

## 🎯 Success Criteria

✅ All validations PASS  
✅ Alerts fire on FAIL/WARN  
✅ Trends exported (7-day)  
✅ agent_health OK  

---

**Quick Reference v1.0 | Charter v3.0 | 2025-10-30**

