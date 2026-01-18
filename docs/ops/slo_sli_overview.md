# Service Level Objectives & Service Level Indicators

**Document Owner**: SRE Team
**Last Updated**: 2025-12-01
**Review Cadence**: Monthly
**Related**: [Production Charter](../PRODUCTION_CHARTER.md), [Phase 3 Orchestration](../modernization/phase3_temporal_orchestration.md)

---

## Overview

This document defines the Service Level Objectives (SLOs) and Service Level Indicators (SLIs) for the Unit Talk platform. These metrics establish the reliability, performance, and availability targets that the system must maintain in production.

**Key Principles**:
- SLOs are **measurable, achievable, and meaningful** to end users
- SLIs are **observable metrics** that directly inform SLO compliance
- Alerts trigger only on **sustained SLO violations** (not transient spikes)
- SLOs are reviewed and adjusted based on **actual user experience**

---

## SLO Framework

### SLO Structure

Each SLO follows this structure:

```yaml
name: [Descriptive Name]
objective: [What we're measuring and why it matters]
target: [Numeric target with time window]
measurement_window: [Time period for evaluation]
error_budget: [Allowed failure rate]
consequences:
  breach: [What happens if we miss the SLO]
  exhaustion: [What happens if error budget is exhausted]
```

### Error Budget Philosophy

**Error Budget** = `1 - SLO Target`

- **Purpose**: Allow for innovation and deployment velocity while maintaining reliability
- **Usage**: If error budget is exhausted, **freeze non-critical changes** until budget recovers
- **Tracking**: Monitored continuously with weekly reviews
- **Replenishment**: Resets at the start of each measurement window

---

## Tier 1: User-Facing SLOs (Critical)

These SLOs directly impact end-user experience and are **non-negotiable**.

### 1.1 API Availability

**Objective**: The API must be reachable and responding to requests.

```yaml
name: API Availability
sli: (successful_requests) / (total_requests)
target: 99.9% (three nines)
measurement_window: 30 days
error_budget: 0.1% = 43 minutes/month downtime allowed

alert_conditions:
  - error_rate > 1% for 5 consecutive minutes (P1)
  - error_rate > 5% for 1 minute (P0)

dashboard_panel: "API Availability (30-day rolling)"
prometheus_query: |
  (
    sum(rate(http_requests_total{status!~"5.."}[5m]))
    /
    sum(rate(http_requests_total[5m]))
  ) * 100
```

**Measurement**: HTTP response status codes (2xx, 3xx, 4xx = success, 5xx = failure)

**Consequences**:
- **Breach**: Immediate incident response, all hands on deck
- **Budget Exhaustion**: Deployment freeze for non-critical changes

---

### 1.2 API Latency (p95)

**Objective**: 95% of API requests complete within acceptable time.

```yaml
name: API Response Time (p95)
sli: 95th_percentile(request_duration_seconds)
target: < 150ms
measurement_window: 7 days
error_budget: 5% of requests can exceed 150ms

alert_conditions:
  - p95_latency > 150ms for 10 minutes (P1)
  - p95_latency > 300ms for 5 minutes (P0)
  - p99_latency > 1000ms for 5 minutes (P0)

dashboard_panel: "API Latency (p50, p95, p99)"
prometheus_query: |
  histogram_quantile(0.95,
    sum(rate(http_request_duration_seconds_bucket[5m])) by (le, endpoint)
  )
```

**Breakdown by Endpoint**:
- `/api/domain/picks/insert`: p95 < 100ms
- `/api/domain/picks/preflight`: p95 < 50ms
- `/api/health`: p95 < 20ms
- `/api/games`: p95 < 200ms

**Consequences**:
- **Breach**: Performance investigation required within 24 hours
- **Budget Exhaustion**: Optimization sprint prioritized

---

### 1.3 Database Query Performance

**Objective**: Database queries complete quickly to avoid bottlenecks.

```yaml
name: Database Query Latency (p95)
sli: 95th_percentile(db_query_duration_seconds)
target: < 50ms
measurement_window: 7 days
error_budget: 5% of queries can exceed 50ms

alert_conditions:
  - p95_db_latency > 50ms for 10 minutes (P1)
  - p95_db_latency > 100ms for 5 minutes (P0)

dashboard_panel: "Database Query Performance"
prometheus_query: |
  histogram_quantile(0.95,
    sum(rate(db_query_duration_seconds_bucket[5m])) by (le, table, operation)
  )
```

**Breakdown by Operation**:
- `SELECT picks WHERE bet_slip_id = ?`: p95 < 10ms (indexed)
- `INSERT INTO picks`: p95 < 20ms
- `SELECT FROM raw_props JOIN canonical_players`: p95 < 100ms (complex query allowed)

**Consequences**:
- **Breach**: Query optimization review, index analysis
- **Budget Exhaustion**: Database performance sprint

---

### 1.4 Discord Publishing Success Rate

**Objective**: Picks successfully publish to Discord without failures.

```yaml
name: Discord Publishing Success Rate
sli: (successful_publishes) / (total_publish_attempts)
target: 99.5%
measurement_window: 24 hours
error_budget: 0.5% = ~7 failed publishes per 1,000

alert_conditions:
  - publish_success_rate < 99% for 15 minutes (P1)
  - publish_success_rate < 95% for 5 minutes (P0)
  - DLQ depth > 50 messages (P1)

dashboard_panel: "Discord Publishing Metrics"
prometheus_query: |
  (
    sum(rate(discord_publish_success_total[5m]))
    /
    sum(rate(discord_publish_attempts_total[5m]))
  ) * 100
```

**Failure Categories**:
- Transient (rate limit, network): Auto-retry with backoff
- Permanent (invalid channel, permissions): Move to DLQ
- Idempotency: Deduplicate via message_id tracking

**Consequences**:
- **Breach**: Review Discord API integration, retry logic
- **Budget Exhaustion**: Publishing reliability sprint

---

## Tier 2: Pipeline SLOs (Important)

These SLOs track internal pipeline health and data flow.

### 2.1 Data Ingestion Freshness

**Objective**: Raw props are ingested from feeds with minimal delay.

```yaml
name: Data Ingestion Freshness
sli: time_difference(feed_timestamp, db_insert_timestamp)
target: p95 < 60 seconds
measurement_window: 1 hour
error_budget: 5% of props can have >60s delay

alert_conditions:
  - p95_ingestion_delay > 60s for 10 minutes (P2)
  - p95_ingestion_delay > 120s for 5 minutes (P1)

dashboard_panel: "Data Ingestion Pipeline"
prometheus_query: |
  histogram_quantile(0.95,
    sum(rate(ingestion_delay_seconds_bucket[5m])) by (le, source, sport)
  )
```

**Breakdown by Source**:
- Odds API: p95 < 30s (real-time priority)
- Optimal API: p95 < 60s (acceptable delay)
- Manual submission: p95 < 5s (instant)

**Consequences**:
- **Breach**: Review FeedAgent performance, API latency
- **Budget Exhaustion**: Ingestion optimization required

---

### 2.2 Canonical Mapping Coverage

**Objective**: High percentage of raw props successfully map to canonical entities.

```yaml
name: Canonical Mapping Coverage
sli: (raw_props_with_canonical_ids) / (total_raw_props_ingested)
target: > 99%
measurement_window: 24 hours
error_budget: 1% unmapped props allowed

alert_conditions:
  - mapping_coverage < 98% for 30 minutes (P2)
  - mapping_coverage < 95% for 10 minutes (P1)

dashboard_panel: "Canonical Mapping Success"
prometheus_query: |
  (
    sum(raw_props_with_canonical_player_id)
    /
    sum(total_raw_props)
  ) * 100
```

**Failure Modes**:
- New player not in canonical_players table
- Typo/variation in player name
- New team/game not yet mapped

**Consequences**:
- **Breach**: Review player name matching logic
- **Budget Exhaustion**: Canonical entity maintenance sprint

---

### 2.3 Professional Grading Throughput

**Objective**: Picks are professionally graded without delay.

```yaml
name: Professional Grading Latency
sli: time_from_pick_creation_to_grading_complete
target: p95 < 5 seconds
measurement_window: 1 hour
error_budget: 5% of picks can take >5s to grade

alert_conditions:
  - p95_grading_latency > 5s for 10 minutes (P2)
  - p95_grading_latency > 10s for 5 minutes (P1)

dashboard_panel: "Professional Grading Performance"
prometheus_query: |
  histogram_quantile(0.95,
    sum(rate(grading_duration_seconds_bucket[5m])) by (le, tier)
  )
```

**Breakdown by Complexity**:
- Single leg pick: p95 < 2s
- 3-leg parlay: p95 < 5s
- 6-leg parlay: p95 < 10s

**Consequences**:
- **Breach**: ProfessionalPropProcessor optimization review
- **Budget Exhaustion**: Grading performance sprint

---

### 2.4 CLV Tracking Coverage

**Objective**: All eligible picks have CLV tracking initiated.

```yaml
name: CLV Tracking Coverage
sli: (picks_with_clv_tracking) / (total_approved_picks)
target: 100%
measurement_window: 24 hours
error_budget: 0% (all picks must have CLV tracking)

alert_conditions:
  - clv_coverage < 100% for 30 minutes (P1)
  - clv_coverage < 95% for 10 minutes (P0)

dashboard_panel: "CLV Tracking Metrics"
prometheus_query: |
  (
    sum(picks_with_clv_tracking_id)
    /
    sum(approved_picks)
  ) * 100
```

**Consequences**:
- **Breach**: Review CLV tracking initialization logic
- **Budget Exhaustion**: CLV infrastructure remediation

---

## Tier 3: Operational SLOs (Monitoring)

These SLOs track system health and operational metrics.

### 3.1 Temporal Workflow Success Rate

**Objective**: Temporal workflows complete successfully without failures.

```yaml
name: Temporal Workflow Success Rate
sli: (successful_workflows) / (total_workflow_executions)
target: 99%
measurement_window: 24 hours
error_budget: 1% workflows can fail

alert_conditions:
  - workflow_failure_rate > 2% for 30 minutes (P2)
  - workflow_failure_rate > 5% for 10 minutes (P1)

dashboard_panel: "Temporal Workflow Health"
prometheus_query: |
  (
    sum(rate(temporal_workflow_completed_total{status="success"}[5m]))
    /
    sum(rate(temporal_workflow_completed_total[5m]))
  ) * 100
```

**Breakdown by Workflow**:
- TicketLifecycleWorkflow: 99% success
- CLVUpdateWorkflow: 95% success (external API dependencies)
- DailyRecapWorkflow: 99.9% success (critical business function)

**Consequences**:
- **Breach**: Review workflow error logs, activity failures
- **Budget Exhaustion**: Workflow reliability improvements

---

### 3.2 DLQ Health

**Objective**: Dead Letter Queue remains manageable and events are processed.

```yaml
name: DLQ Depth
sli: current_dlq_message_count
target: < 100 messages
measurement_window: Real-time
error_budget: N/A (absolute threshold)

alert_conditions:
  - dlq_depth > 100 for 10 minutes (P2)
  - dlq_depth > 500 for 5 minutes (P1)
  - oldest_dlq_message_age > 24 hours (P2)

dashboard_panel: "DLQ Monitoring"
prometheus_query: |
  sum(dlq_message_count) by (source, error_type)
```

**Consequences**:
- **Breach**: Review DLQ messages, identify patterns
- **Sustained High Depth**: Manual intervention required

---

### 3.3 Cache Hit Rate

**Objective**: Redis cache provides high hit rate for frequently accessed data.

```yaml
name: Cache Hit Rate
sli: (cache_hits) / (cache_hits + cache_misses)
target: > 80%
measurement_window: 1 hour
error_budget: 20% cache misses allowed

alert_conditions:
  - cache_hit_rate < 70% for 30 minutes (P2)
  - cache_hit_rate < 50% for 10 minutes (P1)

dashboard_panel: "Redis Cache Performance"
prometheus_query: |
  (
    sum(rate(redis_cache_hits_total[5m]))
    /
    (sum(rate(redis_cache_hits_total[5m])) + sum(rate(redis_cache_misses_total[5m])))
  ) * 100
```

**Consequences**:
- **Breach**: Review cache key strategy, TTL settings
- **Budget Exhaustion**: Cache optimization required

---

## SLO Compliance Dashboard

### Grafana Dashboard Layout

**Dashboard Name**: `Unit Talk - SLO Compliance`

**Panels** (in order):
1. **SLO Summary** (Table)
   - All SLOs with current compliance status
   - Green (✓) = meeting target
   - Yellow (⚠) = within error budget
   - Red (✗) = exceeding error budget

2. **Error Budget Burn Rate** (Graph)
   - Shows error budget consumption over time
   - Forecasts when budget will be exhausted

3. **API Availability** (Graph + Stats)
   - 30-day rolling availability
   - Current uptime percentage
   - Time since last incident

4. **API Latency** (Multi-line graph)
   - p50, p95, p99 latencies
   - Target threshold line at 150ms
   - Per-endpoint breakdown

5. **Database Performance** (Heatmap)
   - Query latency distribution by table
   - Slow query identification

6. **Discord Publishing** (Graph + Table)
   - Success rate over time
   - Failure breakdown by error type
   - DLQ depth and age

7. **Pipeline Health** (Multiple panels)
   - Ingestion freshness
   - Canonical mapping coverage
   - Professional grading latency
   - CLV tracking coverage

8. **Temporal Workflows** (Graph + Stats)
   - Workflow success rate by type
   - Average workflow duration
   - Failed workflow count

---

## Alert Definitions

### Alert Severity Levels

| Severity | Description | Response Time | Escalation |
|----------|-------------|---------------|------------|
| **P0** | Critical outage | Immediate page | All hands |
| **P1** | Major degradation | Within 15 minutes | On-call engineer |
| **P2** | Minor issue | Within 1 hour | Team notification |
| **P3** | Warning | Next business day | Logged only |

### Alert Routing

```yaml
alert_routing:
  P0_alerts:
    - PagerDuty
    - Discord (#incidents channel)
    - SMS to on-call
    - Auto-create incident ticket

  P1_alerts:
    - PagerDuty
    - Discord (#alerts channel)
    - Email to on-call

  P2_alerts:
    - Discord (#alerts channel)
    - Email to team

  P3_alerts:
    - Logged in Prometheus
    - Weekly summary email
```

### Sample Alert Configuration (Prometheus)

```yaml
groups:
  - name: unit_talk_slo_alerts
    interval: 1m
    rules:
      # P0: Critical API outage
      - alert: APIAvailabilityCritical
        expr: |
          (
            sum(rate(http_requests_total{status!~"5.."}[1m]))
            /
            sum(rate(http_requests_total[1m]))
          ) * 100 < 95
        for: 1m
        labels:
          severity: P0
          slo: api_availability
        annotations:
          summary: "CRITICAL: API availability below 95%"
          description: "API availability is {{ $value | humanizePercentage }} (target: 99.9%)"

      # P1: API latency breach
      - alert: APILatencyBreach
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
          ) > 0.150
        for: 10m
        labels:
          severity: P1
          slo: api_latency_p95
        annotations:
          summary: "API p95 latency exceeds 150ms"
          description: "API p95 latency is {{ $value | humanizeDuration }} (target: 150ms)"

      # P1: Discord publishing failure
      - alert: DiscordPublishingFailure
        expr: |
          (
            sum(rate(discord_publish_success_total[5m]))
            /
            sum(rate(discord_publish_attempts_total[5m]))
          ) * 100 < 99
        for: 15m
        labels:
          severity: P1
          slo: discord_publishing_success
        annotations:
          summary: "Discord publishing success rate below 99%"
          description: "Success rate is {{ $value | humanizePercentage }} (target: 99.5%)"

      # P2: CLV tracking coverage drop
      - alert: CLVTrackingCoverageDrop
        expr: |
          (
            sum(picks_with_clv_tracking_id)
            /
            sum(approved_picks)
          ) * 100 < 100
        for: 30m
        labels:
          severity: P2
          slo: clv_tracking_coverage
        annotations:
          summary: "CLV tracking coverage below 100%"
          description: "Coverage is {{ $value | humanizePercentage }} (target: 100%)"
```

---

## SLO Review Process

### Weekly Reviews

**Attendees**: SRE Team, Engineering Lead
**Duration**: 30 minutes
**Agenda**:
1. Review SLO compliance for the week
2. Identify trends and patterns
3. Discuss error budget consumption
4. Prioritize improvements for next sprint

### Monthly Reviews

**Attendees**: Engineering Team, Product, Leadership
**Duration**: 1 hour
**Agenda**:
1. Comprehensive SLO performance review
2. Discuss user impact of any breaches
3. Adjust SLO targets if needed (data-driven)
4. Plan strategic improvements

### SLO Adjustment Criteria

SLOs should be adjusted when:
- **Too easy**: Consistently meeting target with >95% headroom
- **Too hard**: Consistently missing target despite best efforts
- **User feedback**: Real user experience doesn't match SLO compliance
- **Business changes**: New features or traffic patterns require new targets

---

## Appendix: Prometheus Metric Names

### API Metrics
- `http_requests_total{status, endpoint, method}`
- `http_request_duration_seconds_bucket{endpoint, le}`
- `http_request_size_bytes_bucket{endpoint, le}`

### Database Metrics
- `db_query_duration_seconds_bucket{table, operation, le}`
- `db_connection_pool_size{state}` (active, idle, waiting)
- `db_transaction_duration_seconds_bucket{le}`

### Discord Publishing Metrics
- `discord_publish_attempts_total{channel, tier}`
- `discord_publish_success_total{channel, tier}`
- `discord_publish_failures_total{channel, tier, error_type}`
- `dlq_message_count{source, error_type}`
- `dlq_oldest_message_age_seconds`

### Pipeline Metrics
- `ingestion_delay_seconds_bucket{source, sport, le}`
- `raw_props_with_canonical_player_id`
- `total_raw_props`
- `grading_duration_seconds_bucket{tier, le}`
- `picks_with_clv_tracking_id`
- `approved_picks`

### Temporal Metrics
- `temporal_workflow_started_total{workflow_type, source}`
- `temporal_workflow_completed_total{workflow_type, status}`
- `temporal_workflow_duration_seconds_bucket{workflow_type, le}`
- `temporal_activity_duration_seconds_bucket{activity_name, status, le}`

### Cache Metrics
- `redis_cache_hits_total{cache_name}`
- `redis_cache_misses_total{cache_name}`
- `redis_command_duration_seconds_bucket{command, le}`

---

**Version**: 1.0
**Next Review**: 2025-01-01
**Feedback**: Please submit SLO feedback to #sre-feedback channel
