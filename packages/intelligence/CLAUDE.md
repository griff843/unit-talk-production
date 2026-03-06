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
import {
  computeConsensus,
  calculateEdge,
  calculateBookWeight,
  americanToImplied,
  applyDevig,
} from '@unit-talk/intelligence';

import { runProbabilityLayer } from '@unit-talk/intelligence';

import { computeCalibration } from '@unit-talk/intelligence';
```

---

## Re-export Strategy

Original files in `apps/api/src/lib/probability/` have been replaced with
re-export stubs pointing to this package. Consumers need zero import changes.

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
