# Claude OS — Multi-LLM Orchestration Blueprint

**Document**: claude_os_multi_llm_orchestration_blueprint.md **Status**:
CANONICAL — Active Authority **Sprint**:
SPRINT-CLAUDE-OS-MULTI-LLM-ORCHESTRATION-BLUEPRINT **Date**: 2026-03-14
**Authority**: Governance / Claude OS Evolution **Supersedes**: Nothing (new
document; extends `claude_os_ceiling_blueprint.md §2.2`)

> This blueprint defines the canonical architecture, operating model, and
> operator interaction model for upgrading Claude OS from a single-LLM sprint
> executor to a governed multi-LLM orchestration layer. It does NOT weaken proof
> discipline, gate enforcement, or the single-authority principle. Operator
> burden MUST NOT increase.

---

## 1. Purpose and Scope

### 1.1 What This Blueprint Solves

Claude OS currently operates as a single-LLM sprint executor: one Claude Code
instance plans, implements, verifies, and closes sprints sequentially. This
model works well for Layers 1–2 (proof-heavy, governance-intensive, bounded
scope). As Unit Talk advances into Layers 3–4 and sprint complexity grows —
multi-lane parallelism, specialized domain research, architectural design
alongside implementation — single-LLM sequential execution becomes a bottleneck.

This blueprint answers:

1. How does Claude OS coordinate with external LLMs without losing governance?
2. Which responsibilities may be delegated and which may never be?
3. How does the operator interact with a multi-LLM system?
4. What is the progressive path from current state to full orchestration?

### 1.2 What "Multi-LLM Orchestration" Means Here

**Multi-LLM orchestration** is the capability for Claude OS (Claude Code) to:

- Delegate sub-tasks to external LLM agents (ChatGPT, Codex, Gemini, Opus
  sub-instances)
- Collect and validate their outputs
- Integrate validated outputs into the sprint artifact bundle under Claude
  Code's authority
- Enforce proof discipline and gate requirements on all external contributions

Multi-LLM orchestration is **NOT**:

- External LLMs committing code, tagging sprints, or merging to main
- External LLMs declaring sprint completion
- External LLMs modifying governance documents
- Weakening or bypassing any existing gate requirement
- Requiring more operator decisions per sprint

### 1.3 Non-Goals

| Non-Goal                                                  | Why Excluded                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| Autonomous multi-agent task graphs without human approval | Violates Human-Approval Zone from `ceiling_blueprint.md §8`     |
| External LLM writes to protected branches                 | Violates single-authority principle (§5)                        |
| Reducing proof artifact requirements for delegated work   | Proof requirements are floor constraints, not negotiable        |
| Replacing Opus with external LLMs for audit/truth work    | Audit lane requires highest-fidelity judgment — never delegated |
| External LLMs with direct Supabase/production access      | Runtime operations are always Claude Code authority             |

---

## 2. Current Claude OS Architecture

### 2.1 Single-LLM Execution Model

Claude OS today is a governed single-LLM executor:

```
Operator prompt
      │
      ▼
Claude Code (Sonnet/Opus/Haiku)
      │
      ├─ Plan (reads status docs, NEXT_5_SPRINTS, DRIFT_REPORT)
      ├─ Implement (edits files, runs commands)
      ├─ Verify (type-check, tests, lifecycle gate)
      ├─ Proof (captures artifacts to out/sprints/)
      ├─ Commit + Tag (git operations — single authority)
      ├─ Merge (push to origin/main via PR)
      └─ Status Sync (updates docs/, Linear)
```

All operations flow through a single Claude Code instance. No external agents.

### 2.2 Lane Model (Current)

Six execution lanes, defined in `.claude/rules/07-lane-model.md`:

| Lane                    | Purpose                       | Default Model                        |
| ----------------------- | ----------------------------- | ------------------------------------ |
| 1 — Implementation      | Code, migrations, tests       | Sonnet (mech) / Opus (new contracts) |
| 2 — Audit/Truth         | Read, reconcile state         | Opus                                 |
| 3 — Verification        | Run gates, capture proofs     | Sonnet / Haiku (status only)         |
| 4 — Governance/Docs     | Sprint plans, closeouts, docs | Opus (design) / Sonnet (mech)        |
| 5 — Operations/Runtime  | Monitor, debug, runbooks      | Sonnet                               |
| 6 — Design/Architecture | ADRs, blueprints, contracts   | Opus                                 |

Currently all lanes run sequentially within one Claude Code instance.

### 2.3 Model Routing Matrix (Current)

From `ceiling_blueprint.md §6`:

| Condition                                            | Model  |
| ---------------------------------------------------- | ------ |
| Status-only read, no reasoning needed                | Haiku  |
| Fix, Migration, Activation sprint                    | Sonnet |
| Feature sprint (clear requirements)                  | Sonnet |
| Architecture / cross-system design                   | Opus   |
| Audit/Truth sprint                                   | Opus   |
| Ambiguous requirements, reasoning needed             | Opus   |
| Large mechanical refactor (>10 files, clear pattern) | Sonnet |

### 2.4 Proof Architecture (Current)

Every sprint requires a minimum proof bundle (governed by
`docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md §4`):

```
out/sprints/<SPRINT>/<DATE>/proofs/
├── proof_git_status.txt
├── proof_typecheck*.txt
├── proof_fetch_main.txt
├── proof_rebase_or_merge_main.txt
├── proof_tag_exists.txt
├── proof_git_status_clean.txt
└── proof_proof_inventory.txt
```

### 2.5 Autonomy Boundaries (Current)

From `ceiling_blueprint.md §8`:

| Zone           | Examples                                                                                     | Human needed? |
| -------------- | -------------------------------------------------------------------------------------------- | ------------- |
| Automatic      | Edits, tests, proofs, status doc updates, Linear state                                       | No            |
| Human-Approval | Production deployments, schema drops, force push to main, agent task graph approval (Mode C) | Yes           |

---

## 3. The Problem with Single-LLM Execution

### 3.1 Context Saturation

Long sprints with large file reads, extensive test output, and multiple proof
artifacts saturate Claude Code's working context. Complex multi-lane sprints
(e.g., implementation + architecture design + governance docs simultaneously)
push context limits, causing earlier context to be lost.

**Impact**: Claude Code may lose track of earlier plan decisions, earlier proof
results, or file states mid-sprint.

### 3.2 Sequential Bottleneck in Multi-Lane Sprints

The Lane Model permits parallel execution across non-conflicting lanes (e.g.,
Lane 4 Governance/Docs always safe with any other lane). But single-LLM
execution cannot truly parallelize — Claude Code processes one lane at a time,
even when lanes are independent.

**Impact**: Multi-lane sprints that should complete in parallel take sequential
wall-clock time. A Lane 4 doc sprint that could run concurrently with Lane 3
verification must wait.

### 3.3 Specialized Capability Gaps

Some sprint sub-tasks benefit from capabilities Claude Code lacks or is
suboptimal for:

| Sub-task                                             | Current approach      | Gap                                                              |
| ---------------------------------------------------- | --------------------- | ---------------------------------------------------------------- |
| Deep web research for competitive analysis           | Claude Code WebSearch | Gemini superior for real-time comprehensive research             |
| Code generation for isolated, well-specified modules | Claude Code Sonnet    | Codex/GPT-4-turbo competitive, could handle mechanical sub-tasks |
| Long-form technical document drafting                | Claude Opus           | ChatGPT-4o competitive for drafting; Opus then validates         |
| Mathematical proof / statistical analysis            | Claude Opus           | Specialized reasoning models may outperform                      |

### 3.4 Proof-Generation Overhead

Generating proof artifacts, running commands, capturing output, and updating
status docs all consume Claude Code context and turns, leaving less capacity for
the actual implementation work. External agents could handle proof scaffolding
tasks under Claude Code supervision.

### 3.5 What Single-LLM Does Well (Preserve)

The single-LLM model excels at:

- **Governance enforcement** — authoritative interpretation of contracts
- **Cross-file coherence** — understanding how changes interact across the
  codebase
- **Proof discipline** — knowing exactly what constitutes sufficient evidence
- **Gate enforcement** — fail-closed behavior that never bends on violations

These capabilities must remain with Claude Code. They are never delegated.

---

## 4. Multi-LLM Orchestration Architecture

### 4.1 Authority Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  AUTHORITY LAYER — Claude Code (Claude OS)                       │
│                                                                   │
│  • Sprint planning and selection (NEXT_5_SPRINTS authority)       │
│  • All git operations (commit, tag, push, merge)                  │
│  • All proof bundle generation and gate enforcement               │
│  • All status document updates (docs/status/)                     │
│  • All Linear state transitions                                   │
│  • Final validation of all external agent outputs                 │
│  • Sprint declaration of COMPLETE                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │ delegates sub-tasks
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  EXECUTION AGENT LAYER — External LLMs                           │
│                                                                   │
│  Roles:                                                           │
│  • Execution Agents — lane workers (code gen, doc drafting)      │
│  • Research Agents — domain-specific sub-tasks (web research)    │
│  • Verification Agents — independent gate validation (future)    │
│                                                                   │
│  Constraints:                                                     │
│  • Outputs are DRAFTS — not authoritative until Claude validates  │
│  • No git operations                                              │
│  • No status doc writes                                           │
│  • No governance document edits                                   │
│  • No sprint-complete declarations                                │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Orchestration Modes

#### Mode A — Prompt Orchestration (Lowest complexity)

Claude Code formulates structured sub-task prompts and issues them to external
LLMs via operator relay or API. Claude Code validates outputs before
integration.

```
Claude Code → [structured prompt] → External LLM
External LLM → [output artifact] → Claude Code
Claude Code → [validate] → integrate or reject
```

**When to use**: Document drafting sub-tasks, research queries, domain-specific
analysis that informs (but does not replace) Claude Code's implementation.

**Operator burden**: Zero change. Operator issues the same sprint prompt. Claude
Code delegates internally and reports results.

#### Mode B — Assisted Collection (Moderate complexity)

External LLMs produce structured artifacts (code, docs, proofs) independently.
Claude Code collects them, validates against governance contracts, and
integrates validated artifacts into the sprint bundle.

```
Claude Code → [task envelope] → External LLM (autonomous)
External LLM → [artifact bundle] → Claude Code
Claude Code → [gate validation] → pass/reject
              [integration] → sprint proof bundle
```

**When to use**: Parallelizing Lane 1 implementation sub-tasks, where one
external agent handles a well-specified isolated module while Claude Code works
on a different module concurrently.

**Operator burden**: Operator sees delegation decisions in output. No new input
required.

#### Mode C — Full Orchestration (Highest complexity)

Claude Code manages a multi-agent task graph. Operator approves the graph before
execution begins. Claude Code coordinates execution, collects artifacts,
enforces gates, and declares sprint complete.

```
Claude Code → [task graph] → Operator approval
Operator → [approve]
Claude Code → [dispatch] → Agent 1, Agent 2, Agent 3 (parallel)
Agents → [artifacts] → Claude Code
Claude Code → [validate all] → [integrate] → [sprint close]
```

**When to use**: Complex multi-lane sprints where Lane 1 + Lane 4 + Lane 6 can
run in parallel with substantial work in each.

**Operator burden**: One additional approval step (task graph approval). Human-
Approval Zone per `ceiling_blueprint.md §8`.

---

## 5. Single Authority Principle

### 5.1 The Principle

**Claude Code (Claude OS) is the single final authority for all sprint
governance operations. This principle is non-negotiable and cannot be relaxed in
any orchestration mode.**

External LLMs are **Execution Agents** — they produce work product under Claude
Code's supervision. They are not co-authorities.

### 5.2 Operations That Can Never Be Delegated

| Operation                        | Why Claude Code Only                                            |
| -------------------------------- | --------------------------------------------------------------- |
| `git commit`                     | Proof chain integrity — commit must reflect validated state     |
| `git tag` (SPRINT-\*)            | Governed tag flow — CI validates tag via governance/closeouts/  |
| `git push origin main`           | Protected branch; merge requires human PR approval              |
| `npm run sprint:close`           | Closeout validation — Claude OS must validate proof inventory   |
| Status doc writes (docs/status/) | Single source of truth — only one writer                        |
| Linear state transitions         | Audit trail — Claude Code is the sync authority                 |
| Declaring sprint COMPLETE        | Requires validated proof bundle + all gates passing             |
| Modifying governance documents   | Authority documents — only Claude Code under operator direction |

### 5.3 Operations That May Be Delegated (with validation)

| Operation                            | Delegation Mode | Claude Code's Role                             |
| ------------------------------------ | --------------- | ---------------------------------------------- |
| Code generation for isolated modules | Mode A or B     | Validate, integrate, or reject                 |
| Technical document drafting          | Mode A          | Validate against governance contracts, edit    |
| Web research and synthesis           | Mode A          | Verify accuracy, extract relevant findings     |
| Test case generation                 | Mode A or B     | Validate coverage, run through gate            |
| Architecture option generation       | Mode A          | Opus-level review before any design is adopted |
| Proof artifact scaffolding           | Mode A          | Validate contents, sign off                    |

### 5.4 Validation Requirement

Every external LLM output MUST pass Claude Code's validation gate before
integration. Validation means:

1. Content aligns with sprint objective and acceptance criteria
2. No governance contract violations (no direct `unified_picks` writes, no
   lifecycle bypass, etc.)
3. TypeScript types correct (for code contributions)
4. No hallucinated claims (especially in status/proof documents)
5. Proof artifact created: `proof_external_<agent>_<task>_validated.txt`

If validation fails: output is rejected, logged, and Claude Code implements the
sub-task directly. Rejection does not fail the sprint — it escalates the
sub-task.

---

## 6. Lane-to-Agent Assignment

### 6.1 Canonical Lane-Agent Matrix

| Lane                    | Primary Agent | May Use External? | Allowed External Roles                           | Never Delegate                                              |
| ----------------------- | ------------- | ----------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| 1 — Implementation      | Claude Sonnet | Yes (Mode A/B)    | Codex, GPT-4-turbo: isolated module code gen     | Gate enforcement, commit, architecture decisions            |
| 2 — Audit/Truth         | Claude Opus   | **No**            | None                                             | Everything — truth reconciliation requires highest fidelity |
| 3 — Verification        | Claude Sonnet | **No**            | None                                             | All gate execution — never delegated                        |
| 4 — Governance/Docs     | Claude Sonnet | Yes (Mode A)      | ChatGPT-4o: document drafting sub-tasks          | Governance contract edits, sprint plans                     |
| 5 — Operations/Runtime  | Claude Sonnet | **No**            | None                                             | All runtime operations — direct system access required      |
| 6 — Design/Architecture | Claude Opus   | Yes (Mode A)      | Gemini: research sub-tasks, competitive analysis | Architecture decisions, ADR ratification                    |

### 6.2 Lane 2 — Why No External Agents

Lane 2 (Audit/Truth) reconciles system state against canonical documents. This
requires:

- Authoritative interpretation of governance contracts
- Cross-document consistency judgment
- Drift detection that depends on understanding the full context chain

External LLMs lack the full context of Unit Talk's governance authority chain.
An Audit/Truth lane that delegates to an external agent risks false VERIFIED
claims and missed drift items. This failure mode is catastrophic (false clean
status → wrong sprint selection → compounding drift).

**Lane 2 is always Claude Opus. No exceptions.**

### 6.3 Lane 3 — Why No External Agents

Lane 3 (Verification) runs the actual gates: `npm run type-check`,
`npm run test`, `npm run lifecycle:single-writer -- --strict`. These require:

- Direct filesystem access
- Bash execution
- Authoritative interpretation of gate results

External LLMs cannot run these commands. Claude Code runs them and captures the
output. If an external agent claims "tests pass," that claim is unverified.
Claude Code must run the tests itself.

**Lane 3 gate execution is always Claude Code. No exceptions.**

### 6.4 Parallelism Extension for Multi-Agent

The Lane Model parallelism rules from `.claude/rules/07-lane-model.md` extend
naturally to multi-agent execution:

- Lane 4 (Governance/Docs) remains safe to run in parallel with all other lanes
  — an external agent drafting docs while Claude Code implements is valid Mode A
- Lane 1 (Implementation) with external agent and Lane 3 (Verification) remain
  **non-parallel** — verification must run after implementation is complete and
  stable, regardless of which agent did the implementation
- Two external agents in Lane 1 may run in parallel only if they touch
  non-overlapping file sets — Claude Code must verify file coverage before
  dispatching

---

## 7. Model Responsibility Matrix

### 7.1 Canonical Responsibility Table

| Capability                                    | Sonnet                 | Opus                   | Haiku | ChatGPT-4o              | Codex/GPT-4-turbo             | Gemini Advanced     |
| --------------------------------------------- | ---------------------- | ---------------------- | ----- | ----------------------- | ----------------------------- | ------------------- |
| Write code (implementation lane)              | ✅ Primary             | ✅ New contracts       | ❌    | Draft only              | Draft only                    | ❌                  |
| `git commit` / `git tag` / `git push`         | ✅                     | ✅                     | ❌    | ❌                      | ❌                            | ❌                  |
| Generate proof artifacts                      | ✅                     | ✅                     | ❌    | ❌                      | ❌                            | ❌                  |
| Run gates (type-check, tests, lifecycle)      | ✅                     | ✅                     | ❌    | ❌                      | ❌                            | ❌                  |
| Update status docs (docs/status/)             | ✅                     | ✅                     | ❌    | ❌                      | ❌                            | ❌                  |
| Linear state transitions                      | ✅                     | ✅                     | ❌    | ❌                      | ❌                            | ❌                  |
| Sprint planning (NEXT_5_SPRINTS authority)    | ✅                     | ✅                     | ❌    | ❌                      | ❌                            | ❌                  |
| Architecture design / ADR ratification        | Sonnet consults Opus   | ✅ Primary             | ❌    | ❌                      | ❌                            | Research input only |
| Audit / truth reconciliation                  | ❌                     | ✅ Only                | ❌    | ❌                      | ❌                            | ❌                  |
| Technical document drafting (Governance/Docs) | ✅                     | ✅                     | ❌    | Draft for Sonnet review | ❌                            | ❌                  |
| Web research and synthesis                    | ✅ (WebSearch)         | ✅                     | ❌    | ✅ Mode A only          | ❌                            | ✅ Mode A only      |
| Code generation sub-tasks (isolated modules)  | ✅                     | ✅                     | ❌    | ❌                      | Mode B only, Claude validates | ❌                  |
| Status queries (health checks, counts)        | ✅                     | ✅                     | ✅    | ❌                      | ❌                            | ❌                  |
| Declare sprint COMPLETE                       | ✅                     | ✅                     | ❌    | ❌                      | ❌                            | ❌                  |
| Governance document edits                     | ✅ (operator-directed) | ✅ (operator-directed) | ❌    | ❌                      | ❌                            | ❌                  |

### 7.2 Reading the Matrix

- **✅ Primary** — this model handles this autonomously; no external help needed
- **Draft only / Mode A/B only** — external model produces a draft; Claude Code
  validates and integrates before it becomes authoritative
- **❌** — this model may NOT perform this operation in the Claude OS context
- **Research input only** — model provides research synthesis; decision remains
  with Claude Code

---

## 8. Proof Discipline for External Contributions

### 8.1 External Contributions Are Drafts Until Validated

No external LLM output enters the sprint proof bundle as authoritative until
Claude Code performs explicit validation. The authority chain is:

```
External LLM output (DRAFT) → Claude Code validation → Integrated artifact (AUTHORITATIVE)
```

Skipping the validation step is a governance violation equivalent to an
unreviewed merge — the sprint is not closeable while unvalidated external
contributions exist.

### 8.2 Required Proof Artifacts for External Contributions

For each external LLM contribution integrated into a sprint, Claude Code MUST
create:

```
proofs/
├── proof_external_<agent>_<task>_raw.txt      # raw output from external LLM
├── proof_external_<agent>_<task>_validation.txt  # Claude Code's validation result
└── proof_external_<agent>_<task>_decision.txt    # integrated / rejected + reason
```

These artifacts join the standard proof bundle. They expand the proof inventory
— they never reduce it.

Example (Mode B code generation):

```
proofs/
├── proof_external_codex_lane1_module_raw.txt       # Codex output
├── proof_external_codex_lane1_module_validation.txt # type-check on Codex code
└── proof_external_codex_lane1_module_decision.txt   # "INTEGRATED: passes gates"
```

### 8.3 Validation Failure Protocol

When Claude Code rejects an external contribution:

1. Log the rejection in `proof_external_<agent>_<task>_decision.txt`
2. Log the reason (governance violation, type error, hallucination, etc.)
3. Implement the sub-task directly (Claude Code takes over)
4. Update the proof bundle to reflect the direct implementation
5. Do NOT retry the same external agent without understanding the failure

Rejection count for a sprint is reported in the SPRINT_CLOSEOUT_REPORT.md under
"External Agent Activity."

### 8.4 Proof Bundle Expansion Rule

Multi-LLM sprints have a LARGER proof bundle than equivalent single-LLM sprints.
The baseline proof artifacts (§4 of `CLAUDE_OS_GOVERNANCE_CONTRACT.md`) are the
MINIMUM — external contributions ADD proof artifacts. The `sprint:close` command
validates the inventory against the manifest, which must include all external
contribution proofs.

---

## 9. Operator Interaction Model

### 9.1 Core Principle: Operator Burden Must Not Increase

The multi-LLM architecture is an execution-layer concern. The operator's
interface to Claude OS is the sprint prompt — and that interface must remain
simple, unchanged, and low-burden regardless of orchestration complexity.

If a proposed orchestration mode requires the operator to issue more prompts,
track more state, or make more decisions per sprint, the orchestration design is
wrong and must be revised.

### 9.2 Mode A — Prompt Orchestration (Operator Experience: Unchanged)

```
Operator:  "Run SPRINT-CLAUDE-OS-FEATURE-001"
Claude OS: [internally delegates research sub-task to Gemini via Mode A]
           [validates Gemini output]
           [continues implementation]
           "Sprint complete. See out/sprints/.../SPRINT_CLOSEOUT_REPORT.md"
```

Operator sees: normal sprint output. External delegation is an implementation
detail, reported in the closeout report's "External Agent Activity" section but
not requiring operator action.

### 9.3 Mode B — Assisted Collection (Operator Experience: Transparency Only)

```
Operator:  "Run SPRINT-CLAUDE-OS-FEATURE-001"
Claude OS: [implements Lane 4 docs while dispatching Lane 1 module to Codex]
           "→ Delegating lane1/module-auth to Codex (Mode B, task-envelope sent)"
           [continues Lane 4 work]
           [collects Codex output when ready]
           [validates and integrates]
           "Sprint complete."
```

Operator sees: delegation announcements in output. No new input required. The
announcements are informational — the operator may observe but need not act.

### 9.4 Mode C — Full Orchestration (Operator Experience: One Approval Gate)

```
Operator:  "Run SPRINT-CLAUDE-OS-COMPLEX-001 (Mode C)"
Claude OS: [reads sprint plan]
           [generates task graph]
           ---
           Task Graph — SPRINT-CLAUDE-OS-COMPLEX-001:
           • Agent 1 (Codex): lane1/module-auth [files: auth.ts, auth.test.ts]
           • Agent 2 (ChatGPT): lane4/closeout-draft [files: SPRINT_CLOSEOUT_REPORT.md]
           • Agent 3 (Claude Sonnet): lane3/verification [runs gates after Agent 1]
           Parallelism: Agent 1 + Agent 2 in parallel; Agent 3 after Agent 1
           Approve? (y/n)
           ---
Operator:  "y"
Claude OS: [dispatches graph]
           [coordinates]
           [validates all]
           "Sprint complete."
```

Operator sees: one approval gate before execution begins. This is the only
additional step versus Modes A/B. The approval is binary (proceed/abort) — the
operator does not need to review individual agent prompts.

Mode C is a Human-Approval Zone operation per `ceiling_blueprint.md §8`.

### 9.5 Sprint Prompt Format (Extended for Mode C)

For Mode C sprints, the sprint prompt may include a directive:

```
Orchestration: Mode C — Full Orchestration
Agent Budget: 3 external agents maximum
Lane Coverage: Lane 1 (Codex) + Lane 4 (ChatGPT) + Lane 3 (Sonnet)
```

If no `Orchestration:` field is present, Claude OS defaults to **Mode A** (no
external agents; single-LLM execution). This ensures backward compatibility —
all existing sprint prompts continue to work without modification.

### 9.6 Operator Override: Disable External Agents

An operator may disable external agent delegation at any time by including:

```
Orchestration: Mode A — Single LLM Only
```

in the sprint prompt. This forces single-LLM execution regardless of sprint
complexity. Useful for sensitive sprints (governance document edits, production
fixes) where the operator wants maximum authority concentration.

---

## 10. Progressive Implementation Plan

### 10.1 Phase Overview

Claude OS evolves from current state to full orchestration across four phases.
Each phase is a stable operating mode — the system can remain at any phase
indefinitely.

```
Phase A (current) → Phase B → Phase C → Phase D (ceiling)
```

### 10.2 Phase A — Single-LLM Disciplined (Current State)

**Description**: Current operating model. One Claude Code instance, Lane Model
applied, Sonnet/Opus/Haiku routing. No external agents.

**Capability trigger to advance**: Two or more complex sprints blocked or
significantly slowed by single-LLM context saturation or sequential bottleneck.

**Rollback**: N/A (current state is the rollback target).

**Governance changes needed**: None.

### 10.3 Phase B — Prompt Orchestration (Mode A Only)

**Description**: Claude Code begins delegating research and document-drafting
sub-tasks to external LLMs via structured prompts (Mode A). External outputs are
always validated before integration. Lane 2, 3, 5 never delegated.

**Capability triggers**:

- Claude Code explicitly requests external research in sprint prompt OR
- Sprint plan includes a lane4/docs sub-task that ChatGPT can draft faster

**What changes**:

- Claude Code issues structured sub-task prompts (operator may relay manually or
  via API integration)
- External proof artifacts added to proof bundle per §8.2
- Closeout report gains "External Agent Activity" section

**Governance changes needed**:

- This blueprint document (already created)
- `CLAUDE_OS_GOVERNANCE_CONTRACT.md`: add §12 "External Agent Protocol" (Phase B
  entry criterion)
- Sprint prompt template: add optional `Orchestration:` field

**Rollback criterion**: Any sprint where Mode A delegation produces a rejected
contribution requiring full re-implementation by Claude Code → that sub-task
class returns to single-LLM in subsequent sprints.

### 10.4 Phase C — Assisted Collection (Mode A + B)

**Description**: External LLMs produce artifact bundles for well-specified
isolated modules. Claude Code collects and validates. Enables true parallelism
for non-overlapping Lane 1 sub-tasks alongside Lane 4 work.

**Capability triggers**:

- Phase B stable for ≥5 consecutive sprints with no unplanned rejections
- A sprint exists with two clearly non-overlapping Lane 1 modules that would
  benefit from parallel implementation

**What changes**:

- Task envelope format defined (see Appendix A — reserved for Phase C)
- External agent artifact bundle format defined
- `sprint:close` validates external artifact bundles in proof inventory

**Governance changes needed**:

- Task envelope format (Appendix A of this document)
- `CLAUDE_OS_GOVERNANCE_CONTRACT.md`: §12 extended with Mode B protocol
- CI: external artifact validation added to proof inventory check

**Rollback criterion**: Any gate enforcement failure attributable to undetected
external agent hallucination → Mode A only until root cause resolved.

### 10.5 Phase D — Full Orchestration (Mode A + B + C, Ceiling)

**Description**: Claude Code manages multi-agent task graphs with operator
approval. Enables maximum parallelism across all non-conflicting lanes with
mixed external agent assignment.

**Capability triggers**:

- Phase C stable for ≥10 consecutive sprints
- A sprint class exists that genuinely benefits from 3+ parallel agent lanes
- Operator explicitly requests Mode C capability

**What changes**:

- Task graph format defined
- Operator approval UX defined (task graph display format)
- `sprint:close` validates task graph against executed artifact set

**Governance changes needed**:

- `CLAUDE_OS_GOVERNANCE_CONTRACT.md`: §12 extended with Mode C protocol
- `ceiling_blueprint.md §9`: Upgrade Roadmap entry for Phase D (this is the
  ceiling vision from §2.2)

**Rollback criterion**: Any sprint where task graph coordination overhead
exceeds the parallel execution benefit → revert to Phase C for that sprint
class.

---

## 11. Claude Code Instance Strategy

### 11.1 Three Instance Modes

The number of Claude Code instances maps to sprint complexity and the
orchestration phase.

#### Single Instance Mode (Phase A, default)

```
Instance 1 (Claude Code)
  ├─ Lane 1: Implementation
  ├─ Lane 2: Audit/Truth (if needed)
  ├─ Lane 3: Verification
  ├─ Lane 4: Governance/Docs
  ├─ Lane 5: Operations/Runtime (if needed)
  └─ Lane 6: Design/Architecture (if needed)
```

One instance handles all lanes sequentially. All git operations, proof
generation, and status updates centralized here.

#### Two Instance Mode (Phase B/C, for complex sprints)

```
Instance 1 — Orchestrator (Claude Opus or Sonnet)
  ├─ Lane 2: Audit/Truth (always Orchestrator)
  ├─ Lane 4: Governance/Docs (Orchestrator writes governance docs)
  └─ Lane 6: Design/Architecture (Orchestrator owns design decisions)
  • All git operations (commit, tag, push)
  • Status doc updates
  • Linear sync
  • Final proof bundle assembly

Instance 2 — Executor (Claude Sonnet)
  ├─ Lane 1: Implementation (code, migrations, tests)
  ├─ Lane 3: Verification (gates, proof capture)
  └─ Lane 5: Operations/Runtime (if needed)
  • Produces: code artifacts, proof_*.txt files
  • Does NOT commit, tag, or push
  • Reports completed artifacts to Orchestrator for integration
```

**Coordination mechanism**: Shared sprint artifact directory
(`out/sprints/<SPRINT>/<DATE>/`). Executor writes artifacts; Orchestrator reads
and validates before final integration.

**Constraint**: Instance boundary MUST align with lane boundary. The Executor
may not write to Lane 2 artifacts (docs/status/). The Orchestrator may not skip
Executor's gate results.

#### Three Instance Mode (Phase D, high-complexity sprints)

```
Instance 1 — Orchestrator (Claude Opus)
  ├─ Lane 2, 4, 6 (audit, governance, design)
  └─ All git operations, status updates, Linear sync

Instance 2 — Implementation Executor (Claude Sonnet)
  └─ Lane 1 (implementation) for Sprint N

Instance 3 — Verification Executor (Claude Sonnet)
  └─ Lane 3 (verification) for Sprint N
      (can run concurrently with Instance 2 working on Sprint N+1)
```

This mode enables verification of Sprint N to overlap with implementation of
Sprint N+1, creating a sprint pipeline. This is only valid when Sprint N
implementation is complete and stable before Sprint N+1 begins.

**Constraint**: No instance may consume artifacts from a lane gate that hasn't
completed. Instance 3 (verification of Sprint N) must finish before Instance 1
declares Sprint N complete.

### 11.2 Instance Selection Rules

| Sprint characteristics                                | Recommended mode                       |
| ----------------------------------------------------- | -------------------------------------- |
| Single-lane, bounded scope                            | Single Instance                        |
| Multi-lane, moderate complexity                       | Single Instance with Mode A delegation |
| Multi-lane, large scope, Lane 1 + Lane 4 parallel     | Two Instance Mode                      |
| Pipeline execution (N + N+1 overlap)                  | Three Instance Mode                    |
| Sensitive sprint (governance edits, production fixes) | Single Instance, Mode A only           |

---

## 12. Governance Integration

### 12.1 Execution Contract Is Inviolable

`CLAUDE_EXECUTION_CONTRACT.md` governs all operations. Multi-LLM orchestration
does not modify, relax, or create exceptions to any invariant in the Execution
Contract.

External agents are bound by the contract through the single authority
principle: Claude Code, which is bound by the contract, validates all external
outputs against the contract before integration. An external LLM that produces a
direct `unified_picks` write will have its contribution rejected at validation —
the violation never reaches the codebase.

### 12.2 Governance Contract Remains the Sprint Authority

`docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md` governs sprint execution mechanics.
Multi-LLM orchestration adds to the proof bundle requirements (§8 of this
document) but never reduces them. External contributions must be documented in
the proof inventory just as Claude Code's own work is.

**Required governance contract amendment** (to be executed in a follow-on
sprint): Add §12 "External Agent Protocol" to `CLAUDE_OS_GOVERNANCE_CONTRACT.md`
covering:

- Mode A/B/C definitions (reference this blueprint)
- External proof artifact naming convention
- Rejection logging requirement
- Mode C operator approval requirement

### 12.3 Layer/Phase Model Remains Authoritative

`docs/04_roadmap/layer_phase_execution_model.md` is the roadmap execution
authority. Multi-LLM orchestration does not change sprint classification. A
sprint that is Layer 1 / Phase 3 remains Layer 1 / Phase 3 regardless of which
agents implement it. Phase completion criteria are unchanged.

External agents may never claim layer boundary completion. Only Claude Code,
with a validated proof bundle, may advance a phase/layer status.

### 12.4 What External Agents May Never Touch

| Governance artifact                                   | External agent access     |
| ----------------------------------------------------- | ------------------------- |
| `CLAUDE_EXECUTION_CONTRACT.md`                        | ❌ Read only (never edit) |
| `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`               | ❌ Read only              |
| `docs/04_roadmap/layer_phase_execution_model.md`      | ❌ Read only              |
| `docs/02_architecture/claude_os_ceiling_blueprint.md` | ❌ Read only              |
| `docs/status/CURRENT_SYSTEM_STATUS.md`                | ❌ No access              |
| `docs/status/PHASE_STATUS.md`                         | ❌ No access              |
| `docs/status/NEXT_5_SPRINTS.md`                       | ❌ No access              |
| `docs/status/DRIFT_REPORT.md`                         | ❌ No access              |
| `governance/closeouts/*.md`                           | ❌ No access              |
| Git tags (SPRINT-_, PHASE-_, GOVERNANCE-\*)           | ❌ Cannot create          |

### 12.5 Fail-Closed Behavior Preserved

The fail-closed behavior of Claude OS (halt on gate failure; never proceed with
unvalidated state) applies equally to external agent contributions:

- If an external contribution fails validation → Claude Code takes over the
  sub-task directly (never proceeds with the failed artifact)
- If gate fails on externally-contributed code → sprint halts; Claude Code fixes
  and re-runs gate
- If the proof inventory is incomplete (external artifact missing) →
  `sprint:close` exits non-zero; sprint is not closeable

No orchestration mode changes this behavior. External delegation does not create
a "soft" gate path.

---

## Appendix A — Task Envelope Format (Reserved for Phase C)

_Task envelope specification will be defined when Phase C capability is
triggered. Reserved section — do not populate until Phase C entry criteria are
met._

---

## Appendix B — Document Authority Chain (Updated)

| Document                                                                  | Authority Role                                              |
| ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `CLAUDE_EXECUTION_CONTRACT.md`                                            | Hard law — non-negotiable invariants                        |
| `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`                                   | Sprint execution rules                                      |
| `docs/04_roadmap/layer_phase_execution_model.md`                          | Roadmap execution model                                     |
| `docs/02_architecture/claude_os_ceiling_blueprint.md`                     | Claude OS evolution authority                               |
| **`docs/02_architecture/claude_os_multi_llm_orchestration_blueprint.md`** | **Multi-LLM orchestration canonical model — this document** |

This document is subordinate to the Execution Contract and Governance Contract.
It extends (not supersedes) the Ceiling Blueprint.

---

## Appendix C — Glossary

| Term            | Definition                                                                          |
| --------------- | ----------------------------------------------------------------------------------- |
| Claude OS       | The governed execution layer; Claude Code + governance contracts + skills + rules   |
| External LLM    | Any non-Claude Code LLM used as an Execution Agent (ChatGPT, Codex, Gemini, etc.)   |
| Execution Agent | An external LLM in a delegated sub-task role                                        |
| Authority Layer | The Claude Code instance that holds final authority over all sprint operations      |
| Mode A          | Prompt Orchestration — Claude Code delegates via structured prompts                 |
| Mode B          | Assisted Collection — external LLMs produce artifact bundles; Claude Code validates |
| Mode C          | Full Orchestration — Claude Code manages a multi-agent task graph                   |
| Task Envelope   | Structured input format for Mode B/C external agent dispatch (Phase C)              |
| Task Graph      | Mode C multi-agent execution plan (requires operator approval)                      |
| Draft           | An external LLM output that has not yet been validated by Claude Code               |
| Validated       | An external LLM output that passed Claude Code's validation gate                    |
| Authoritative   | A validated artifact integrated into the sprint proof bundle                        |

---

**Governance Owner**: Engineering Team **Effective Date**: 2026-03-14 **Next
Review**: On Phase B entry (first Mode A external delegation sprint) **Sprint**:
SPRINT-CLAUDE-OS-MULTI-LLM-ORCHESTRATION-BLUEPRINT
