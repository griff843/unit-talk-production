# Promotion Policy — Current System

> Generated: 2026-03-07 | Sprint: SPRINT-SYSTEM-DOCUMENTATION-FOUNDATION

---

## Overview

The promotion policy determines which graded props are eligible for Discord
posting. It is a **fail-closed** system: missing any required field defaults to
NONE band, promote=false.

**Master file**: `apps/api/src/agents/GradingAgent/scoring/promotionPolicy.ts`

---

## Promotion Bands

| Band     | Meaning          | Auto-Post                          | Requirements                                            |
| -------- | ---------------- | ---------------------------------- | ------------------------------------------------------- |
| **HARD** | Elite picks      | YES (always)                       | S or A tier + EV >= 1% + confidence >= 7.0              |
| **SOFT** | Moderate signals | Only if PROMOTION_SOFT_ENABLE=true | A or B tier + EV in [0, 1%) OR confidence in [6.0, 7.0) |
| **NONE** | Not eligible     | NO                                 | Everything else, or missing data                        |

---

## Tier Scale

**File**: `apps/api/src/agents/GradingAgent/scoring/TierScale.ts`

| Tier  | Min Score | Min Edge | Max Risk | Promotion Eligible           |
| ----- | --------- | -------- | -------- | ---------------------------- |
| **S** | 70        | 20       | 4        | Yes (HARD candidate)         |
| **A** | 50        | 0        | 5        | Yes (HARD or SOFT candidate) |
| **B** | 40        | --       | 6        | SOFT candidate only          |
| **C** | 30        | --       | 7        | No                           |
| **D** | <30       | --       | --       | No                           |

---

## Gate Execution Order

The `evaluatePromotion()` function runs 8 gates in sequence. Failure at any gate
sets promote=false.

```
Gate 1: Kill Switch
  PROMOTION_KILL_SWITCH=true -> promote=false, band=NONE

Gate 2: Policy Enabled
  PROMOTION_POLICY_V2=false -> promote=false, band=NONE

Gate 3: Required Fields
  Missing score, tier, or feature_audit -> promote=false

Gate 4: Canary Gate
  Sport must be in PROMOTION_CANARY_SPORTS
  Pick hash must be below PROMOTION_CANARY_PERCENT threshold

Gate 5: Band Classification
  classifyBand() -> HARD / SOFT / NONE
  Based on tier + EV + confidence + data gap analysis

Gate 6: Hard-Only Enforcement
  PROMOTION_HARD_ONLY=true -> blocks SOFT even if eligible

Gate 7: Feature Snapshot Integrity (Constitutional - cannot be disabled)
  featureSnapshotId AND featureVectorHash must be present
  Ensures grading reproducibility

Gate 8: Probability Primitives (Constitutional - cannot be disabled)
  8a: p_final in [0, 1]
  8b: uncertainty_final in [0, 1] AND <= band threshold
      HARD: uncertainty <= 0.25
      SOFT: uncertainty <= 0.40
  8c: p_market_devig in [0, 1]
  8d: edgeFinal consistent with p_final - p_market_devig
```

---

## Secondary Promotion Gate (GradingAgent)

**File**: `GradingAgent.ts` line 828

Independent of the policy gates, GradingAgent has its own
`meetsPromotionCriteria()`:

```
MIN_EDGE_SCORE = 800    (8% edge minimum)
MIN_CONFIDENCE = 85     (85% confidence minimum)

S tier: edge >= 800 AND confidence >= 85
A tier: edge >= 1200 AND confidence >= 90 (exceptional A-tier only)
B/C/D: never promoted
```

Both gates must pass for promotion to occur.

---

## Canary Routing

Allows gradual rollout of promotion policy.

```
sportOk = PROMOTION_CANARY_SPORTS is empty OR sport is in the list
percentOk = PROMOTION_CANARY_PERCENT > 0 AND stableHash(pickId) < threshold
```

---

## Environment Variables

| Variable                   | Default | Purpose                        |
| -------------------------- | ------- | ------------------------------ |
| `PROMOTION_POLICY_V2`      | false   | Master enable for V2 policy    |
| `PROMOTION_KILL_SWITCH`    | false   | Emergency stop (blocks ALL)    |
| `PROMOTION_SOFT_ENABLE`    | false   | Allow SOFT auto-promote        |
| `PROMOTION_HARD_ONLY`      | false   | Only HARD can promote          |
| `PROMOTION_HARD_MIN_EV`    | 0.01    | Min EV for HARD (1%)           |
| `PROMOTION_HARD_MIN_CONF`  | 7.0     | Min confidence for HARD        |
| `PROMOTION_CANARY_PERCENT` | 0       | % picks through policy (0=off) |
| `PROMOTION_CANARY_SPORTS`  | ""      | Sports allowed in canary       |

---

## Data Gap Detection

Before band classification, `findCriticalDataGaps()` checks for features in
critical groups ('market', 'core') that used fallback values instead of real
data. Any critical data gap blocks both HARD and SOFT bands.

---

## Current Runtime Behavior

With default environment variables:

- `PROMOTION_POLICY_V2=false` -> Policy is disabled
- All props score and get tier assignments
- All props evaluate to `band=NONE, promote=false`
- No props are promoted to unified_picks via automated pipeline
- Manual promotion via operator_override is still possible
