# UNIT TALK — PRODUCTION CHARTER (v3.0)

> **Purpose:** Establish a single source of truth for how Unit Talk operates in production — across data, environments, automation, validation, and governance — to eliminate drift, bottlenecks, and broken cycles while enabling rapid, safe scale.

---

## 1) Vision & Principles

- **Syndicate-grade**: Latency-focused, self-healing, observable, and security-first.
- **Canonical-first**: `picks` + `pick_publish` are the authoritative model; `unified_picks` remains read-compatible (fallback only) during convergence windows.
- **Git-driven everything**: Schema, environments, runbooks, and automation prompts live in repo; no snowflake ops.
- **Zero-surprises deployments**: Canary/blue-green with hard SLO gates and automatic rollback.
- **Agent alignment**: Every automated actor (Augment, Claude Code, ChatGPT PM) reads this charter and the alignment spec **before** acting.

---

## 2) System of Record

- **Repository**: `griff843/unit-talk-production` (main branch = truth; protected).
- **IaC/Manifest**: Kubernetes/DOKS + ArgoCD (or Docker Compose for local prod); manifests live in `infrastructure/`.
- **Schema source**: `supabase/migrations/**` (idempotent SQL only). No schema edits outside migrations.
- **App services**: API, Smart Form, Command Center, Discord Bot, Workers, Redis, Postgres, (Temporal optional).

---

## 3) Environments & Env Files

**Environments**: `dev`, `staging`, `prod`.

**Env file precedence (read-only to apps; never printed):**
1. `.env.shared` (shared secrets; highest precedence)
2. `.env.local` (developer machine/host overrides)
3. `.env` (defaults)

**Required keys (subset):**
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_DIRECT_URL`
- Core: `DEFAULT_TENANT_ID`, `PICK_DRIVER`, `PUBLISH_MODE`, `SHADOW_MODE`, `LOG_MODE`
- Discord: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_TEST_CHANNEL_ID`
- Observability (optional): `OTEL_EXPORTER_OTLP_ENDPOINT`

**Rules**:
- Secrets are masked in logs (`SUPA***`, `disco***`).
- All services load via `env_file: .env` plus an env-loader that merges `.env.shared` > `.env.local` > `.env` at runtime.
- CI/CD uses **GitHub Actions Secrets**; no plaintext in pipeline logs.

---

## 4) Data Model & Governance

**Canonical Tables**: `public.picks`, `public.pick_publish`.

### picks
Core pick record; tenant scoped; includes:
- `id` (UUID, PK)
- `tenant_id` (UUID, FK → tenants)
- `user_id` (UUID, FK → users, the capper)
- `prop_id` (UUID, FK → props, nullable)
- `selection` (TEXT, e.g., "over", "under")
- `odds` (INTEGER, American odds)
- `stake` (DECIMAL, default 1.0)
- `confidence` (INTEGER, 1-10)
- `workflow_stage` (TEXT: draft|pending_review|approved|rejected|published)
- `status` (TEXT: pending|won|lost|push|void|cancelled)
- `professional_score` (DECIMAL)
- `grading_status` (TEXT: pending|processing|completed|failed)
- `idempotency_key` (TEXT, unique per tenant)
- `bet_slip_id` (TEXT, unique per tenant)
- `metadata` (JSONB)
- Timestamps: `created_at`, `updated_at`, `published_at`, `settled_at`, `graded_at`

### pick_publish
Outbox for Discord delivery:
- `id` (UUID, PK)
- `pick_id` (UUID, FK → picks)
- `tenant_id` (UUID, FK → tenants)
- `channel` (TEXT: DISCORD|WEBHOOK|EMAIL)
- `status` (TEXT: pending|processing|sent|failed|cancelled)
- `thread_id` (TEXT, Discord thread)
- `external_message_id` (TEXT, Discord message ID)
- `discord_channel_id` (TEXT)
- `attempts` (INTEGER, retry count)
- `max_attempts` (INTEGER, default 3)
- `next_retry_at` (TIMESTAMPTZ)
- `last_error` (TEXT)
- `scheduled_for` (TIMESTAMPTZ)
- `sent_at` (TIMESTAMPTZ)
- `confirmed_at` (TIMESTAMPTZ)
- `metadata` (JSONB)
- Timestamps: `created_at`, `updated_at`

**Fallback Table**: `public.unified_picks` (read/compat only). Drivers may auto-fallback if canonical is unavailable, but **GO criteria require canonical path**.

**RLS**: Rules exist and are **disabled** by default; enabling is a managed change (see Security section).

**Migrations**:
- Must be **idempotent**; never destructive.
- Include indexes, constraints, and `SELECT pg_notify('pgrst','reload schema');` as final statement.
- PRs require: migration dry-run, visibility check, and E2E pass in CI before merge.

---

## 5) Drivers & Runtime Behavior

- **Requested driver** via env: `PICK_DRIVER=canonical|unified`.
- **PicksDriverFactory** performs **schema probe on boot**:
  - If `canonical` requested and `picks`/`pick_publish` visible → **use canonical**.
  - Else auto-fallback to **unified** with reason = `fallback_canonical_missing`.
- **Self-healing writes**: On schema errors (column/relation not found), force PostgREST reload (`pg_notify`) and retry once.

---

## 6) Self-Healing & Preflight

- **On boot**: `SCHEMA_RELOAD_ON_BOOT=true` triggers `pg_notify('pgrst','reload schema')`.
- **Preflight endpoint**: `/api/domain/picks/preflight` returns table/column visibility; may trigger a reload if stale.
- **Health endpoint**: `/api/health` includes pgrest state (`lastReloadAt`, attempts, successes, failures) + driver status.
- **Outbox**: Resilient worker with exponential backoff, jitter, circuit breaker, and idempotent Discord sends.

---

## 7) Observability & SLOs

- **OpenTelemetry** spans: `api.picks.insert`, `db.write`, `outbox.publish` with attributes (league, market_type, driver_effective, tenant_id, shadowMode).
- **Dashboards**: Grafana panels for:
  - API p95 < 150ms
  - DB p95 < 50ms
  - Error rate < 0.5%
  - Publish lag p95 < 60s
- **Alerts**: Prometheus/Alertmanager: page on sustained SLO breach (≥5 min window); auto-rollback hooks.

---

## 8) Security & Rate Limiting

- **RLS**: Policies authored and versioned; enablement is a controlled change with staged rollout.
- **Rate limits**:
  - Writes: 10 req/min per IP+user
  - Reads: 300 req/min
- **Secrets**: Never logged; only presence/shape reported. All agents must mask.

---

## 9) CI/CD & Validation Gates

### Pre-merge
- Type-check (0 TS errors)
- Unit tests
- Migration dry-run
- PostgREST visibility check
- DRY-RUN E2E across leagues

### Pre-deploy
- LIVE E2E (NBA/NFL/MLB/NHL)
- Discord in shadow or live as configured
- GO/NO-GO attestation in `out/ops/cutover/metrics/100/`

### Deploy strategy
Canary: 5% → 25% → 50% → 100% with auto-rollback on SLO violation.

---

## 10) Automation Agents: Contract

Every automated actor (Claude Code, Augment, ChatGPT PM, GitHub Copilot) must:

1. **Read this Charter and the [System Alignment Spec](./SYSTEM_ALIGNMENT_SPEC.yml) before acting.**
2. **Use Prompt Contract**:
   - Objective
   - Assumptions
   - Plan
   - Validation
   - Artifacts
   - Exit Criteria
3. **Respect Env & Schema gates**:
   - Refuse to run LIVE E2E if canonical tables are not visible and canonical driver requested.
   - Offer unified fallback **only** when explicitly allowed.
4. **Produce artifacts** under `out/ops/cutover/metrics/100/` (JSON + MD).
5. **Mask secrets** and never print raw credentials.

---

## 11) Runbooks & Rollout

### Start Command
```bash
./dev.sh start  # Source of truth; do not use 'up'
```

### Preflight Check
```bash
curl -sf http://localhost:3010/api/domain/picks/preflight
# Must return: {"ok": true}
```

### Validation Scripts
- `scripts/ops/industry-standard-e2e-validation.ps1|.sh`
- `scripts/ops/self-heal-and-validate.ps1|.sh`

### Discord Configuration
- `SHADOW_MODE=true` for test
- `SHADOW_MODE=false` for live
- Threads mapped via `capper_threads` configuration

---

## 12) Incident Response & Change Management

### IR Tiers
- **P0**: Publishing halted (immediate page)
- **P1**: SLO breach (page within 5 min)
- **P2**: Degraded, self-healed (alert only)

### Immediate Triage Capture
1. Health status: `curl http://localhost:3010/api/health`
2. Driver status: Check `PICK_DRIVER` and effective driver
3. PostgREST state: `lastReloadAt`, attempts, successes, failures
4. Logs: Last 200 lines
5. Failures: Top 20 `pick_publish` failures from outbox

### Rollback
- Canary step-down via ArgoCD
- Blue/green flip for immediate rollback

### Postmortem
- Within 24 hours
- Add guardrails/tests
- Update Charter if needed

---

## IMPLEMENTATION CHECKLIST (must be GREEN)

- [ ] `.env.shared` + `.env` present and loaded; secrets masked in all logs
- [ ] `supabase/migrations/**` contain canonical DDL; last step triggers `pg_notify('pgrst','reload schema')`
- [ ] `verify-pgrst-visible.ts` returns `visible=true` for `picks` & `pick_publish`
- [ ] `/api/domain/picks/preflight` → `ok:true`
- [ ] E2E DRY-RUN & LIVE (NBA/NFL/MLB/NHL) PASS; Discord publishes (or `SHADOW_MODE=true` during tests)
- [ ] SLOs satisfied; dashboards & alerts deployed
- [ ] GO/NO-GO artifacts emitted in `out/ops/cutover/metrics/100/`

---

## GOVERNANCE

- Any agent or developer proposing changes must reference this Charter and include a diff plan.
- CI enforces validation gates; merges blocked if any gate fails.
- Post-deployment: 24-48h monitoring, then tag + changelog.
- Deprecate legacy paths only after canonical path is stable.

---

## RELATED DOCUMENTS

- **System Alignment Spec**: [SYSTEM_ALIGNMENT_SPEC.yml](./SYSTEM_ALIGNMENT_SPEC.yml) - Machine-readable contract
- **Root CLAUDE.md**: [../CLAUDE.md](../CLAUDE.md) - Workspace guidance
- **API CLAUDE.md**: [../apps/api/CLAUDE.md](../apps/api/CLAUDE.md) - API-specific guidance
- **Canonical Schema Migration**: [../supabase/migrations/20251029_canonical_schema.sql](../supabase/migrations/20251029_canonical_schema.sql)

---

**This Charter and Spec are the binding contract between engineering, automation agents, and operations. All instructions, prompts, and changes must conform to these documents.**

---

**Version**: 3.0
**Last Updated**: 2025-10-29
**Next Review**: Quarterly or after major incidents
**Owner**: Engineering Team
