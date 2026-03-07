# System Overview

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-07 Sprint: SPRINT-DOCS-CANONICALIZATION-040

---

## Platform Summary

Unit Talk is a professional sports pick syndication platform. It ingests odds
data from multiple providers, grades picks using a multi-model scoring pipeline,
promotes top-tier picks through lifecycle gates, distributes them via Discord,
and settles against real outcomes.

The platform runs as a monorepo with 5 applications, 7 shared packages, and a
Temporal-orchestrated agent pipeline.

---

## Applications

| App            | Path                   | Purpose                                                     | Port                    |
| -------------- | ---------------------- | ----------------------------------------------------------- | ----------------------- |
| API            | `apps/api/`            | Backend API, agents, Temporal worker, lifecycle enforcement | 3010 (ext) → 3000 (int) |
| Command Center | `apps/command-center/` | Operations dashboard (READ-ONLY)                            | 3004 → 3015             |
| Dashboard      | `apps/dashboard/`      | Analytics frontend (READ-ONLY)                              | 3003 → 3000             |
| Discord Bot    | `apps/discord-bot/`    | Discord slash commands, tier system, onboarding             | —                       |
| Smart Form     | `apps/smart-form/`     | Ticket submission UI (writes to `bridge_outbox` ONLY)       | 3021                    |

## Shared Packages

| Package                  | NPM Name                   | Purpose                                                |
| ------------------------ | -------------------------- | ------------------------------------------------------ |
| `packages/config`        | `@unit-talk/config`        | Zod environment validation, fail-closed boot           |
| `packages/contracts`     | `@unit-talk/contracts`     | Centralized TypeScript type definitions                |
| `packages/data-access`   | `@unit-talk/data-access`   | Supabase client factory                                |
| `packages/distribution`  | `@unit-talk/distribution`  | Distribution channel interfaces (types only)           |
| `packages/intelligence`  | `@unit-talk/intelligence`  | Pure computation: devig, CLV, calibration, probability |
| `packages/observability` | `@unit-talk/observability` | OpenTelemetry tracing, structured logging              |
| `packages/shared`        | `@unit-talk/shared`        | Redis-backed autopilot freeze mechanism                |

## Infrastructure Services

| Service          | Port | Purpose                  |
| ---------------- | ---- | ------------------------ |
| Temporal Server  | 7233 | Workflow orchestration   |
| Temporal UI      | 8088 | Workflow visibility      |
| Redis            | 6379 | Caching, autopilot state |
| Prometheus       | 9090 | Metrics collection       |
| Grafana          | 3001 | Dashboards and alerting  |
| Supabase (cloud) | —    | PostgreSQL database      |

## Technology Stack

- **Runtime**: Node.js + TypeScript
- **Orchestration**: Temporal (workflows + activities)
- **Database**: Supabase (PostgreSQL)
- **Cache**: Redis
- **Monitoring**: Prometheus + Grafana + OpenTelemetry
- **Distribution**: Discord webhooks
- **Build**: pnpm monorepo
- **Container**: Docker Compose (dev), Kubernetes + ArgoCD (prod)

---

## Key Architectural Decisions

1. **Single-Writer Discipline**: All `unified_picks` writes go through lifecycle
   adapters with role-based authority
2. **Temporal Orchestration**: All agent activities registered on a single
   worker, invoked via `proxyActivities<T>()`
3. **Fail-Closed Boot**: Missing env vars or schema drift prevents startup
4. **Provider Failover**: DataSourceRouter handles primary→fallback internally
   (Optimal → OddsAPI)
5. **Lifecycle FSM**: Picks progress through canonical stages:
   `raw_prop → normalized_market → scored_prop → promoted_pick → distributed_pick → settled_pick`

---

## Related Documents

- [Canonical Runtime Path](./CANONICAL_RUNTIME_PATH.md)
- [Current System Status](./CURRENT_SYSTEM_STATUS.md)
- [Architecture Contracts](../../architecture/CONSTITUTION_v1.0.md)
- [Pick Lifecycle Contract](../contracts/PICK_LIFECYCLE_CONTRACT.md)
- [Agent Registry](../../apps/api/AGENT_REGISTRY.md)
