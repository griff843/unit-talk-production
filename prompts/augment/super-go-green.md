You are at the root of the `unit-talk-production` monorepo.

GOAL
Achieve a fully green, production-ready state:
- Fix remaining TypeScript mismatches (telemetry/OpenTelemetry, etc.).
- Eliminate ALL mocks/fixtures/fake data from runtime paths.
- Prove real-data wiring end-to-end with a production E2E run (no mock shortcuts).
- Emit artifacts under `out/ops/**` and wire a Command Center entry point to run/inspect E2E.
- Windows-safe, ESM-compliant, Docker-compatible; do not touch secrets.

NON-NEGOTIABLES
- No mock data anywhere on runtime or API code paths. Tests may keep mocks only inside isolated test folders.
- No deep `.../dist/...` imports; import from package roots.
- Idempotent scripts; never assume Docker/Supabase/Temporal are running to succeed writing files.
- Keep single-writer invariants and existing schema as-is (report drift; don’t invent migrations).

TASKS

A) P0 — Telemetry fixes to green
1) Normalize `packages/telemetry` (or similarly named) to compile cleanly:
   - Fix OpenTelemetry API mismatches (import surfaces, types, init sequence).
   - Ensure `package.json` exports to `dist` (main/module/types/exports/files).
   - Provide `tsconfig.build.json` and `src/index.ts` barrel.
2) Ensure consumers (API, workers) initialize telemetry safely:
   - Lazy init, guard unknown envs.
   - No hard failures if missing optional exporters.
3) Artifact: `out/ops/telemetry-fix.report.json` with changed files and a short “why”.

B) P0 — Assert NO mocks in production code paths
1) Add `scripts/ops/assert-no-mocks.ts` that scans repo for mock/stub/fixture usage outside allowed folders:
   - Disallow patterns: `__mocks__`, `fixtures`, `faker`, `msw`, `.spec.`, `.test.`, “mock*”, “fake*”, “fixture*” in `apps/**` and `packages/**` runtime sources.
   - Allowed: inside `tests/**` or `__tests__/**` only.
2) On violation, write details to `out/ops/no-mocks.violations.json` and return nonzero exit.
3) Artifact: `out/ops/no-mocks.report.json` with summary `{ ok, violationsCount }`.

C) P0 — Real-data production E2E (no mocks)
1) Create `scripts/e2e/prod-e2e.ts` that:
   - Validates required env (Supabase URL/key, Temporal address/namespace or falls back to local dev).
   - Runs **live** API smoke (GET /health, /ops/runtime-mode, critical CRUD read paths).
   - Exercises ingestion?repo?unified_picks?publish path read-only (no destructive writes unless a flag `ALLOW_WRITES=true` is set).
   - Hits Temporal “health” RPC and lists a few workflow summaries if available.
   - Emits a consolidated result object with timings, statuses, and any errors.
2) Write `out/ops/prod-e2e.results.json` and `out/ops/prod-e2e.summary.json` (brief).
3) Provide a Node-only runner script in `package.json` (root): `"e2e:prod": "node -r dotenv/config scripts/e2e/prod-e2e.js || node -r dotenv/config --loader tsx scripts/e2e/prod-e2e.ts"`

D) P0 — Env validation
1) Add `scripts/ops/validate-env.ts`:
   - Checks for required envs per app (API/worker/command-center).
   - Writes `out/ops/env-validate.json` with present/missing and suggested .env keys.
2) Hook this into E2E preflight (if keys missing, E2E marks degraded but still runs read-only probes).

E) P1 — Command Center hooks
1) Add minimal API routes (admin-guarded) to trigger E2E + read artifacts:
   - `POST /api/ops/probes/run-prod-e2e` ? runs the `e2e:prod` script (spawn) and returns status.
   - `GET  /api/ops/probes/prod-e2e` ? returns the latest `prod-e2e.summary.json` + link to results.
2) In apps/command-center add a `/e2e` page:
   - Button “Run Production E2E” (shows spinner, then surfaces results).
   - Panels for: Env Validate, No-Mocks report, Telemetry status, Temporal/DB/API health.
   - Links to artifact files under `out/ops/**`.
3) RBAC: only admins can run; viewers can read artifacts.

F) P1 — CI switch & scripts
1) Add an npm script `"ops:green": "npm run build:packages && npm run build:api && node scripts/ops/validate-env.js && node scripts/ops/assert-no-mocks.js && npm run e2e:prod"`.
2) Optional GitHub Action template under `.github/workflows/ops-green.yml` that:
   - Checks out, installs, builds packages+api, runs no-mocks + env validate (E2E optional in CI).
   - Uploads artifacts in `out/ops/**`.

G) P2 — Docker echo (non-blocking)
1) Ensure `apps/api/Dockerfile` and compose are still monorepo-aware. If changes needed, update and add a small script `scripts/ops/verify-docker-api.ts` that inspects the built image for package presence (node_modules resolution).
2) Artifact: `out/ops/verify-docker-api.json`.

H) Reports & wiring
- Always write concise JSON artifacts:
  - `out/ops/telemetry-fix.report.json`
  - `out/ops/no-mocks.report.json`, `out/ops/no-mocks.violations.json?`
  - `out/ops/env-validate.json`
  - `out/ops/prod-e2e.results.json`, `out/ops/prod-e2e.summary.json`
  - `out/ops/verify-docker-api.json` (optional)
  - `out/ops/go-green.final.json` — master roll-up with links to the artifacts above.

ACCEPTANCE
- `npm run build:packages && npm run build:api` succeed with no module or TS errors.
- `node scripts/ops/assert-no-mocks.js` reports `{ ok: true }` (no violations in runtime paths).
- `node -r dotenv/config scripts/e2e/prod-e2e.js` produces **non-mock**, **real-data** results (OK or clearly degraded with diagnostics).
- Command Center `/e2e` page exists:
  - Can trigger the E2E run (admin-only).
  - Renders the last results and env/no-mocks summaries.
- `out/ops/go-green.final.json` says `"green": true` (or `"green": false` with precise reasons and file paths).

OUTPUT
- Update or create the scripts, pages, and routes described.
- Do NOT commit secrets; never overwrite existing `.env`.
- Produce all artifacts listed under H).
- End with a changed-files summary and explicit “what still blocks green” if any.
