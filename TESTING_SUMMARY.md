# Testing Summary

## Purpose

This document describes **how we test the Unit-Talk-Production monorepo**, with a special focus on the newly *fully-standardised* agents and the 25-Point Model.  
It should be read by every contributor before opening a pull-request.

---

## 1  Testing Pyramid

| Layer | Tooling                | Scope & Goal                                   |
|-------|------------------------|-----------------------------------------------|
| **Unit** | `jest`, `ts-jest`        | Verify isolated functions/classes (no I/O). |
| **Integration** | `jest` + test DB & mocks | Verify agent ↔ DB / external service interaction. |
| **End-to-End / Workflow** | Temporal test-worker harness | Validate full workflow orchestration & retries. |
| **Static** | `eslint`, `tsc`   | Linting & type-checking gate.                 |

Each PR **must** keep the pyramid green.

---

## 2  Standard Agent Test Suite

Every agent directory **MUST** contain:

| File/Folder                          | Required | Purpose |
|--------------------------------------|----------|---------|
| `__tests__/unit/*.test.ts`           | ✔        | Pure logic, no network. |
| `__tests__/integration/*.test.ts`    | ✔        | Real Supabase test instance or local pg container. |
| `__tests__/workflow/*.test.ts` (if applicable) | ✔ | Calls Temporal activities via the proxy. |
| `mocks/` or shared mocks             | ✔        | Stub Prom-client, logger, Supabase, openai. |

### Unit Assertions

* Class **extends `BaseAgent`**  
  `expect(agent).toBeInstanceOf(BaseAgent)`  
* Lifecycle hooks exist and resolve without throwing.
* Metrics/gauges increment correctly.
* Error paths call `errorHandler.handleError()` exactly once.

### Integration Assertions

* Inserts actually land in the test DB.
* Agent respects idempotency – running twice does **not** create duplicates.
* Health-check returns `healthy` when dependencies are reachable.

### Workflow Assertions

Use the temporal test-worker:

```ts
const result = await testWorker.runWorkflow(ingestionWorkflow, { dryRun: true });
expect(result.processed).toBeGreaterThan(0);
```

Validate:

* Retry policy triggers as configured.
* `ApplicationFailure` is thrown for non-retryable errors.

---

## 3  Running Tests Locally

```bash
# one-off
npm test                       # all unit tests
npm run test:integration       # integration only
# watch mode
npm run test:watch
```

### Useful flags

| Flag                         | Effect                              |
|------------------------------|-------------------------------------|
| `--testPathPattern=AgentX`   | Run subset                          |
| `--coverage`                 | Show coverage summary               |
| `--runInBand`                | Serial (debugging)                  |

---

## 4  CI Pipeline (GitHub Actions)

1. **agent-testing.yml** auto-detects changed agent folders.  
2. Matrix job runs **unit** ➜ **integration** ➜ **workflow** tests.  
3. Coverage reports are merged and uploaded (`coverage/`).  
4. JUnit XML is published for PR annotations.  
5. Slack alert summarises pass/fail.

A PR **fails** when:

* *any* test job fails.
* global coverage ↓ below thresholds (Branches ≥ 70 %, Lines ≥ 80 %).
* ESLint or type-check fails.

---

## 5  Maintaining High Coverage

* **Rule of thumb:** code under `src/agents` must stay **≥ 85 % lines**.  
* Add tests **with** new features – never in a later PR.
* When refactoring, run `npm test -- --coverage && npx nyc report` to verify.
* Complex branches → write **happy** & **edge** tests.
* Use **fixtures/mocks** for large JSON payloads (keep tests fast).

---

## 6  Adding Tests for a New Agent

1. Copy `__tests__/unit` & `__tests__/integration` skeletons from `ReferralAgent`.
2. Ensure mocks cover:
   * `prom-client`
   * `metricsServer`
   * Supabase RPCs used.
3. Update **jest `moduleNameMapper`** if the agent brings new externals.
4. Register directory-specific coverage threshold in `jest.config.js`.

---

## 7  Troubleshooting

| Symptom                                           | Likely Cause / Fix                                   |
|---------------------------------------------------|------------------------------------------------------|
| `jest: not found` in CI                           | `npm install` missing – check pre-install step.      |
| Temporal workflow hangs                           | Missing `await` on activity or infinite loop timeout |
| Coverage dropped unexpectedly                     | New files excluded by `collectCoverageFrom` pattern. |
| Integration tests flaky                           | Data races – wrap Supabase calls in transaction or use unique IDs. |

---

## 8  Glossary

* **Agent** – Micro-service class extending `BaseAgent`.
* **Activity** – Temporal callable function wrapping agent logic.
* **Workflow** – Temporal orchestration combining activities.
* **25-Point Model** – GradingAgent scoring framework.

---

*File created – keep this document updated whenever the testing strategy evolves.*  
