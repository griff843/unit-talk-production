# CLAUDE.md - Intelligence Package

> **Sprint**: SPRINT-REPO-TRUTH-LOCK-002 **Status**: AUTHORITATIVE **Role**:
> PURE COMPUTATION **Last Updated**: 2026-03-06

---

## Overview

The intelligence package contains pure computation modules with zero I/O
dependencies. All functions are deterministic (same input → same output) and
never touch Supabase, filesystem, or environment variables.

---

## Package Boundaries

### This Package OWNS

- Devig/consensus probability computation (`devigConsensus`)
- Probability layer orchestration (`probabilityLayer`)
- Calibration computation (`calibrationCompute`)

### This Package MUST NOT

- Import Supabase, Redis, or any I/O library
- Read environment variables or filesystem
- Contain side effects of any kind
- Import from `apps/` or service packages

---

## Key Exports

```typescript
// Devig/Consensus (22 exports)
import {
  computeConsensus,
  calculateEdge,
  calculateBookWeight,
  americanToImplied,
  applyDevig,
  calculateCLVProb,
  type ConsensusResult,
  type BookOffer,
  type EdgeResult,
} from '@unit-talk/intelligence';

// Probability Layer (13 exports)
import {
  computeProbabilityLayer,
  computeUncertainty,
  computePFinal,
  computeCLVForecast,
  type ProbabilityInput,
  type ProbabilityOutput,
} from '@unit-talk/intelligence';

// Calibration (9 exports)
import {
  computeBrierScore,
  computeCalibrationMetrics,
  type CalibrationMetrics,
} from '@unit-talk/intelligence';
```

---

## Sync Status

`apps/api/src/lib/probability/` maintains **local copies** of all functions with
"keep in sync" comments. Re-export stubs were attempted and reverted — local
copies are authoritative for the API. The package holds the canonical reference
implementations. Both must stay in sync manually.

Export parity verified: **MATCH** (44 shared exports across 3 modules).

`offerFetch.ts` stays in API (has Supabase I/O dependency).

---

## Future Extraction Candidates

Pure-computation functions still trapped in `apps/api/` that could move here:

| Function                  | Location                             | Notes                         |
| ------------------------- | ------------------------------------ | ----------------------------- |
| `computeCLVForecastV2()`  | `analysis/models/clv-forecast.ts`    | Pure math, no deps            |
| `computeModelBlend()`     | `analysis/models/model-blend.ts`     | Pure math, no deps            |
| `computeSharpConsensus()` | `analysis/models/sharp-consensus.ts` | Depends on `getBookProfile()` |
| `computeScoreV2()`        | `agents/GradingAgent/scoring/`       | Depends on config lookup      |

---

## Development Commands

```bash
pnpm --filter intelligence type-check
pnpm --filter intelligence build
```

---

## References

- Root Governance: `../../CLAUDE.md`
- Scoring Authority: `../../docs/architecture/SCORING_AUTHORITY.md`

---

**Document Owner**: Engineering Team **Last Audit**: SPRINT-REPO-TRUTH-LOCK-002
