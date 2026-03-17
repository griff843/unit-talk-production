# SCORING & PROMOTION LINEAGE AUDIT

**Sprint**: SPRINT-063-LIFECYCLE-TRUTH-RESTORATION **Date**: 2026-03-16
**Verdict**: Scoring infrastructure is architecturally sound but UNEXERCISED

---

## SPRINT-062 Posted Picks — Lineage Trace

### Pick 062a0001 (Lane A: LeBron James)

| Field              | Value                      | Source           |
| ------------------ | -------------------------- | ---------------- |
| Pick ID            | 062a0001                   | Manual creation  |
| Player             | LeBron James               | Hardcoded        |
| Score Output       | NONE — scoring not run     | N/A              |
| Model/Version      | NONE                       | N/A              |
| Tier               | S                          | **Hardcoded**    |
| Tier Derivation    | Manual assignment          | Not computed     |
| Promotion Band     | HARD                       | **Hardcoded**    |
| Promotion Decision | Manual (operator approved) | Not policy-gated |
| Discord Snowflake  | 1483145928566378556        | Real             |
| Publish Receipt    | pick_publish outbox record | Real             |

### Pick 062b0001 (Lane B: Stephen Curry)

| Field             | Value                    | Source          |
| ----------------- | ------------------------ | --------------- |
| Pick ID           | 062b0001                 | Manual creation |
| Score Output      | NONE                     | N/A             |
| Tier              | S                        | **Hardcoded**   |
| Promotion Band    | HARD                     | **Hardcoded**   |
| Discord Snowflake | (recorded in SPRINT-062) | Real            |

### Pick 062c0001 (Lane C: Jayson Tatum)

Same pattern — manually created, hardcoded tier/band, real Discord post.

### Pick 062d0001 (Lane D: Nikola Jokic)

Same pattern — manually created, hardcoded tier/band, real Discord post.

---

## Scoring Engine Architecture

### Pipeline: `GradingAgent` → `computeScoreV2` → `canonicalTier` → `evaluatePromotion`

**Stage 1: Feature Collection & Scoring**

- **File**: `apps/api/src/agents/GradingAgent/scoring/computeScoreV2.ts:116-150`
- **Algorithm**: Weighted sum of 40+ registered features with sport-specific
  weight profiles
- **Output**: Score (0-100), EV%, per-feature breakdown, feature_audit

**Stage 2: Edge & Risk Derivation**

- **File**: `computeScoreV2.ts:73-96`
- Edge = expectedValue + closingLineValue + (sharpMoney - 50)/5
- Risk = min(10, correlationRisk*4 + volatility*0.3 + portfolioImpact\*3)

**Stage 3: Canonical Tier Classification**

- **File**: `apps/api/src/agents/GradingAgent/scoring/TierScale.ts:54-78`
- **Single source of truth** for tier → multi-dimensional (score + edge + risk)
- Thresholds:
  - S: score ≥ 70, edge ≥ 20, risk ≤ 4
  - A: score ≥ 50, risk ≤ 5
  - B: score ≥ 40, risk ≤ 6
  - C: score ≥ 30, risk ≤ 7
  - D: everything else

**Tier is COMPUTED, never carried from submission.**

**Stage 4: Promotion Policy (8 Gates)**

- **File**:
  `apps/api/src/agents/GradingAgent/scoring/promotionPolicy.ts:329-455`
- Gate 1: Kill switch check
- Gate 2: Policy V2 enabled check
- Gate 3: Required fields (score, tier, feature_audit)
- Gate 4: Canary gate (sport + percent hash)
- Gate 5: **CONSTITUTIONAL** — Feature snapshot ID required
- Gate 6: **CONSTITUTIONAL** — Probability primitives (p_final,
  uncertainty_final, p_market_devig)
- Gate 7: Hard-only enforcement
- Gate 8: Band classification (HARD/SOFT/NONE)

**Band Classification** (`promotionPolicy.ts:269-308`):

- HARD: tier S/A AND EV ≥ threshold AND confidence ≥ threshold
- SOFT: tier A/B AND (EV in range OR confidence in range)
- NONE: everything else

---

## Model Version Tracking

**YES — tracked and stored.**

- `GradingResult.modelVersion` — string field on grading output
  (`gradingEngine.ts:143`)
- `pick_publish.modelVersion` — stored in outbox payload
  (`publishOutbox.ts:114`)
- `canaryDecide()` selects V1 vs V2 engine via environment flags
  (`canaryRouter.ts:97-141`)

### Canary Routing Control

| Env Var                  | Effect                      |
| ------------------------ | --------------------------- |
| `SCORING_KILL_SWITCH`    | Force V1                    |
| `SCORING_ENGINE_V2`      | Master V2 enable            |
| `SCORING_V2_PRIMARY`     | V2 is primary, V1 for drift |
| `SCORING_SHADOW`         | Compute both, return V1     |
| `SCORING_CANARY_SPORTS`  | Sport-gated V2 rollout      |
| `SCORING_CANARY_PERCENT` | Percent-gated V2 rollout    |

**During SPRINT-062**: `SCORING_ENGINE_V2` was not set, causing `canaryDecide()`
to return `v1`, which meant `evaluatePromotion()` was never called by
GradingAgent (`result.promotionBand` remained `undefined`). This was the root
cause of null promotion_band picks before the SPRINT-062 fix.

---

## Discord Output — Operator Truth Exposure

### What IS visible in Discord embed:

- Pick title (player + stat + line)
- Tier (S/A/B/C/D)
- Confidence (score / 100)
- EV (expected value %)
- Promotion Band (HARD/SOFT/NONE)
- Discord message ID (snowflake)

### What is NOT visible in Discord embed:

- Scoring model version
- Feature breakdown (40+ features)
- Risk score components
- Probability primitives (p_final, etc.)
- Feature snapshot ID
- Per-feature audit trail

### Where full lineage IS stored:

- `pick_publish` outbox payload — includes modelVersion, tier, promotionBand
- `unified_picks` record — includes all lifecycle fields
- `scoring_snapshots` (if feature snapshot gate passes) — full feature vector

**Verdict**: Discord embed is a user-facing summary. Full scoring lineage is
operator-auditable via the outbox and pick record, but is not exposed in the
embed itself.

---

## Certification Status

| Component              | Certified? | Evidence                             |
| ---------------------- | ---------- | ------------------------------------ |
| computeScoreV2()       | NO         | Never exercised with live data       |
| canonicalTier()        | NO         | Never exercised with live data       |
| evaluatePromotion()    | NO         | Never exercised (canary returned v1) |
| canaryDecide()         | PARTIAL    | Ran but returned v1 (fallback path)  |
| Tier derivation        | NO         | Tier was hardcoded, not computed     |
| Band derivation        | NO         | Band was hardcoded, not computed     |
| Model version tracking | PARTIAL    | Field exists but not populated       |
| Discord embed accuracy | PARTIAL    | Real posts but with manual data      |

---

## Recommendations

1. Set `SCORING_ENGINE_V2=true` in test environment and exercise full pipeline
2. Create a scoring integration test that provides feature data and verifies
   score → tier → band → promotion decision chain
3. Add model version and feature snapshot ID to Discord embed footer for
   operator transparency
4. Exercise `evaluatePromotion()` CONSTITUTIONAL gates (5 and 6) with real
   feature snapshots to verify they don't silently block all picks
