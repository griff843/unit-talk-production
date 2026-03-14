# SLO Definitions

**Sprint**: SPRINT-043-LAYER2-PHASE7-RELIABILITY-MONITORING **Layer/Phase**:
Layer 2 / Phase 7 — Reliability & Monitoring **Date**: 2026-03-14 **Authority**:
Canonical SLO reference for Unit Talk platform

---

## Overview

These SLOs define the platform's performance commitments. They are measured over
a **7-day rolling window** and exposed via `GET /api/slo/status`.

Thresholds:

- **OK**: attainment ≥ target
- **WARN**: attainment < target
- **BREACH**: attainment < (target − 0.05) for rates, or p99 > (target × 2) for
  latency

---

## SLO 1 — Pick Lifecycle Completion Rate

| Field      | Value                           |
| ---------- | ------------------------------- |
| **ID**     | `lifecycle_completion`          |
| **Target** | ≥ 95% over 7-day rolling window |
| **Unit**   | Ratio (0–1)                     |

**Definition**: Percentage of picks that reach `SETTLED` lifecycle stage within
72 hours of being `SUBMITTED`.

**Measurement query**:

```sql
SELECT
  COUNT(*) FILTER (WHERE lifecycle_stage = 'SETTLED'
                     AND settled_at - created_at < INTERVAL '72 hours') AS settled,
  COUNT(*) AS total
FROM unified_picks
WHERE created_at >= NOW() - INTERVAL '7 days';
```

**Why it matters**: Completion rate is the primary indicator of end-to-end
pipeline health. A drop here signals grading, promotion, or settlement failure.

---

## SLO 2 — Discord Posting Success Rate

| Field      | Value                           |
| ---------- | ------------------------------- |
| **ID**     | `discord_posting`               |
| **Target** | ≥ 98% over 7-day rolling window |
| **Unit**   | Ratio (0–1)                     |

**Definition**: Percentage of `pick_publish` outbox rows that transition from
`pending` to `posted` (not `failed`) within 15 minutes of insertion.

**Measurement query**:

```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'posted') AS posted,
  COUNT(*) AS total
FROM pick_publish
WHERE created_at >= NOW() - INTERVAL '7 days';
```

**Why it matters**: Discord is the primary delivery channel. A drop here means
subscribers are not receiving pick alerts.

---

## SLO 3 — Grading Latency (p50)

| Field      | Value                         |
| ---------- | ----------------------------- |
| **ID**     | `grading_latency_p50`         |
| **Target** | p50 < 300 seconds (5 minutes) |
| **Unit**   | Seconds (median)              |

**Definition**: Median time from `unified_picks.created_at` (promotion
timestamp) to the pick being ready for Discord posting
(`promotion_status = 'queued'`).

**Measurement query**:

```sql
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at))
  ) AS p50_seconds
FROM unified_picks
WHERE promotion_status = 'queued'
  AND created_at >= NOW() - INTERVAL '7 days';
```

**Why it matters**: High latency here means picks are stale by the time they
reach subscribers, reducing the value of the intelligence signal.

---

## SLO 4 — Settlement Accuracy

| Field      | Value                             |
| ---------- | --------------------------------- |
| **ID**     | `settlement_accuracy`             |
| **Target** | ≥ 99.5% over 7-day rolling window |
| **Unit**   | Ratio (0–1)                       |

**Definition**: Percentage of SETTLED picks where `settlement_status` is NOT
`'disputed'`. A disputed settlement indicates a grading error or data
inconsistency.

**Measurement query**:

```sql
SELECT
  COUNT(*) FILTER (WHERE settlement_status != 'disputed') AS clean,
  COUNT(*) AS total
FROM unified_picks
WHERE lifecycle_stage = 'SETTLED'
  AND settled_at >= NOW() - INTERVAL '7 days';
```

**Why it matters**: Settlement accuracy is the integrity measure of the scoring
engine. Disputes require manual remediation and undermine user trust.

---

## SLO Attainment API

Live SLO attainment is available at:

```
GET /api/slo/status
Authorization: Bearer admin-<token>
```

Response: `SloStatusResponse` — see `apps/api/src/routes/slo.ts`.

---

## Alerting Thresholds

| SLO                  | WARN threshold | BREACH threshold |
| -------------------- | -------------- | ---------------- |
| Lifecycle completion | < 95%          | < 90%            |
| Discord posting      | < 98%          | < 93%            |
| Grading latency p50  | > 300s         | > 600s           |
| Settlement accuracy  | < 99.5%        | < 94.5%          |

Threshold alerts are surfaced in `GET /api/health/summary` and logged by
`PlatformThresholdEvaluator`.

---

## Revision History

| Date       | Change                           | Sprint                                          |
| ---------- | -------------------------------- | ----------------------------------------------- |
| 2026-03-14 | Initial SLO definitions (4 SLOs) | SPRINT-043-LAYER2-PHASE7-RELIABILITY-MONITORING |
