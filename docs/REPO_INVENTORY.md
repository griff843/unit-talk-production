# Repository Inventory Snapshot

**Generated**: 2026-01-21
**Branch**: feat/pr9-go-live-hardening
**Purpose**: Track repository composition for hygiene management.

---

## Summary Statistics

| Category | Count | Notes |
|----------|-------|-------|
| TypeScript files (.ts/.tsx) | 5,768 | Core application code |
| JavaScript files (.js/.jsx) | 6,493 | Legacy + config + build artifacts |
| Markdown docs (active) | 88 | In `docs/` excluding `_archive/` |
| Markdown docs (archived) | 10 | In `docs/_archive/` |
| Active scripts | 31 | In `scripts/` excluding `_archive/` |
| Archived scripts | 12 | In `scripts/_archive/` |
| Database migrations | 15 | In `supabase/migrations/` |
| GitHub workflows | 20 | In `.github/workflows/` |

---

## Documentation Authority

### Authoritative Documents (Keep Updated)

| Document | Purpose |
|----------|---------|
| `docs/contracts/SYSTEM_CONTRACT.md` | Single source of truth for canonical model |
| `docs/contracts/EXECUTION_PLAN.md` | Gate definitions and verification |
| `docs/contracts/GATE_VERIFICATION.md` | Pass/fail criteria |
| `docs/DOCUMENTATION_AUTHORITY.md` | Documentation governance rules |
| `CLAUDE.md` (root) | Development rules and Docker-first mandate |
| `apps/*/CLAUDE.md` | App-specific implementation guidance |

### Archived Documents (Historical Reference Only)

See `docs/_archive/ARCHIVE_MANIFEST.md` for complete list.

---

## Script Inventory

### Canonical Scripts (Active, CI-Integrated)

| Script | Purpose |
|--------|---------|
| `scripts/seed/seed_e2e_data.ts` | E2E test data seeding |
| `scripts/phase6-e2e-validation.ts` | CI E2E validation |
| `scripts/stage1-schema-parity.ts` | Schema verification |
| `scripts/stage2-smart-form-e2e.ts` | Smart Form E2E |
| `scripts/stage3-discord-canary-e2e.ts` | Discord E2E |
| `scripts/stage4-inventory-cleanup.ts` | Inventory validation |
| `scripts/outbox-health-check.ts` | Health monitoring |

### Operational Scripts (Active, Manual Use)

| Script | Purpose |
|--------|---------|
| `scripts/ops/bootstrap-github-labels.ts` | GitHub label setup |
| `scripts/ops/measure-ci-health.ts` | CI metrics |
| `scripts/ops/set-autopilot-mode.ts` | Autopilot configuration |
| `scripts/burn-in/start-burn-in.ts` | Burn-in testing |
| `scripts/burn-in/stop-burn-in.ts` | Stop burn-in |
| `scripts/verify-phase4-autopilot-policy.ts` | Policy verification |
| `scripts/verify-agent-control-plane.ts` | Agent verification |

### Archived Scripts (Historical Reference Only)

See `scripts/_archive/ARCHIVE_MANIFEST.md` for complete list.

---

## Migration Inventory

| Migration | Purpose |
|-----------|---------|
| All migrations in `supabase/migrations/` | Schema changes (DO NOT DELETE) |

**Note**: Migrations are historical records and must never be deleted.

---

## Workflow Inventory

### CI/CD Workflows

| Workflow | Purpose |
|----------|---------|
| `phase6-e2e-validation.yml` | Canonical E2E proof |
| `schema-parity-check.yml` | Schema drift prevention |
| `daily-canary-proof.yml` | Daily health check |
| `verify-gap-resolution.yml` | Gap verification |

### Other Workflows

See `.github/workflows/` for complete list.

---

## Week 1 Cleanup Summary

| Action | Count |
|--------|-------|
| Documents archived | 9 |
| Documents deleted | 0 |
| Scripts deleted (dangerous) | 21 |
| Scripts archived (noisy) | 12 |
| Scripts kept (canonical) | 31 |
| New authority docs created | 2 |

---

## Next Review

This inventory should be updated:
- After major cleanup operations
- Monthly as part of hygiene review
- Before production releases
