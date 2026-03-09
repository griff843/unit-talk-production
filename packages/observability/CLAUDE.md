# CLAUDE.md - Observability Package

> **Sprint**: SPRINT-REPO-TRUTH-LOCK-002 **Status**: AUTHORITATIVE **Role**:
> OBSERVABILITY **Last Updated**: 2026-03-06

---

## Overview

The observability package provides OpenTelemetry instrumentation for distributed
tracing, structured logging, and synthetic canary monitoring.

---

## Package Boundaries

### This Package OWNS

- OpenTelemetry SDK configuration (`UnitTalkTelemetry`)
- Business operation span helpers (`UnitTalkTracing`)
- Structured logging factory (`createLogger`)
- Trace context propagation and middleware
- Synthetic canary framework (`SyntheticCanary`)

### This Package MUST NOT

- Contain business logic
- Define service-specific metrics (services own their metrics)
- Store sensitive data in traces

---

## Key Exports

```typescript
// Telemetry initialization
import {
  UnitTalkTelemetry,
  getDefaultTelemetry,
  telemetry,
  type TelemetryConfig,
} from '@unit-talk/observability';

// Business operation tracing
import { UnitTalkTracing } from '@unit-talk/observability';

// Logging
import {
  createLogger,
  type Logger,
  type LogLevel,
} from '@unit-talk/observability';

// Middleware & context
import {
  traceMiddleware,
  getCurrentTraceId,
  getCurrentSpanContext,
  withTraceContext,
} from '@unit-talk/observability';

// Synthetic canary
import { SyntheticCanary, type CanaryConfig } from '@unit-talk/observability';

// OpenTelemetry re-exports
import { trace, context, propagation } from '@unit-talk/observability';
```

---

## Usage Pattern

### Service Initialization

```typescript
import { getDefaultTelemetry } from '@unit-talk/observability';

// Lazy-initialized singleton (reads env at first call)
const telemetry = getDefaultTelemetry();
telemetry.initialize();
```

### Creating Spans

```typescript
import { UnitTalkTracing } from '@unit-talk/observability';

const span = UnitTalkTracing.startPropProcessingSpan('scoring', propId);
try {
  const result = await scoreProp(prop);
  UnitTalkTracing.recordSuccess(span, { duration: Date.now() - start });
} catch (error) {
  UnitTalkTracing.recordError(span, error as Error);
} finally {
  span.end();
}
```

### Logging

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

## Adoption Status

| App            | Status  | Notes                                                        |
| -------------- | ------- | ------------------------------------------------------------ |
| API            | ADOPTED | `createLogger` in 98 files, `getDefaultTelemetry` at startup |
| Command Center | PARTIAL | Local mock `telemetry.ts` stub                               |
| Discord Bot    | NONE    | No telemetry (lightweight service)                           |
| Smart Form     | NONE    | No telemetry (frontend only)                                 |

---

**Document Owner**: Engineering Team **Last Audit**: SPRINT-REPO-TRUTH-LOCK-002
