# UTRP-R5 — Downstream Outcome Reconstruction

> **Sprint**: UTRP-R5-DOWNSTREAM-OUTCOME-RECONSTRUCTION **Workstream**: R5
> **Status**: NOT STARTED **Dependencies**: R3 COMPLETE, R4 COMPLETE

---

## Objective

A settled pick must propagate its outcome through every downstream system:
settlement audit log, recap surface, and Discord posting — with correct
attribution, correct data, and confirmed proof that each system received it.

> A pick that cannot be settled, recapped, or posted is not a real pick. R5
> closes the loop on the full outcome pipeline.

---

## Scope

### 1. DEFECT-24 — RecapService uses SUPABASE_ANON_KEY

`RecapService.getDailyRecapData()` uses the anon key. If RLS policies restrict
read access to `settlement_status='settled'` rows for the anon role, recap
returns empty even for settled picks.

Required actions:

- Confirm whether RLS restricts settled pick reads for anon role
- If restricted: update RecapService to use the service role key
- Document the change: RecapService is read-only (no writes) so service role is
  appropriate for this use case
- Migration: no schema changes required, only config change

### 2. DEFECT-25 — RecapService capper attribution reads non-existent `tags`

`RecapService.extractCapper()` reads `pick.tags` array looking for known capper
names. `unified_picks` has no `tags` column. Capper attribution always falls
back to "Unit Talk".

Required actions:

- Fix `extractCapper()` to resolve capper from `user_id`:
  - Join `users` table on `user_id` during `getDailyRecapData()` query
  - Or: look up username by `user_id` in a secondary query
  - Attribute the pick to the username if found; "Unit Talk" if not
- Update the query to include `user_id` in SELECT if not already present

### 3. DEFECT-26 — Settlement pipeline verified end-to-end

After R3 unblocks settlement auth, verify the complete settlement path:

**Settlement test sequence:**

1. Submit a pick via Smart Form (or directly via RPC)
2. Grade the pick (or manually set `tier` and `promotion_band`)
3. Call `manual_settle_pick(pick_id, 'win')` via the ops endpoint
4. Confirm: `settlement_status='settled'`, `settlement_result='win'` in DB
5. Confirm: `prop_settlements` row created with `final_pick_id` = pick_id
6. Confirm: `settlement_audit_log` row created
7. Trigger recap: confirm `getDailyRecapData()` returns the settled pick
8. Confirm: capper attributed correctly (not "Unit Talk" if user record exists)

### 4. DEFECT-27 — AUTOPILOT_MODE configuration

`DiscordPromotionAgent` requires `AUTOPILOT_MODE` to be set to `prod`, `canary`,
or `shadow` for any posting to occur.

Required actions:

- Add `AUTOPILOT_MODE=shadow` to docker-compose API service (shadow = logs
  posting intent without sending to Discord — safe for dev)
- Document the production value (`prod` or `canary`) and the env var location
- Verify: after GradingAgent sets `promotion_band`, DiscordPromotionAgent
  attempts to post (shadow mode: logs attempt, does not send)

### 5. DEFECT-29 — DISCORD_WEBHOOK_URL and DISCORD_TOKEN presence

Verify that `DISCORD_WEBHOOK_URL` and `DISCORD_TOKEN` are:

- Set in docker-compose for local development
- Documented in the env contract as required for Discord posting
- If not set: `AUTOPILOT_MODE=shadow` must suppress the error gracefully

### 6. Discord posting end-to-end (smoke confirmation)

With `AUTOPILOT_MODE=shadow`:

1. Submit a pick, wait for GradingAgent to grade it (or manually set fields)
2. Confirm `promotion_band` is set on the pick
3. Confirm `DiscordPromotionAgent` attempts posting (visible in agent logs)
4. Confirm the attempt is logged with the correct channel tier

In shadow mode, no message is sent. The proof is the log entry, not a Discord
message.

---

## Exclusions

- No new Discord commands or bot features
- No Discord channel structure changes
- No recap UI changes (those are in R4/operator surface)
- No changes to GradingAgent logic or scoring
- No changes to settlement RPC (those are in R1 and were addressed in REM-001)
- No changes to `prop_settlements` schema beyond what R1 addressed

---

## Acceptance Criteria

| #        | Criterion                                                                                               | Proof Artifact                           |
| -------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| AC-R5-1  | RecapService uses service role key for settled pick queries                                             | `proof_recapservice_key.txt` (code diff) |
| AC-R5-2  | `extractCapper()` resolves username from `user_id` join — not from `tags` column                        | `proof_capper_fix.txt` (code diff)       |
| AC-R5-3  | Manual settlement of a pick via ops endpoint produces: `settlement_status='settled'` in `unified_picks` | `proof_settlement_db.txt`                |
| AC-R5-4  | Manual settlement produces `prop_settlements` row with `final_pick_id` = pick_id                        | `proof_prop_settlements_row.txt`         |
| AC-R5-5  | Manual settlement produces `settlement_audit_log` row                                                   | `proof_audit_log.txt`                    |
| AC-R5-6  | `getDailyRecapData()` returns the settled pick — recap is not empty                                     | `proof_recap_populated.txt`              |
| AC-R5-7  | Capper attribution in recap shows username (not "Unit Talk") for picks with a known user                | `proof_recap_capper.txt`                 |
| AC-R5-8  | `AUTOPILOT_MODE=shadow` set in docker-compose API service                                               | `proof_compose_diff.txt`                 |
| AC-R5-9  | DiscordPromotionAgent logs a posting attempt (shadow mode) for a pick with `promotion_band` set         | `proof_discord_shadow_log.txt`           |
| AC-R5-10 | All existing tests pass — vitest ≥ R0 baseline                                                          | `proof_tests.txt`                        |
| AC-R5-11 | Type check passes                                                                                       | `proof_typecheck.txt`                    |
| AC-R5-12 | Single-writer gate passes                                                                               | `proof_gate.txt`                         |

---

## Kill Conditions

| Condition                                                                                                  | Action                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Changing RecapService to service role key exposes settlement data that was intentionally restricted by RLS | Pause. Review RLS policies for `unified_picks` on settled rows. The recap endpoint is internal; service role is appropriate, but confirm RLS intent. |
| Settlement via ops endpoint succeeds but `prop_settlements` row is not created                             | Stop. Debug the RPC transaction. Both tables must be updated atomically.                                                                             |
| `extractCapper()` user join introduces N+1 query problem in recap                                          | Fix by including the join in the primary `getDailyRecapData()` query, not as a separate lookup per pick.                                             |
| `AUTOPILOT_MODE=shadow` causes GradingAgent to post to Discord in local dev                                | Immediate rollback. Shadow must mean no-send. Verify DiscordPromotionAgent shadow logic before declaring R5 complete.                                |

---

## Proof Artifacts

```
out/sprints/UTRP-R5-DOWNSTREAM-OUTCOME-RECONSTRUCTION/<DATE>/
├── proofs/
│   ├── proof_recapservice_key.txt      # Code diff: service role key
│   ├── proof_capper_fix.txt            # Code diff: user_id join in extractCapper
│   ├── proof_settlement_db.txt         # DB query output: settlement_status='settled'
│   ├── proof_prop_settlements_row.txt  # DB query output: prop_settlements row
│   ├── proof_audit_log.txt             # DB query output: settlement_audit_log row
│   ├── proof_recap_populated.txt       # RecapService output showing settled pick
│   ├── proof_recap_capper.txt          # Recap output showing username attribution
│   ├── proof_compose_diff.txt          # docker-compose diff: AUTOPILOT_MODE=shadow
│   ├── proof_discord_shadow_log.txt    # DiscordPromotionAgent log: shadow posting attempt
│   ├── proof_tests.txt
│   ├── proof_typecheck.txt
│   └── proof_gate.txt
└── SPRINT_CLOSEOUT_REPORT.md
```

---

## The End-to-End Chain

R5 is the workstream that proves the following sequence works:

```
Submit pick
  → unified_picks row created with all required fields (R2)
  → GradingAgent grades pick → sets tier, promotion_band, professional_score
  → DiscordPromotionAgent queues pick → AUTOPILOT_MODE=shadow → logs intent (R5)
  → Operator calls settle via CC ops endpoint → 200 (R3)
  → manual_settle_pick RPC → settlement_status='settled' (R1)
  → prop_settlements row created
  → settlement_audit_log row created
  → RecapService getDailyRecapData() → picks returned (R5)
  → Capper attributed to username (R5)
```

This chain does not need to be automated in R5. It needs to be **manually
proven** with the above proof artifacts. Automation is R6's job.

---

## Dependency Order

```
R5 depends on: R3 COMPLETE (auth), R4 COMPLETE (surface)
R5 must complete before: R6, R7
```

---

**Workstream Owner**: Engineering Team **Estimated Effort**: 2 sessions
(RecapService fixes + settlement E2E proof + Discord shadow verification)
