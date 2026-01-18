# Unit Talk Migration Workflow Guide (v3.0) – 2025-11-20

> **Purpose:** Single source of truth for how to apply Supabase/Postgres schema changes for Unit Talk, aligned with the Production Charter and System Alignment Spec.

---

## 1. Source of Truth

- **Authoritative schema:** `supabase/migrations/**` (idempotent SQL only)
- **Legacy baseline:** `scripts/migrations/2025-10-25_*.sql` and `MIGRATION_SUCCESS_SUMMARY.md` describe the **v2.0 production cutover** and are historical records.
- **Charter rule:** Do **not** edit schema directly via dashboard; always go through Git + SQL under `supabase/migrations`.

---

## 2. Environments & Required Env Vars

- `.env.shared` > `.env.local` > `.env` (see `docs/PRODUCTION_CHARTER.md` and `docs/SYSTEM_ALIGNMENT_SPEC.yml`).
- Supabase-related env vars (must all point at the **same project**):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `DATABASE_DIRECT_URL` (non-pooled direct Postgres URL, port 5432)
- Guard rails:
  - `scripts/ops/check-project-alignment.ts` verifies that `SUPABASE_URL` and `DATABASE_DIRECT_URL` are aligned and that canonical tables are visible.
  - Migrations must end with `SELECT pg_notify('pgrst','reload schema');` to keep PostgREST in sync.

---

## 3. CI / Non-Prod Migrations (Supabase CLI)

**Canonical automated path (see `.github/workflows/e2e-ci.yml`):**

1. Install Supabase CLI via `supabase/setup-cli@v1`.
2. Login and link project:
   - `supabase link --project-ref "$SUPABASE_PROJECT_REF"`
3. Push all SQL under `supabase/migrations/**`:
   - `supabase db push` (with simple retry wrapper in CI).
4. Run admin RPCs and validation scripts against that project using `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

This is the **preferred path** for:
- CI environments
- Ephemeral test environments
- Staging environments

---

## 4. Operator / Production Migrations (Direct Postgres)

For production and manual cutovers, the repo provides a **direct Postgres path** using `DATABASE_DIRECT_URL` and Node/`pg`:

### 4.1 Preflight

1. Ensure env is loaded (`.env` + `.env.shared`).
2. Run project-alignment guard:
   - `npx tsx scripts/ops/check-project-alignment.ts`
3. Confirm `DATABASE_DIRECT_URL` is the **non-pooled** Postgres URL for the same Supabase project as `SUPABASE_URL`.

### 4.2 Apply canonical scoring/unified picks migrations

These critical migrations live in `supabase/migrations` and are applied via:

- Script: `apps/api/src/scripts/apply-sql-migrations.ts`
- Current curated set:
  - `20251030_unified_picks_readonly.sql`
  - `20251030_scoring_infrastructure.sql`

**Recommended command (inside Docker):**

- `docker-compose exec api sh -lc "cd /app/apps/api && npx tsx src/scripts/apply-sql-migrations.ts"`

This script:
- Connects to Postgres using `DATABASE_DIRECT_URL` (via `pg.Pool`).
- Applies each migration in order.
- Verifies canonical/unified tables and RLS state.
- Writes JSON + Markdown artifacts under `out/ops/cutover/metrics/101/`.

### 4.3 Post-migration checks

After the script completes successfully:

1. Force PostgREST reload if needed:
   - `npm run ops:reload-pgrst` (from repo root)
2. Verify canonical table visibility:
   - `npm run ops:verify-pgrst`
3. Hit preflight endpoint once API is running:
   - `curl -sf http://localhost:3010/api/domain/picks/preflight`

---

## 5. Adding New Migrations

When introducing a new schema change:

1. Create an idempotent SQL file under `supabase/migrations/` with:
   - `IF NOT EXISTS` / `IF EXISTS` guards
   - A final `SELECT pg_notify('pgrst','reload schema');`
2. Commit the new migration with a clear, dated filename (e.g. `YYYYMMDD_description.sql`).
3. For CI/non-prod:
   - Rely on `supabase db push` (e2e-ci workflow will pick it up automatically).
4. For production:
   - Either:
     - (A) Use Supabase CLI: `supabase db push` against the live project, **or**
     - (B) Add the file name to the `MIGRATIONS` array in `apps/api/src/scripts/apply-sql-migrations.ts` and re-run that script via Docker.

---

## 6. Legacy & Deprecated Paths

These exist in the repo but are **not the primary path** going forward:

- `scripts/migrations/2025-10-25_*.sql` – historical v2.0 cutover; do not modify.
- `apps/api/src/scripts/apply-migrations.ts` – stub that only prints `psql $DATABASE_DIRECT_URL` instructions; superseded by `apply-sql-migrations.ts`.
- `scripts/execute-database-migration.ts` and `apps/api/scripts/execute-database-migration.ts` – RPC-based executor for an earlier "critical schema alignment"; keep for reference, but new work should use `supabase/migrations/**` + CLI/`apply-sql-migrations.ts`.

When in doubt:
- **Read:** `docs/PRODUCTION_CHARTER.md` and `docs/SYSTEM_ALIGNMENT_SPEC.yml`.
- **Check alignment:** `npx tsx scripts/ops/check-project-alignment.ts`.
- **Apply migrations:**
  - CI/staging → `supabase db push`
  - Production/manual → `apply-sql-migrations.ts` via `DATABASE_DIRECT_URL`.

