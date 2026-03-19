# UTRP-R0 — Truth Reset

> **Sprint**: UTRP-R0-TRUTH-RESET **Workstream**: R0 **Status**: COMPLETE
> (2026-03-19) **Dependencies**: None — runs first.

---

## Objective

Establish a verified baseline of every system component's actual state. Produce
no code changes. Produce only truth artifacts.

> The program cannot reconstruct what it has not first correctly measured.

---

## Scope

1. **Schema audit** — Run a live query against the production/staging DB to
   confirm the exact constraint definitions, column types, and defaults for
   `unified_picks`, `prop_settlements`, `bridge_outbox`. Compare against
   migration history.

2. **Pipeline reachability audit** — For each pipeline (submission, grading,
   settlement, recap, Discord), document whether it is currently:
   - REACHABLE: can be invoked without auth or config blockers
   - BLOCKED: known blockers prevent invocation
   - UNKNOWN: not yet verified

3. **Auth surface audit** — Document every API endpoint that uses `operatorAuth`
   or JWT requirement. For each, confirm whether Command Center can currently
   reach it and under what conditions.

4. **Config audit** — Document every environment variable required by the
   pipeline that is unset, defaulted incorrectly, or inconsistently set across
   services in docker-compose.

5. **Test suite baseline** — Record the exact test counts and pass rates for the
   vitest and Jest suites at program start. This becomes the regression floor —
   no workstream may reduce this count.

6. **Defect ledger validation** — Review every OPEN defect in `UTRP_LEDGER.md`.
   Confirm the defect description is accurate, severity is correct, and
   workstream assignment is correct. Add any defects not yet documented.

7. **Workstream scope confirmation** — For each R1–R6 workstream document,
   confirm that the acceptance criteria are achievable with the current codebase
   without requiring out-of-scope work.

---

## Exclusions

- No code changes of any kind.
- No migrations.
- No configuration changes.
- No test additions.

R0 produces **documents only**.

---

## Acceptance Criteria

| #       | Criterion                                                                                                                                                        | Proof Artifact                   |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| AC-R0-1 | Schema truth table produced: exact column list + constraint definitions for `unified_picks`, `prop_settlements`, `bridge_outbox` as confirmed by direct DB query | `proof_schema_truth.txt`         |
| AC-R0-2 | Pipeline reachability matrix produced: submit/grade/settle/recap/discord each marked REACHABLE / BLOCKED / UNKNOWN with exact blocking reason                    | `proof_pipeline_reachability.md` |
| AC-R0-3 | Auth surface inventory produced: every `operatorAuth`-protected endpoint documented with current 401/403/200 state from CC context                               | `proof_auth_surface.md`          |
| AC-R0-4 | Config gap report produced: every required env var missing or incorrect in docker-compose documented with correct value                                          | `proof_config_gaps.md`           |
| AC-R0-5 | Test suite baseline recorded: vitest count, Jest count, passing rate                                                                                             | `proof_test_baseline.txt`        |
| AC-R0-6 | All OPEN defects in ledger reviewed and confirmed accurate                                                                                                       | `proof_ledger_review.md`         |
| AC-R0-7 | R1–R6 workstream scopes reviewed and confirmed feasible                                                                                                          | `proof_scope_review.md`          |

---

## Kill Conditions

| Condition                                                                              | Action                                                                                                    |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| New P0 defect discovered that changes the blocking dependency order of R1–R6           | STOP. Update UTRP_LEDGER.md. Update affected workstream documents. Resume only after re-planning.         |
| DB query returns unexpected constraint definitions inconsistent with migration history | STOP. Investigate migration application state. Do not proceed with R1 until schema history is reconciled. |
| Any pipeline currently believed to be reachable is confirmed completely broken         | Update R5/R6 scope before declaring R0 complete.                                                          |

---

## Proof Artifacts

```
out/sprints/UTRP-R0-TRUTH-RESET/<DATE>/
├── proofs/
│   ├── proof_schema_truth.txt          # Live DB constraint/column query output
│   ├── proof_pipeline_reachability.md  # Per-pipeline reachability table
│   ├── proof_auth_surface.md           # operatorAuth endpoint inventory
│   ├── proof_config_gaps.md            # Missing/incorrect env vars
│   ├── proof_test_baseline.txt         # Test counts at program start
│   ├── proof_ledger_review.md          # Defect review confirmation
│   └── proof_scope_review.md           # Workstream feasibility confirmation
└── SPRINT_CLOSEOUT_REPORT.md
```

---

## Dependency Order

```
R0 must complete before: R1, and all subsequent workstreams.
R0 depends on: nothing.
```

---

## Recommended Queries for AC-R0-1

```sql
-- Confirm workflow_stage constraint (post DEFECT-8 fix)
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%workflow_stage%';

-- Confirm prop_settlements columns (DEFECT-9 verification)
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'prop_settlements'
ORDER BY ordinal_position;

-- Confirm unified_picks column count and key columns
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'unified_picks'
ORDER BY ordinal_position;
```

---

**Workstream Owner**: Engineering Team **Estimated Effort**: 1 session
(read-only audit)
