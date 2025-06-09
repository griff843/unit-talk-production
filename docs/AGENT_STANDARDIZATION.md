# Agent Standardization Guide

This document explains the **“Fully Standardized”** agent pattern adopted across the `unit-talk-production` codebase.  
Follow these guidelines when building **new agents** or refactoring legacy ones so that all services behave the same way in production, testing, and during Temporal workflow execution.

---

## 1  Why Standardize?

* Consistent lifecycle hooks simplify onboarding and reviews.  
* Shared **metrics**, **health checks**, and **error handling** enable unified observability.  
* Predictable **Temporal workflow** signatures make orchestration trivial.  
* Re-usable dependency bundle (Supabase, logger, errorHandler) eliminates boilerplate.

---

## 2  The `BaseAgent` Contract

All business agents extend `BaseAgent` (`src/agents/BaseAgent/index.ts`).

### 2.1  Public Lifecycle

Method | Responsibility
------ | --------------
`start()` | Validate state → `initialize()` → mark `running` → spawn safe loop `process()` every metrics interval.
`stop()`  | Transition to `stopping` → `cleanup()` → mark `stopped`.

> **Never** override `start/stop` – only implement the protected hooks.

### 2.2  Required Protected Hooks

```ts
protected async initialize(): Promise<void>;
protected async process():    Promise<void>;
protected async cleanup():    Promise<void>;

protected async checkHealth():   Promise<HealthStatus>;
protected async collectMetrics(): Promise<BaseMetrics>;
```

### 2.3  Standard Config & DI

```ts
interface BaseAgentDependencies {
  supabase: SupabaseClient;
  logger:   Logger;
  errorHandler: ErrorHandler;
}
```

`BaseAgentConfig` provides toggles for `metrics`, `health`, and `retry` behaviour.  
Each concrete agent passes its own default config inside `getInstance()`.

---

## 3  Observability Pattern

### 3.1  Metrics

* Import helpers from `services/metricsServer.ts`.
* Register **Counters**, **Gauges**, and **Histograms** in the agent file.
* Start the exporter once per-agent:

```ts
if (!this.metricsStarted) startMetricsServer(900X);
```

* Extend `BaseMetrics` with namespaced keys

```
'custom.activePromos'
'custom.propsIngested'
```

### 3.2  Health Checks

Implement `checkHealth()` to return

```ts
{
  status: 'healthy' | 'degraded' | 'unhealthy',
  timestamp: ISO,
  details: { errors?: string[]; warnings?: string[]; metrics?: {...} }
}
```

Common rules:
* Unreachable DB → `unhealthy`
* High error rate or stale run → `degraded`

---

## 4  Centralised Error Handling

* Call `this.deps.errorHandler.handleError(err, context)`.
* Increment `errorCounter` and push onto `errorList` to expose via metrics.
* Wrap long tasks with `durationHistogram.startTimer()`.

---

## 5  Temporal Workflow Integration

Each agent exposes a **thin activity layer** (`src/agents/<Agent>/activities/*`) used by workflows in `src/workflows`.

Pattern:

```ts
const promoActivities = proxyActivities<PromoAgentActivities>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 3, backoffCoefficient: 2 }
});
```

Workflows orchestrate business steps but delegate logic to the agent class, giving:

* Deterministic retry & timeout semantics
* Single place for business rules (the agent)
* Easy unit tests for activities

---

## 6  Concrete Standardization Examples

### 6.1  IngestionAgent

* **process()** fetches raw props → validates → normalizes → inserts.  
* Metrics: `propsIngested`, `propsSkipped`, `propsInvalid`.  
* Health degrades if loop hasn’t executed within 24h.

### 6.2  FinalizerAgent

* Finalizes graded picks that meet quality thresholds.  
* Uses `finalizedCounter`, publishes results, and performs publication via activities.  

### 6.3  PromoAgent

* Demonstrates **complex metrics** (counters + gauges) and multi-phase timers (`execute_promotion`, `apply_discounts`).  
* Health warns on zero active promotions or high error rate.

### 6.4  ReferralAgent

* Tracks referral lifecycle, conversion, reward issuance.  
* Exposes `conversionRateGauge`.  
* Workflows: `referralWorkflow`, `referralStatusWorkflow`, `referralRewardWorkflow`.

### 6.5  RecapAgent

* Generates daily recap report with streaks, ROI, MVP logic.  
* Reads `final_picks`, writes `daily_recaps`.  
* No continuous loop – `process()` schedules a single recap per run.

### 6.6  GradingAgent

* Implements **25-Point Model**.  
* Adds advanced scoring components (margin adjustment, contextual bonus, penalties, volatility).  
* Metrics derived from graded picks within 24h.

### 6.7  PromotionAgent

* Promotes picks from `graded_picks` to daily display.  
* Metrics server on port 9001; custom metric `promotions24h`.

---

## 7  Checklist for New Agents

1. **Subclass** `BaseAgent`.
2. Provide a `getInstance(deps)` singleton with default config.
3. Implement all six protected hooks.
4. Define **metrics** in `prom-client`; expose at unique port (900X).
5. Populate **health** logic covering:
   * DB connectivity
   * Recent run freshness
   * Error thresholds
6. Wrap risky blocks with `errorHandler` & `durationHistogram`.
7. Add **activities** file exposing minimal functions.
8. Create **Temporal workflow** in `src/workflows` using proxy pattern.
9. Add unit & integration tests under `src/agents/<Agent>/__tests__`.
10. Update docs & dashboards.

---

## 8  Troubleshooting FAQ

**Q:** Agent reports `degraded` but works.  
**A:** Verify `lastRunTimestamp` and error counts; thresholds may be too strict.

**Q:** Prometheus shows duplicate metric registration.  
**A:** Ensure metrics are created **outside loops** and guarded by the `metricsStarted` flag.

**Q:** Workflow stuck retrying activity.  
**A:** Check activity timeout values and database locks inside the agent logic.

---

## 9  Resources

* ADR 001 – Agent Architecture  
* `docs/agent-development-sop.md` – SOP for new agents  
* Temporal docs – https://docs.temporal.io  
* Prom-client – https://github.com/siimon/prom-client  

---

**Adopt these patterns and every new agent will be production-ready from day one.**
