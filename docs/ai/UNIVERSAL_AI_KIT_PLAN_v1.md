# Universal AI Kit — Plan v1

> **Version**: v1 | **Status**: Planning **Last Updated**: 2026-03-15
> **Authority**: `docs/ai/AI_OPERATING_DOCTRINE_v1.md §Future Evolution`

---

## Purpose

Unit Talk is the first governed implementation of a multi-AI operating model.
This document defines the architecture of a cross-project AI operating kit —
what parts are universal, what parts are project-specific, and how to extract a
reusable standard from the Unit Talk implementation.

This is a planning document. It does not represent a scheduled sprint or a
committed roadmap item. It records the intent and architecture so future work is
grounded, not invented from scratch.

---

## The Problem This Solves

Without a reusable AI operating framework:

- Every new project re-invents AI tool routing from scratch
- Doctrine, handoff standards, and preflight patterns drift per-project
- Context bundle approaches are ad-hoc and non-transferable
- Governance (proof, verification, closeout) is inconsistent across codebases
- Teams accumulate wrong routing habits and wasted prompts

A Universal AI Kit extracts the proven model from Unit Talk and makes it
transferable.

---

## Architecture: Universal Layer vs Project Adapter Layer

The kit is organized into two layers:

### Universal Layer

Components that apply to any software project using a multi-AI workflow. These
are extracted from Unit Talk with minimal or no modification.

| Component                      | Description                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| AI Operating Doctrine          | Multi-AI role definitions, routing rules, task lanes, anti-patterns                                 |
| Task Routing Matrix            | Quick-reference lookup: task type → first tool → downstream flow                                    |
| Preflight Checklist            | Five questions to answer before any serious AI task                                                 |
| Handoff Template               | Standardized ChatGPT → Claude Code 10-field implementation prompt                                   |
| Project Setup Checklist        | How to configure the ChatGPT project surface                                                        |
| Context Bundle Script          | Script that generates a ChatGPT-pasteable repo/system snapshot                                      |
| Prompt Template Family         | Reusable ChatGPT prompt templates: architecture audit, sprint review, incident analysis, repo audit |
| Intelligence Review Procedures | Periodic AI-assisted review procedures (calibrate to domain)                                        |
| Lane Model                     | Parallel execution lanes with merge gates                                                           |

### Project Adapter Layer

Components that must be customized per project. These are the project-specific
inputs that the universal layer consumes.

| Component             | Project Adapter Requirement                                  |
| --------------------- | ------------------------------------------------------------ |
| System Brain doc      | Write once per project — AI-facing canonical system summary  |
| MCP skill definitions | Define 3–5 repeatable diagnostic skills per platform         |
| Context bundle config | Configure which status docs and subsystems feed the bundle   |
| Governance contract   | Define sprint governance rules and verification expectations |
| Sprint queue          | Maintain project-specific sprint ordering and queue docs     |
| Drift report          | Track project-specific technical debt and drift items        |

---

## Reusable Documents

The following Unit Talk docs are candidates for extraction into the universal
layer, requiring only light templating:

| Document                                           | Universal Extract Target                 | Required Adaptations                          |
| -------------------------------------------------- | ---------------------------------------- | --------------------------------------------- |
| `docs/ai/AI_OPERATING_DOCTRINE_v1.md`              | `AI_OPERATING_DOCTRINE.md` template      | Replace Unit Talk references with `[PROJECT]` |
| `docs/ai/AI_TASK_ROUTING_MATRIX_v1.md`             | `AI_TASK_ROUTING_MATRIX.md` template     | MCP skill invocations are project-specific    |
| `docs/ai/AI_PREFLIGHT_CHECKLIST_v1.md`             | `AI_PREFLIGHT_CHECKLIST.md` template     | Skill names, constraint file paths            |
| `docs/ai/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_v1.md` | Universal — no adaptation needed         | None                                          |
| `docs/ai/AI_PROJECT_SETUP_CHECKLIST_v1.md`         | `AI_PROJECT_SETUP_CHECKLIST.md` template | Project instructions block, artifact list     |
| `docs/ai/LLM_DECISION_PLAYBOOK.md`                 | `LLM_DECISION_PLAYBOOK.md` template      | MCP skills table, intelligence review list    |
| `docs/ai/prompt-templates/`                        | Universal prompt family                  | Replace domain-specific examples              |

---

## Reusable Scripts

The context bundle script family (`scripts/ai/`) is designed for extraction:

| Script                            | Extraction Path                | Required Adaptations                    |
| --------------------------------- | ------------------------------ | --------------------------------------- |
| `build-context-bundle.mjs`        | Universal orchestrator         | Status doc paths, bundle section titles |
| `repo-intelligence-snapshot.mjs`  | Universal — minimal adaptation | App directories to scan                 |
| `generate-repo-map.mjs`           | Universal — minimal adaptation | App and package directory names         |
| `export-command-center-state.mjs` | Project-specific               | API endpoints are project-specific      |

**Extraction format**: These scripts should be published as a standalone package
(e.g., `@ai-kit/context-bundle`) with a config file that supplies
project-specific paths and endpoints.

---

## Reusable Artifact Structure

The following directory structure is universal:

```
docs/
├── ai/
│   ├── AI_OPERATING_DOCTRINE_v1.md
│   ├── AI_TASK_ROUTING_MATRIX_v1.md
│   ├── AI_PREFLIGHT_CHECKLIST_v1.md
│   ├── CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_v1.md
│   ├── AI_PROJECT_SETUP_CHECKLIST_v1.md
│   ├── LLM_DECISION_PLAYBOOK.md
│   ├── prompt-templates/
│   │   ├── architecture-audit.md
│   │   ├── sprint-plan-review.md
│   │   ├── incident-analysis.md
│   │   └── repo-audit.md
│   └── intelligence-reviews/    ← domain-specific; adapt titles
├── system/
│   └── [PROJECT]_SYSTEM_BRAIN.md    ← project-specific
└── status/
    ├── CURRENT_SYSTEM_STATUS.md     ← project-specific
    ├── NEXT_5_SPRINTS.md            ← project-specific
    ├── DRIFT_REPORT.md              ← project-specific
    └── PHASE_STATUS.md              ← project-specific

scripts/
└── ai/
    ├── build-context-bundle.mjs     ← universal (config-driven)
    ├── repo-intelligence-snapshot.mjs ← universal
    ├── generate-repo-map.mjs        ← universal
    └── export-[platform]-state.mjs  ← project-specific

.claude/
└── skills/                          ← project-specific skill definitions
    ├── pipeline-health.md
    ├── pick-trace.md
    ├── slo-report.md
    └── edge-check.md
```

---

## Reusable Prompt Families

The four prompt template families are universal with domain substitutions:

| Template                | Universal | Domain Substitutions                      |
| ----------------------- | --------- | ----------------------------------------- |
| `architecture-audit.md` | Yes       | Focus area names                          |
| `sprint-plan-review.md` | Yes       | Sprint name, phase names                  |
| `incident-analysis.md`  | Yes       | Subsystem names, metric names             |
| `repo-audit.md`         | Yes       | Compliance standards, deprecation targets |

Intelligence review procedures are domain-specific (CLV, Brier score, Kelly
sizing are Unit Talk concepts). Projects in other domains define their own
review procedures under `docs/ai/intelligence-reviews/`.

---

## Project-Specific Pieces

These components from Unit Talk are NOT extractable without full replacement:

- `docs/system/UNIT_TALK_SYSTEM_BRAIN.md` — Unit Talk architecture only
- `.claude/skills/pick-trace.md` — pick lifecycle is Unit Talk-specific
- `.claude/skills/edge-check.md` — CLV edge is Unit Talk-specific
- `scripts/ai/export-command-center-state.mjs` — Unit Talk API endpoints only
- `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md` — Unit Talk sprint governance
- `CLAUDE_EXECUTION_CONTRACT.md` — Unit Talk invariants
- `docs/ai/intelligence-reviews/` — Unit Talk intelligence model reviews

---

## Extraction Steps (Future Work)

When the time comes to extract this into a standalone kit:

1. **Document the universal interface** — define the config schema that drives
   the context bundle scripts
2. **Parameterize doctrine templates** — replace Unit Talk-specific names with
   `[PROJECT]` placeholders
3. **Extract scripts into a package** — publish `@ai-kit/context-bundle` with
   config-driven behavior
4. **Define the system brain template** — a structured questionnaire for writing
   a new project's system brain doc
5. **Define the skill template** — a minimal interface for defining project MCP
   skills
6. **Write an adoption guide** — step-by-step for bringing a new project into
   compliance with the AI operating model
7. **Version the universal kit separately** from project-specific
   implementations

---

## Governance Note

This plan does not change any runtime behavior, governance contracts, or
existing doctrine. It is a forward-looking architecture document.

Any future extraction work should go through the standard ChatGPT → Claude Code
→ Claude OS flow defined in the doctrine.

Unit Talk remains the authoritative reference implementation until a governed
extraction sprint produces a separate, versioned universal kit.

---

## Related Documents

| Document                                                | Purpose                                               |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `docs/ai/AI_OPERATING_DOCTRINE_v1.md §Future Evolution` | Doctrine's forward-looking intent for this kit        |
| `docs/system/UNIT_TALK_SYSTEM_BRAIN.md`                 | Reference implementation of the system brain doc      |
| `scripts/ai/build-context-bundle.mjs`                   | Reference implementation of the context bundle script |
| `docs/ai/AI_PROJECT_SETUP_CHECKLIST_v1.md`              | How to configure a project using this kit             |
