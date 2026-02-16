# CLAUDE.md - Unit Talk API

> **Governance**: See [../../CLAUDE.md](../../CLAUDE.md) for Docker rules,
> secrets, database architecture, and service boundaries.

---

## Service Overview

The API is the backend service for the sports betting intelligence platform. It
provides agent orchestration, grading, settlement, and data pipeline.

---

## Service Boundaries

### This Service OWNS

- Agent orchestration (BaseAgent framework)
- Grading logic (GradingAgent, ProfessionalPropProcessor)
- Settlement processing (SettlementAgent)
- Data pipeline (FeedAgent, BridgeWorker)
- Temporal workflows

### This Service MUST NOT

- Serve UI assets
- Handle direct Discord interactions
- Define database schema (infrastructure concern)

---

## Development Commands

```bash
# Development
docker-compose exec api npm run start:dev
docker-compose exec api npm run worker:dev

# Build
docker-compose exec api npm run build

# Type check
docker-compose exec api npm run type-check

# Test
docker-compose exec api npm test
docker-compose exec api npm run test:unit
docker-compose exec api npm run test:integration

# Lint
docker-compose exec api npm run lint
```

---

## Agent System

All agents extend `BaseAgent` from `src/agents/BaseAgent/`.

### Import Pattern

```typescript
import { BaseAgentConfig } from '@shared/types/base';
import { BaseAgent } from '../BaseAgent';
```

**Never redefine `BaseAgentConfig`** - always import from `@shared/types/base`.

### Agent Categories

**Business Intelligence:** GradingAgent, AnalyticsAgent, AlertAgent, FeedAgent,
RecapAgent

**Operational:** NotificationAgent, ContestAgent, PlayerEnrichmentAgent,
AuditAgent

### Agent Development

1. Extend `BaseAgent`
2. Implement health checks
3. Add Prometheus metrics
4. Use structured logging with correlation IDs

---

## Professional Grading Rules

### Core Standards

1. **Devigging**: Every odds source must be devigged
2. **CLV Tracking**: Every pick must have CLV tracking
3. **Professional Grading**: All picks through ProfessionalPropProcessor
4. **Kelly Sizing**: Optimal Kelly fraction for all picks

### Required Fields

| Field                | Requirement            |
| -------------------- | ---------------------- |
| `devigged_edge`      | Must be populated      |
| `clv_tracking_id`    | Must be populated      |
| `professional_score` | Must be populated      |
| `kelly_fraction`     | > 0 for approved picks |

### Prohibitions

- No raw odds without devigging
- No picks without CLV tracking
- No manual grading bypasses

---

## BridgeWorker

Consumes events from `bridge_outbox` table.

```bash
BRIDGE_OUTBOX_POLL_INTERVAL=10000
BRIDGE_OUTBOX_BATCH_SIZE=10
ENABLE_BRIDGE_OUTBOX=true
```

- Idempotent processing by `bet_slip_id`
- Exponential backoff: 1min, 5min, 15min
- Circuit breaker for external failures

---

## Temporal Workflows

### EventDrivenGradingWorkflow

- Individual leg processing
- Professional grading features
- Circuit breaker protection
- Automatic retry

### Key Activities

- `validateEventData`
- `processIndividualLeg`
- `applyProfessionalGrading`
- `generateAlerts`

---

## Settlement

### Rules

1. Only `SettlementAgent` writes to settlement columns
2. Settlement fields are immutable after set
3. Settlement source must be valid
4. Settlement confidence: 0.0-1.0

### Single-Writer Enforcement

`prop_settlements` table: Only SettlementAgent

---

## Troubleshooting

```bash
# Debug agent
docker-compose exec api bash -c "DEBUG=agent:* npx tsx src/runner/testAllAgents.ts"

# Health check
docker-compose exec api npm run health:check

# Database status
docker-compose exec api npm run db:status
```

---

**Status**: See CI/CD pipelines
