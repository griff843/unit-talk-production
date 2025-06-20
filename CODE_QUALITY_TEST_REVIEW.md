# Unit Talk Production – Code Quality & Test Infrastructure Review  
*Version 2025-06-19  — Pre-launch QA*

---

## 1. Executive Summary
The codebase is **TypeScript-clean and builds without errors**, but code-quality polish and test hygiene need one more sprint to reach Fortune-100 maintainability.

* Strengths  
  * Strong BaseAgent abstraction, consistent typing, and strict `tsconfig`.
  * Modular agent folders with their own utilities and sub-modules.
  * Jest test runner configured, plus mocks for Supabase, logger, etc.

* Weaknesses  
  * **Mis-located test files inside `/src`**, breaking the clear prod vs test boundary.  
  * **Inconsistent test depth**: core scoring & recap logic have unit tests; Ingestion & Notification logic have few or none; Operator & Promotion agents lack any tests.  
  * **No automated coverage gating**; actual coverage ~35 – 40 % by rough line count.  
  * Some legacy utilities / empty stubs (e.g. `src/workflows/ingestion.workflow.ts`) linger in prod folders.  

---

## 2. Code Organization Assessment

| Concern | Findings | Impact | Action |
|---------|----------|--------|--------|
| **File Placement** | `src/agents/FeedAgent/test/testFeedAgent.ts`, `src/agents/MarketingAgent/tests.ts`, and scattered `__tests__` live under `src/` | Pollutes production tree; can bloat builds | Move to `/test/agents/...` with identical path mirroring |
| **Duplicate helper modules** | `edgeScoring` exists in `src/logic/scoring` **and** `src/agents/GradingAgent/scoring/*` | Risk of logic drift | Consolidate to single package in `src/logic/` and import everywhere |
| **Empty / stub files** | `src/workflows/ingestion.workflow.ts` (empty), multiple `utils/*Stub.ts` placeholders | Confusion for new devs | Remove or move to `/deprecated/` before launch |
| **Multiple `index.ts` / `types.ts`** in agent folders | Allowed as long as only one of each per folder; currently OK but _Analytics‐ & ContestAgent_ have extra `types/index.ts` vs `types.ts` | Minor complexity | Prefer a single `types.ts`; merge duplicate content and delete redundant files |
| **Deprecated scripts** | Legacy runners in `src/runner/*.ts` duplicate workflow logic | Unused in CI; manual only | Archive or delete after confirming Temporal workflows cover same tasks |

---

## 3. Test Infrastructure Review

### 3.1 Jest Configuration
* `jest.config.js` set up with `ts-jest` and path mapping – good.
* No `coverageThreshold`.  
  **Recommendation:** add 70 % lines/branches minimum gate.

### 3.2 Test Folder Layout
Current structure:
```
src/agents/**/__tests__/*          ← MIXED (should move)
src/agents/FeedAgent/test/*        ← WRONG PATH
src/test/**/*                      ← Canonical tests
```
*Adopt a single canonical root:* `/test/` mirroring prod tree, e.g. `/test/agents/GradingAgent/...`.

### 3.3 Coverage Snapshot (manual sampling)
| Module | Lines | Tests | Approx Coverage |
|--------|-------|-------|-----------------|
| BaseAgent lifecycle | 850 | ✅ 5 | ~75 % |
| Grading scoring engine | 1 200 | ✅ 14 | ~60 % |
| Recap formatting | 600 | ✅ 8 | ~55 % |
| Alert rate-limiter & LLM | 500 | ❌ 0 | 0 % |
| Ingestion de-dupe | 400 | ✅ 6 | ~65 % |
| Operator / Promotion / Onboarding | 1 100 | ❌ 0 | 0 % |
**Global estimate:** **~38 %**

### 3.4 Mocking & Stubs
* Good usage of `supabaseMock.ts`, `loggerMock.ts`.
* **No Discord / OpenAI mocks** – AlertAgent tests currently absent.  
  Add lightweight nock-style mocks for these HTTP clients.

---

## 4. Detailed File-Relocation List

| File | Current Path | Target Path |
|------|--------------|-------------|
| `src/agents/FeedAgent/test/testFeedAgent.ts` | `src/...` | `test/agents/FeedAgent/feedAgent.test.ts` |
| `src/agents/MarketingAgent/tests.ts` | `src/...` | `test/agents/MarketingAgent/marketingAgent.test.ts` |
| Every `src/agents/**/__tests__/*` | `src/...` | `test/agents/**/*` |
| `src/agents/ReferralAgent/__tests__/*` | `src/...` | `test/agents/ReferralAgent/*` |
| `src/shared/errors/index.test.ts` | `src/...` | `test/shared/errors/errorHelpers.test.ts` |
| Stubs `src/utils/recapStub.ts`, `managerStub.ts` | `src/utils` | `test/stubs/` or delete |
| Empty file `src/workflows/ingestion.workflow.ts` | — | delete or implement |
| Legacy runners `src/runner/*Harness.ts` if replaced by Temporal workflows | — | `/scripts/legacy/` or delete |

---

## 5. Recommended Improvements

### 5.1 Coverage & Quality Gates
1. **Enable Jest coverage:**  
   ```json
   // package.json
   "scripts": { "test:cov": "jest --coverage" }
   ```
2. **Add coverage threshold** in `jest.config.js`  
   ```js
   coverageThreshold: { global: { lines: 70, branches: 65 } }
   ```

### 5.2 Lint & Formatting
* Replace deprecated husky prepare hook with **biome** or **lint-staged** + GitHub Actions check.  
* Enforce `eslint --max-warnings 0` in CI.

### 5.3 Test Debt Backlog (Top 5)
| Priority | Area | Task |
|----------|------|------|
| P1 | AlertAgent | Unit tests for `enforceRateLimit`, `retryWithBackoff`, Discord integration mock |
| P1 | EdgeScoring | Snapshot tests ensuring identical output after consolidation |
| P2 | Temporal Workflows | Integration test verifying `gradingWorkflow` triggers `alertWorkflow` |
| P2 | OperatorAgent | Health-check restart scenario test |
| P3 | NotificationAgent | Channel fall-back order test (Discord → SMS) |

### 5.4 Architectural Hygiene
* **Single Source of Truth** for scoring: import from `src/logic/scoring/` everywhere.
* Consider a **packages/** workspace split: `core`, `agents`, `shared` to reduce circular deps.
* Remove all `.test.ts` from production build via `tsconfig.prod.json` `exclude`.

---

## 6. Action Plan & Ticket Suggestions

| Ticket | Description | Owner | ETA |
|--------|-------------|-------|-----|
| QA-01 | Relocate all misplaced test files (list above) | DevOps | +1 day |
| QA-02 | Delete empty `ingestion.workflow.ts` or implement Temporal ingestion flow | Backend | +1 day |
| QA-03 | Consolidate edge scoring modules & update imports | Data Eng | +2 days |
| QA-04 | Add Discord/OpenAI mocks, write AlertAgent unit tests (80 % coverage) | Backend | +3 days |
| QA-05 | Introduce Jest coverage gate at 70 % lines | DevOps | +2 days |
| QA-06 | Replace Husky script with lint-staged + GitHub Action | DevOps | +2 days |
| QA-07 | Write OperatorAgent restart scenario test | Backend | +4 days |
| QA-08 | Create CI step to fail on `eslint` warnings | DevOps | +1 day |

---

## 7. Conclusion

The codebase is structurally sound but **test coverage and folder hygiene lag behind Fortune-100 expectations**. Completing the above eight tickets will:

* Lift coverage to **≥ 70 %**,  
* Remove ambiguity between prod & test code,  
* Prevent logic drift via consolidated scoring modules, and  
* Guard the Alert LLM spend with deterministic tests.

After finishing this sprint, Unit Talk Production will meet enterprise maintainability standards and pass investor technical due diligence with confidence.
