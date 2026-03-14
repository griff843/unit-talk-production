# Claude OS — LLM Routing Engine

**Document**: claude_os_llm_routing_engine.md **Status**: CANONICAL — Active
Authority **Sprint**: SPRINT-CLAUDE-OS-COS006-LLM-ROUTING-ENGINE **Date**:
2026-03-14 **Implements**:
`docs/02_architecture/claude_os_multi_llm_orchestration_blueprint.md §4, §6, §7, §9, §10`

> The LLM Routing Engine is the first operational component of the Claude OS
> multi-LLM orchestration system. It upgrades `/sprint-plan` to emit a governed
> routing plan that assigns work to lanes, selects optimal models, recommends
> Claude Code instance counts, and generates structured prompts for external
> advisory LLMs.
>
> Claude Code remains the single final authority. The router is a planning tool
> only — it never dispatches to external LLMs automatically.

---

## 1. Location and Integration

**Source module**: `tools/claude-os/src/llm-router.ts`

**CLI command**:

```bash
npx tsx tools/claude-os/src/cli.ts route \
  --sprint "<SPRINT-NAME>" \
  --summary "<description>" \
  --type <sprint-type> \
  --layer "Layer N" \
  --phase "Phase M — Name" \
  --orchestration-mode A|B|C \
  --output-dir "out/sprints/<SPRINT>/<DATE>"
```

**Integration point**: Step 4.5 of `/sprint-plan` skill
(`.claude/skills/sprint-plan/SKILL.md §Step 4.5`)

**Artifact output**: `out/sprints/<SPRINT>/<DATE>/LLM_ROUTING_DECISION.md`

---

## 2. Five Core Functions

### 2.1 Task Classification (`classifyTask`)

Classifies a sprint into one or more work types:

| Classification       | Trigger Conditions                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `implementation`     | Sprint type fix/migration/activation/feature; keywords: fix, implement, build, add         |
| `architecture`       | Cross-system design, new contracts; keywords: architecture, blueprint, contract, consensus |
| `audit`              | System state reconciliation; keywords: audit, truth, reconcile, drift                      |
| `verification`       | Gate-focused work; keywords: gate, verification, test suite, e2e                           |
| `documentation`      | Governance docs, specs; keywords: docs, governance, runbook, closeout                      |
| `runtime_operations` | Production monitoring, SLOs; keywords: monitor, runtime, alert, slo, reliability           |
| `design`             | ADRs, blueprints; keywords: design, blueprint, schema design, routing engine               |

Classification uses a two-pass approach:

1. **Primary**: sprint type field → direct mapping to dominant classification
2. **Secondary**: keyword scan of sprint ID, summary, objective, and touched
   areas

Multiple classifications are valid and drive multiple lane assignments.

### 2.2 Lane Assignment (`assignLanes`)

Maps classifications to execution lanes defined in `07-lane-model.md`:

| Lane | Name                  | Trigger Classifications    | External Eligible?       |
| ---- | --------------------- | -------------------------- | ------------------------ |
| 1    | Implementation        | `implementation`           | Yes (Mode B/C: Codex)    |
| 2    | Audit / Truth         | `audit`                    | **Never**                |
| 3    | Verification          | All (paired with Lane 1/6) | **Never**                |
| 4    | Governance / Docs     | `documentation`, `design`  | Yes (Mode A: ChatGPT-4o) |
| 5    | Operations / Runtime  | `runtime_operations`       | **Never**                |
| 6    | Design / Architecture | `architecture`, `design`   | Yes (Mode A: Gemini)     |

**Automatic pairing**: Lane 3 (Verification) is always included when Lane 1 is
present. Implementation without verification is not permitted.

### 2.3 Model Routing (`routeModels`)

Applies the Model Responsibility Matrix from the blueprint:

| Lane                    | Primary Model        | External Advisory (Mode B/C)              |
| ----------------------- | -------------------- | ----------------------------------------- |
| 1 — Implementation      | Claude Sonnet        | Codex / GPT-4-turbo (isolated module gen) |
| 2 — Audit/Truth         | **Claude Opus only** | None — never delegated                    |
| 3 — Verification        | Claude Sonnet        | None — Claude Code runs gates directly    |
| 4 — Governance/Docs     | Claude Sonnet        | ChatGPT-4o (document drafting)            |
| 5 — Operations/Runtime  | Claude Sonnet        | None — direct system access required      |
| 6 — Design/Architecture | Claude Opus          | Gemini Advanced (research synthesis)      |

### 2.4 Instance Recommendation (`recommendInstances`)

Recommends how many Claude Code instances should execute the sprint:

| Mode              | Trigger Conditions                                                                                       | Rationale                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `SINGLE_INSTANCE` | Orchestration Mode A, or no parallel lane pairs                                                          | All lanes sequential in one Claude Code instance                        |
| `TWO_INSTANCES`   | Lane 1 + Lane 4, or Lane 6 + Lane 1 (non-overlapping files)                                              | Implementation + docs/design can run concurrently                       |
| `THREE_INSTANCES` | Lane 1 + Lane 3 + Lane 4 active; or pipeline overlap (Sprint N verification + Sprint N+1 implementation) | Maximum parallelism across implementation, verification, and governance |

Each recommendation includes:

- Instance count and rationale
- Lane-to-instance mapping (which lanes run on which instance)
- Merge order (which instance's output must complete before the next step)

Instance boundaries always align with lane boundaries per blueprint §11.

### 2.5 Prompt Generation (`generatePrompts`)

For Modes B and C only: generates structured prompt templates for external
advisory LLM lanes. Each prompt includes:

- Sprint context (ID, objective, layer/phase)
- Specific task definition and scope boundaries
- Expected output format
- Authority note (Claude Code reviews and validates — output is a DRAFT)

**Prompt templates by model**:

- **ChatGPT-4o** (Lane 4): technical documentation drafting assistant
- **Codex/GPT-4-turbo** (Lane 1): isolated TypeScript module generation
- **Gemini Advanced** (Lane 6): research synthesis and option matrix generation

All generated prompts include an authority note making clear that Claude Code
reviews and integrates (or rejects) external outputs. External LLMs do not
declare their outputs authoritative.

---

## 3. Output Artifacts

### 3.1 Operator Display (stdout)

When run via `/sprint-plan`, the router emits a formatted routing section:

```
## LLM Routing Plan
────────────────────────────────────────────────────────────

Sprint:            SPRINT-EXAMPLE-044
Work type(s):      implementation, documentation
Orchestration:     Mode A
Instance mode:     SINGLE_INSTANCE

### Lane Assignments

Lane 1 — Implementation
  Model:    Claude Sonnet
  Mode:     ● Claude Code internal
  Purpose:  Write code, create migrations, fix tests, activate features
  Locked:   Gate enforcement, git commit, Architecture decisions

Lane 3 — Verification
  Model:    Claude Sonnet
  Mode:     ● Claude Code internal
  Purpose:  Run test suites, CI gates, capture proof artifacts
  Locked:   All gate execution — Claude Code must run shell commands directly

Lane 4 — Governance / Docs
  Model:    Claude Sonnet
  Mode:     ● Claude Code internal
  Purpose:  Sprint planning, closeout reports, governance doc updates
  Locked:   Governance contract edits, Sprint plans, Canonical doc writes

### Instance Recommendation

Recommended: SINGLE_INSTANCE
Rationale:   Orchestration Mode A — single-LLM execution; all lanes sequential.

### External LLM Prompts

Mode A — no external prompts generated. All lanes run internally in Claude Code.

────────────────────────────────────────────────────────────
```

### 3.2 Evidence Artifact (`LLM_ROUTING_DECISION.md`)

Written to `out/sprints/<SPRINT>/<DATE>/LLM_ROUTING_DECISION.md`. Contains:

1. Classification result and rationale
2. Lanes selected (table with model and execution mode)
3. Model routing summary
4. Instance recommendation with rationale and lane-to-instance mapping
5. Generated prompts (if Mode B/C)
6. Governance constraints (non-negotiable, always present)

This artifact is part of the sprint proof bundle and is validated by
`sprint:close` in Phase B (COS-007).

---

## 4. Orchestration Modes

The router behavior changes based on the `--orchestration-mode` flag:

| Mode        | Router Behavior                                                    | External Prompts                     | Operator Burden            |
| ----------- | ------------------------------------------------------------------ | ------------------------------------ | -------------------------- |
| A (default) | All lanes run in Claude Code; no external advisory                 | None generated                       | Unchanged                  |
| B           | Eligible lanes can use external advisory models; prompts generated | Generated, require operator dispatch | Transparency announcements |
| C           | Full task graph with operator approval                             | Generated                            | One approval gate          |

Mode A is always the default. Existing sprint prompts (without the
`Orchestration:` field) run as Mode A — backward compatible.

---

## 5. Never-Delegated Lanes (Absolute)

These lanes are hardcoded to `claude_code_internal` regardless of orchestration
mode. No flag or argument can change this:

| Lane                        | Reason                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| Lane 2 — Audit/Truth        | Truth reconciliation requires highest-fidelity judgment; false VERIFIED status is catastrophic |
| Lane 3 — Verification       | Claude Code must run shell gates directly; external LLMs cannot execute commands               |
| Lane 5 — Operations/Runtime | Direct production system access required; no proxy path available                              |

---

## 6. Usage Examples

### Example 1: Standard implementation sprint (Mode A)

```bash
npx tsx tools/claude-os/src/cli.ts route \
  --sprint "SPRINT-044-LAYER2-PHASE8-RECOVERY" \
  --type "feature" \
  --summary "Implement replay engine production readiness and incident recovery" \
  --layer "Layer 2" \
  --phase "Phase 8 — Recovery & Replay" \
  --orchestration-mode A \
  --output-dir "out/sprints/SPRINT-044-LAYER2-PHASE8-RECOVERY/2026-03-14"
```

Expected routing: Lane 1 (Sonnet) + Lane 3 (Sonnet) + Lane 4 (Sonnet) Instance
mode: SINGLE_INSTANCE

### Example 2: Architecture sprint with research (Mode B)

```bash
npx tsx tools/claude-os/src/cli.ts route \
  --sprint "SPRINT-LAYER4-PHASE12-EDGE-DETECTION" \
  --type "architecture" \
  --summary "Design closing line value analysis and edge identification system" \
  --layer "Layer 4" \
  --phase "Phase 12 — Edge Detection" \
  --orchestration-mode B \
  --output-dir "out/sprints/SPRINT-LAYER4-PHASE12-EDGE-DETECTION/2026-03-14"
```

Expected routing: Lane 6 (Opus + Gemini advisory) + Lane 3 (Sonnet) Instance
mode: TWO_INSTANCES External prompts: 1 (Gemini research synthesis)

### Example 3: Multi-lane complex sprint (Mode B)

```bash
npx tsx tools/claude-os/src/cli.ts route \
  --sprint "SPRINT-LAYER3-PHASE9-SMARTFORM-UX" \
  --type "feature" \
  --summary "Smart Form UX polish and user-facing pick submission workflows" \
  --layer "Layer 3" \
  --phase "Phase 9 — SmartForm UX" \
  --orchestration-mode B \
  --touched-areas "apps/smart-form,docs/ops" \
  --output-dir "out/sprints/SPRINT-LAYER3-PHASE9-SMARTFORM-UX/2026-03-14"
```

Expected routing: Lane 1 (Sonnet + Codex advisory) + Lane 3 (Sonnet) + Lane 4
(Sonnet + ChatGPT advisory) Instance mode: THREE_INSTANCES (Lane 1 + Lane 3 +
Lane 4 pipeline) External prompts: 2 (Codex module gen, ChatGPT docs)

---

## 7. Governance Integration

The routing engine is governed by the same authority chain as all Claude OS
components:

| Document                                                              | Authority                                          |
| --------------------------------------------------------------------- | -------------------------------------------------- |
| `CLAUDE_EXECUTION_CONTRACT.md`                                        | Non-negotiable invariants — router cannot override |
| `docs/02_architecture/claude_os_multi_llm_orchestration_blueprint.md` | Primary design authority for this module           |
| `.claude/rules/07-lane-model.md`                                      | Lane definitions and parallelism rules             |
| `docs/04_roadmap/layer_phase_execution_model.md`                      | Phase classification (used in routing context)     |

The router is a **planning tool only**. It:

- Does NOT dispatch to external LLMs
- Does NOT commit code
- Does NOT modify status documents
- Does NOT declare sprint complete

All final authority remains with Claude Code.

---

## 8. Implementation Notes

### Type Safety

The router is written in TypeScript strict mode. All exported types are in
`tools/claude-os/src/llm-router.ts`. The module follows the ESM pattern used
throughout `tools/claude-os/src/`.

### Fail Behavior

If classification produces no results, the router defaults to `implementation`
(fail-open for classification — never blocks sprint planning). If the module
throws, the CLI exits non-zero and emits the error — fail-closed for execution.

### Future Extensions

- Phase C (COS-008): Task envelope format for Mode B artifact bundles
- Phase D (COS-011): Task graph format for Mode C with operator approval UI
- `sprint:close` validation of `LLM_ROUTING_DECISION.md` (COS-007)

---

**Governance Owner**: Engineering Team **Effective Date**: 2026-03-14
**Sprint**: SPRINT-CLAUDE-OS-COS006-LLM-ROUTING-ENGINE **Authority**:
`docs/02_architecture/claude_os_multi_llm_orchestration_blueprint.md §4, §6, §7, §9, §10`
