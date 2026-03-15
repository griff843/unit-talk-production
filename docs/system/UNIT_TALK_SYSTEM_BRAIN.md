# Unit Talk — System Brain

> **AI-facing canonical summary.** This document is the authoritative entry
> point for any LLM reasoning about the Unit Talk platform. Keep it concise and
> high-signal. All status claims must be current.
>
> **Last Updated**: 2026-03-15 | **Audit Source**:
> SPRINT-057-CHATGPT-ENHANCEMENT-LAYER

---

## Platform Overview

Unit Talk is a sports betting picks intelligence platform. It ingests ticket
submissions from operators, grades picks against closing lines and outcomes,
posts approved picks to Discord, and settles results. The system is built for
deterministic, auditable pick lifecycle management with a strong single-writer
discipline.

**Core loop**: Smart Form submission → `bridge_outbox` → BridgeWorker promotion
→ `unified_picks` → GradingAgent → DiscordPromotionAgent → Discord →
SettlementAgent → settled.

---

## App Topology

| App                   | Role                                       | Write Authority                          |
| --------------------- | ------------------------------------------ | ---------------------------------------- |
| `apps/api`            | Backend API, agents, lifecycle enforcement | **CANONICAL WRITER** for `unified_picks` |
| `apps/command-center` | Operator dashboard                         | READ-ONLY (no business table writes)     |
| `apps/dashboard`      | Analytics frontend                         | READ-ONLY (no business table writes)     |
| `apps/discord-bot`    | Discord integration                        | Reads picks, posts via webhook           |
| `apps/smart-form`     | Ticket submission UI                       | Writes to `bridge_outbox` ONLY           |

---

## Canonical Backend Role (apps/api)

- **Owns**: Agents, Grading, Settlement, Lifecycle enforcement, Risk engine, MCP
  servers
- **All `unified_picks` writes** must go through lifecycle adapters in
  `apps/api/src/lib/lifecycle/`
- **Must not**: Serve UI, handle Discord directly, accept raw picks bypassing
  adapters

---

## Agent Architecture

| Agent                   | Trigger               | Responsibility                                    |
| ----------------------- | --------------------- | ------------------------------------------------- |
| `BridgeWorker`          | Polls `bridge_outbox` | Promotes bridge submissions to `unified_picks`    |
| `GradingAgent`          | Cron / event          | Grades picks against CLV, applies promotion bands |
| `DiscordPromotionAgent` | After grading         | Posts approved picks to Discord channels          |
| `SettlementAgent`       | Outcome data          | Settles picks, writes `prop_settlements`          |
| `IngestionAgent`        | External feeds        | Pulls odds data from providers (Optimal, etc.)    |

Agent heartbeats reported to `agent_health` table. Health tracked via
`get_pipeline_status` MCP tool.

---

## Temporal Workflows

- Temporal orchestrates long-running pick lifecycle workflows
- `apps/command-center/src/app/api/replay/route.ts` — replay endpoint
  (SPRINT-054, queued)
- Workflow clients use pattern from `apps/api/src/lib/workflow-registry/`
- Operator workflow registry: `apps/api/src/lib/workflow-registry/`

---

## Intelligence Modules

| Module      | Location                 | Capability                                                   |
| ----------- | ------------------------ | ------------------------------------------------------------ |
| CLV Engine  | `packages/intelligence/` | Consensus fair odds, edge calculation                        |
| Calibration | `packages/intelligence/` | Brier score, ECE, model calibration audit                    |
| Risk Engine | `apps/api/src/lib/risk/` | Kelly sizing, bankroll management, market-type exposure caps |
| Market Caps | `apps/api/src/lib/risk/` | Per-market-type exposure limits (Phase 3, 100%)              |

Math note: CLV uses a 2% vig approximation — directional for standard lines,
less reliable for heavily juiced lines.

---

## Canonical Tables

| Table                     | Status         | Writer                                 |
| ------------------------- | -------------- | -------------------------------------- |
| `unified_picks`           | **CANONICAL**  | `apps/api` via lifecycle adapters only |
| `participants`            | **CANONICAL**  | SGO Sync (players/teams)               |
| `participant_memberships` | **CANONICAL**  | SGO Sync (player-team links)           |
| `bridge_outbox`           | ACTIVE         | `apps/smart-form`                      |
| `agent_health`            | ACTIVE         | API Agents (heartbeat)                 |
| `prop_settlements`        | ACTIVE         | SettlementAgent                        |
| `daily_picks`             | **DEPRECATED** | NONE — do not use                      |
| `players`                 | **DEPRECATED** | NONE — use `participants`              |
| `teams`                   | **DEPRECATED** | NONE — use `participants`              |

---

## Pick Lifecycle Stages

Stages are derived from `unified_picks` field state via `deriveLifecycleStage`.
They are NOT stored directly — they are computed.

| Stage       | Condition                                                    |
| ----------- | ------------------------------------------------------------ |
| `CANCELLED` | `status === 'cancelled'`                                     |
| `VOID`      | `settlement_status === 'void'`                               |
| `DISPUTED`  | `settlement_status === 'disputed'`                           |
| `SETTLED`   | `settlement_status === 'settled'`                            |
| `BLOCKED`   | `blocked_reason` is non-null                                 |
| `FAILED`    | `failed_reason` is non-null                                  |
| `POSTED`    | `posted_to_discord = true` AND `discord_message_id` non-null |
| `QUEUED`    | `promotion_status === 'queued'`                              |
| `SUBMITTED` | default (none of the above)                                  |

Lifecycle adapters enforce idempotency at each transition.

---

## MCP Layer (VERIFIED — SPRINT-055)

Four MCP servers expose platform capabilities to Claude without raw DB/API
credentials:

| Server                   | Package                     | Key Tools                                                                                |
| ------------------------ | --------------------------- | ---------------------------------------------------------------------------------------- |
| `unit-talk-state`        | `packages/mcp-state`        | `get_pick`, `get_lifecycle_stage`, `get_settlement_records`, `list_picks`                |
| `unit-talk-intelligence` | `packages/mcp-intelligence` | `compute_clv`, `compute_calibration`, `get_model_performance`                            |
| `unit-talk-ops`          | `packages/mcp-ops`          | `get_pipeline_status`, `get_platform_health`, `get_slo_status`, `get_operator_workflows` |
| `unit-talk-decision`     | `packages/mcp-decision`     | `get_sprint_context`, `evaluate_routing_decision`, `get_governance_state`                |

All 4 servers verified at SPRINT-055. All field names in
`packages/mcp-*/src/schemas/`.

---

## Claude OS Role

Claude OS governs all AI-driven sprint execution. It is **100% complete** as of
SPRINT-056.

| Component                                  | Status   | Purpose                                              |
| ------------------------------------------ | -------- | ---------------------------------------------------- |
| COS-001: Ceiling Blueprint                 | COMPLETE | Model authority (Opus/Sonnet/Haiku selection)        |
| COS-002: Multi-LLM Orchestration Blueprint | COMPLETE | Parallel lane architecture                           |
| COS-003: Source-of-Truth Fix               | COMPLETE | Canonical phase doc authority                        |
| COS-004: Lane Model Rules                  | COMPLETE | `.claude/rules/07-lane-model.md`                     |
| COS-005: Finding Backlog Automation        | COMPLETE | `tools/claude-os/src/finding-backlog.ts`             |
| COS-006: LLM Routing Engine                | COMPLETE | `tools/claude-os/src/llm-router.ts`                  |
| COS-007: Sprint Close Validation           | COMPLETE | `routing-decision-validator.ts`, `sprint:close` gate |

Skills: `.claude/skills/` — pipeline-health, pick-trace, slo-report, edge-check
(4 observability skills, SPRINT-056).

---

## Roadmap — Layer/Phase Model

| Layer                      | Phases | Status                            |
| -------------------------- | ------ | --------------------------------- |
| Layer 1 — Foundation       | 0–5    | **COMPLETE**                      |
| Layer 2 — Operations       | 6–8    | **COMPLETE**                      |
| Layer 3 — Product Complete | 9–11   | **ACTIVE** (Phase 10 in progress) |
| Layer 4 — Intelligent Ops  | 12–14  | ~40%                              |

**Current position**: Layer 3 / Phase 10 — Command Center UX.

Active sprint queue: `SPRINT-054-LAYER3-PHASE10-REPLAY-ENDPOINT` (next), then
`SPRINT-057` (current).

---

## Key Invariants

1. **Single-writer**: All `unified_picks` writes via lifecycle adapters. Gate:
   `npm run lifecycle:single-writer -- --strict` (0 violations, 998 files
   scanned).
2. **Idempotency**: Submit (bet_slip_id dedup), Post (atomic claim WHERE
   false→true), Settle (atomic claim WHERE pending→settled).
3. **No static claims**: All status from health endpoints, DB, or CI. Never
   hardcode percentages.
4. **Proof discipline**: Every sprint completion requires proof artifacts in
   `out/sprints/<SPRINT>/<DATE>/`.
5. **Governed tag flow**: CI mints sprint tags from `governance/closeouts/*.md`.
   Humans must not create sprint tags.
6. **Fail closed**: MCP tools requiring `OPERATOR_TOKEN` return auth errors (not
   empty results) when token is missing.

---

## Current Known Constraints

- **SPRINT-054 (Replay Endpoint)**:
  `apps/command-center/src/app/api/replay/route.ts` has a TODO for
  `startWorkflow` call. Temporal wiring is pending.
- **External feeds**: Optimal provider returning 503 intermittently.
  IngestionAgent handles gracefully.
- **Discord bot intents**: Slash commands only (webhook posting unaffected).
- **`packages/observability` build**: Pre-existing `@opentelemetry/api`
  resolution issue — type-check passes; build is scoped to `apps/api` only.
- **Math approximation**: CLV engine uses 2% vig — directional accuracy, not
  exact for exotic lines.

---

## Infrastructure

- **Database**: Supabase (PostgreSQL)
- **Orchestration**: Temporal (workflow replay, long-running tasks)
- **Package manager**: pnpm (workspaces)
- **CI**: GitHub Actions (`.github/workflows/`)
- **Test runners**: Vitest (api: 978/978, claude-os: 532/532, command-center:
  29/29), Jest (api: 643/643)
- **Branch convention**: `sprint/<name>-###`
- **Tag convention**: `SPRINT-<NAME>-###` (CI-minted only)

---

## Relevant Truth Docs

| Doc                                              | Authority                                           |
| ------------------------------------------------ | --------------------------------------------------- |
| `docs/status/CURRENT_SYSTEM_STATUS.md`           | Subsystem health, infrastructure, agent compliance  |
| `docs/status/PHASE_STATUS.md`                    | Phase completion percentages (operational tracking) |
| `docs/status/NEXT_5_SPRINTS.md`                  | Sprint queue and priorities                         |
| `docs/status/DRIFT_REPORT.md`                    | Active drift items by severity                      |
| `docs/04_roadmap/layer_phase_execution_model.md` | Canonical Layer/Phase model (sprint classification) |
| `docs/06_status/current_phase.md`                | Tier 3 canonical current position                   |
| `CLAUDE_EXECUTION_CONTRACT.md`                   | Non-negotiable AI execution invariants              |
| `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`          | Sprint execution rules (authoritative)              |
