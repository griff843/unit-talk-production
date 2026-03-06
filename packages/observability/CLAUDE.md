# CLAUDE.md - Observability Package

> **Sprint**: SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A **Status**: AUTHORITATIVE
> **Role**: OBSERVABILITY **Last Updated**: 2026-02-22

---

## Overview

The telemetry package provides OpenTelemetry instrumentation for distributed
tracing, metrics, and logging across all services.

---

## Package Boundaries

### This Package OWNS

- OpenTelemetry configuration
- Trace context propagation
- Prometheus metrics registration
- Structured logging utilities

### This Package MUST NOT

- Contain business logic
- Define service-specific metrics (services own their metrics)
- Store sensitive data in traces

---

## Key Exports

```typescript
// Tracing
import { initTracing, getTracer, withSpan } from '@unit-talk/observability';

// Metrics
import {
  initMetrics,
  createCounter,
  createHistogram,
} from '@unit-talk/observability';

// Logging
import { createLogger, withCorrelationId } from '@unit-talk/observability';
```

---

## Usage Pattern

### Service Initialization

```typescript
import { initTracing, initMetrics } from '@unit-talk/observability';

// At service startup
initTracing({
  serviceName: 'api',
  endpoint: process.env.OTEL_EXPORTER_ENDPOINT,
});

initMetrics({
  serviceName: 'api',
  port: 9090,
});
```

### Creating Spans

```typescript
import { withSpan } from '@unit-talk/observability';

const result = await withSpan('processGrading', async span => {
  span.setAttribute('pickId', pickId);
  return await gradePick(pick);
});
```

### Logging with Correlation

```typescript
import { createLogger } from '@unit-talk/observability';

const logger = createLogger('GradingAgent');

logger.info('Processing pick', { pickId, correlationId });
```

---

## Metrics Endpoints

| Service | Port | Path       |
| ------- | ---- | ---------- |
| API     | 9090 | `/metrics` |
| Workers | 9091 | `/metrics` |

---

## Environment Variables

| Variable                 | Purpose                 | Default      |
| ------------------------ | ----------------------- | ------------ |
| `OTEL_EXPORTER_ENDPOINT` | OpenTelemetry collector | None         |
| `OTEL_SERVICE_NAME`      | Service identifier      | Package name |
| `PROMETHEUS_PORT`        | Metrics port            | 9090         |

---

## Development Commands

```bash
# Type check
pnpm --filter observability type-check

# Build
pnpm --filter observability build

# Test
pnpm --filter observability test
```

---

## References

- Root Governance: `../../CLAUDE.md`
- System Invariants: `../../docs/SYSTEM_INVARIANTS.md`

---

**Document Owner**: Engineering Team **Last Audit**:
SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A
