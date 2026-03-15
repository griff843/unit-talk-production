# LLM Decision Playbook — Unit Talk

> **Which AI tool does what.** Use this to route work to the right model or
> tool. Do not route to a tool that lacks the required context or authority.
>
> **Last Updated**: 2026-03-15 | **Audit Source**:
> SPRINT-057-CHATGPT-ENHANCEMENT-LAYER

---

## Tool Roster

| Tool                     | Context                                | Best For                                                                        | Avoid When                              |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------- |
| **Claude Code (Sonnet)** | Full repo access, live file reads, git | Implementation, migrations, bug fixes, mechanical refactors                     | Architecture design without clear spec  |
| **Claude Code (Opus)**   | Full repo access                       | Architecture decisions, audit/truth sprints, ambiguous cross-system design      | Simple one-file fixes (overkill)        |
| **Claude Code (Haiku)**  | Full repo access                       | Status reads, health checks, quick lookups, no reasoning required               | Anything requiring multi-file reasoning |
| **ChatGPT (GPT-4o)**     | Context bundle only (no live repo)     | Architecture review, code review, incident analysis, strategic planning         | Live debugging, file edits              |
| **Claude MCP Skills**    | MCP layer (no DB creds needed)         | Operator observability — pipeline health, pick traces, SLO reports, edge checks | Code generation                         |

---

## Claude Code — Model Selection

From `docs/02_architecture/claude_os_ceiling_blueprint.md §6`:

| Condition                                             | Model  |
| ----------------------------------------------------- | ------ |
| Status-only read, health check, no reasoning          | Haiku  |
| Fix, Migration, Activation sprint                     | Sonnet |
| Feature sprint (clear requirements)                   | Sonnet |
| Architecture or cross-system design                   | Opus   |
| Audit/Truth sprint                                    | Opus   |
| Ambiguous requirements needing reasoning              | Opus   |
| Large mechanical refactor (> 10 files, clear pattern) | Sonnet |

---

## Claude MCP Observability Skills

Use these for live platform diagnostics without touching code:

| Skill                     | Invocation                  | When to Use                                                                                                            |
| ------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/pipeline-health`        | No args                     | First diagnostic for any pipeline issue. Gets agent health, outbox depth, SLO attainment, platform status in one pass. |
| `/pick-trace <uuid>`      | Pick UUID                   | Trace a single pick through its lifecycle. Identifies stage, stuck reasons, settlement history.                        |
| `/slo-report [--context]` | Optional `--context` flag   | SLO attainment report. Use `--context` for incident response (adds subsystem correlation).                             |
| `/edge-check`             | No args (CLV inputs needed) | Directional CLV edge and model calibration audit. Requires `compute_clv` and `compute_calibration` inputs.             |

**OPERATOR_TOKEN**: `get_slo_status` requires this env var. Other MCP tools work
without it.

---

## ChatGPT — Appropriate Use Cases

ChatGPT has **no live repo access**. Ground it using context artifacts:

```bash
pnpm ai:context   # generates out/ai/context/context_bundle.md
```

Paste `context_bundle.md` into ChatGPT before asking anything about the
codebase.

### What ChatGPT is good for (with context bundle):

| Use Case           | Prompt Template                                  |
| ------------------ | ------------------------------------------------ |
| Architecture audit | `docs/ai/prompt-templates/architecture-audit.md` |
| Sprint plan review | `docs/ai/prompt-templates/sprint-plan-review.md` |
| Incident analysis  | `docs/ai/prompt-templates/incident-analysis.md`  |
| Repository audit   | `docs/ai/prompt-templates/repo-audit.md`         |

### What ChatGPT cannot do:

- Read files in real-time
- Run tests or gates
- Execute bash commands
- Access Supabase, Linear, or GitHub
- Make changes to the codebase

---

## Lane Model — Parallel Execution

From `.claude/rules/07-lane-model.md`:

| Lane                        | Purpose                              | Model          |
| --------------------------- | ------------------------------------ | -------------- |
| Lane 1: Implementation      | Write code, migrations, fixes        | Sonnet / Opus  |
| Lane 2: Audit/Truth         | Read and reconcile system state      | Opus           |
| Lane 3: Verification        | Run tests, capture proof artifacts   | Sonnet / Haiku |
| Lane 4: Governance/Docs     | Sprint plans, closeouts, doc updates | Opus / Sonnet  |
| Lane 5: Operations/Runtime  | Monitor prod, run runbooks           | Sonnet         |
| Lane 6: Design/Architecture | Contract design, blueprints          | Opus           |

**Parallelism rules**:

- Implementation (Lane 1) + Governance (Lane 4): safe to parallelize
- Implementation (Lane 1) + Verification (Lane 3): never parallel — verification
  runs after implementation
- Two Implementation lanes touching same files: never parallel

---

## Decision Flow — Which Tool to Use

```
Is this a live platform diagnostic (not code)?
  └─ YES → Use Claude MCP skill (/pipeline-health, /pick-trace, /slo-report, /edge-check)

Is this a code change or file edit?
  └─ YES → Use Claude Code
      Is it mechanical / clear spec?
        └─ YES → Sonnet
        └─ NO → Opus
      Is it a status query only?
        └─ YES → Haiku

Is this strategic review, incident analysis, or architecture review?
  └─ YES → Use ChatGPT with context bundle
      Generate: pnpm ai:context → paste context_bundle.md → use prompt template

Is this sprint planning?
  └─ YES → Run /sprint-plan in Claude Code
      This reads status docs, checks drift, validates dependencies, emits routing plan
```

---

## Context Bundle — What's Included

`pnpm ai:context` generates `out/ai/context/context_bundle.md` containing:

- Platform overview (from UNIT_TALK_SYSTEM_BRAIN.md)
- App topology summary
- Subsystem health snapshot (from status docs)
- Sprint queue (from NEXT_5_SPRINTS.md)
- Drift summary (from DRIFT_REPORT.md)
- Repo map (key files and packages)
- MCP layer summary
- Layer/Phase position

The bundle is capped for ChatGPT context limits. It does not include raw file
dumps.

---

## Intelligence Reviews

Periodic structured reviews using the platform's intelligence modules:

| Review               | File                                                          | Frequency                              | What It Checks                                   |
| -------------------- | ------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------ |
| Edge Drift           | `docs/ai/intelligence-reviews/edge-drift-review.md`           | Weekly / after odds feed change        | CLV edge shift across books and bet types        |
| Strategy Performance | `docs/ai/intelligence-reviews/strategy-performance-review.md` | Weekly / after bankroll change         | Kelly vs flat unit performance, ROI trend        |
| Model Calibration    | `docs/ai/intelligence-reviews/model-calibration-check.md`     | Weekly / after grading pipeline change | ECE, Brier score, CALIBRATED/DRIFT/MISCALIBRATED |

---

## Anti-Patterns

| Anti-Pattern                                             | Why It's Wrong                        | Correct Approach                                |
| -------------------------------------------------------- | ------------------------------------- | ----------------------------------------------- |
| Ask ChatGPT to edit files                                | It has no access                      | Use Claude Code                                 |
| Use Claude Code for architecture without reading context | May miss existing patterns            | Read relevant docs first                        |
| Use Opus for single-file fixes                           | Wasteful                              | Use Sonnet                                      |
| Ask Claude MCP skills for code generation                | Wrong tool                            | Use Claude Code Lane 1                          |
| Run implementation and verification lanes simultaneously | Gate violation                        | Run verification after implementation is stable |
| Paste full file contents into ChatGPT                    | Context pollution                     | Use context_bundle.md                           |
| Make status claims without proof                         | Violates CLAUDE_EXECUTION_CONTRACT.md | Proof artifacts required                        |
