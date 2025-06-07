# 🔭 Unit Talk – High-Level Architecture

```txt
src/
 ├─ agents/          # Business agents – always extend BaseAgent
 ├─ shared/
 │    ├─ types/      # Single source-of-truth type exports
 │    └─ utils/      # Logger, ErrorHandler, helpers
 ├─ test/            # Mocks, fixtures, harnesses
 └─ docs/            # Architecture & contributor docs
```

Event-driven – agents communicate via Commands & Events.

BaseAgent v2 – lifecycle, DI, metrics, health, retry, logging.

Shared types – @shared/types/* path alias prevents drift.

Observability – metrics → Prometheus, logs → Loki, traces → OTLP.

Keep this file concise – link deeper docs from here. 