# Codex Parallel Agent Execution Policy

**Authority**: Unit Talk Engineering | Claude OS §7,
`.claude/rules/07-lane-model.md` **Status**: ACTIVE **Sprint**:
SPRINT-REM-004-CANONICAL-INGESTION-TRUTH-PROVE (first application)
**Supersedes**: Informal ad-hoc parallel patterns in `CODEX_EXECUTION_PLANE.md`
§4

---

## 1. Operating Principle

**Claude is the authority thread. Subagents execute bounded work in parallel.**

When a sprint task decomposes into non-overlapping, bounded subtasks, Claude
dispatches 2–3 parallel subagents to execute them concurrently. Claude retains
all architecture decisions, scope definition, and merge authority.

### Core Invariant

Parallel execution never bypasses a gate. Subagent outputs are always reviewed
by Claude before commit.

---

## 2. Default Lane Model

Every parallel dispatch assigns each subagent to exactly one lane:

| Lane                        | Purpose                                                                        | Mode                    | Model Tier                         |
| --------------------------- | ------------------------------------------------------------------------------ | ----------------------- | ---------------------------------- |
| **Scan**                    | Repo/code-path tracing, parity checks, grep/subscription/schema/event coverage | read-only               | haiku (fast, cheap)                |
| **Verification**            | Field authority, contract checks, lifecycle/single-writer checks               | read-only               | haiku (fast, cheap)                |
| **Execution-or-Regression** | Write one bounded artifact OR run gates/regression/proof collection            | bounded-write or verify | sonnet (artifact) or haiku (gates) |

### Model Tier Rationale

| Tier       | Claude Code Model    | Use For                                                   | Cost Ratio |
| ---------- | -------------------- | --------------------------------------------------------- | ---------- |
| Fast/cheap | `haiku`              | Scan, verification, gate running, proof collection        | 1x         |
| Standard   | `sonnet`             | Bounded artifact generation (test files, migration files) | ~5x        |
| Authority  | `opus` (main thread) | Architecture, scope, review, merge, closeout              | ~15x       |

**Default reasoning effort**: medium (standard). Only escalate when the task
explicitly requires deep architectural reasoning or ambiguous spec resolution.

---

## 3. Auto-Trigger Rules

### 2-Agent Mode — Auto-Trigger When ALL True

1. Task is read-only or bounded (no open-ended implementation)
2. Files are non-overlapping between lanes
3. Work is primarily audit / proof / verification
4. No architecture or truth authority decisions pending

**Typical pattern**: Scan lane + Verification lane in parallel.

### 3-Agent Mode — Auto-Trigger When ALL True

1. One lane can write a single bounded artifact (test file, migration, config)
2. Two other lanes can independently verify inputs/outputs
3. Sequential execution would waste time (each lane takes >30s independently)
4. No file overlap between any pair of lanes

**Typical pattern**: Scan + Verification + Artifact-write in parallel, then
gates run after artifact is complete.

### Do NOT Parallelize When ANY True

1. Multiple agents would edit the same files
2. Architecture or truth authority is still undecided
3. Scope is ambiguous or requires Claude judgment mid-execution
4. Task is primarily governance/closeout/status-doc work
5. One lane's output is required as input to another lane (use sequential +
   blocked-by)

---

## 4. Dispatch Protocol

### Before Dispatch

Claude MUST:

1. Decompose the sprint into non-overlapping subtasks
2. Assign each subtask to exactly one lane
3. Verify zero file overlap between concurrent lanes
4. Identify dependencies (blocked-by relationships)
5. Select model tier per lane (default: haiku for scan/verify, sonnet for
   artifact)

### Dispatch Format

```
Parallel Dispatch: <sprint-id>
  Agent 1 (<lane>): <task summary>
    Model: <haiku|sonnet>
    Files in scope: <list>
    Mode: <read-only|bounded-write|verify>
  Agent 2 (<lane>): <task summary>
    Model: <haiku|sonnet>
    Files in scope: <list>
    Mode: <read-only|bounded-write|verify>
  [Agent 3 (<lane>): ...]
  Dependencies: Agent N blocked by Agent M (if any)
  Review point: Claude reviews all outputs before commit
```

### After Dispatch

Claude MUST:

1. Wait for all agents to complete (or handle partial completion)
2. Review each agent's output for correctness
3. Merge results into a single sprint result
4. Run verification gates (type-check, tests, lifecycle gate)
5. Produce closeout verdict with: diff summary, proof receipts, gate results

---

## 5. Cost and Token Guardrails

### Per-Agent Limits

| Constraint                      | Value  | Rationale                                   |
| ------------------------------- | ------ | ------------------------------------------- |
| Max turns per scan/verify agent | 30     | Prevents runaway exploration                |
| Max turns per artifact agent    | 50     | Artifact generation may need more iteration |
| Preferred model for scan/verify | haiku  | ~10x cheaper than opus                      |
| Preferred model for artifact    | sonnet | Good balance of capability and cost         |

### Sprint-Level Budget

- **2-agent sprint**: Target < 100 total agent turns
- **3-agent sprint**: Target < 150 total agent turns
- **If an agent exceeds its turn limit**: Claude reviews partial output and
  decides whether to resume or absorb the remaining work

### Cost Optimization Rules

1. Use `haiku` for any task that is purely grep/read/verify
2. Use `sonnet` only when the agent must generate code or structured artifacts
3. Never use `opus` for subagents — reserve for the main authority thread
4. Prefer `run_in_background: true` for scan/verify agents when Claude has
   independent work to do in parallel
5. Do not spawn an agent for a task that can be done in < 3 tool calls

---

## 6. Safety Invariants

1. **No parallel writes to the same file.** If two agents need the same file,
   serialize them with a blocked-by dependency.

2. **Subagent output is never auto-committed.** Claude reviews all diffs before
   staging.

3. **Read-only agents are always safe to parallelize.** They cannot cause merge
   conflicts or data corruption.

4. **Bounded-write agents produce exactly one artifact.** If an agent needs to
   write multiple files, it must declare them upfront and they must not overlap
   with any concurrent agent's scope.

5. **Gate agents run AFTER artifact agents complete.** Never run type-check or
   test suites while code is still being written by another agent.

6. **Failed agents do not block the sprint.** If a scan or verify agent fails,
   Claude can absorb its task and continue. Only artifact-lane failures block.

7. **Lane model applies.** Subagent lanes map to
   `.claude/rules/07-lane-model.md`:
   - Scan → Lane 2 (Audit/Truth)
   - Verification → Lane 3 (Verification)
   - Artifact → Lane 1 (Implementation)
   - Gates → Lane 3 (Verification)

---

## 7. Reference Implementation: SPRINT-REM-004

First application of this policy:

```
Sprint: SPRINT-REM-004-CANONICAL-INGESTION-TRUTH-PROVE
Mode: 3-agent parallel
Production code changes: ZERO (proof-of-truth sprint)

Agent 1 (Scan/Verification — haiku):
  Task: T1 event_type parity + T2 submitter field-authority
  Files read: BridgeWorker.ts, write-adapter.ts, writer-authority.ts
  Result: PASS (both T1 and T2)
  Turns used: ~15

Agent 2 (Artifact — general-purpose):
  Task: T3 write canonical-ingestion-proof.test.ts
  Files written: apps/api/src/__tests__/canonical-ingestion-proof.test.ts (845 lines)
  Result: 10/10 tests passing, 8 hops proven PASS
  Turns used: ~47

Agent 3 (Gates — main thread):
  Task: T4 type-check + API vitest + lifecycle gate + proof collection
  Result: All 3 gates PASS
  Turns used: ~5 (direct tool calls, not subagent)

Dependencies: Agent 3 blocked by Agent 2 (gates need artifact)
Agents 1 and 2: ran in parallel (non-overlapping files)

Total turns: ~67 (within 3-agent budget of 150)
```

---

## 8. Document Relationships

| Document                                         | Role                                                          |
| ------------------------------------------------ | ------------------------------------------------------------- |
| This document (`CODEX_PARALLEL_AGENT_POLICY.md`) | Parallel execution trigger rules, lane model, cost guardrails |
| `docs/ai/CODEX_EXECUTION_PLANE.md` §4            | Basic parallel pattern (superseded by this doc for detail)    |
| `scripts/codex/CODEX_GOVERNANCE.md`              | Hard rules and safety invariants                              |
| `.claude/rules/07-lane-model.md`                 | Lane definitions and dependency rules                         |

---

**End of document.**
