---
title: 'Market Data Foundation — Provider Offers Ingestion & Truth Layer'
version: '1.0'
status: 'Draft'
authority: 'Founder'
sprint: 'MARKET-DATA-FOUNDATION-001'
last_updated: '2026-03-01'
depends_on:
  - 'PHASE 2B Intelligence Superiority: PASS'
  - 'Probability primitives + CCC exist and are fail-closed'
primary_providers:
  - 'SportsGameOdds (SGO) — primary'
  - 'OddsAPI — secondary/failover'
scope:
  - 'Offer ingestion'
  - 'Normalization'
  - 'Deterministic upsert into provider_offers'
  - 'Closing-line snapshot immutability'
  - 'Cache-first + credit logging'
non_scope:
  - 'Risk layer'
  - 'Automation/autopilot selection'
  - 'UI polish beyond operational verification'
---

# 1. Purpose

`provider_offers` is the market truth substrate for:

- devig consensus (`p_market_devig`)
- probability primitives (`p_final`, `edge_final`, `uncertainty_final`,
  `clv_forecast`)
- CCC slate compression
- CLV dominance measurement

Without `provider_offers`, all intelligence and CCC behavior must fail-closed.

This spec defines the constitutional market data ingestion system required for
production operation.

# 2. Goals

## 2.1 Functional Goals

1. Populate `provider_offers` with multi-book offers for all supported markets.
2. Ensure coverage sufficient to compute devig consensus:
   - consensus eligibility requires `books_used >= 2`
3. Maintain deterministic, idempotent ingestion:
   - repeated pulls must not create duplicates
4. Preserve closing-line immutability:
   - once locked, closing snapshots are append-only / immutable
5. Provide provenance and auditability:
   - provider, book, timestamp, response hash, normalization version
6. Provide cost control:
   - cache-first TTL
   - credit usage logging and throttling

## 2.2 Product Goals

1. CCC shows ranked plays (non-zero) once offers exist.
2. Time compression becomes measurable (10–15 minute workflow).

# 3. Architecture (Canonical)

## 3.1 Single Writer

Only the ingestion service (FeedAgent / ingestion worker) may write
`provider_offers`.

No writes from:

- CCC
- Smart Form
- Scoring/Probability layer
- UI

## 3.2 Provider Hierarchy

- Primary: SGO
- Secondary: OddsAPI

Failover behavior:

- If SGO fails or is stale beyond threshold, use OddsAPI.
- Failover must be logged with reason code.

## 3.3 Cache-First Policy

- Redis TTL default: 90s (configurable)
- Cache key must include:
  - provider
  - sport/league
  - event_id
  - market_type_id
  - outcome_id (if applicable)
  - timestamp bucket

Cache must prevent redundant provider calls inside TTL.

## 3.4 Deterministic Normalization

Ingestion must normalize raw provider payloads into canonical identifiers:

- event_id (canonical)
- market_type_id (canonical)
- outcome identifiers (canonical)
- book registry mapping

Normalization must be versioned:

- `normalization_version`

## 3.5 Deterministic Upsert

`provider_offers` must be written via deterministic upsert using a canonical
unique key.

The unique key must prevent duplicates across re-pulls and jitter. Example
(conceptual):

- provider_id
- book_id
- market_key (event_id + market_type_id + outcome_key)
- offered_at_bucket (or exact offered_at if stable)

Final key must align with actual schema.

# 4. Data Contract (Minimum Required Fields)

Ingestion must persist enough to support devig consensus and audit:

- provider_id
- book_id
- event_id
- market_type_id
- outcome_key / side (over/under/home/away)
- price/odds (normalized)
- implied_prob (optional precompute)
- offered_at_utc
- retrieved_at_utc
- response_hash (or payload hash)
- normalization_version
- data_quality flags (optional)
- liquidity/sharp weights (via provider_registry/book metadata)

# 5. Closing Snapshot Immutability

Closing line snapshots must be locked at (or near) event start time:

- Once closing snapshot is locked, it must never be overwritten.
- Any late-arriving offers are stored as new records and flagged as post-start.

CLV requires:

- entry snapshot reference
- closing snapshot reference

# 6. Governance & Safety Gates

## 6.1 Fail-Closed

If offers are insufficient:

- devig consensus must return `{ ok: false, reason: INSUFFICIENT_BOOKS }`
- probability layer must fail closed
- CCC must eliminate plays and show counts

## 6.2 Staleness Guard

Offers older than threshold (e.g. 5–10 minutes near start) are flagged stale.
Stale offers may be excluded from consensus weighting.

## 6.3 Credit Throttle

If credit usage exceeds threshold:

- reduce polling frequency
- prioritize near-start events
- log throttle actions

# 7. Acceptance Criteria (Binary)

This sprint is PASS only if:

1. `provider_offers` contains non-zero rows for at least one sport/league.
2. At least one event has offers from >= 2 books for a supported market.
3. Running a V3 scoring pass produces:
   - `p_market_devig` not null
   - `p_final` not null
   - `edge_final` not null
   - `uncertainty_final` not null
   - `clv_forecast` not null
4. CCC shows >= 5 ranked plays for a populated slate.
5. Credit usage is logged for provider calls.
6. Re-running ingestion within TTL does not create duplicate offers.
7. Proof bundle produced (Section 8).

# 8. Proof Bundle Requirements

Location: `out/sprints/MARKET-DATA-FOUNDATION-001/YYYY-MM-DD/`

Must include:

- proof_git_status.txt
- proof_typecheck.txt (if code changes)
- proof_provider_offers_count.txt
- proof_provider_offers_sample.json
- proof_books_coverage_by_market.json
- proof_ccc_nonzero.png (CCC shows ranked plays)
- proof_probability_primitives_nonnull.json
- proof_credit_usage_log_row.json
- SPRINT_CLOSEOUT_REPORT.md

# 9. Non-Goals

- No risk engine expansion
- No automation/autopilot changes
- No UI polish beyond verification needs
