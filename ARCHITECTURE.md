# 🔭 Unit Talk – High-level Architecture

src/
├─ agents/ # All business agents extend BaseAgent
├─ shared/
│ ├─ types/ # Single source-of-truth type exports
│ └─ utils/ # Logger, ErrorHandler, helpers
├─ test/ # Mocks & harnesses
└─ docs/ # Architecture & contributor docs

css
Copy
Edit

* **Event-driven** – agents communicate via Commands & Events.
* **BaseAgent** – lifecycle, DI, metrics, health, retry, logging.
* **Shared types** – `@shared/types` path alias prevents drift.
* **Observability** – metrics → Prometheus, logs → Loki, traces → OTLP.

_Keep this file concise – link deeper docs from here._
