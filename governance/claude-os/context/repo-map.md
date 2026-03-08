# CLAUDE OS — Repository Map

**Version**: 1.0.0 **Purpose**: Oriented reference for Claude OS execution.
Describes where things live and what they do.

> **Convention**: Items marked with `[VERIFY]` should be confirmed against the
> actual repo before relying on specific file paths or internal structure.

---

## Top-Level Structure

```
unit-talk-production/
├── apps/                    # Runtime applications
├── packages/                # Shared packages (monorepo)
├── docs/                    # Governance and architecture documentation
├── governance/              # Claude OS governance framework
├── out/                     # Sprint artifacts (gitignored)
├── supabase/                # Supabase config and migrations
├── scripts/                 # Repo-level scripts
├── tools/                   # Development and governance tooling
├── .claude/                 # Claude session configuration
├── CLAUDE.md                # Primary Claude operating rules
├── CLAUDE_EXECUTION_CONTRACT.md  # Hard law
└── runtime_config/          # Runtime configuration state
```

---

## Applications (`apps/`)

| App                    | Responsibility                                                  | Write Authority                                                | Change Risk                     |
| ---------------------- | --------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------- |
| `apps/api/`            | Backend API, Agents, Grading, Settlement, Lifecycle enforcement | **CANONICAL WRITER** to `unified_picks` via lifecycle adapters | **HIGH** -- core runtime        |
| `apps/command-center/` | Operations dashboard                                            | **READ-ONLY** -- no writes to business tables                  | Medium -- UI only               |
| `apps/dashboard/`      | Analytics frontend                                              | **READ-ONLY** -- no writes to business tables                  | Medium -- UI only               |
| `apps/discord-bot/`    | Discord integration and delivery                                | Posts via distribution layer                                   | High -- user-facing delivery    |
| `apps/smart-form/`     | Ticket/pick submission UI                                       | Writes to `bridge_outbox` ONLY                                 | Medium -- ingestion entry point |

### API Internal Structure `[VERIFY]`

```
apps/api/src/
├── agents/           # Runtime agents (FeedAgent, GradingAgent, SettlementAgent)
├── activities/       # Temporal-style activities (ingestion, backfill)
├── api-server.ts     # Express server entry point
├── lib/              # Core libraries
│   └── lifecycle/    # Lifecycle adapters (single-writer enforcement)
├── services/         # Business logic services
├── runner/           # Script runners [VERIFY current state]
└── scripts/          # API-specific scripts [VERIFY current state]
```

---

## Shared Packages (`packages/`)

| Package                  | Responsibility               | Notes                           |
| ------------------------ | ---------------------------- | ------------------------------- |
| `packages/config`        | Shared configuration         | `[VERIFY]` internal structure   |
| `packages/contracts`     | Shared type contracts        | Cross-app type definitions      |
| `packages/data-access`   | Database access layer        | Supabase client utilities       |
| `packages/distribution`  | Discord distribution logic   | Embed building, channel routing |
| `packages/intelligence`  | Scoring/grading intelligence | Core analytics logic            |
| `packages/observability` | Logging, metrics, health     | Agent health reporting          |
| `packages/shared`        | Common utilities             | Shared helpers                  |

---

## Governance and Documentation (`docs/`)

### Contracts (`docs/contracts/`)

Formal contracts governing data formats, API boundaries, and behavior
expectations.

| Contract                          | Governs                                         |
| --------------------------------- | ----------------------------------------------- |
| `PICK_LIFECYCLE_CONTRACT.md`      | Pick state machine, lifecycle adapters          |
| `DISCORD_EMBED_CONTRACT.md`       | Discord embed format and delivery               |
| `PROMOTION_AUTHORITY_BOUNDARY.md` | Who can promote picks and under what conditions |
| `SMARTFORM_DATA_CONTRACT_V2.md`   | Smart Form submission data format               |
| `SEARCH_CATALOG_CONTRACT_V1.md`   | Search/catalog API contract                     |

### System Current State (`docs/system/current/`)

Living documentation of the system's current architectural state.

| Document                         | Describes                                    |
| -------------------------------- | -------------------------------------------- |
| `table-contracts.md`             | Table ownership, schemas, writer authorities |
| `runtime-dataflow.md`            | Canonical data movement at runtime           |
| `ingestion-source-of-truth.md`   | Provider ingestion canonical path            |
| `lifecycle-state-machine.md`     | Pick lifecycle state transitions             |
| `promotion-policy.md`            | Promotion rules and tier logic               |
| `agent-responsibility-matrix.md` | Agent role boundaries                        |
| `provider-normalization.md`      | Provider data normalization rules            |
| `ingestion-freshness-policy.md`  | Data freshness requirements                  |
| `*-migration-status.md`          | Various migration tracking docs              |

### Roadmap (`docs/roadmap/`)

| Document                                | Purpose                       |
| --------------------------------------- | ----------------------------- |
| `INTELLIGENCE_PIPELINE_SPRINT_ORDER.md` | Locked sprint execution order |

### Analysis (`docs/system/analysis/`)

| Document                 | Purpose                             |
| ------------------------ | ----------------------------------- |
| `system-gap-analysis.md` | Known gaps in system implementation |

---

## Claude OS Governance (`governance/claude-os/`)

```
governance/claude-os/
├── SYSTEM_LAWS.md              # Inviolable execution laws
├── blueprint/
│   └── CLAUDE_OS_BLUEPRINT_V1.md   # Master design document
├── context/
│   ├── context-manifest.json       # Truth loading manifest
│   ├── repo-map.md                 # This file
│   ├── architecture-summary.md     # Architecture overview for Claude
│   ├── dataflow-map.md             # Canonical data movement
│   └── package-ownership.json      # Machine-readable ownership
├── contracts/
│   ├── sprint-contract-template.md # Per-sprint boundary contract
│   ├── verification-contract.md    # What "verified" means
│   ├── artifact-contract.md        # Proof bundle requirements
│   └── fail-closed-rules.md        # Stop conditions
├── recipes/
│   ├── verification-recipes.json   # Verification commands/evidence
│   └── proof-recipes.json          # Proof requirements by sprint type
├── templates/
│   ├── sprint-plan-template.md     # Sprint planning format
│   ├── proof-bundle-template.md    # Proof bundle index format
│   └── verdict-template.md         # Sprint verdict format
└── agents/
    ├── architect-agent.md          # Sprint Architect role
    ├── implementer-agent.md        # Sprint Implementer role
    ├── verifier-agent.md           # Verifier role
    ├── proof-agent.md              # Proof Bundler role
    └── audit-agent.md              # Audit Sentinel role
```

---

## Sprint Artifacts (`out/`)

**Note**: `out/` is gitignored. Artifacts are local proof records.

```
out/
├── sprints/
│   └── <SPRINT-NAME-###>/
│       └── <YYYY-MM-DD>/
│           ├── proofs/           # Captured command outputs
│           ├── diffs/            # Code change diffs
│           ├── notes/            # Planning and investigation notes
│           └── SPRINT_CLOSEOUT_REPORT.md
└── session-baseline/
    └── <timestamp>/
        ├── baseline.json         # Structured diagnostics
        └── baseline-summary.md   # Human-readable summary
```

---

## Database Migrations (`supabase/`)

```
supabase/
├── migrations/          # Timestamped SQL migrations
│   └── YYYYMMDDHHMMSS_<description>.sql
└── config.toml          # Supabase project config [VERIFY]
```

---

## Claude Session Configuration (`.claude/`)

```
.claude/
├── agents/              # Agent role definitions (existing, pre-Claude OS)
├── rules/               # Modular rule files loaded per session
│   ├── 00-workflow.md
│   ├── 01-safety-and-proof.md
│   ├── 02-db-migrations.md
│   ├── 03-single-writer-and-idempotency.md
│   ├── 04-testing-and-verification.md
│   └── 05-output-formats.md
└── skills/              # Repeatable procedure definitions
```

---

## Tooling (`tools/` and `scripts/`)

| Path                | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `tools/governance/` | Governance enforcement scripts (sprint gate, etc.)  |
| `tools/huly-os/`    | Deprecated Huly stack (reference only, not running) |
| `tools/profile/`    | Profiling utilities `[VERIFY]`                      |
| `scripts/`          | Repo-level scripts (env guards, etc.)               |

---

## Runtime-Sensitive Areas

These areas require extra care during sprints:

| Area                          | Why Sensitive                                                    |
| ----------------------------- | ---------------------------------------------------------------- |
| `apps/api/src/lib/lifecycle/` | Single-writer enforcement -- changes here affect all pick writes |
| `apps/api/src/agents/`        | Runtime agents -- changes affect live data processing            |
| `apps/api/src/activities/`    | Ingestion/backfill -- changes affect data pipeline               |
| `packages/distribution/`      | Discord delivery -- changes affect user-visible output           |
| `packages/intelligence/`      | Scoring/grading -- changes affect pick quality                   |
| `supabase/migrations/`        | Schema changes -- irreversible in production                     |
| `runtime_config/`             | Runtime state -- changes affect live behavior                    |

---

## Key Files for Sprint Execution

| File                                                 | Role in Sprint                     |
| ---------------------------------------------------- | ---------------------------------- |
| `CLAUDE_EXECUTION_CONTRACT.md`                       | Hard law -- read first             |
| `CLAUDE.md`                                          | Operating rules -- read always     |
| `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`              | Sprint governance protocol         |
| `docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md` | Sprint ordering                    |
| `package.json` (root)                                | Workspace scripts and dependencies |
| `apps/api/package.json`                              | API-specific scripts               |
