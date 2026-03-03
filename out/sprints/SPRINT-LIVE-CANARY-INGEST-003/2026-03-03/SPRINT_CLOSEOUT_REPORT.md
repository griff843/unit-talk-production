# SPRINT CLOSEOUT REPORT

**Sprint**: SPRINT-LIVE-CANARY-INGEST-003
**Objective**: Live canary ingestion loop — real OddsAPI NBA data through full pipeline to canary Discord
**Date**: 2026-03-03
**Status**: PASS

---

## Executive Summary

Executed live canary ingestion loop against real OddsAPI (NBA), staging Supabase, and canary Discord webhook.
Fetched 10 NBA games (480 props), scored via V2 engine, evaluated risk gate (fail-closed, canary override),
inserted 5 picks via `lifecycleInsert`, published 5 to canary Discord via `publishOneToCanary`.
All 5 Discord snowflake IDs validated. Cleanup verified 0 residual rows.

---

## Pipeline Proven

| Stage | Result |
|-------|--------|
| Ingestion (OddsAPI) | 10 games, 480 props, 95ms, 1 credit |
| Scoring (V2) | 480 scored, 480 eligible, top tier: A |
| CCC Ranking | Deterministic sort by professional_score |
| Risk Gate (fail-closed) | 5 evaluated, 5 BLOCK (total_kelly=2.38>1.0), canary override |
| Lifecycle Insert | 5 inserted via `lifecycleInsert` (submitter) |
| Lifecycle Promote | 5 promoted via `lifecycleUpdate` (promoter) |
| Discord Publish | 5 published via `publishOneToCanary`, all snowflakes valid |
| Idempotency | Re-publish correctly blocked |
| Cleanup | 5 deleted, 0 residual (CLEAN) |

---

## Discord Snowflake Samples

- `1478354410588475464` (Phoenix Suns, betmgm, 1505ms)
- `1478354416276082770` (Phoenix Suns, betonlineag, 484ms)
- `1478354422001172605` (Phoenix Suns, betrivers, 364ms)

---

## Credit Usage

| Provider | Endpoint | Credits | DB Logged |
|----------|----------|---------|-----------|
| The Odds API | /v4/sports/basketball_nba/odds | 1 | Yes |

---

## Cache Metrics

| Metric | Value |
|--------|-------|
| Mode | Memory Cache (Redis unavailable) |
| Lookups | 1 |
| Hits | 0 |
| Misses | 1 |
| TTL | 90s |

---

## Risk Gate Detail

Risk engine evaluated all 5 picks. All blocked due to existing kelly exposure (2.38 > 1.0 critical threshold).
In production, these would be stopped. Canary override proceeded to prove publishing pipeline.
This proves the risk engine is **fail-closed** and correctly enforcing exposure limits.

---

## Kill Conditions

| Condition | Status |
|-----------|--------|
| Publish error | Not triggered |
| Missing credit log | Not triggered |
| Outbox backlog growth | Not triggered |

---

## Artifacts

| # | File | Description |
|---|------|-------------|
| 00 | 00_context.json | Sprint context and configuration |
| 01 | 01_ingest_cadence.json | Cycle timing and counts |
| 02 | 02_cache_metrics.json | Redis/memory cache hit/miss |
| 03 | 03_credit_usage.json | OddsAPI credit telemetry |
| 04 | 04_stale_offer_report.json | Stale offer detection |
| 05 | 05_scored_ranked.json | Scoring engine results |
| 06 | 06_risk_decisions.json | Risk gate decisions |
| 07 | 07_outbox_publish.json | Outbox insert/publish counts |
| 08 | 08_discord_receipts.json | Discord snowflake receipts |
| 09 | 09_post_run_cleanup.json | Post-run cleanup verification |

---

## Sign-off

- [x] Live API data ingested (OddsAPI NBA)
- [x] Scoring + CCC ranking executed
- [x] Risk gate evaluated (fail-closed proven)
- [x] Lifecycle adapters used (insert, update, publish)
- [x] Discord canary receipts with valid snowflakes
- [x] Credit usage logged to DB
- [x] Cleanup verified (0 residual)
- [x] All 10 proof artifacts generated

**Sprint Status**: PASS
