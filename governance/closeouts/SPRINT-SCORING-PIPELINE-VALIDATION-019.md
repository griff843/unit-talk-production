# SPRINT CLOSEOUT REPORT

**Sprint**: SPRINT-SCORING-PIPELINE-VALIDATION-019 **Objective**: Runtime
validation of scoring pipeline activated in Sprint 018 **Date**: 2026-03-04
**Status**: COMPLETE

---

## Executive Summary

Executed live runtime validation of the production scoring pipeline against SGO
market data. Validated 250 props through the full pipeline (devig, probability,
scoring, promotion, lifecycle). Confirmed all fail-closed mechanisms operate
correctly. Identified 5 legacy Discord posts from Sprint 016 era that predate
the guardrails — no new violations detected.

---

## Sprint Objective

Validate that SPRINT-SCORING-PIPELINE-ACTIVATION-018's production pipeline
produces correct, conservative scoring results with proper fail-closed behavior
when operating with single-book data (SGO only).

---

## Validation Methodology

### Scripts Created

| Script                                        | Purpose                                            |
| --------------------------------------------- | -------------------------------------------------- |
| `scripts/analysis/sample-sgo-markets.ts`      | Capture live SGO events with opposing odds         |
| `scripts/analysis/run-scoring-sample.ts`      | Score 200+ props through ProfessionalPropProcessor |
| `scripts/analysis/generate-scoring-report.ts` | Distribution, guardrail, integrity, CLV checks     |

### Data Captured

- 20 live SGO events (10 NBA, 10 NHL, 0 MLB)
- 8,444 total odds keys (5,920 both-sided, 2,524 single-sided)
- 3,093 paired props (2,803 PAIRED, 290 FALLBACK_SINGLE_SIDED)
- 200 raw_props inserted into database
- 250 raw_props scored through production pipeline

---

## Distribution Analysis

### Tier Distribution

| Tier | Count | Notes                                                           |
| ---- | ----- | --------------------------------------------------------------- |
| D    | 250   | All props — expected with neutral confidence + default features |

### Promotion Band Distribution

| Band    | Count | Notes                                                  |
| ------- | ----- | ------------------------------------------------------ |
| NO_POST | 250   | Correct — Gate 8 blocks without probability primitives |

### Score Statistics

| Metric  | Value |
| ------- | ----- |
| Average | 20.70 |
| Min     | 20.69 |
| Max     | 20.72 |

### Devig Mode

| Mode                  | Pairing Stage | Processing Stage                     |
| --------------------- | ------------- | ------------------------------------ |
| PAIRED                | 2,803 (90.6%) | 0 (raw_props store single direction) |
| FALLBACK_SINGLE_SIDED | 290 (9.4%)    | 250 (100%)                           |

---

## Guardrail Validation

### DB CHECK Constraints (Sprint 018)

- `chk_posting_requires_hard_band`: Prevents `posted_to_discord = true` unless
  `promotion_band = 'HARD'` AND `tier IN ('S', 'A', 'B')`
- `chk_promotion_band_enum`: Restricts `promotion_band` to `HARD`, `SOFT`,
  `NO_POST`, or `NULL`

### Runtime BlockedError Guard (Sprint 018)

- F-tier picks: `BLOCKED_PROMOTION_INELIGIBLE`
- Non-HARD band: `BLOCKED_PROMOTION_INELIGIBLE`
- NULL band: `BLOCKED_PROMOTION_INELIGIBLE`

### Legacy Violations

5 F-tier picks with `posted_to_discord = true` detected — all predate Sprint 018
guardrails. These are the Sprint 016 posts that motivated the guardrail
implementation. No new violations since guardrails were activated.

---

## Integrity Checks

### Probability Primitives

| Primitive         | Status | Reason                                   |
| ----------------- | ------ | ---------------------------------------- |
| p_final           | NULL   | INSUFFICIENT_BOOKS (single book)         |
| edge_final        | NULL   | INSUFFICIENT_BOOKS (single book)         |
| uncertainty_final | NULL   | INSUFFICIENT_BOOKS (single book)         |
| clv_forecast      | NULL   | INSUFFICIENT_BOOKS + CLV schema mismatch |

All NULLs are justified by single-book data limitation. Fail-closed behavior is
correct.

### Missing Schema

| Column              | Table         | Status          |
| ------------------- | ------------- | --------------- |
| model_version       | unified_picks | Not yet created |
| feature_set_version | unified_picks | Not yet created |
| betLine             | clv_tracking  | Missing         |

---

## CLV Sanity Results

No CLV forecast data available — expected when probability layer returns
INSUFFICIENT_BOOKS. Testing deferred until multi-book integration is live.

---

## Key Findings

1. **Pipeline is correctly wired**: Devig → ProbabilityLayer → computeScoreV2 →
   evaluatePromotion → lifecycleInsert
2. **Fail-closed works at every level**:
   - Probability layer: INSUFFICIENT_BOOKS → primitives NULL
   - Promotion policy: Gate 8 blocks → NO_POST
   - Autopilot: No Redis → FROZEN → writes blocked
3. **Scoring is conservative**: D-tier/~20.7 with neutral features (no
   inflation)
4. **No F-tier promotion possible**: Runtime guard + DB CHECK both active
5. **Legacy violations documented**: 5 Sprint-016 era posts identified

## Blockers for Production Readiness

| Blocker                               | Severity | Fix                            |
| ------------------------------------- | -------- | ------------------------------ |
| Single-book data (INSUFFICIENT_BOOKS) | P1       | Add 2nd book source (OddsAPI)  |
| Autopilot requires Redis              | P2       | Start Redis for local/staging  |
| Missing model_version column          | P2       | DB migration                   |
| CLV tracking schema mismatch          | P3       | Add betLine column             |
| Raw props store single direction      | P3       | Insert paired odds in same row |

---

## Proof Bundle Path

```
out/sprints/SPRINT-SCORING-PIPELINE-VALIDATION-019/2026-03-04/
  SGO_SAMPLE.json
  SGO_SAMPLE_SUMMARY.json
  SCORING_DISTRIBUTION.md
  EDGE_DISTRIBUTION.md
  DEVIG_MODE_BREAKDOWN.md
  DISCORD_POST_VALIDATION.md
  PRIMITIVE_INTEGRITY_CHECK.md
  CLV_SANITY_CHECK.md
  proofs/
    proof_git_push.txt
    proof_pr_created.txt
    proof_scoring_report.json
```

---

## Sign-off

- [x] SGO market data captured
- [x] 250 props scored through production pipeline
- [x] Distribution analysis complete
- [x] Guardrail validation complete (legacy violations documented)
- [x] Integrity checks complete (NULLs justified)
- [x] CLV check deferred (no data — expected)
- [x] Proof artifacts generated
- [x] PR created (#107)

**Sprint Status**: COMPLETE
