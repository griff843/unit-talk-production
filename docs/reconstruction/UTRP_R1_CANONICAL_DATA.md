# UTRP-R1 — Canonical Data Reconstruction

> **Sprint**: UTRP-R1-CANONICAL-DATA **Workstream**: R1 **Status**: COMPLETE
> (2026-03-19) **Dependencies**: R0 COMPLETE

---

## Objective

Eliminate all known data model defects so that the schema correctly represents
the full lifecycle state space and the API/RPC layer uses canonical column names
throughout.

> The data model is the foundation. Every workstream downstream of R1 produces
> meaningless results if the schema is wrong.

---

## Scope

### 1. DEFECT-9 — `prop_settlements` column name audit and fix

The schema uses `final_pick_id` and `settlement_result`. Legacy code paths may
use `pick_id` and `outcome`. Required actions:

- Grep every file in `apps/api/src/` for `prop_settlements` queries
- For each reference: confirm `final_pick_id` (not `pick_id`) and
  `settlement_result` (not `outcome`) are used
- Fix any code using wrong column names
- Verify the fix with a targeted test or query proof

### 2. DEFECT-10 — `confidence` NULL semantics in `atomic_submit_ticket`

The RPC defaults `confidence` to `0` when the form omits it. `confidence=0` is
indistinguishable from "zero confidence" vs "no confidence supplied". Required
actions:

- Locate the `atomic_submit_ticket` migration or RPC function definition
- Change the default: `COALESCE(p_confidence, NULL)` — store NULL when
  confidence is not supplied
- Verify no existing code path depends on `confidence=0` as a sentinel

### 3. DEFECT-13 — `unified_picks.confidence` range constraint

Add a CHECK constraint to ensure confidence is in range [0, 100] when not NULL:

```sql
ALTER TABLE unified_picks ADD CONSTRAINT chk_confidence_range
  CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100));
```

### 4. Verify DEFECT-8 fix is applied in target DB

The migration `20260319120000_fix_workflow_stage_constraint.sql` was written in
SPRINT-UNIFIED-PICKS-CONTRACT-TRUTH-LOCK. Confirm via live DB query that the
constraint matches the migration.

---

## Exclusions

- No changes to `tickets`, `ticket_legs`, or other canonical V3 tables
- No schema additions beyond those listed above
- No data backfill or migration of existing rows
- No changes to `unified_picks` beyond constraint additions

---

## Acceptance Criteria

| #       | Criterion                                                                                                                                                   | Proof Artifact                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| AC-R1-1 | All `prop_settlements` references in `apps/api/src/` use `final_pick_id` and `settlement_result` — zero references to `pick_id` or `outcome` for this table | `proof_defect9_audit.txt`                                        |
| AC-R1-2 | `atomic_submit_ticket` stores `NULL` (not `0`) when confidence is not supplied by caller                                                                    | `proof_defect10_migration.sql` + `proof_defect10_rpc_output.txt` |
| AC-R1-3 | `chk_confidence_range` constraint exists on `unified_picks`                                                                                                 | `proof_confidence_constraint.txt`                                |
| AC-R1-4 | `chk_unified_picks_workflow_stage` in live DB matches the 9-value set from `20260319120000` migration                                                       | `proof_defect8_confirmed.txt`                                    |
| AC-R1-5 | All existing tests still pass — vitest count ≥ baseline from R0                                                                                             | `proof_tests.txt`                                                |
| AC-R1-6 | Type check passes — API + CC                                                                                                                                | `proof_typecheck.txt`                                            |
| AC-R1-7 | Single-writer gate passes                                                                                                                                   | `proof_gate.txt`                                                 |

---

## Kill Conditions

| Condition                                                                                                                                           | Action                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| DEFECT-9 audit finds routes that query `prop_settlements` using wrong column names AND those routes are in production-critical paths                | Pause. Assess whether a data migration is required before the code fix. Update ledger.                             |
| Changing `atomic_submit_ticket` confidence default would break existing Smart Form submissions (e.g., form always sends `confidence: 0` explicitly) | Pause. Audit form payload first. The RPC change is correct; the question is whether the form needs a parallel fix. |
| Live DB query for DEFECT-8 shows constraint is NOT applied                                                                                          | Stop. Investigate migration application state. The constraint fix must be applied before R2 can proceed.           |

---

## Proof Artifacts

```
out/sprints/UTRP-R1-CANONICAL-DATA-RECONSTRUCTION/<DATE>/
├── proofs/
│   ├── proof_defect9_audit.txt          # grep output: zero prop_settlements wrong-column refs
│   ├── proof_defect10_migration.sql     # Migration file for confidence NULL fix
│   ├── proof_defect10_rpc_output.txt    # RPC output confirming NULL confidence stored
│   ├── proof_confidence_constraint.txt  # DB query confirming chk_confidence_range exists
│   ├── proof_defect8_confirmed.txt      # Live DB query showing 9-value constraint
│   ├── proof_tests.txt                  # vitest output ≥ R0 baseline
│   ├── proof_typecheck.txt              # tsc --noEmit output
│   └── proof_gate.txt                   # single-writer gate output
└── SPRINT_CLOSEOUT_REPORT.md
```

---

## Downstream Stability Check

Before declaring R1 COMPLETE, verify that the R0 test baseline is maintained:

```bash
cd apps/api && npm run test:vitest
cd apps/command-center && npx vitest run
cd apps/api && npm run lifecycle:single-writer -- --strict
```

R1 is not complete if any downstream gate is degraded relative to the R0
baseline.

---

## Dependency Order

```
R1 depends on: R0 COMPLETE
R1 must complete before: R2, R3, R4, R5, R6
```

---

**Workstream Owner**: Engineering Team **Estimated Effort**: 1 session (targeted
fixes, migration authoring, audit)
