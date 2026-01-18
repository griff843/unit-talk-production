# Success Metrics Dashboard Specification

**Phase:** Phase 17 - Go-Live & Stabilization
**Last Updated:** 2025-01-25
**Owner:** Platform SRE Team

---

## Overview

This document specifies the Success Metrics Dashboard for monitoring Phase 17 go-live and 30-day stabilization. The dashboard provides real-time visibility into SLO compliance, operational health, and business metrics.

### Dashboard Purpose

- **Real-time SLO monitoring** during go-live and stabilization
- **Executive visibility** into platform health
- **Trend analysis** for capacity planning
- **Incident detection** and alerting
- **Business metrics** alignment with technical performance

---

## Dashboard Structure

### Primary Metrics (SLO-Driven)

The dashboard is organized around the five critical SLO metrics defined for production:

1. **API Latency (p95)** - Target: < 150ms
2. **API Latency (p99)** - Target: < 500ms
3. **Database Latency (p95)** - Target: < 50ms
4. **Error Rate** - Target: < 0.5%
5. **Availability** - Target: > 99.5%

### Secondary Metrics (Operational)

Supporting metrics that indicate system health:

6. **MTTR** (Mean Time to Resolve) - Target: < 30 minutes
7. **MTTD** (Mean Time to Detect) - Target: < 5 minutes
8. **Uptime** - Target: > 99.5%
9. **Request Throughput** - Baseline monitoring
10. **Resource Utilization** - Target: < 70% CPU, < 80% Memory

---

## Grafana Dashboard Configuration

### Dashboard JSON Export

**Dashboard ID:** `phase17-success-metrics`
**Refresh Interval:** 30 seconds
**Time Range:** Last 24 hours (default), adjustable to 7d/30d

### Panel Specifications

#### Panel 1: SLO Compliance Overview (Stat Panel)

**Purpose:** At-a-glance view of all SLO compliance percentages

```json
{
  "title": "SLO Compliance - Last 24h",
  "type": "stat",
  "targets": [
    {
      "expr": "(count_over_time((histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job=\"unit-talk-api\"}[5m])) by (le)) * 1000 < 150)[24h:1m]) / (24*60)) * 100",
      "legendFormat": "API Latency p95",
      "refId": "A"
    },
    {
      "expr": "(count_over_time((histogram_quantile(0.95, sum(rate(database_query_duration_seconds_bucket{job=\"unit-talk-api\"}[5m])) by (le)) * 1000 < 50)[24h:1m]) / (24*60)) * 100",
      "legendFormat": "DB Latency p95",
      "refId": "B"
    },
    {
      "expr": "(count_over_time(((sum(rate(http_requests_total{job=\"unit-talk-api\",status=~\"5..\"}[5m])) / sum(rate(http_requests_total{job=\"unit-talk-api\"}[5m]))) * 100 < 0.5)[24h:1m]) / (24*60)) * 100",
      "legendFormat": "Error Rate",
      "refId": "C"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "percent",
      "thresholds": {
        "mode": "absolute",
        "steps": [
          {"value": 0, "color": "red"},
          {"value": 95, "color": "yellow"},
          {"value": 99, "color": "green"}
        ]
      }
    }
  },
  "gridPos": {"h": 4, "w": 24, "x": 0, "y": 0}
}
```

**Visual:** Large percentage stat with color coding (green >99%, yellow >95%, red <95%)

---

#### Panel 2: API Latency (p95) Timeseries

**Purpose:** Track API response time trend

```json
{
  "title": "API Latency (p95) - Target: < 150ms",
  "type": "timeseries",
  "targets": [
    {
      "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job=\"unit-talk-api\"}[5m])) by (le)) * 1000",
      "legendFormat": "p95 Latency",
      "refId": "A"
    },
    {
      "expr": "150",
      "legendFormat": "SLO Target (150ms)",
      "refId": "B"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "ms",
      "custom": {
        "axisPlacement": "auto",
        "lineWidth": 2,
        "fillOpacity": 10
      }
    },
    "overrides": [
      {
        "matcher": {"id": "byName", "options": "SLO Target (150ms)"},
        "properties": [
          {"id": "custom.lineStyle", "value": {"dash": [10, 10]}},
          {"id": "color", "value": {"mode": "fixed", "fixedColor": "red"}}
        ]
      }
    ]
  },
  "gridPos": {"h": 8, "w": 12, "x": 0, "y": 4}
}
```

**Visual:** Line graph with SLO threshold line

---

#### Panel 3: API Latency (p99) Timeseries

**Purpose:** Monitor tail latency

```json
{
  "title": "API Latency (p99) - Target: < 500ms",
  "type": "timeseries",
  "targets": [
    {
      "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{job=\"unit-talk-api\"}[5m])) by (le)) * 1000",
      "legendFormat": "p99 Latency",
      "refId": "A"
    },
    {
      "expr": "500",
      "legendFormat": "SLO Target (500ms)",
      "refId": "B"
    }
  ],
  "fieldConfig": {
    "defaults": {"unit": "ms"}
  },
  "gridPos": {"h": 8, "w": 12, "x": 12, "y": 4}
}
```

---

#### Panel 4: Database Latency (p95) Timeseries

**Purpose:** Monitor database query performance

```json
{
  "title": "Database Latency (p95) - Target: < 50ms",
  "type": "timeseries",
  "targets": [
    {
      "expr": "histogram_quantile(0.95, sum(rate(database_query_duration_seconds_bucket{job=\"unit-talk-api\"}[5m])) by (le)) * 1000",
      "legendFormat": "p95 Query Latency",
      "refId": "A"
    },
    {
      "expr": "50",
      "legendFormat": "SLO Target (50ms)",
      "refId": "B"
    }
  ],
  "fieldConfig": {
    "defaults": {"unit": "ms"}
  },
  "gridPos": {"h": 8, "w": 12, "x": 0, "y": 12}
}
```

---

#### Panel 5: Error Rate Timeseries

**Purpose:** Track 5xx error rate

```json
{
  "title": "Error Rate (5xx) - Target: < 0.5%",
  "type": "timeseries",
  "targets": [
    {
      "expr": "(sum(rate(http_requests_total{job=\"unit-talk-api\",status=~\"5..\"}[5m])) / sum(rate(http_requests_total{job=\"unit-talk-api\"}[5m]))) * 100",
      "legendFormat": "Error Rate",
      "refId": "A"
    },
    {
      "expr": "0.5",
      "legendFormat": "SLO Target (0.5%)",
      "refId": "B"
    }
  ],
  "fieldConfig": {
    "defaults": {"unit": "percent"}
  },
  "gridPos": {"h": 8, "w": 12, "x": 12, "y": 12}
}
```

---

#### Panel 6: Availability Gauge

**Purpose:** Show current availability percentage

```json
{
  "title": "Availability (30-day) - Target: > 99.5%",
  "type": "gauge",
  "targets": [
    {
      "expr": "(1 - (sum(increase(http_requests_total{job=\"unit-talk-api\",status=~\"5..\"}[30d])) / sum(increase(http_requests_total{job=\"unit-talk-api\"}[30d])))) * 100",
      "refId": "A"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "percent",
      "min": 99,
      "max": 100,
      "thresholds": {
        "mode": "absolute",
        "steps": [
          {"value": 99, "color": "red"},
          {"value": 99.5, "color": "yellow"},
          {"value": 99.9, "color": "green"}
        ]
      }
    }
  },
  "gridPos": {"h": 8, "w": 6, "x": 0, "y": 20}
}
```

---

#### Panel 7: MTTR (Mean Time to Resolve)

**Purpose:** Track incident response efficiency

```json
{
  "title": "MTTR (Mean Time to Resolve) - Target: < 30 min",
  "type": "stat",
  "targets": [
    {
      "expr": "avg(incident_resolution_duration_seconds{severity=\"1\"}) / 60",
      "legendFormat": "Sev 1 MTTR",
      "refId": "A"
    },
    {
      "expr": "avg(incident_resolution_duration_seconds{severity=\"2\"}) / 60",
      "legendFormat": "Sev 2 MTTR",
      "refId": "B"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "m",
      "thresholds": {
        "steps": [
          {"value": 0, "color": "green"},
          {"value": 30, "color": "yellow"},
          {"value": 60, "color": "red"}
        ]
      }
    }
  },
  "gridPos": {"h": 4, "w": 6, "x": 6, "y": 20}
}
```

---

#### Panel 8: MTTD (Mean Time to Detect)

**Purpose:** Measure alert effectiveness

```json
{
  "title": "MTTD (Mean Time to Detect) - Target: < 5 min",
  "type": "stat",
  "targets": [
    {
      "expr": "avg(alert_detection_time_seconds) / 60",
      "refId": "A"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "m",
      "thresholds": {
        "steps": [
          {"value": 0, "color": "green"},
          {"value": 5, "color": "yellow"},
          {"value": 10, "color": "red"}
        ]
      }
    }
  },
  "gridPos": {"h": 4, "w": 6, "x": 12, "y": 20}
}
```

---

#### Panel 9: Uptime (Current)

**Purpose:** Show current deployment uptime

```json
{
  "title": "Current Uptime",
  "type": "stat",
  "targets": [
    {
      "expr": "(time() - process_start_time_seconds{job=\"unit-talk-api\"}) / 3600",
      "refId": "A"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "h",
      "decimals": 1
    }
  },
  "gridPos": {"h": 4, "w": 6, "x": 18, "y": 20}
}
```

---

#### Panel 10: Request Throughput

**Purpose:** Monitor traffic volume

```json
{
  "title": "Request Throughput (req/s)",
  "type": "timeseries",
  "targets": [
    {
      "expr": "sum(rate(http_requests_total{job=\"unit-talk-api\"}[5m]))",
      "legendFormat": "Total Requests",
      "refId": "A"
    }
  ],
  "fieldConfig": {
    "defaults": {"unit": "reqps"}
  },
  "gridPos": {"h": 6, "w": 12, "x": 0, "y": 24}
}
```

---

#### Panel 11: Resource Utilization (CPU)

**Purpose:** Monitor pod CPU usage

```json
{
  "title": "CPU Utilization - Target: < 70%",
  "type": "timeseries",
  "targets": [
    {
      "expr": "(sum(rate(container_cpu_usage_seconds_total{namespace=\"unit-talk\",pod=~\"unit-talk-api-.*\"}[5m])) by (pod) / sum(container_spec_cpu_quota{namespace=\"unit-talk\",pod=~\"unit-talk-api-.*\"}/container_spec_cpu_period{namespace=\"unit-talk\",pod=~\"unit-talk-api-.*\"}) by (pod)) * 100",
      "legendFormat": "{{pod}}",
      "refId": "A"
    },
    {
      "expr": "70",
      "legendFormat": "Target (70%)",
      "refId": "B"
    }
  ],
  "fieldConfig": {
    "defaults": {"unit": "percent"}
  },
  "gridPos": {"h": 6, "w": 12, "x": 12, "y": 24}
}
```

---

#### Panel 12: Resource Utilization (Memory)

**Purpose:** Monitor pod memory usage

```json
{
  "title": "Memory Utilization - Target: < 80%",
  "type": "timeseries",
  "targets": [
    {
      "expr": "(sum(container_memory_working_set_bytes{namespace=\"unit-talk\",pod=~\"unit-talk-api-.*\"}) by (pod) / sum(container_spec_memory_limit_bytes{namespace=\"unit-talk\",pod=~\"unit-talk-api-.*\"}) by (pod)) * 100",
      "legendFormat": "{{pod}}",
      "refId": "A"
    },
    {
      "expr": "80",
      "legendFormat": "Target (80%)",
      "refId": "B"
    }
  ],
  "fieldConfig": {
    "defaults": {"unit": "percent"}
  },
  "gridPos": {"h": 6, "w": 12, "x": 0, "y": 30}
}
```

---

#### Panel 13: Active Alerts

**Purpose:** Show currently firing alerts

```json
{
  "title": "Active Alerts",
  "type": "table",
  "targets": [
    {
      "expr": "ALERTS{alertstate=\"firing\"}",
      "format": "table",
      "refId": "A"
    }
  ],
  "transformations": [
    {
      "id": "organize",
      "options": {
        "excludeByName": {
          "__name__": true,
          "Time": true
        },
        "indexByName": {},
        "renameByName": {
          "alertname": "Alert",
          "severity": "Severity",
          "summary": "Summary"
        }
      }
    }
  ],
  "gridPos": {"h": 6, "w": 12, "x": 12, "y": 30}
}
```

---

#### Panel 14: Incident Timeline

**Purpose:** Visual timeline of incidents

```json
{
  "title": "Incident Timeline (Last 7 Days)",
  "type": "timeseries",
  "targets": [
    {
      "expr": "changes(incident_created_total[7d])",
      "legendFormat": "Incidents Created",
      "refId": "A"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "custom": {
        "drawStyle": "bars",
        "barAlignment": 0
      }
    }
  },
  "gridPos": {"h": 6, "w": 24, "x": 0, "y": 36}
}
```

---

## Alert Annotations

**Purpose:** Display deployment and incident events on timeline

```json
{
  "annotations": {
    "list": [
      {
        "datasource": "Prometheus",
        "enable": true,
        "expr": "changes(deployment_timestamp[1m]) > 0",
        "iconColor": "blue",
        "name": "Deployments",
        "tagKeys": "version",
        "titleFormat": "Deployment: {{version}}"
      },
      {
        "datasource": "Prometheus",
        "enable": true,
        "expr": "ALERTS{alertstate=\"firing\",severity=\"critical\"}",
        "iconColor": "red",
        "name": "Critical Alerts",
        "titleFormat": "{{alertname}}"
      }
    ]
  }
}
```

---

## Dashboard Variables

**Purpose:** Allow filtering by environment, version, pod

```json
{
  "templating": {
    "list": [
      {
        "name": "env",
        "label": "Environment",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(up{job=\"unit-talk-api\"}, env)",
        "current": {"text": "production", "value": "production"}
      },
      {
        "name": "version",
        "label": "Version",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(up{job=\"unit-talk-api\",env=\"$env\"}, version)",
        "multi": true,
        "includeAll": true
      },
      {
        "name": "pod",
        "label": "Pod",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(up{job=\"unit-talk-api\",env=\"$env\",version=~\"$version\"}, pod)",
        "multi": true,
        "includeAll": true
      }
    ]
  }
}
```

---

## Accessibility and Sharing

### Dashboard Permissions

- **Viewers:** All engineering team members
- **Editors:** SRE team, Engineering managers
- **Admins:** Platform SRE lead

### Public Status Page Integration

**Embed public-facing metrics:**
- Overall availability (30-day)
- Current incidents
- Scheduled maintenance

**Status Page URL:** https://status.unit-talk.com

**Grafana Snapshot API:**
```bash
# Generate public snapshot
curl -X POST https://grafana.unit-talk.com/api/snapshots \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dashboard": {...},
    "expires": 86400
  }'
```

---

## Automated Reporting

### Daily SLO Report (Email)

**Cron:** 0 9 * * * (9 AM daily)

```bash
#!/bin/bash
# scripts/ops/daily-slo-report.sh

# Generate SLO compliance report
cat > /tmp/daily-slo-report.html <<EOF
<html>
<body>
<h1>Daily SLO Report - $(date +%Y-%m-%d)</h1>

<h2>SLO Compliance (Last 24 Hours)</h2>
<table>
  <tr>
    <th>Metric</th>
    <th>Target</th>
    <th>Actual</th>
    <th>Compliance</th>
    <th>Status</th>
  </tr>
  <tr>
    <td>API Latency p95</td>
    <td>&lt; 150ms</td>
    <td>$(curl -s 'http://prometheus:9090/api/v1/query?query=avg_over_time(histogram_quantile(0.95,sum(rate(http_request_duration_seconds_bucket{job="unit-talk-api"}[5m]))by(le))[24h:5m])*1000' | jq -r '.data.result[0].value[1]')ms</td>
    <td>$(curl -s 'http://prometheus:9090/api/v1/query?query=(count_over_time((histogram_quantile(0.95,sum(rate(http_request_duration_seconds_bucket{job="unit-talk-api"}[5m]))by(le))*1000<150)[24h:1m])/(24*60))*100' | jq -r '.data.result[0].value[1]')%</td>
    <td>✅</td>
  </tr>
</table>

<h2>Incidents</h2>
<p>Total: $(kubectl get events -n unit-talk --field-selector type=Warning --since=24h | wc -l)</p>

<p>Dashboard: <a href="http://grafana.unit-talk.com/d/phase17-success-metrics">View Live Dashboard</a></p>
</body>
</html>
EOF

# Send email
mail -s "Daily SLO Report - $(date +%Y-%m-%d)" \
  -a "Content-Type: text/html" \
  engineering-team@unit-talk.com < /tmp/daily-slo-report.html
```

---

## Mobile Access

### Grafana Mobile App

- iOS: https://apps.apple.com/app/grafana/id1481343365
- Android: https://play.google.com/store/apps/details?id=com.grafana.mobile

**Setup:**
1. Install Grafana mobile app
2. Add server: https://grafana.unit-talk.com
3. Authenticate with SSO
4. Add dashboard to favorites
5. Enable push notifications for critical alerts

---

## Executive Summary View

**Simplified dashboard for non-technical stakeholders:**

### Single-Page Executive Dashboard

**Metrics:**
- Availability (last 30 days): **Gauge (large, center)**
- Incidents this week: **Number**
- Average response time: **Number**
- Active users: **Number**

**URL:** http://grafana.unit-talk.com/d/executive-summary

**Auto-refresh:** Every 60 seconds

---

**Document Version:** 1.0
**Last Updated:** 2025-01-25
**Owner:** Platform SRE Team
