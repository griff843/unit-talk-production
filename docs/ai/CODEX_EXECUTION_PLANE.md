# Codex Execution Plane — Canonical Workflow Definition

**Authority**: Unit Talk Engineering **Sprint**:
SPRINT-CODEX-EXECUTION-PLANE-INDUSTRIALIZATION **Status**: ACTIVE
**Supersedes**: None (new document — subsumes informal patterns from
CODEX_GOVERNANCE.md and CODEX_AUDIT_ORCHESTRATION_SPEC.md)

---

## 1. Operating Model

Unit Talk uses a stratified multi-agent model:

```
Claude       = architecture / contracts / sequencing / audit leadership
Codex        = implementation / bounded execution / repo scans / test hardening
Claude OS    = verification / gate enforcement / closeout / proof capture
```

Codex is a **first-class execution plane**, not an ad-hoc helper. It has defined
task classes, output contracts, trigger rules, and parallel execution patterns.

### Core Invariant

**Codex executes. Claude decides. Claude OS verifies.**

Codex never chooses what to do — it receives a fully-specified task file and
produces a structured output. Claude reviews all Codex outputs before any
commit, merge, or status update.

---

## 2. Codex Role in the Sprint Lifecycle

Codex has defined integration points in the 6-phase sprint workflow:

| Phase               | Codex Role                                              | Trigger Moment                                                              | Required?                                                |
| ------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| Phase 0: Context    | Diagnostic repo scan                                    | `diagnosis-start`                                                           | Optional — when error picture is unclear                 |
| Phase 1: Plan       | None                                                    | —                                                                           | N/A — planning is Claude's authority                     |
| Phase 2: Implement  | Bounded mechanical execution                            | `implementation-start`                                                      | Optional — for well-specified mechanical tasks           |
| Phase 3: Verify     | Path verification, test hardening, regression challenge | `post-implementation-verify`, `test-hardening`, `regression-challenge-pass` | Optional — when confidence is low or coverage gaps exist |
| Phase 4: Proof      | Pre-closeout scan                                       | `sprint-closeout-support`                                                   | Optional — final confidence check                        |
| Phase 5: Commit+Tag | None                                                    | —                                                                           | N/A — Claude handles commits                             |
| Phase 6: Closeout   | None                                                    | —                                                                           | N/A — Claude OS handles closeout                         |

### When Codex Is Required

Codex is **never strictly required** for any sprint phase. It becomes the
**preferred executor** when ALL of these are true:

1. The task is fully specified (no ambiguity in what to do)
2. The scope is bounded (explicit file list or directory)
3. The output format is known (structured report, specific edits, pass/fail)
4. No architecture or design judgment is needed

### When Codex Is Prohibited

- Sprint planning or sequencing decisions
- Status document updates (`docs/status/`, `PHASE_STATUS.md`)
- Architecture design or contract changes
- Cross-service integration decisions
- Merge or commit operations
- Gate enforcement decisions

---

## 3. Task-Class Routing Table

Every Codex invocation falls into one of these task classes:

| Task Class                     | Mode          | Trigger                      | Task Template             | When to Use                                           |
| ------------------------------ | ------------- | ---------------------------- | ------------------------- | ----------------------------------------------------- |
| **Repo Scan**                  | read-only     | `diagnosis-start`            | `repo-scan-agent.md`      | Phase 0: error clusters, schema drift, route risks    |
| **Bounded Fix**                | bounded-write | `implementation-start`       | `fix-executor.md`         | Phase 2: mechanical fix with exact file list and spec |
| **Visibility Verification**    | verify        | `visibility-check`           | `publish-visibility.md`   | Phase 3: Discord publish path, outbox, CC visibility  |
| **Test Hardening**             | bounded-write | `test-hardening`             | `test-hardening.md`       | Phase 3: add missing tests for specific modules       |
| **Migration Validation**       | read-only     | `migration-validation`       | `migration-validation.md` | Phase 2/3: schema/migration correctness check         |
| **Regression Challenge**       | read-only     | `regression-challenge-pass`  | `regression-challenge.md` | Phase 3: adversarial review of recent changes         |
| **Post-Implementation Verify** | verify        | `post-implementation-verify` | `publish-visibility.md`   | Phase 3: confirm changes didn't break publish chain   |
| **Closeout Scan**              | read-only     | `sprint-closeout-support`    | `repo-scan-agent.md`      | Phase 4: final scan before proof bundle               |

### Routing Decision Flow

```
Claude receives a task or subtask
  ↓
Is the scope fully specified? ──NO──→ Claude handles it
  │YES
  ↓
Is it bounded to specific files? ──NO──→ Claude handles it
  │YES
  ↓
Does it require design judgment? ──YES──→ Claude handles it
  │NO
  ↓
Match to task class above → Route to Codex
```

### Model/Effort Strategy by Task Class

| Task Class              | Codex Model    | Rationale                            |
| ----------------------- | -------------- | ------------------------------------ |
| Repo Scan               | Default (auto) | Read-only, structured output         |
| Bounded Fix             | Default (auto) | Mechanical edits, scope-locked       |
| Visibility Verification | Default (auto) | Path tracing, no creativity needed   |
| Test Hardening          | Default (auto) | Pattern-following test generation    |
| Migration Validation    | Default (auto) | Schema rule checking                 |
| Regression Challenge    | Default (auto) | Adversarial code review within scope |

Codex model selection is managed by the Codex platform. Claude does not override
Codex's internal model choice. Claude controls only **whether** to invoke Codex.

---

## 4. Parallel Execution Model

> **Detailed policy**: See `docs/ai/CODEX_PARALLEL_AGENT_POLICY.md` for the full
> parallel agent execution policy including auto-trigger rules, 2-agent/3-agent
> mode triggers, model tier routing, cost guardrails, and safety invariants.

### Claude + Codex Parallel Pattern

Claude and Codex can work in parallel on **non-overlapping** bounded tasks:

```
Claude (Lane 1/Implementation)     Codex (bounded task)
────────────────────────────       ─────────────────────
Phase 2: Implement feature X       Phase 3: Test-harden module Y
  ↓                                  ↓
Both complete                      Both complete
  ↓                                  ↓
Claude reviews Codex output
  ↓
Claude OS: Verification gate (Lane 3)
```

### Multi-Agent Parallel Pattern (Default for Remediation Sprints)

```
Agent 1 (Scan — haiku)        Agent 2 (Artifact — sonnet)     Agent 3 (Gates)
─────────────────────         ─────────────────────────        ───────────────
Parity checks                 Write bounded test/artifact      [blocked by Agent 2]
Field authority scans           ↓                              Type-check
Schema coverage                 ↓                              Full test suite
  ↓                           Complete                         Lifecycle gate
Complete                        ↓                                ↓
  ↓                           Claude reviews                   Complete
Merged into sprint result       ↓                                ↓
                              Claude reviews all → commit
```

Auto-trigger 2-agent mode when: task is read-only/bounded, files
non-overlapping, work is audit/proof/verification heavy.

Auto-trigger 3-agent mode when: one lane writes a bounded artifact, two other
lanes independently verify, sequential execution would waste time.

Do NOT parallelize when: agents would edit the same files, architecture is
undecided, scope is ambiguous, or the task is governance/closeout.

### Parallel Rules

1. **Non-overlapping files only.** Claude and Codex must not edit the same files
   concurrently. Before dispatching a Codex task, Claude confirms no file
   overlap with its own in-progress work.

2. **Codex output is always reviewed.** Even in parallel mode, Claude reviews
   Codex output before integrating or committing.

3. **No parallel writes to the same branch.** Codex bounded-write tasks produce
   diffs that Claude applies. They do not directly commit.

4. **Read-only Codex tasks are always safe to parallelize.** Repo scans,
   visibility checks, and migration validation can run alongside any Claude
   work.

5. **Lane model applies.** Codex bounded-write tasks are Lane 1
   (Implementation). Codex read-only tasks are Lane 2 (Audit/Truth). Lane rules
   from `.claude/rules/07-lane-model.md` apply.

6. **Gate agents run AFTER artifact agents.** Never run verification gates while
   code is still being written by another agent.

### Parallel Dispatch Format

When Claude dispatches a Codex task in parallel, it records:

```
Codex Dispatch: <task-class>
  Task file: sprint_tasks/codex/<file>.md
  Trigger: <moment>
  Files in scope: <list>
  Parallel with: <what Claude is doing>
  Review point: <when Claude will review output>
```

---

## 5. Standard Codex Output Contract

Every Codex task must produce output conforming to this contract:

### Required Output Sections

```markdown
## Task Summary

- Task class: <repo-scan | bounded-fix | visibility-verify | test-hardening |
  migration-validation | regression-challenge>
- Mode: <read-only | bounded-write | verify>
- Sprint: <SPRINT-ID>
- Files examined: <count>
- Files modified: <count> (0 for read-only/verify)

## Findings

<Structured findings per the task template's Required Output section>

## Verdict

- Status: PASS | FAIL | PARTIAL
- Confidence: HIGH | MEDIUM | LOW
- Blocking issues: <count>
- Advisory issues: <count>

## Modified Files (bounded-write only)

| File   | Change        |
| ------ | ------------- |
| <path> | <description> |

## Acceptance Criteria Check

- [ ] <criterion 1>: PASS/FAIL
- [ ] <criterion 2>: PASS/FAIL
```

### Output Handling Rules

1. **PASS** — Claude may integrate output directly
2. **FAIL** — Claude must address blocking issues before proceeding
3. **PARTIAL** — Claude reviews advisory issues and decides action
4. **Codex output is never auto-committed** — Claude always reviews first

---

## 6. Trigger and Invocation Rules

### By Workflow Moment (Preferred)

```bash
# Auto triggers (read-only/verify — no confirmation needed)
bash scripts/codex/run-trigger.sh diagnosis-start
bash scripts/codex/run-trigger.sh visibility-check
bash scripts/codex/run-trigger.sh post-implementation-verify
bash scripts/codex/run-trigger.sh sprint-closeout-support
bash scripts/codex/run-trigger.sh migration-validation
bash scripts/codex/run-trigger.sh regression-challenge-pass

# Manual-confirm triggers (bounded-write — requires confirmation)
bash scripts/codex/run-trigger.sh implementation-start
bash scripts/codex/run-trigger.sh test-hardening

# List all registered triggers
bash scripts/codex/run-trigger.sh --list
```

### Direct Wrapper Invocation (When Custom Task File)

```bash
bash scripts/codex/run-readonly.sh sprint_tasks/codex/<task>.md
bash scripts/codex/run-verify.sh sprint_tasks/codex/<task>.md
bash scripts/codex/run-write.sh sprint_tasks/codex/<task>.md
```

### Trigger Type Safety

| Trigger Type     | Wrapper Allowed   | Confirmation              |
| ---------------- | ----------------- | ------------------------- |
| `auto`           | read-only, verify | None                      |
| `suggest`        | read-only, verify | Explicit `--run` flag     |
| `manual-confirm` | bounded-write     | Interactive yes/no prompt |

**Hard rule**: Bounded-write wrappers may NEVER use `auto` trigger type.

---

## 7. Agent Registry (Current)

| Agent                       | Wrapper           | Task File                 | Mode          | Trigger                                          |
| --------------------------- | ----------------- | ------------------------- | ------------- | ------------------------------------------------ |
| Repo Scan                   | `run-readonly.sh` | `repo-scan-agent.md`      | read-only     | `diagnosis-start`, `sprint-closeout-support`     |
| Fix Executor                | `run-write.sh`    | `fix-executor.md`         | bounded-write | `implementation-start`                           |
| Publish Visibility Verifier | `run-verify.sh`   | `publish-visibility.md`   | verify        | `visibility-check`, `post-implementation-verify` |
| Test Hardener               | `run-write.sh`    | `test-hardening.md`       | bounded-write | `test-hardening`                                 |
| Migration Validator         | `run-readonly.sh` | `migration-validation.md` | read-only     | `migration-validation`                           |
| Regression Challenger       | `run-readonly.sh` | `regression-challenge.md` | read-only     | `regression-challenge-pass`                      |

### Adding a New Agent

1. Create task file in `sprint_tasks/codex/<name>.md` (use `_TEMPLATE.md`)
2. Register trigger in `scripts/codex/trigger-registry.sh`
3. If bounded-write: trigger type MUST be `manual-confirm`
4. Test invocation: `bash scripts/codex/run-trigger.sh <moment>`
5. Update this document's agent registry table

---

## 8. Claude ↔ Codex ↔ Claude OS Interaction Protocol

### Standard Flow

```
1. Claude identifies a subtask suitable for Codex
2. Claude fills or selects a task template
3. Claude invokes Codex via trigger or direct wrapper
4. Codex executes and produces structured output
5. Claude reviews output against the output contract
6. If PASS: Claude integrates the work
7. If FAIL: Claude addresses issues, may re-run
8. Claude OS runs verification gates
9. Sprint proceeds to next phase
```

### Authority Boundaries

| Decision                    | Authority | Codex May? |
| --------------------------- | --------- | ---------- |
| What to build               | Claude    | No         |
| How to build (architecture) | Claude    | No         |
| Execute a specified fix     | Codex     | Yes        |
| Execute a specified scan    | Codex     | Yes        |
| Review Codex output         | Claude    | N/A        |
| Run verification gates      | Claude OS | N/A        |
| Commit changes              | Claude    | N/A        |
| Update status docs          | Claude    | N/A        |
| Merge to main               | Claude    | N/A        |
| Create sprint tags          | Claude OS | N/A        |

---

## 9. Safety and Governance

All rules from `scripts/codex/CODEX_GOVERNANCE.md` remain in force. Key
additions:

1. **Output contract is mandatory.** Codex output that doesn't conform to §5 is
   rejected and the task is re-dispatched with a corrected prompt.

2. **Parallel dispatch requires file-overlap check.** Claude must verify
   non-overlapping scope before dispatching Codex alongside its own
   implementation work.

3. **Task templates must be complete before dispatch.** No `<FILL IN:`
   placeholders or HTML comment markers may remain (enforced by `run-write.sh`).

4. **New task classes require this document to be updated.** Do not add triggers
   without updating §3 (routing table) and §7 (agent registry).

---

## 10. Deferred to Codex Automations (Future)

The following capabilities are identified for future automation but are NOT
implemented in this sprint:

| Capability                                              | Current State  | Automation Target                                    |
| ------------------------------------------------------- | -------------- | ---------------------------------------------------- |
| Auto-trigger repo scan on branch creation               | Manual trigger | Codex Automation on git push                         |
| Auto-trigger test hardening on coverage drop            | Manual trigger | Codex Automation on CI coverage report               |
| Auto-trigger migration validation on `.sql` file change | Manual trigger | Codex Automation on file pattern match               |
| Auto-trigger regression challenge on PR creation        | Manual trigger | Codex Automation on PR open event                    |
| Structured output → Linear issue creation               | Manual review  | Codex Automation post-processing                     |
| Codex output → proof artifact auto-capture              | Manual copy    | Codex Automation `--output-last-message` + proof dir |

### Prerequisites for Automation

1. Codex Automations feature must be GA and stable
2. Output contract (§5) must be machine-parseable (currently markdown)
3. CI integration hooks must support Codex trigger dispatch
4. Human review gate must remain for bounded-write tasks (non-negotiable)

---

## 11. Document Relationships

| Document                                    | Role                                                       |
| ------------------------------------------- | ---------------------------------------------------------- |
| This document (`CODEX_EXECUTION_PLANE.md`)  | Canonical workflow definition — when/how/why Codex is used |
| `docs/ai/CODEX_PARALLEL_AGENT_POLICY.md`    | Parallel execution triggers, lane model, cost guardrails   |
| `scripts/codex/CODEX_GOVERNANCE.md`         | Hard rules and safety invariants                           |
| `docs/ai/CODEX_AUDIT_ORCHESTRATION_SPEC.md` | Verified runtime behavior reference                        |
| `scripts/codex/trigger-registry.sh`         | Trigger → agent mapping (source of truth for dispatch)     |
| `sprint_tasks/codex/_TEMPLATE.md`           | Standard task file format                                  |
| `sprint_tasks/codex/*.md`                   | Individual task files per agent                            |
| `.codex/config.toml`                        | MCP suppression configuration                              |

---

**End of document.**
