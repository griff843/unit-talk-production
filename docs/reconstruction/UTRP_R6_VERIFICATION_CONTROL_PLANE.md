# UTRP-R6 — Verification Control Plane Reconstruction

> **Sprint**: UTRP-R6-VERIFICATION-CONTROL-PLANE-RECONSTRUCTION **Workstream**:
> R6 **Status**: NOT STARTED **Dependencies**: R1 COMPLETE, R2 COMPLETE, R3
> COMPLETE, R4 COMPLETE, R5 COMPLETE

---

## Objective

Lock the reconstructed system's behavior into automated, repeatable
verification. Every critical path established in R1–R5 must be covered by a
gate, test, or replay fixture that will catch regression.

> Reconstruction without verification is temporary. R6 converts the program's
> manual proofs into durable automated coverage.

---

## Scope

### 1. DEFECT-30 — R2 replay fixture: add game total and spread

The current `post-rem-events.jsonl` fixture only covers player props (NBA, NFL,
MLB). R2 established the submission contract for all 3 bet types. R6 locks that
coverage into the replay harness.

Required actions:

- Create `post-rem-events-3types.jsonl` in
  `apps/api/src/lib/verification/test-fixtures/`
- Include player_prop, total (game total), and spread picks
- Each pick type goes through the full lifecycle: SUBMITTED → GRADED → POSTED →
  SETTLED
- Run R2 replay: all 7 gates must pass for all 3 pick types
- `determinism-hash.txt` must match across two sub-runs

### 2. DEFECT-31 — E2E smoke test: submit → settle → recap chain

Create an E2E smoke test that exercises the critical path without Discord:

**Test scenario:**

1. Insert a pick directly via `lifecycleInsert` (submitter role)
2. Grade the pick: set `tier`, `promotion_band`, `professional_score` via
   `lifecycleUpdate` (promoter role)
3. Settle the pick: call `manual_settle_pick` RPC
4. Query `getDailyRecapData()` for today's date
5. Assert: the pick appears in the recap result with the correct capper

**Test location**:
`apps/api/src/lib/verification/__tests__/e2e-critical-path.test.ts` **Runner**:
vitest (in-process, no HTTP) **Isolation**: Uses `IsolatedPickStore` or test DB
— no production writes

### 3. DEFECT-32 — Auth regression test

Create a targeted test for `operatorAuth.ts` that covers:

- Valid internal token → 200
- Missing token in production mode → 401
- Invalid token → 403 (or 401 — document expected behavior)
- Valid JWT (existing path) → 200

**Test location**: `apps/api/src/middleware/__tests__/operatorAuth.test.ts`

### 4. Replay harness expansion: settlement gate

The current R2 replay harness (7 gates A–G) does not have a dedicated gate for
settlement output correctness. Add a Gate H:

**Gate H: Settlement Truth**

- After PICK_SETTLED events are processed, the in-memory store must have:
  - `settlement_status = 'settled'`
  - `settlement_result` matching the event payload result
  - `settled_at` timestamp set
- Gate H fails if any settled pick is missing these fields

### 5. Monitoring verification

Confirm that after R5, the following SLO metrics are non-zero and correct:

- `computeLifecycleCompletionSlo()`: `attainment > 0` when picks are settled
- `computeSettlementAccuracySlo()`: `total > 0`, `settled > 0`
- Agent health heartbeats: all 3 workers reporting within threshold

Document the verified state in the proof artifacts.

### 6. CI gate addition: settlement auth test

Add the `operatorAuth.test.ts` suite to the CI test run so that auth regressions
are caught before merge. Update the relevant CI workflow file.

---

## Exclusions

- No new production features
- No changes to the replay harness beyond Gate H and the 3-types fixture
- No new monitoring dashboards
- No changes to SLO computation logic (only verification of current behavior)
- No changes to existing test suites beyond the new files listed above

---

## Acceptance Criteria

| #        | Criterion                                                                       | Proof Artifact                                 |
| -------- | ------------------------------------------------------------------------------- | ---------------------------------------------- |
| AC-R6-1  | `post-rem-events-3types.jsonl` fixture exists with player_prop, total, spread   | `proof_fixture_exists.txt`                     |
| AC-R6-2  | R2 replay against 3-types fixture: all 7 gates pass for all 3 pick types        | `proof_r2_3types.txt` + replay proof bundle    |
| AC-R6-3  | R2 replay determinism confirmed: SHA-256 hash matches across r1 and r2 sub-runs | `proof_determinism_hash.txt`                   |
| AC-R6-4  | E2E critical path test exists and passes: submit → grade → settle → recap chain | `proof_e2e_test.txt`                           |
| AC-R6-5  | `operatorAuth.test.ts` exists with all 4 scenarios covered and passes           | `proof_auth_test.txt`                          |
| AC-R6-6  | Gate H added to replay harness: settlement truth verified in-memory             | `proof_gate_h.txt` (code diff + replay output) |
| AC-R6-7  | SLO metrics verified non-zero after R5 settlement activity                      | `proof_slo_metrics.txt`                        |
| AC-R6-8  | `operatorAuth.test.ts` included in CI workflow                                  | `proof_ci_diff.txt`                            |
| AC-R6-9  | Total vitest count ≥ R0 baseline + new test additions                           | `proof_tests.txt`                              |
| AC-R6-10 | Type check passes                                                               | `proof_typecheck.txt`                          |
| AC-R6-11 | Single-writer gate passes                                                       | `proof_gate.txt`                               |

---

## Kill Conditions

| Condition                                                                                           | Action                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E2E critical path test cannot use `IsolatedPickStore` because the recap pipeline requires a real DB | Use a test DB (Supabase local) for R6. Document the test DB dependency in the test file. Do not use production.                                        |
| Gate H addition breaks existing replay gates (A–G)                                                  | Fix gate H logic before declaring R6 complete. The gate must be additive, not breaking.                                                                |
| `operatorAuth.test.ts` requires mocking middleware in a way that creates false test confidence      | Use real middleware with a real test Express app. Mock only the environment variables.                                                                 |
| SLO metrics remain at zero after confirmed settlement                                               | Stop. Debug settlement audit event emission. The SLO queries depend on the events table receiving `PICK_SETTLED` events — verify RPC is emitting them. |

---

## Proof Artifacts

```
out/sprints/UTRP-R6-VERIFICATION-CONTROL-PLANE-RECONSTRUCTION/<DATE>/
├── proofs/
│   ├── proof_fixture_exists.txt        # File listing: post-rem-events-3types.jsonl
│   ├── proof_r2_3types.txt             # Replay CLI output: 7/7 gates, 3 bet types
│   ├── proof_determinism_hash.txt      # SHA-256 match across r1/r2 sub-runs
│   ├── proof_e2e_test.txt              # vitest output for e2e-critical-path.test.ts
│   ├── proof_auth_test.txt             # vitest output for operatorAuth.test.ts
│   ├── proof_gate_h.txt                # Code diff + replay output showing Gate H
│   ├── proof_slo_metrics.txt           # SLO query output showing non-zero attainment
│   ├── proof_ci_diff.txt               # CI workflow diff adding auth test
│   ├── proof_tests.txt                 # Full vitest count
│   ├── proof_typecheck.txt
│   └── proof_gate.txt
├── replay-bundle-3types/               # Proof bundle: 3-types fixture run
│   ├── lifecycle-trace.jsonl
│   ├── determinism-hash.txt
│   └── proof-bundle-checksum.txt
└── SPRINT_CLOSEOUT_REPORT.md
```

---

## The Verification Pyramid After R6

```
                    ┌─────────────────┐
                    │  R2 Replay      │  ← Deterministic, all bet types,
                    │  (3-types +     │    all lifecycle gates including
                    │   Gate H)       │    settlement truth
                    └────────┬────────┘
               ┌─────────────┴───────────────┐
               │                             │
      ┌────────┴────────┐         ┌──────────┴──────────┐
      │  E2E Critical   │         │  operatorAuth        │
      │  Path Test      │         │  Regression Test     │
      │  (submit→recap) │         │  (token + JWT)       │
      └────────┬────────┘         └──────────┬───────────┘
               │                             │
      ┌────────┴─────────────────────────────┴──────────┐
      │           Unit + Integration Suite               │
      │           (1172+ vitest, 643+ Jest)              │
      └──────────────────────────────────────────────────┘
```

---

## Dependency Order

```
R6 depends on: R1 COMPLETE, R2 COMPLETE, R3 COMPLETE, R4 COMPLETE, R5 COMPLETE
R6 must complete before: R7
```

---

**Workstream Owner**: Engineering Team **Estimated Effort**: 2 sessions (fixture
authoring + test writing + relay gate addition + CI)
