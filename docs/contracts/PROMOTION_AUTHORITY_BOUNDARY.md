# Promotion Authority Boundary

Status: ACTIVE Created: SPRINT-036 (Promotion Band Calibration) Owner:
Engineering Team

---

## Two-Stage Promotion Architecture

Promotion is split into two independent stages with distinct authority:

### Stage 1 — Eligibility Gate (`promotionPolicy.ts`)

Location: `apps/api/src/agents/GradingAgent/scoring/promotionPolicy.ts`

Purpose: Decides whether a scored pick is **eligible for promotion** at all.

Authority:

- Kill switch enforcement
- Policy enable/disable
- Canary routing (sport + percent gates)
- Band classification: HARD / SOFT / NONE
- Feature snapshot integrity (constitutional gate)
- Probability primitive validation (constitutional gate)
- Critical data gap detection

Output:
`PromotionDecision { promote: boolean, band: PromotionBand, reason_codes, notes }`

Key rule: A pick with `promote=false` or `band=NONE` never reaches Stage 2.

### Stage 2 — Publication Tier Assignment (band calibration)

Location: `apps/api/src/analysis/promotion/`

Purpose: Assigns a **publication quality tier** to picks that passed Stage 1.

Authority:

- Initial band assignment: A+ / A / B / C / SUPPRESS
- Uncertainty caps and cascading downgrades
- CLV forecast adjustments
- Liquidity-based band caps
- Market resistance evaluation
- Risk decision enforcement
- Suppression with deterministic reason codes

Output:
`BandOutput { finalBand, initialBand, downgradeReasons, suppressionReasons, thresholdVersion }`

Key rule: Every selected pick receives exactly one deterministic band or
suppression outcome.

---

## Boundary Rules

1. Stage 1 runs first. Stage 2 only evaluates picks that Stage 1 approved.
2. Stage 1 owns env-flag gating, canary routing, and constitutional gates.
3. Stage 2 owns quality-tier assignment and signal-based downgrades.
4. Neither stage writes to `unified_picks` directly — both produce decision
   objects consumed by downstream writers via lifecycle adapters.
5. Stage 2 may suppress a pick that Stage 1 approved. Stage 2 never
   un-suppresses a pick that Stage 1 rejected.
6. Threshold versions are independent: Stage 1 uses `PromotionPolicyConfig`,
   Stage 2 uses `THRESHOLD_VERSION`.

---

## Data Flow

```
Scoring (GradingAgent)
  → Stage 1: evaluatePromotion() — eligible? HARD/SOFT/NONE
    → [if eligible] Stage 2: assignPromotionBand() — A+ / A / B / C / SUPPRESS
      → [if not suppressed] Downstream posting via lifecycle adapters
```

---

## References

- Stage 1: `apps/api/src/agents/GradingAgent/scoring/promotionPolicy.ts`
- Stage 2: `apps/api/src/analysis/promotion/index.ts`
- Lifecycle contract: `docs/contracts/PICK_LIFECYCLE_CONTRACT.md`
