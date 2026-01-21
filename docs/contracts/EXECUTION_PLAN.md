# Unit Talk Stage-Gated Execution Plan

**Purpose**: Systematic validation of the Unit Talk platform against the System
Contract.

---

## Stage 1 - Contract & DB Parity Gate

### Scope

- DB (Supabase): schema + permissions + canonical objects
- Docs: CONTRACT alignment references

### Goal

Prove staging and prod match for canonical objects and no writable legacy pick
surfaces exist.

### Required Alignment

- unified_picks is the only writable pick table
- pick_publish is the only Discord publish outbox
- smart_tickets groups multi-leg tickets
- bridge_outbox exists and is idempotent-friendly
- picks is view-only, no writes possible

### PASS Checks

1. **Canonical Object Parity**: Tables exist with all required columns
2. **Permissions**: App roles cannot write to picks view
3. **Parity Definition**: Same columns, types, FK links

### FAIL Conditions

- Any required canonical object missing
- Missing trace_id on canonical write surfaces
- Any writable "alt pick surface" exists
- picks is not a view or is writable

### Evidence Artifacts

- `out/proof/stage1/db_parity/prod_schema_inventory.json`
- `out/proof/stage1/db_parity/staging_schema_inventory.json`
- `out/proof/stage1/db_parity/parity_report.md`
- `out/proof/stage1/db_parity/permissions_checks.md`
- `out/proof/stage1/db_parity/legacy_surface_manifest.json`

---

## Stage 2 - Smart Form -> API Canonical Write Gate

### Scope

- apps/smart-form (UI)
- apps/api (Smart Form submit handler)
- DB writes to unified_picks, pick_publish, bridge_outbox

### Goal

Prove contract lifecycle from UI submit through canonical DB writes and outbox
enqueue.

### Required Alignment

- UI generates trace_id once per submission
- API validates before any DB write
- Odds normalized to American integer
- Multi-leg creates smart_tickets
- Discord routing resolved at enqueue time
- API must never call Discord directly

### PASS Checks

1. Trace visible in UI proof
2. DB writes exist for same trace_id
3. pick_publish row created with status='pending'
4. bridge_outbox event created
5. Fail-closed routing validated

### FAIL Conditions

- Any write occurs without trace_id
- unified_picks missing required fields
- pick_publish not created
- Direct Discord send from API/UI

### Evidence Artifacts

- `out/proof/stage2/smart_form_submit/ui_submission.png`
- `out/proof/stage2/smart_form_submit/trace_bundle.json`
- `out/proof/stage2/smart_form_submit/db_rows.md`
- `out/proof/stage2/smart_form_submit/routing_resolution.md`

---

## Stage 3 - Discord Canary E2E Gate

### Scope

- Publisher Worker / consumer
- DB (pick_publish transitions)
- Discord Canary Channel: 1296531122234327100

### Goal

Prove Smart Form submit posts to Discord canary via pick_publish only.

### Required Alignment

- Worker uses atomic claim on pick_publish rows
- On success: status='sent', discord_message_id set
- On failure: attempts incremented, backoff applied
- Idempotency: retries do not duplicate Discord sends

### PASS Checks

1. Discord Canary post exists with trace_id
2. Outbox transitions: pending -> processing -> sent
3. Atomic claim correctness
4. Retry logic validated

### FAIL Conditions

- Discord message posted without pick_publish row
- Missing trace_id in Discord message
- Duplicate Discord sends
- Worker sends Discord outside pick_publish pipeline

### Evidence Artifacts

- `out/proof/stage3/discord_canary/discord_message_url.txt`
- `out/proof/stage3/discord_canary/outbox_transition_report.md`
- `out/proof/stage3/discord_canary/claim_logic_snippet.md`
- `out/proof/stage3/discord_canary/retry_proof.md`

---

## Stage 4 - Inventory + Cleanup + Lock Gate

### Scope

- Repo-wide: docs, scripts, migrations, workers, UI
- Archive: legacy docs/scripts moved with manifest

### Goal

Create measured inventory, archive legacy safely with manifest.

### Required Alignment

- Contract referenced as authority everywhere
- Legacy docs/scripts do not contradict contract
- Archive does not break builds

### PASS Checks

1. Inventory produced with LOC by app
2. Archive executed with manifest
3. Build verification passes

### FAIL Conditions

- Inventory incomplete
- Archive breaks build
- Legacy contradictory docs remain active

### Evidence Artifacts

- `out/proof/stage4/inventory/repo_inventory.json`
- `out/proof/stage4/inventory/repo_inventory.md`
- `out/proof/stage4/archive/archive_manifest.json`
- `out/proof/stage4/archive/archive_manifest.md`
- `out/proof/stage4/lock/build_verification.md`

---

## "Stop Doing" List (Anti-Scope-Creep Guardrails)

During this execution plan, we will NOT:

- Add new pipelines
- Create a suite of new scripts for every check
- Refactor scoring/grading/agent logic
- Change schema beyond parity requirements
- Introduce new infra
- Rebuild UI/UX beyond trace_id surfacing
- Rename tables broadly
- Tackle Command Center expansion
- Touch production secrets/rotation

---

## Execution Order

1. DB / Supabase parity (Stage 1)
2. Smart Form + API submit path (Stage 2)
3. Publisher worker + Discord canary (Stage 3)
4. Repo inventory + archive + lock proof (Stage 4)
