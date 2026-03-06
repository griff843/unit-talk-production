# Blueprint v2 → Repository Mapping

> **Sprint**: SPRINT-REPO-TRUTH-LOCK-002 **Status**: AUTHORITATIVE **Last
> Updated**: 2026-03-06

This document maps every service, package, and platform component declared in
the Blueprint v2 (`docs/blueprints/UNIT_TALK_MASTER_SYSTEM_BLUEPRINT_v2.0.md`)
to its actual location in the repository. Use this to find where things live.

---

## Applications

| Blueprint Name         | Repo Path              | Status | Notes                                         |
| ---------------------- | ---------------------- | ------ | --------------------------------------------- |
| API (Canonical Writer) | `apps/api/`            | ACTIVE | Monolith — contains agents, services, scoring |
| Command Center         | `apps/command-center/` | ACTIVE | Read-only ops dashboard                       |
| Dashboard              | `apps/dashboard/`      | ACTIVE | Analytics frontend                            |
| Discord Bot            | `apps/discord-bot/`    | ACTIVE | Slash commands, interactions                  |
| Smart Form             | `apps/smart-form/`     | ACTIVE | Ticket submission, writes to bridge_outbox    |

---

## Packages

| Blueprint Name | Repo Path                 | Status      | Notes                                                                    |
| -------------- | ------------------------- | ----------- | ------------------------------------------------------------------------ |
| contracts      | `packages/contracts/`     | ACTIVE      | Renamed from shared-types (this sprint)                                  |
| shared         | `packages/shared/`        | ACTIVE      | Renamed from shared-utils (this sprint)                                  |
| config         | `packages/config/`        | ACTIVE      | Zod env validation                                                       |
| observability  | `packages/observability/` | ACTIVE      | Renamed from telemetry (this sprint)                                     |
| intelligence   | `packages/intelligence/`  | ACTIVE      | Probability layer (devigConsensus, probabilityLayer, calibrationCompute) |
| distribution   | `packages/distribution/`  | TYPES-ONLY  | Distribution channel interfaces and payload types                        |
| data-access    | `packages/data-access/`   | ACTIVE      | Supabase client factory (`createSupabaseClientFromConfig`)               |
| ui             | —                         | NOT CREATED | Blueprint v2 Phase 2; no immediate need                                  |
| event-kit      | —                         | NOT CREATED | Blueprint v2 Phase 2; no immediate need                                  |
| risk-engine    | —                         | NOT CREATED | Blueprint v2 Phase 3; depends on intelligence                            |
| automation     | —                         | NOT CREATED | Blueprint v2 Phase 4                                                     |

---

## Platform Services (declared in Blueprint v2)

These are currently trapped inside `apps/api/src/`. Blueprint v2 envisions them
as separate deployable services. Current locations listed for reference.

| Blueprint Service           | Current Location                                           | Extraction Status                                                |
| --------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| Scoring Engine              | `apps/api/src/agents/GradingAgent/scoring/`                | See SCORING_AUTHORITY.md                                         |
| Edge Engine                 | `apps/api/src/agents/ScoringAgent/scoring/edgeEngineV1.ts` | In API monolith                                                  |
| Risk Domain                 | `apps/api/src/services/risk/`                              | Consolidated (RiskEngine, PortfolioRiskManager, edge-validation) |
| CLV Compute                 | `apps/api/src/services/CLVComputeService.ts`               | In API monolith                                                  |
| Shadow Scoring              | `apps/api/src/services/ShadowScoringService.ts`            | In API monolith                                                  |
| Settlement Engine           | `apps/api/src/agents/SettlementAgent/`                     | In API monolith                                                  |
| Feed Pipeline               | `apps/api/src/agents/FeedAgent/`                           | In API monolith                                                  |
| Discord Posting             | `apps/api/src/agents/DiscordPromotionAgent/`               | In API monolith                                                  |
| Notification Service        | `apps/api/src/agents/NotificationAgent/`                   | In API monolith                                                  |
| Professional Prop Processor | `apps/api/src/services/ProfessionalPropProcessor.ts`       | In API monolith                                                  |
| Market Offer Aggregator     | `apps/api/src/services/MarketOfferAggregator.ts`           | In API monolith                                                  |
| Bridge Worker               | `apps/api/src/agents/BridgeWorker/`                        | In API monolith                                                  |
| Lifecycle Adapters          | `apps/api/src/lib/lifecycle/`                              | In API monolith                                                  |

---

## Agents (Production)

| Agent                 | Location                                     | Category              |
| --------------------- | -------------------------------------------- | --------------------- |
| GradingAgent          | `apps/api/src/agents/GradingAgent/`          | Business Intelligence |
| ScoringAgent          | `apps/api/src/agents/ScoringAgent/`          | Business Intelligence |
| SettlementAgent       | `apps/api/src/agents/SettlementAgent/`       | Lifecycle             |
| DiscordPromotionAgent | `apps/api/src/agents/DiscordPromotionAgent/` | Lifecycle             |
| FeedAgent             | `apps/api/src/agents/FeedAgent/`             | Data Pipeline         |
| NotificationAgent     | `apps/api/src/agents/NotificationAgent/`     | Operational           |
| AnalyticsAgent        | `apps/api/src/agents/AnalyticsAgent/`        | Business Intelligence |
| AlertAgent            | `apps/api/src/agents/AlertAgent/`            | Operational           |
| RecapAgent            | `apps/api/src/agents/RecapAgent/`            | Business Intelligence |
| AuditAgent            | `apps/api/src/agents/AuditAgent/`            | Operational           |
| IngestionAgent        | `apps/api/src/agents/IngestionAgent/`        | Data Pipeline         |
| PlayerEnrichmentAgent | `apps/api/src/agents/PlayerEnrichmentAgent/` | Data Pipeline         |
| BridgeWorker          | `apps/api/src/agents/BridgeWorker/`          | Data Pipeline         |
| DataAgent             | `apps/api/src/agents/DataAgent/`             | Operational           |
| OperatorAgent         | `apps/api/src/agents/OperatorAgent/`         | Operational           |

## Agents (Archived)

Experimental/stub agents moved to `apps/api/src/agents/_archived/` in
SPRINT-REPO-TRUTH-LOCK-002:

AutomatedOnboardingAgent, CampaignAgent, ContestAgent, DataLifecycleAgent,
EligibilityAgent, FeedbackLoopAgent, MarketingAgent,
PerformanceOptimizationAgent, PredictiveAnalyticsAgent, ProjectionAgent,
ReferralAgent, RiskManagementAgent, UserRetentionAgent, V3ScoringAdapter

---

## Key Architecture Files

| File                                        | Purpose                                          |
| ------------------------------------------- | ------------------------------------------------ |
| `pnpm-workspace.yaml`                       | Monorepo workspace definition                    |
| `tsconfig.base.json`                        | Root TypeScript config with package path aliases |
| `docker-compose.yml`                        | Local development stack                          |
| `docs/SYSTEM_INVARIANTS.md`                 | 10 permanent system rules                        |
| `docs/contracts/PICK_LIFECYCLE_CONTRACT.md` | Pick state machine                               |
| `docs/architecture/SCORING_AUTHORITY.md`    | Canonical scorer map                             |
| `CLAUDE.md`                                 | Root AI governance                               |
| `CLAUDE_EXECUTION_CONTRACT.md`              | Hard law for AI operations                       |

---

## Legend

| Status          | Meaning                                                           |
| --------------- | ----------------------------------------------------------------- |
| ACTIVE          | Package/app exists and is in use                                  |
| TYPES-ONLY      | Package exports type definitions only; no runtime logic yet       |
| SHELL           | Package exists with stub index.ts; awaiting content extraction    |
| NOT CREATED     | Declared in Blueprint v2 but no directory exists yet              |
| Consolidated    | Previously scattered code gathered into a single domain directory |
| In API monolith | Code exists inside apps/api/; not yet extracted to a package      |
