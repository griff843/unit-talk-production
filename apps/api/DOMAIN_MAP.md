# API Domain Map

> **Sprint**: SPRINT-REPO-TRUTH-LOCK-002 **Last Updated**: 2026-03-06

Maps every top-level folder in `apps/api/src/` to its Blueprint v2 domain.

---

## Data Pipeline

| Folder                   | Purpose                                       | Key Files                          |
| ------------------------ | --------------------------------------------- | ---------------------------------- |
| `agents/IngestionAgent/` | Raw prop fetching, validation, dedup          | `index.ts`, `fetchRawProps.ts`     |
| `agents/FeedAgent/`      | Public prop normalization, market aggregation | `index.ts`, `oddsApi.ts`           |
| `logic/providers/`       | Multi-source provider integration             | `sgoFetcher.ts`, `marketAdapters/` |
| `consumers/`             | Temporal event-driven consumption             | Consumer activities                |

## Intelligence / Scoring

| Folder                 | Purpose                                       | Key Files                                  |
| ---------------------- | --------------------------------------------- | ------------------------------------------ |
| `agents/GradingAgent/` | Multi-model ensemble scoring, tier assignment | `GradingAgent.ts`, `scoring/`              |
| `agents/ScoringAgent/` | Real-time edge scoring, probability           | `index.ts`, `scoring/edgeScoring.ts`       |
| `lib/probability/`     | Devig, consensus, calibration                 | `devigConsensus.ts`, `probabilityLayer.ts` |
| `analysis/`            | Edge validation, signals, model analysis      | `edge-validation/`, `signals/`, `models/`  |
| `scoring/`             | Scoring utilities                             | Edge scoring                               |

## Lifecycle

| Folder                          | Purpose                                      | Key Files                         |
| ------------------------------- | -------------------------------------------- | --------------------------------- |
| `lib/lifecycle/`                | Single-writer enforcement, state transitions | `index.ts`, `writer-authority.ts` |
| `agents/DiscordPromotionAgent/` | Posting picks to Discord, receipt tracking   | `index.ts`                        |
| `agents/SettlementAgent/`       | Settlement via atomic claims                 | `index.ts`                        |

## Distribution

| Folder                          | Purpose                         | Key Files      |
| ------------------------------- | ------------------------------- | -------------- |
| `agents/DiscordPromotionAgent/` | Discord channel posting         | Embed builders |
| `agents/NotificationAgent/`     | Multi-channel notifications     | `index.ts`     |
| `agents/RecapAgent/`            | Daily/weekly performance recaps | `index.ts`     |
| `services/publishOutbox.ts`     | Idempotent outbox publishing    | Outbox pattern |

## Risk

| Folder                           | Purpose                                 | Key Files                                |
| -------------------------------- | --------------------------------------- | ---------------------------------------- |
| `services/risk/`                 | Portfolio risk, exposure, drift, alerts | `RiskEngine.ts`, `ExposureCalculator.ts` |
| `services/risk/edge-validation/` | Calibration, CLV robustness, ROI sim    | 5 files                                  |
| `risk/`                          | Kelly criterion, VaR calculations       | `enhanced-risk-manager.ts`               |

## Business Logic (Pick Engine)

| Folder                                  | Purpose                            | Key Files                                                   |
| --------------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| `pick-engine/`                          | Pick selection, promotion pipeline | `pick-engine.ts`, `promotion-pipeline.ts`, `pick-policy.ts` |
| `services/ProfessionalPropProcessor.ts` | Professional capper processing     | Single file                                                 |
| `services/MarketOfferAggregator.ts`     | Multi-book offer consolidation     | Single file                                                 |
| `services/CLVComputeService.ts`         | Closing line value computation     | Single file                                                 |
| `services/ShadowScoringService.ts`      | Experimental scoring variants      | Single file                                                 |
| `services/ClosingSnapshotService.ts`    | Closing line snapshots             | Single file                                                 |

## Infrastructure

| Folder                       | Purpose                             | Key Files                     |
| ---------------------------- | ----------------------------------- | ----------------------------- |
| `config/`                    | Environment, feature flags, routing | Discord routing, env config   |
| `db/`                        | Database utilities, query builders  | Supabase helpers              |
| `middleware/`                | Express middleware (auth, logging)  | Auth, error handling          |
| `monitoring/`                | Agent health checks, metrics        | Health monitoring             |
| `security/`                  | Authentication, authorization       | Auth utilities                |
| `cache/`                     | Redis integration                   | Cache management              |
| `utils/`                     | Shared utilities, logger            | Logger, helpers               |
| `types/`                     | Domain model type definitions       | Schema types                  |
| `shared/`                    | Cross-service definitions           | Shared types                  |
| `routes/`                    | REST API surface                    | `ops.ts`, API endpoints       |
| `services/logging.ts`        | Structured logging                  | Logger setup                  |
| `services/supabaseClient.ts` | Canonical Supabase client           | Uses `@unit-talk/data-access` |

## Execution / Orchestration

| Folder        | Purpose                         | Key Files                          |
| ------------- | ------------------------------- | ---------------------------------- |
| `temporal/`   | Temporal workflow orchestration | Workflow definitions               |
| `workflows/`  | Workflow implementations        | `smartFormWorkflow.ts`, schedulers |
| `workers/`    | Activity executors              | Worker implementations             |
| `activities/` | Temporal activities             | Activity definitions               |
| `runner/`     | Test execution utilities        | Development only                   |
| `scripts/`    | Analysis and backfill scripts   | Development only                   |

## Operational Agents

| Folder                          | Purpose                           | Key Files                     |
| ------------------------------- | --------------------------------- | ----------------------------- |
| `agents/AlertAgent/`            | Line movement, hedge alerts       | `index.ts`, `adviceEngine.ts` |
| `agents/AnalyticsAgent/`        | ROI tracking, performance metrics | `index.ts`, `activities.ts`   |
| `agents/AuditAgent/`            | Audit logging, compliance         | `index.ts`                    |
| `agents/DataAgent/`             | Data sync, cache management       | `index.ts`                    |
| `agents/OperatorAgent/`         | Manual corrections, overrides     | `index.ts`                    |
| `agents/PlayerEnrichmentAgent/` | Player metadata enrichment        | `index.ts`                    |

## Experimental / Development

| Folder              | Purpose                    | Status           |
| ------------------- | -------------------------- | ---------------- |
| `shadow/`           | Shadow scoring experiments | Experimental     |
| `ai/`               | LLM/AI endpoints           | Experimental     |
| `ml/`               | ML model integration       | Experimental     |
| `load-balancer/`    | Request distribution       | Experimental     |
| `portfolio/`        | Portfolio analysis tools   | Experimental     |
| `commands/`         | CLI commands               | Development only |
| `test/`, `tests/`   | Test suites                | Tests            |
| `agents/_archived/` | 14 archived agents         | Deprecated       |

## Legacy / Unclear

| Folder       | Purpose               | Notes                          |
| ------------ | --------------------- | ------------------------------ |
| `api/`       | Additional API routes | Overlaps with `routes/`        |
| `core/`      | Core abstractions     | Unclear boundary with `lib/`   |
| `handlers/`  | Event handlers        | Overlaps with `consumers/`     |
| `promotion/` | Pick promotion        | Superseded by `pick-engine/`   |
| `analytics/` | Analytics utilities   | Overlaps with `AnalyticsAgent` |
