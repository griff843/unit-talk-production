# CLAUDE OS — Architecture Summary

**Version**: 1.0.0 **Purpose**: Concise architectural reference for Claude OS
execution context. This document provides the system shape, not implementation
details.

> Items marked `[VERIFY]` require confirmation against current repo state before
> relying on specifics.

---

## System Shape

Unit Talk is a sports intelligence platform built as a TypeScript monorepo. The
core loop is:

1. **Ingest** provider data (odds, lines, markets) into canonical tables.
2. **Grade** and score props using intelligence logic.
3. **Promote** top picks through a governed lifecycle.
4. **Deliver** picks to Discord as the primary user-facing surface.
5. **Settle** picks against outcomes with immutable results.

The platform is SaaS-first at its intelligence core. Discord is the primary
delivery surface today, but the architecture supports multiple distribution
channels.

---

## Operating Surfaces

| Surface                                    | Role                                                 | Technology                   |
| ------------------------------------------ | ---------------------------------------------------- | ---------------------------- |
| **API** (`apps/api`)                       | Core runtime: agents, grading, settlement, lifecycle | Node.js / Express / Supabase |
| **Discord Bot** (`apps/discord-bot`)       | User-facing delivery of picks and results            | Discord.js                   |
| **Smart Form** (`apps/smart-form`)         | Pick submission UI                                   | React / Next.js `[VERIFY]`   |
| **Command Center** (`apps/command-center`) | Operations dashboard (read-only)                     | React / Next.js `[VERIFY]`   |
| **Dashboard** (`apps/dashboard`)           | Analytics frontend (read-only)                       | React / Next.js `[VERIFY]`   |
| **Supabase**                               | PostgreSQL database + auth + storage                 | Hosted Supabase              |

---

## Canonical Data Movement

```
External Providers (ESPN, odds APIs, etc.)
    |
    v
Ingestion Activities (apps/api/src/activities/)
    |
    v
provider_offers (CANONICAL landing table)
    |                              raw_props (DEPRECATED — compatibility only)
    v
GradingAgent (scoring, tier assignment)
    |
    v
unified_picks (CANONICAL pick table, via lifecycle adapters ONLY)
    |
    v
FeedAgent (promotion, queue management)
    |
    v
Discord Distribution (packages/distribution)
    |
    v
Discord Channels (user-facing)
    |
    v
SettlementAgent (outcome resolution, immutable settlement)
```

**Critical invariants**:

- `provider_offers` is the canonical ingestion target. `raw_props` is deprecated
  compatibility.
- `unified_picks` is the canonical pick table. All writes go through lifecycle
  adapters.
- `daily_picks`, `players`, `teams` are deprecated. Use `unified_picks` and
  `participants`.
- Settlement results are immutable once written.

---

## Runtime Truth Principles

1. **Single-writer discipline**: Only `apps/api` writes to `unified_picks`, and
   only through lifecycle adapters (`lifecycleInsert`, `lifecycleUpdate`,
   `atomicClaimForPost`, `lifecycleSettle`).
2. **Idempotency**: All posting and settlement operations use atomic claim
   patterns. Replay produces no side effects.
3. **Immutability**: `settlement_result`, `settlement_hash`, and `closing_line`
   cannot be modified once set. Database triggers enforce this.
4. **Fail-closed**: Missing data, failed grading, or broken preconditions halt
   the pipeline rather than producing degraded output.

---

## Discord Delivery Model

Discord is the primary distribution surface:

- **Embeds**: Formatted pick cards with odds, analysis, and metadata. Governed
  by `DISCORD_EMBED_CONTRACT.md`.
- **Channels**: Picks route to specific channels based on tier and sport
  `[VERIFY routing logic]`.
- **Distribution package**: `packages/distribution` handles embed building and
  channel routing.
- **Posting flow**: FeedAgent selects picks -> atomicClaimForPost ->
  distribution builds embed -> Discord bot posts -> receipt stored on
  `unified_picks`.

---

## Governance and Ratification Model

| Layer                 | Instrument                              | Authority                          |
| --------------------- | --------------------------------------- | ---------------------------------- |
| **Hard law**          | `CLAUDE_EXECUTION_CONTRACT.md`          | Non-negotiable invariants          |
| **System invariants** | `docs/SYSTEM_INVARIANTS.md`             | Fail-open/fail-closed rules        |
| **Domain contracts**  | `docs/contracts/*.md`                   | Data format and behavior contracts |
| **System truth**      | `docs/system/current/*.md`              | Current architectural state        |
| **Sprint governance** | `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md` | Sprint execution protocol          |
| **Claude OS**         | `governance/claude-os/`                 | Execution layer governance         |
| **Workflow**          | Linear (UNI team)                       | Planning and visibility only       |
| **Ratification**      | GitHub PRs via `gh`                     | Human review and merge             |
| **Proof**             | `out/sprints/`                          | Forensic sprint evidence           |

---

## Major Architectural Dangers

These are the highest-risk failure modes. Claude OS must be designed to prevent
or detect them:

| Danger                                                               | Impact                                                | Mitigation                                                         |
| -------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ |
| **Direct writes to `unified_picks`** bypassing lifecycle adapters    | Data corruption, lost idempotency guarantees          | Single-writer gate (`npm run lifecycle:single-writer -- --strict`) |
| **New code targeting deprecated paths** (`raw_props`, `daily_picks`) | Extends technical debt, blocks migration              | Audit agent deprecated-path detection                              |
| **Silent fallback** in ingestion or grading                          | Wrong data propagates to users without visibility     | No-silent-fallback law, fail-closed gates                          |
| **Schema drift** between types and actual database                   | Runtime errors, data corruption                       | Drift detection in session baseline                                |
| **Build-time-only proof** for runtime changes                        | False confidence — build passes but runtime is broken | Build/runtime separation law                                       |
| **Merging without proof**                                            | Unverifiable claims of completion                     | Proof-before-ratification law                                      |
| **Linear overriding repo truth**                                     | Architecture divergence from ratified state           | Linear-not-truth law                                               |
| **Immutable field modification** (settlement_result, closing_line)   | Trust violation, incorrect outcomes                   | Database-level immutability triggers                               |
| **Cross-boundary writes** (smart-form writing to unified_picks)      | Bypasses lifecycle enforcement                        | Service boundary contracts                                         |

---

## Shared Package Roles

| Package                  | Architectural Role                                                |
| ------------------------ | ----------------------------------------------------------------- |
| `packages/contracts`     | Type definitions shared across apps — the schema contract layer   |
| `packages/data-access`   | Supabase client and query utilities — database access abstraction |
| `packages/distribution`  | Discord embed building and delivery routing                       |
| `packages/intelligence`  | Scoring, grading, and analytical logic — the intelligence core    |
| `packages/observability` | Logging, metrics, agent health — operational visibility           |
| `packages/config`        | Shared configuration `[VERIFY scope]`                             |
| `packages/shared`        | Common utilities `[VERIFY scope]`                                 |

---

## Agent Architecture

Runtime agents operate within `apps/api/src/agents/`:

| Agent               | Responsibility                            | Writes                                                     |
| ------------------- | ----------------------------------------- | ---------------------------------------------------------- |
| **FeedAgent**       | Prop ingestion, curation, promotion queue | `unified_picks` via lifecycle adapters                     |
| **GradingAgent**    | Score and grade props, assign tiers       | `unified_picks` via lifecycle adapters                     |
| **SettlementAgent** | Resolve outcomes, calculate results       | `unified_picks` via lifecycle adapters, `prop_settlements` |

All agent writes to `unified_picks` must use lifecycle adapters. This is
enforced by both code convention and the single-writer gate.
