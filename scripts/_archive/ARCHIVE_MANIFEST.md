# Scripts Archive Manifest

**Created**: 2026-01-21
**Updated**: 2026-01-21
**Purpose**: Track archived scripts for historical reference and potential restoration.

---

## Archive Policy

Scripts are archived (not deleted) when they:
- Were used for one-time audits or debugging
- Are superseded by CI-based verification
- Could cause harm if run in wrong environment
- Are no longer part of active development workflow

Scripts listed as "SAFE TO DELETE" in the Systems Hardening Report have been permanently deleted, not archived.

## How to Restore

1. Move the script from `scripts/_archive/` back to the original path
2. Update this manifest with a restoration note
3. Verify the script is safe to run and doesn't bypass CI verification
4. Ensure no secrets are hardcoded

---

## Deleted Scripts (Permanently Removed - Week 1 Cleanup)

These scripts were classified as "DANGEROUS - SAFE TO DELETE NOW" per the Systems Hardening Report and have been permanently removed:

| Script | Reason for Deletion |
|--------|---------------------|
| `apply-canonical-fix-direct.ts` | Direct DB modification bypass |
| `apply-canonical-schema-fix.ts` | Direct schema modification |
| `apply-smart-tickets-migration.js` | One-time migration, completed |
| `capture-table-evidence.js` | Debug utility, superseded by CI |
| `check-canonical-schema.ts` | Superseded by CI validation |
| `check-constraints.js` | Superseded by CI validation |
| `check-database-state.ts` | Superseded by CI validation |
| `check-fk-constraint.js` | Superseded by CI validation |
| `check-pick-publish.ts` | Superseded by CI validation |
| `check-pick-publish-fk.ts` | Superseded by CI validation |
| `check-pick-publish-schema.js` | Superseded by CI validation |
| `check-pick-publish-schema.ts` | Superseded by CI validation |
| `check-picks-table.ts` | Superseded by CI validation |
| `check-pick-tables.ts` | Superseded by CI validation |
| `check-status-values.ts` | Superseded by CI validation |
| `check-tables.ts` | Superseded by CI validation |
| `check-tier-constraint.ts` | Superseded by CI validation |
| `check-unified-schema.js` | Superseded by CI validation |
| `investigate-schema.ts` | Debug utility, one-time use |
| `verify-canonical-schema.ts` | Superseded by CI validation |
| `APPLY_IN_SUPABASE_SQL_EDITOR.sql` | Manual SQL bypass, dangerous |

---

## Archived Scripts (Preserved for Reference)

### Audit Scripts (`scripts/_archive/audit/`)

| Original Path | Reason | Date | Safe to Delete After |
|--------------|--------|------|----------------------|
| `scripts/audit/audit_e2e_smoke.ts` | One-time audit script | 2026-01-21 | 90 days |
| `scripts/audit/audit_schema.ts` | One-time audit script | 2026-01-21 | 90 days |
| `scripts/audit/canonical-schema-audit.ts` | Superseded by CI | 2026-01-21 | 90 days |
| `scripts/audit/phase0-db-verification.ts` | Phase-specific verification | 2026-01-21 | 90 days |
| `scripts/audit/phase2-real-e2e-proof.ts` | Superseded by CI E2E | 2026-01-21 | 90 days |
| `scripts/audit/trace-discord-message.ts` | Debug utility | 2026-01-21 | 90 days |

### Canary Scripts (`scripts/_archive/canary/`)

| Original Path | Reason | Date | Safe to Delete After |
|--------------|--------|------|----------------------|
| `scripts/canary/submit-canary-pick.ts` | Canary test utility | 2026-01-21 | 90 days |
| `scripts/canary/verify-canary-invariants.ts` | Canary verification | 2026-01-21 | 90 days |

### E2E Test Scripts (`scripts/_archive/`)

| Original Path | Reason | Date | Safe to Delete After |
|--------------|--------|------|----------------------|
| `scripts/direct-api-e2e-test.ts` | Superseded by Playwright E2E | 2026-01-21 | 90 days |
| `scripts/post-today-e2e-proof.ts` | Superseded by CI E2E | 2026-01-21 | 90 days |
| `scripts/post-today-e2e-proof-canonical.ts` | Superseded by CI E2E | 2026-01-21 | 90 days |
| `scripts/smart-form-e2e-harness.ts` | Superseded by Playwright | 2026-01-21 | 90 days |

---

## Canonical Scripts (NOT ARCHIVED - Active)

These scripts remain in active use and should NOT be archived:

| Script | Purpose | CI Integration |
|--------|---------|----------------|
| `scripts/seed/seed_e2e_data.ts` | E2E test data seeding | Used by E2E workflows |
| `scripts/phase6-e2e-validation.ts` | CI E2E validation (canonical) | phase6-e2e-validation.yml |
| `scripts/stage1-schema-parity.ts` | CI schema verification | schema-parity-check.yml |
| `scripts/stage2-smart-form-e2e.ts` | CI Smart Form E2E | phase6-e2e-validation.yml |
| `scripts/stage3-discord-canary-e2e.ts` | CI Discord E2E | phase6-e2e-validation.yml |
| `scripts/stage4-inventory-cleanup.ts` | CI inventory validation | phase6-e2e-validation.yml |
| `scripts/outbox-health-check.ts` | Production health monitoring | Can be run in CI |

---

## Restoration History

| Script | Restored Date | Restored By | Reason |
|--------|--------------|-------------|--------|
| (none yet) | | | |
