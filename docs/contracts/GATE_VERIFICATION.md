# System Contract Gate Verification Report

**Generated**: 2026-01-21 **Branch**: feat/pr9-go-live-hardening **Discord
Canary Channel**: 1296531122234327100

---

## Executive Summary

All four stages of the System Contract verification have **PASSED**. The Unit
Talk platform is verified to comply with the canonical data model and publish
pipeline requirements.

---

## PASS/FAIL Gate Table

| Stage | Name                                   | Status   | Evidence                                                                                 |
| ----- | -------------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| 1     | DB Contract & Parity Gate              | **PASS** | [parity_report.md](../../out/proof/stage1/db_parity/parity_report.md)                    |
| 2     | Smart Form -> API Canonical Write Gate | **PASS** | [trace_bundle.json](../../out/proof/stage2/smart_form_submit/trace_bundle.json)          |
| 3     | Discord Canary E2E Gate                | **PASS** | [discord_message_url.txt](../../out/proof/stage3/discord_canary/discord_message_url.txt) |
| 4     | Inventory + Cleanup + Lock Gate        | **PASS** | [repo_inventory.md](../../out/proof/stage4/inventory/repo_inventory.md)                  |

---

## Stage 1: DB Contract & Parity Gate

### Verified Canonical Objects

| Object        | Type  | Status           |
| ------------- | ----- | ---------------- |
| unified_picks | TABLE | PASS             |
| pick_publish  | TABLE | PASS             |
| smart_tickets | TABLE | PASS             |
| bridge_outbox | TABLE | PASS             |
| users         | TABLE | PASS             |
| games         | TABLE | PASS             |
| picks         | VIEW  | PASS (read-only) |

### Key Verification

- `unified_picks` is the ONLY writable pick table
- `picks` is a READ-ONLY VIEW (write attempts blocked)
- `pick_publish` FK references `unified_picks`
- All required columns present per SYSTEM_CONTRACT.md

---

## Stage 2: Smart Form -> API Canonical Write Gate

### Trace Bundle

```json
{
  "trace_id": "1e6a1a23-99ff-461e-b738-dd4db0050881",
  "bet_slip_id": "6b437132-4210-4a2c-90aa-e12d492ee9c7",
  "pick_ids": ["d4c79a10-79cc-4e48-87a7-10bdd7fc0c29"],
  "pick_publish_ids": ["8c84c571-cb9d-4aad-8764-22630c3ad5ca"],
  "bridge_outbox_ids": ["60dd5247-211a-4e3d-8e24-c6d0efba2b54"]
}
```

### Verified Flow

1. trace_id generated at submission start
2. unified_picks row created with trace_id
3. pick_publish row created with status='pending'
4. bridge_outbox event created
5. Routing resolved (discord_channel_id set)

---

## Stage 3: Discord Canary E2E Gate

### Discord Message

**URL**:
https://discord.com/channels/1284478946171293736/1296531122234327100/1463376501591244965

### Outbox Transitions

```
pending -> processing -> sent
```

### Verified

- Atomic claim with UPDATE...WHERE status='pending'
- trace_id included in Discord message embed
- external_message_id captured after successful post
- Status transitions are strict and monotonic

---

## Stage 4: Inventory + Cleanup + Lock Gate

### Repository Stats

| Metric              | Count   |
| ------------------- | ------- |
| Total Files         | 3,351   |
| Total Lines         | 819,939 |
| Apps                | 14      |
| Documentation Files | 95+     |
| Scripts             | 100+    |
| Migrations          | 31      |

### Build Verification

**Status**: PASS (with pre-existing issues)

Pre-existing TypeScript issues in `apps/command-center` are NOT introduced by
this PR. Our changes (contract docs, verification scripts) do not introduce new
errors.

---

## Artifacts

### Stage 1 Artifacts

- `out/proof/stage1/db_parity/prod_schema_inventory.json`
- `out/proof/stage1/db_parity/parity_report.md`
- `out/proof/stage1/db_parity/permissions_checks.md`
- `out/proof/stage1/db_parity/legacy_surface_manifest.json`

### Stage 2 Artifacts

- `out/proof/stage2/smart_form_submit/trace_bundle.json`
- `out/proof/stage2/smart_form_submit/db_rows.md`
- `out/proof/stage2/smart_form_submit/routing_resolution.md`

### Stage 3 Artifacts

- `out/proof/stage3/discord_canary/discord_message_url.txt`
- `out/proof/stage3/discord_canary/outbox_transition_report.md`
- `out/proof/stage3/discord_canary/claim_logic_snippet.md`
- `out/proof/stage3/discord_canary/retry_proof.md`

### Stage 4 Artifacts

- `out/proof/stage4/inventory/repo_inventory.json`
- `out/proof/stage4/inventory/repo_inventory.md`
- `out/proof/stage4/archive/archive_manifest.json`
- `out/proof/stage4/lock/build_verification.md`

---

## Conclusion

The Unit Talk platform has been verified to comply with the System Contract. All
canonical objects exist with required columns, the publish pipeline follows the
correct lifecycle, and Discord messages are posted through the canonical
`pick_publish` outbox.

**Recommendation**: Merge to main and proceed with production deployment.
