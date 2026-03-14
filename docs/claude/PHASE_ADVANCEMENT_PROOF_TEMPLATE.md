# Phase Advancement Proof Template

**Authority**: `docs/02_architecture/claude_os_ceiling_blueprint.md` §7
**Status**: CANONICAL — Active Authority **Sprint**:
SPRINT-CLAUDE-OS-PHASE-PROOF-003

> Any sprint that claims a phase complete MUST produce a phase advancement proof
> artifact. Claiming a phase complete without this artifact is a governance
> violation. `sprint:close --phase <N>` will fail-closed if the artifact is
> absent or incomplete.

---

## 1. Artifact Location and Naming

```
out/sprints/<SPRINT-ID>/<YYYY-MM-DD>/proofs/proof_phase_advancement_<N>.txt
```

- `<N>` is the integer phase number (0–14)
- One file per phase claimed complete per sprint
- File is plain text (`.txt`), not markdown

---

## 2. Required Content

The file must contain all five sections:

| Section                   | Required Fields                                                              |
| ------------------------- | ---------------------------------------------------------------------------- |
| Header                    | Phase number + name, Layer number + name, Sprint ID, Date                    |
| Phase Scope               | One-line scope from `layer_phase_execution_model.md` §3                      |
| Layer Exit Criteria       | Full criteria statement from `layer_phase_execution_model.md` §2             |
| Phase Completion Evidence | Per-criterion checklist with filled-in evidence                              |
| Explicit Sign-Off         | Exact statement: "Phase N criteria satisfied as of YYYY-MM-DD by SPRINT-ID." |

---

## 3. Phase Map Reference

Sourced from `docs/04_roadmap/layer_phase_execution_model.md` §2 and §3.

### Layer 1 — Functional Pick Machine

Layer 1 exit criterion: _A production pick can reliably traverse the full
lifecycle without manual intervention and the result is deterministic,
auditable, and recoverable._

| Phase | Name                     | Scope                                                                          |
| ----- | ------------------------ | ------------------------------------------------------------------------------ |
| 0     | Governance Lock          | Execution contracts, single-writer discipline, CI gates, Claude OS governance  |
| 1     | Runtime Truth            | Agent health, lifecycle enforcement, idempotency guarantees                    |
| 2     | Data Truth               | Schema canonicalization, type safety, schema drift elimination                 |
| 3     | Distribution Determinism | Discord worker reliability, outbox integrity, delivery proofs                  |
| 4     | Operational Determinism  | Worker health restore, quarantine/dead-letter handling, pipeline observability |
| 5     | Platform Stabilization   | End-to-end E2E verification, smoke tests, shadow mode, fault injection         |

### Layer 2 — Production Platform

Layer 2 exit criterion: _Operators can run the platform, detect problems, and
recover from failure states without requiring engineering escalation for normal
operational events._

| Phase | Name                     | Scope                                                                                      |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------ |
| 6     | Operator Control Plane   | Backend control surface: operator APIs, autopilot mode controls, manual override workflows |
| 7     | Reliability & Monitoring | Alerting, SLO tracking, health dashboards, on-call runbooks                                |
| 8     | Recovery & Replay        | Replay engine production readiness, incident recovery procedures, backup/restore           |

### Layer 3 — Product Complete

Layer 3 exit criterion: _Workflows are usable. Users and operators have polished
interfaces and efficient workflows._

| Phase | Name                  | Scope                                                              |
| ----- | --------------------- | ------------------------------------------------------------------ |
| 9     | SmartForm UX          | Smart Form polish, user-facing pick submission workflows           |
| 10    | Command Center UX     | Command Center interface redesign, operator UI, workflow tooling   |
| 11    | Workflow Optimization | Cross-cutting operator efficiency, automation of routine workflows |

### Layer 4 — Syndicate Intelligence

Layer 4 exit criterion: _Edge detection, market resistance analysis, and CLV
analytics are operational and provide actionable intelligence._

| Phase | Name              | Scope                                                            |
| ----- | ----------------- | ---------------------------------------------------------------- |
| 12    | Edge Detection    | Closing line value analysis, edge identification, backtesting    |
| 13    | Market Resistance | Market behavior analysis, line movement interpretation           |
| 14    | CLV Analytics     | Customer lifetime value, historical model performance, analytics |

---

## 4. Generating a Skeleton File

Use the generator script to create a pre-populated skeleton:

```bash
npm run phase:proof -- --sprint SPRINT-FOO-123 --phase 5
# Optional: specify date
npm run phase:proof -- --sprint SPRINT-FOO-123 --phase 5 --date 2026-03-14
```

The script:

- Creates `out/sprints/<ID>/<DATE>/proofs/proof_phase_advancement_<N>.txt`
- Pre-populates phase name, layer, scope, and layer exit criteria
- Marks all evidence fields as `[FILL IN: ...]`
- Refuses to overwrite an existing file (fail-closed)

After generation, **fill in every `[FILL IN: ...]` field** with actual evidence
(CI output references, proof file names, commit hashes).

Then **replace the sign-off placeholder** with the completed statement.

---

## 5. Validation Rules

`npm run sprint:close -- <SPRINT-ID> --phase <N>` enforces:

| Check              | Condition                                              | Failure                    |
| ------------------ | ------------------------------------------------------ | -------------------------- |
| File exists        | `proof_phase_advancement_<N>.txt` present in `proofs/` | Missing required artifact  |
| No unfilled fields | File must NOT contain `[FILL IN`                       | Evidence not completed     |
| Sign-off completed | File must NOT contain `[REPLACE THIS LINE`             | Sign-off not filled in     |
| Sign-off present   | File MUST contain `Phase <N> criteria satisfied as of` | Sign-off statement missing |

All four checks must pass. Any failure causes `sprint:close` to exit 1.

---

## 6. Example: Completed Phase 5 Proof

```
============================================================
PHASE ADVANCEMENT PROOF
Phase: 5 — Platform Stabilization
Layer: 1 — Functional Pick Machine
Sprint: SPRINT-LAYER1-PHASE5-E2E-CLOSURE
Date:   2026-03-14
============================================================

PHASE SCOPE
-----------
End-to-end E2E verification, smoke tests, shadow mode, fault injection

LAYER EXIT CRITERIA (layer_phase_execution_model.md §2)
--------------------------------------------------------
Layer 1 is complete when a production pick can reliably traverse the full
lifecycle without manual intervention and the result is deterministic,
auditable, and recoverable.

PHASE COMPLETION EVIDENCE
--------------------------
[x] E2E verification pass
    Evidence: proof_verify_e2e.txt (CI SHA-256 verified), commit a6f69276

[x] Smoke tests pass
    Evidence: proof_smoke_test.txt — all 12 assertions pass

[x] Shadow mode operational (R3)
    Evidence: shadow-guardrails CI job GREEN, PR #163, commit b2bda98e

[x] Fault injection framework validated (R4) — F1-F10
    Evidence: fault-suite CI job GREEN, UNI-58 Done, commit b2bda98e

[x] Replay engine E2E traversal (R2)
    Evidence: proof_replay_e2e.txt — SHA-256 verified deterministic output

EXPLICIT SIGN-OFF
-----------------
Phase 5 criteria satisfied as of 2026-03-14 by SPRINT-LAYER1-PHASE5-E2E-CLOSURE.

============================================================
```

---

## 7. Blank Skeleton Template

Copy-paste this if generating manually (prefer `npm run phase:proof`):

```
============================================================
PHASE ADVANCEMENT PROOF
Phase: <N> — <Phase Name>
Layer: <L> — <Layer Name>
Sprint: <SPRINT-ID>
Date:   <YYYY-MM-DD>
============================================================

PHASE SCOPE
-----------
<scope from layer_phase_execution_model.md §3>

LAYER EXIT CRITERIA (layer_phase_execution_model.md §2)
--------------------------------------------------------
<layer exit criterion from layer_phase_execution_model.md §2>

PHASE COMPLETION EVIDENCE
--------------------------
[ ] <Criterion 1>
    Evidence: [FILL IN: CI output, proof file references, commit hashes]

[ ] <Criterion 2>
    Evidence: [FILL IN: CI output, proof file references, commit hashes]

EXPLICIT SIGN-OFF
-----------------
[REPLACE THIS LINE with: "Phase <N> criteria satisfied as of YYYY-MM-DD by <SPRINT-ID>."]

============================================================
```
