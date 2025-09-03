# AUGMENT TASK: {{task}}

You are operating inside the `unit-talk-production` monorepo.
Your mission: eliminate schema?code drift, enforce repository usage, modernize legacy code, add baseline RLS/security, and bake in perf/observability — all Windows-safe, ESM-compliant, and artifact-first.

## Repo Invariants
- Single-writer: **Promoter** is the only writer to `unified_picks`.
- DB snake_case; domain camelCase; repos map both directions.
- Artifact discipline: write JSON reports under `out/ops/**`.
- Do NOT touch `.env*` or secrets. Respect write allowlist.

## Global Deliverables (apply as relevant to each subtask)
- New/updated scripts under `scripts/ops/**` are Node/TS (ESM) and Windows-safe.
- Add structured logging around repo writes (table, op type, actor, status).
- Update docs when fields change (`SCHEMA.md`, `SECURITY.md`, `OPERATIONS_RUNBOOK.md`).
- Fix all TypeScript/ESLint errors you introduce.

---

## Subtasks (choose based on {{task}})

### SCHEMA_HOTFIX
- Migration patch: add `published_at`, `created_at`, and either `current_tier` or refactor tier usage.
- Update `daily_picks` view if needed.
- Update legacy SQL to `score`/`placed_at`.
- Artifact: `out/ops/schema-hotfix.report.json`.

### REPO_ENFORCEMENT
- Replace all direct `supabase.from('unified_picks')` with `unifiedPicksRepo`.
- Add `gradingResultsRepo.ts` for grading.
- Artifact: `out/ops/repo-enforce.report.json`.

### LEGACY_CLEANUP
- Sweep runners/scripts/temporal/workflows; remove legacy fields (`professional_score`, `auto_approved`).
- Fix type gaps.
- Artifact: `out/ops/legacy-clean.report.json`.

### RLS_SECURITY
- New migration: Supabase RLS policies for `unified_picks` and `grading_results`.
- Document in `SECURITY.md`.
- Artifact: `out/ops/rls-migrate.report.json`.

### PERF_EXPLAIN
- Add `scripts/ops/explain-core-queries.ts` to run EXPLAIN ANALYZE on hot queries.
- Output `out/ops/explain-core-queries.json`.

---

## Acceptance Criteria
- Prod build compiles with no errors.
- Schema and code align on `published_at`, `created_at`, tier.
- No direct DB writes outside repos.
- Legacy field names removed/aliased.
- RLS policies in place and documented.
- Perf scripts output JSON artifacts.

## Output
- Summary of touched files
- Any commands to apply migrations or run scripts
