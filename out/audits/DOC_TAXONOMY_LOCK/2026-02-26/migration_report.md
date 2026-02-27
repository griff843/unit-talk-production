# DOC TAXONOMY LOCK - Migration Report

**Sprint:** DOC_TAXONOMY_LOCK
**Date:** 2026-02-26
**Branch:** docs/taxonomy-lock-001

---

## Executive Summary

This migration enforces the canonical documentation taxonomy by:
1. Creating missing canonical folder structure
2. Migrating contracts to `architecture/contracts/**`
3. Creating stubs at old locations
4. Archiving superseded documents

**No files were deleted.** All migrations preserve originals or create stubs.

---

## Folders Created

### governance/
- `governance/vision/` (new)
- `governance/_archive/` (new)

### architecture/
- `architecture/overview/` (new)
- `architecture/data-model/` (new)
- `architecture/contracts/` (new)
- `architecture/contracts/runtime/` (new)
- `architecture/contracts/canonical/` (new)
- `architecture/contracts/distribution/` (new)
- `architecture/contracts/discord/` (new)
- `architecture/phases/` (new)
- `architecture/_archive/` (new)
- `architecture/_archive/phase-4-operational-determinism-legacy/` (new)

### templates/
- `templates/` (new)
- `templates/audits/` (new)
- `templates/sprints/` (new)
- `templates/governance/` (new)

### out/
- `out/closeouts/` (new)

---

## Files Migrated

### To architecture/contracts/distribution/

| Original | Destination |
|----------|-------------|
| `architecture/distribution/OUTBOX_CONTRACT_v1.1.md` | `architecture/contracts/distribution/OUTBOX_CONTRACT_v1.1.md` |
| `architecture/distribution/ROUTING_POLICY_CONTRACT_v1.1.md` | `architecture/contracts/distribution/ROUTING_POLICY_CONTRACT_v1.1.md` |
| `architecture/distribution/CONSUMER_CONTRACT_v1.1.md` | `architecture/contracts/distribution/CONSUMER_CONTRACT_v1.1.md` |
| `architecture/distribution/RETRY_POLICY_CONTRACT_v1.1.md` | `architecture/contracts/distribution/RETRY_POLICY_CONTRACT_v1.1.md` |
| `architecture/distribution/DLQ_CONTRACT_v1.1.md` | `architecture/contracts/distribution/DLQ_CONTRACT_v1.1.md` |
| `architecture/distribution/RECEIPT_VERIFICATION_CONTRACT_v1.1.md` | `architecture/contracts/distribution/RECEIPT_VERIFICATION_CONTRACT_v1.1.md` |
| `architecture/distribution/ENVIRONMENT_DETERMINISM_CONTRACT_v1.1.md` | `architecture/contracts/distribution/ENVIRONMENT_DETERMINISM_CONTRACT_v1.1.md` |
| `architecture/distribution/REPLAY_CONTRACT_v1.1.md` | `architecture/contracts/distribution/REPLAY_CONTRACT_v1.1.md` |

### To architecture/contracts/discord/

| Original | Destination |
|----------|-------------|
| `docs/contracts/DISCORD_EMBED_CONTRACT.md` | `architecture/contracts/discord/DISCORD_DELIVERY_CONTRACT_v1.0.md` |

### To architecture/phases/

| Original | Destination |
|----------|-------------|
| `architecture/distribution/PHASE3_DISTRIBUTION_DETERMINISM_v1.0.md` | `architecture/phases/PHASE3_DISTRIBUTION_DETERMINISM_v1.0.md` |
| `architecture/distribution/PHASE3_RATIFICATION_v1.0.md` | `architecture/phases/PHASE3_RATIFICATION_v1.0.md` |

### To architecture/state-machines/

| Original | Destination |
|----------|-------------|
| `docs/contracts/PICK_LIFECYCLE_CONTRACT.md` | `architecture/state-machines/PICK_LIFECYCLE_v1.0.md` |

### To architecture/data-model/

| Original | Destination |
|----------|-------------|
| `architecture/canonical-data-model/CANONICAL_DATA_MODEL_v1.0-DRAFT.md` | `architecture/data-model/CANONICAL_DATA_MODEL_v1.0.md` |

---

## Stubs Created

| Location | Points To |
|----------|-----------|
| `architecture/distribution/README.md` | `architecture/contracts/distribution/` |
| `architecture/canonical-data-model/README.md` | `architecture/data-model/` |
| `docs/contracts/DISCORD_EMBED_CONTRACT_STUB.md` | `architecture/contracts/discord/DISCORD_DELIVERY_CONTRACT_v1.0.md` |
| `docs/contracts/PICK_LIFECYCLE_CONTRACT_STUB.md` | `architecture/state-machines/PICK_LIFECYCLE_v1.0.md` |
| `docs/phases/phase-4-operational-determinism/README.md` | `architecture/phases/` |

---

## Files Archived

### To architecture/_archive/

| File | Reason |
|------|--------|
| `OUTBOX_CONTRACT_v1.0.md` | Superseded by v1.1 |
| `CONSUMER_CONTRACT_v1.0.md` | Superseded by v1.1 |
| `DLQ_CONTRACT_v1.0.md` | Superseded by v1.1 |
| `RETRY_POLICY_CONTRACT_v1.0.md` | Superseded by v1.1 |
| `RECEIPT_VERIFICATION_CONTRACT_v1.0.md` | Superseded by v1.1 |
| `ENVIRONMENT_DETERMINISM_CONTRACT_v1.0.md` | Superseded by v1.1 |
| `REPLAY_CONTRACT_v1.0.md` | Superseded by v1.1 |
| `DRIFT_DETECTION_MODEL_v1.0.md` | Empty placeholder |
| `FREEZE_PROTOCOL_v1.0.md` | Empty placeholder |
| `PHASE3_BINARY_ACCEPTANCE_MATRIX_v1.0.md` | Empty placeholder |
| `PHASE3_RATIFICATION_RECORD_v1.0.md` | Empty placeholder |
| `POLICY_VERSIONING_MODEL_v1.0.md` | Empty placeholder |

### To architecture/_archive/phase-4-operational-determinism-legacy/

| File | Reason |
|------|--------|
| All files from `docs/phases/phase-4-operational-determinism/` | Alternate Phase 4 definition (empty scaffolds) |

---

## New Documents Created

| Document | Purpose |
|----------|---------|
| `architecture/_archive/ARCHIVE_INDEX.md` | Index of archived documents with reasons |
| `architecture/phases/PHASE3_FILE_MAP_v1.0.md` | Maps Phase 3 docs to canonical contracts |
| `out/audits/DOC_TAXONOMY_LOCK/2026-02-26/unknown_folders_before.md` | Pre-migration analysis |
| `out/audits/DOC_TAXONOMY_LOCK/2026-02-26/migration_report.md` | This report |

---

## Files NOT Moved (Preserved In Place)

The following files were NOT moved to maintain backward compatibility:
- `docs/contracts/DISCORD_EMBED_CONTRACT.md` - Original preserved, canonical copy created
- `docs/contracts/PICK_LIFECYCLE_CONTRACT.md` - Original preserved, canonical copy created
- `architecture/canonical-data-model/CANONICAL_DATA_MODEL_v1.0-DRAFT.md` - Original preserved

---

## Verification Checklist

- [x] No files deleted
- [x] All contracts in `architecture/contracts/**`
- [x] Stubs created at old locations
- [x] Archive index created
- [x] Phase 3 file map created
- [x] Before/after inventories captured

---

End of Migration Report.
