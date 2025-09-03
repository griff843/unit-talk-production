Set-Content -Path "prompts\augment\super-all-in-one.md" -Value @'
You are at the root of the `unit-talk-production` monorepo.

GOAL
Make the repo production-ready on this machine by:
- Fixing `@unit-talk/shared-utils` packaging (and normalizing ALL packages) so everything builds to `dist/` with clean exports.
- Ensuring the API consumes internal packages from node_modules (no deep `.../dist/...` imports or TS path alias at runtime).
- Preserving the previous fix that made `@unit-talk/database` resolve.
- Verifying with artifacts in `out/ops/**` and a clean API build/start (env-gated).
- Keeping Docker build monorepo-aware and Windows-safe.

NON-NEGOTIABLES
- Windows-safe, ESM-compliant. No secrets, no `.env` edits.
- Do not regress the single-writer invariant or any business logic.
- Idempotent migrations/scripts; do not assume Docker or Supabase are running to succeed the sweep.

TASKS

A) Package normalization (shared-utils first, then all packages/*)
1) For each package under `packages/*` (start with `packages/shared-utils`):
   - package.json MUST have:
     "main": "dist/index.js",
     "module": "dist/index.js",
     "types": "dist/index.d.ts",
     "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
     "files": ["dist"],
     "scripts": { "build": "tsc -p tsconfig.build.json" }
     ("type": "module" unless the repo mandates CJS; align to repo standard and avoid mixing)
   - Create/ensure `tsconfig.build.json` with:
     {
       "extends": "../tsconfig.base.json",
       "compilerOptions": {
         "outDir": "dist",
         "declaration": true,
         "declarationMap": false,
         "sourceMap": false,
         "rootDir": "src",
         "module": "ESNext",
         "moduleResolution": "Bundler",
         "target": "ES2020"
       },
       "include": ["src/**/*.ts"]
     }
   - Ensure `src/index.ts` re-exports all public modules (e.g., `export * from "./date-utils";`) so consumers never import deep paths.
   - Remove/replace any deep imports (`@unit-talk/*/dist/...`) across the repo with root imports.

B) API consumption
1) Keep the previous `@unit-talk/database` resolution fix intact (do NOT revert to a setup that breaks on this machine).
2) In `apps/api`, ensure imports come from `@unit-talk/<pkg>` roots (no TS-only path aliases at runtime).
3) Ensure `apps/api` builds against the normalized packages.

C) Build order & scripts
1) At root, ensure (or add) scripts:
   - "build:packages": "npm run -ws --if-present build"
   - "build:api": "npm run -w @unit-talk/shared-utils build && npm run -w @unit-talk/database build && npm run -w @unit-talk/api build"
   - (Keep any working variants already present; do not remove known-good scripts.)
2) Run `npm install` only if required by changed manifests.

D) Verifiers (artifact-first)
1) Create/ensure `scripts/ops/verify-packages.ts`:
   - Enumerate `packages/*` by name (from their package.json).
   - For each, dynamic `import()` from node_modules package root.
   - Check at least one export exists (named or default).
   - Capture resolved path via `require.resolve` (use createRequire for ESM).
   - Write `out/ops/verify-packages.json` with:
     { ok: boolean, packages: [{ name, resolvedPath, exportsOk, notes }] }
2) Keep `scripts/ops/verify-api-module.js` and extend it to also verify `@unit-talk/shared-utils`.
3) Write `out/ops/package-normalization.report.json` summarizing:
   - packages changed,
   - build results,
   - verifier summary,
   - deep-imports replaced (list files/lines).

E) Docker (apps/api) – keep monorepo-aware
1) Ensure the Dockerfile for `apps/api`:
   - Copies root manifest(s), `packages/**`, and `apps/api/**`.
   - Runs `npm ci` once at root context (or equivalent) so internal packages are available.
   - Builds shared packages first, then `@unit-talk/api`.
   - No reliance on `jq`; scripts should be Node-only.
2) Do not require Docker to be running to complete this task; just ensure the Dockerfile is correct.

F) Optional: schema-code drift guard (idempotent)
- If any code paths still write non-existent columns (`published_at`, `created_at`, `tier` vs `tier_when_placed`), emit a note in the final report recommending the existing migration path. Do NOT author new migrations here.

G) Final actions (in this run)
1) Attempt:
   - npm run build:packages
   - npm run build:api
2) Run verifiers:
   - node scripts/ops/verify-api-module.js
   - node --loader tsx scripts/ops/verify-packages.ts  (or compiled JS variant)
3) Write a final `out/ops/sweep-final.report.json` containing:
   - changed files,
   - build logs (condensed),
   - verifier summaries,
   - next steps if any package still shows exportsOk=false.

ACCEPTANCE
- No “Cannot find module …/dist/*” errors remain when building `@unit-talk/api`.
- No deep imports to `/dist/` remain in the repo.
- `out/ops/verify-packages.json` shows ok=true for all internal packages used by the API.
- Dockerfile for API remains monorepo-aware and free of jq.
- This run is safe to re-execute; it only changes what’s needed.

OUTPUT
- Update files as needed.
- Produce `out/ops/package-normalization.report.json`, `out/ops/verify-packages.json`, and `out/ops/sweep-final.report.json`.
- End with a brief, human-readable summary of what changed and why.
'@
