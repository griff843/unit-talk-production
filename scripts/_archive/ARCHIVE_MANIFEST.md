# Scripts Archive Manifest

**Archived Date**: 2026-01-21
**Reason**: One-off check/fix scripts superseded by canonical stage verification scripts
**Replaced By**: `scripts/stage1-schema-parity.ts`, `scripts/stage2-smart-form-e2e.ts`, `scripts/stage3-discord-canary-e2e.ts`, `scripts/stage4-inventory-cleanup.ts`

## Archived Scripts

| Script | Type | Reason |
|--------|------|--------|
| apply-canonical-fix-direct.ts | One-off fix | Superseded by stage scripts |
| apply-canonical-schema-fix.ts | One-off fix | Superseded by stage scripts |
| apply-smart-tickets-migration.js | One-off migration | Migration complete |
| capture-table-evidence.js | Debug script | Superseded by stage scripts |
| check-canonical-schema.ts | One-off check | Superseded by stage1 |
| check-constraints.js | One-off check | Superseded by stage1 |
| check-database-state.ts | One-off check | Superseded by stage1 |
| check-fk-constraint.js | One-off check | Superseded by stage1 |
| check-pick-publish.ts | One-off check | Superseded by stage1 |
| check-pick-publish-fk.ts | One-off check | Superseded by stage1 |
| check-pick-publish-schema.js | One-off check | Superseded by stage1 |
| check-picks-table.ts | One-off check | Superseded by stage1 |
| check-pick-tables.ts | One-off check | Superseded by stage1 |
| check-status-values.ts | One-off check | Superseded by stage1 |
| check-tables.ts | One-off check | Superseded by stage1 |
| check-tier-constraint.ts | One-off check | Superseded by stage1 |
| check-unified-schema.js | One-off check | Superseded by stage1 |
| investigate-schema.ts | Debug script | Superseded by stage scripts |
| verify-canonical-schema.ts | One-off verification | Superseded by stage1 |

## Canonical Stage Scripts (Active)

These are the authoritative verification scripts going forward:

1. **stage1-schema-parity.ts** - DB schema parity verification
2. **stage2-smart-form-e2e.ts** - Smart Form canonical write path verification
3. **stage3-discord-canary-e2e.ts** - Discord canary E2E with outbox transitions
4. **stage4-inventory-cleanup.ts** - Repo inventory and build verification
5. **outbox-health-check.ts** - Outbox health metrics and stuck detection

## Restoration

If any archived script is needed, it can be restored from this directory.
Ensure imports are not broken before restoring.
