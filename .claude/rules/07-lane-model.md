# Rule 07: Lane Model

> Authority: `docs/02_architecture/claude_os_ceiling_blueprint.md §5` Sprint:
> SPRINT-CLAUDE-OS-COS004-LANE-MODEL-RULES

## Core Principle

**Parallel workstreams are organized into lanes.** Each lane has a defined
purpose, model preference, allowed output types, merge constraints, and
parallelism rules. A lane may not exceed its allowed scope or merge without
passing its readiness gate.

Lanes exist to enable parallel execution without weakening proof discipline.
Parallelism never bypasses a gate.

---

## Lane Definitions

### Lane 1: Implementation

| Field             | Value                                                                              |
| ----------------- | ---------------------------------------------------------------------------------- |
| Purpose           | Write code, create migrations, fix tests, activate features                        |
| Default Model     | Sonnet (mechanical) / Opus (new contracts or ambiguous spec)                       |
| Allowed Outputs   | Code diffs, migration files, test updates, config changes                          |
| Merge Constraints | Must pass: type-check, build, all tests, lifecycle gate (if unified_picks touched) |
| Dependency        | Cannot merge if Audit lane has flagged a blocking truth gap                        |
| Parallel With     | Governance/Docs lane (Lane 4), Verification lane (Lane 3)                          |
| Not Parallel With | Another Implementation lane touching the same files                                |

### Lane 2: Audit / Truth

| Field             | Value                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------- |
| Purpose           | Read and reconcile system state; produce truth reports and status updates             |
| Default Model     | Opus                                                                                  |
| Allowed Outputs   | Status docs, drift reports, truth reconciliation notes, architecture assessments      |
| Merge Constraints | No code changes → no build gate required. Must produce at least one written artifact. |
| Dependency        | May read from Implementation lane outputs once that lane's gate passes                |
| Parallel With     | Implementation lane (read-only, no file conflicts)                                    |
| Not Parallel With | None — reads only                                                                     |

### Lane 3: Verification

| Field             | Value                                                                      |
| ----------------- | -------------------------------------------------------------------------- |
| Purpose           | Run test suites, CI gates, capture proof artifacts                         |
| Default Model     | Sonnet (scripting) / Haiku (status queries only)                           |
| Allowed Outputs   | Proof artifact files (`proof_*.txt`), gate outputs, test run summaries     |
| Merge Constraints | Output is input to merge gate. Must produce a non-zero proof artifact set. |
| Dependency        | Must run after Implementation lane code is complete and stable             |
| Parallel With     | Governance/Docs lane (Lane 4)                                              |
| Not Parallel With | Implementation lane (needs stable code to test against)                    |

### Lane 4: Governance / Docs

| Field             | Value                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| Purpose           | Sprint planning, closeout reports, governance doc updates, ADRs, blueprints          |
| Default Model     | Opus (design / blueprint work) / Sonnet (mechanical status updates)                  |
| Allowed Outputs   | Sprint plans, closeout reports, canonical doc updates, ADRs, rule files              |
| Merge Constraints | Must not contradict an existing canonical authority doc without formal supersession. |
| Dependency        | Reads sprint outputs from all other lanes (no code dependency)                       |
| Parallel With     | All other lanes                                                                      |
| Not Parallel With | None — docs only                                                                     |

### Lane 5: Operations / Runtime

| Field             | Value                                                                         |
| ----------------- | ----------------------------------------------------------------------------- |
| Purpose           | Monitor production, debug incidents, execute runbooks, incident response      |
| Default Model     | Sonnet                                                                        |
| Allowed Outputs   | Runbook execution outputs, incident reports, health snapshots, operator notes |
| Merge Constraints | No code changes unless the work is explicitly classified as a Fix sprint.     |
| Dependency        | Reads current runtime state; does not depend on other lane outputs            |
| Parallel With     | All other lanes (runtime monitoring is always live)                           |
| Not Parallel With | None                                                                          |

### Lane 6: Design / Architecture

| Field             | Value                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Purpose           | Contract design, cross-service architecture decisions, new system blueprints                                           |
| Default Model     | Opus                                                                                                                   |
| Allowed Outputs   | ADRs, contract specs, architecture blueprints, interface definitions                                                   |
| Merge Constraints | Must be reviewed before any implementation begins on the designed system. Cannot be directly merged as implementation. |
| Dependency        | Informs Implementation lane; does not depend on it                                                                     |
| Parallel With     | Audit lane (may discover current-state constraints)                                                                    |
| Not Parallel With | Implementation lane working on the same contracts (design race condition)                                              |

---

## Lane Dependency Rules

1. **Gate before read**: A lane may not consume outputs from another lane until
   that lane has passed its readiness gate.

2. **No circular dependencies**: If Lane A depends on Lane B and Lane B depends
   on Lane A, that is a design error. Stop and resolve before proceeding.

3. **Blocker reporting**: If a lane is blocked by a dependency lane failure, it
   stops and reports the blocker explicitly. It does not proceed with
   assumptions or guesses about what the dependency lane would have produced.

4. **Lane label in proof bundle**: When a sprint uses multiple lanes, each
   lane's proof artifacts are labelled with the lane (e.g.,
   `proof_lane1_typecheck.txt`, `proof_lane4_closeout.md`).

---

## Parallelism Rules

- Two Implementation lanes may run in parallel **only if** they touch
  non-overlapping file sets. Claude OS must verify no file overlap before
  recommending parallel execution.

- A Verification lane (Lane 3) and an Implementation lane (Lane 1) are **never
  parallel** in the same sprint. Verification runs after Implementation
  completes.

- Governance/Docs (Lane 4) is always safe to run in parallel with any other
  lane.

---

## When to Declare a Lane

Every sprint prompt should declare which lane(s) it operates in. If a sprint
touches only one lane, the lane label is implicit from the sprint type. If a
sprint spans multiple lanes (e.g., implementation + proof capture), declare
both.

Format in sprint plan:

```
Lane: Implementation (Lane 1) + Verification (Lane 3)
```

or for single-lane:

```
Lane: Governance/Docs (Lane 4)
```

---

## Enforcement

This rule file is the enforcement reference for Claude OS lane discipline.

Any sprint that:

- proposes merging an Implementation lane output without passing the
  Verification lane gate
- runs a Verification lane concurrently with an active Implementation lane
- allows one lane to consume another lane's output before that lane's gate
  passes

...is in violation of this rule. Stop and resolve the violation before
proceeding.
