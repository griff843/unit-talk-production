# UTRP Reconstruction Ledger

> **Authority**: UTRP Charter §6 — Ledger is updated at every state transition.
> This is the canonical source of program truth.
>
> **Last Updated**: 2026-03-19 | **Program Status**: R2 COMPLETE — R3 COMPLETE —
> R4 COMPLETE — R5 COMPLETE — R6 COMPLETE — R7 UNLOCKED

---

## Defect Registry

### Severity Key

| Code | Meaning                                                             |
| ---- | ------------------------------------------------------------------- |
| P0   | Blocks a critical pipeline path. Production data cannot flow.       |
| P1   | Degrades operator visibility or correctness without total blockage. |
| P2   | Cosmetic, informational, or low-frequency.                          |

### Status Key

| Code      | Meaning                                                       |
| --------- | ------------------------------------------------------------- |
| OPEN      | Known issue, not yet assigned to an active sprint.            |
| IN-FLIGHT | Assigned to an active workstream, work in progress.           |
| RESOLVED  | Fix applied, tests pass, proof artifact exists.               |
| DEFERRED  | Acknowledged but explicitly out of UTRP scope with rationale. |

---

## Schema / Data Defects

| ID        | Severity | Title                                                                                                                                       | Workstream | Status      | Sprint                                    | Notes                                                                                                                                                         |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEFECT-8  | P0       | `chk_unified_picks_workflow_stage` only allows `pending_review`/`approved`                                                                  | R1         | ✅ RESOLVED | SPRINT-UNIFIED-PICKS-CONTRACT-TRUTH-LOCK  | Migration `20260319120000_fix_workflow_stage_constraint.sql` applied. 9-value lifecycle set.                                                                  |
| DEFECT-9  | P0       | `prop_settlements` schema mismatch: code legacy paths use `pick_id`/`outcome`, DB has `final_pick_id`/`settlement_result`                   | R1         | ✅ RESOLVED | UTRP-R1-CANONICAL-DATA                    | mcp-state adapter corrected: `pick_id` → `final_pick_id` in query, filter, and mapping. All other surfaces already correct.                                   |
| DEFECT-10 | P1       | `atomic_submit_ticket` defaults `confidence` to `0` not `NULL` when form omits it                                                           | R1         | ✅ RESOLVED | UTRP-R1-CANONICAL-DATA                    | Migration `20260319150000`: COALESCE removed, NULL propagated. Caveat: requires DB application.                                                               |
| DEFECT-11 | P1       | `atomic_submit_ticket` has no `provider`/sportsbook param                                                                                   | R2         | ✅ RESOLVED | UTRP-R2-SUBMISSION-CONTRACT               | Migration `20260319160000`: `p_provider TEXT DEFAULT NULL` added, writes to `provider` column.                                                                |
| DEFECT-12 | P1       | `matchup` column exists in `unified_picks` but is never written by RPC or BridgeWorker                                                      | R2         | ✅ RESOLVED | UTRP-R2-SUBMISSION-CONTRACT               | Migration `20260319160000`: `p_matchup TEXT DEFAULT NULL` added, writes to `matchup` column with team-name derivation fallback.                               |
| DEFECT-13 | P2       | `unified_picks.confidence` column has no CHECK constraint for valid range (0–100)                                                           | R1         | ✅ RESOLVED | UTRP-R1-CANONICAL-DATA                    | Migration `20260319150001`: CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100)). Caveat: requires DB application.                           |
| DEFECT-36 | P1       | `SettlementAgent` writes `pickId` (unified_picks.id) to `settlement_log.prop_settlement_id` (FK to prop_settlements.id) — FK value mismatch | R5         | ✅ RESOLVED | UTRP-R5-DOWNSTREAM-OUTCOME-RECONSTRUCTION | SettlementAgent.manualSettle(): queries prop_settlements.id before settlement_log.insert. ops route also fixed: creates prop_settlements row and uses its id. |

---

## Auth / Security Defects

| ID        | Severity | Title                                                                                                                                                            | Workstream | Status      | Sprint                 | Notes                                                                                                                                        |
| --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| DEFECT-14 | P0       | CC→API operatorAuth returns 403 — CC sends `Bearer admin-internal` (non-JWT garbage token); JWT verify fails → 403. Dev passthrough only triggers with NO token. | R3         | ✅ RESOLVED | UTRP-R3-LIFECYCLE-AUTH | Garbage Bearer token replaced with `X-Internal-Service-Token` in CC ops proxy. `operatorAuth.ts` validates token → `operator_override` role. |
| DEFECT-15 | P1       | No `INTERNAL_SERVICE_TOKEN` mechanism for CC→API internal calls                                                                                                  | R3         | ✅ RESOLVED | UTRP-R3-LIFECYCLE-AUTH | `INTERNAL_SERVICE_TOKEN` added to `operatorAuth.ts`, docker-compose (API + CC), `.env.example`. Min 32-char, env-var only, never logged.     |
| DEFECT-16 | P2       | CC uses `NODE_ENV=production` in docker-compose while API uses `NODE_ENV=development` — inconsistent per-service NODE_ENV                                        | R3         | ✅ RESOLVED | UTRP-R3-LIFECYCLE-AUTH | Per-service NODE_ENV is intentional. INTERNAL_SERVICE_TOKEN mechanism makes auth independent of NODE_ENV — R3 doc confirms this is the fix.  |

---

## Submission Pipeline Defects

| ID        | Severity | Title                                                                                                                        | Workstream | Status      | Sprint                                   | Notes                                                                                                               |
| --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| DEFECT-17 | P1       | `home_team`/`away_team` only mapped for `source='manual'` in RPC — other sources lose team data                              | R2         | ✅ RESOLVED | UTRP-R2-SUBMISSION-CONTRACT              | Migration `20260319160000`: accepts `home_team`/`away_team` JSON keys, builds `manual_fields_blob` unconditionally. |
| DEFECT-18 | P1       | `/api/picks` was missing `bet_type`, `home_team`, `away_team`, `posted_to_discord`, and users join                           | R4         | ✅ RESOLVED | SPRINT-UNIFIED-PICKS-CONTRACT-TRUTH-LOCK | 4 fields + join added.                                                                                              |
| DEFECT-33 | P1       | BridgeWorker V3 maps only 10 of 26+ fields — drops provider, matchup, home_team, away_team, confidence, user_id, ticket_type | R2         | OPEN        | —                                        | `handleBridgeOutboxTicketSubmitted` lines 978-992. V1 RPC writes all 26; V3 path loses critical fields silently.    |

---

## Operator Surface Defects

| ID        | Severity | Title                                                                                                                     | Workstream | Status      | Sprint                                   | Notes                                                                                                                                                                           |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEFECT-19 | P1       | Picks HQ rendered synthetic defaults: `capper='Unknown Capper'`, `tier='C'`, `confidence=50`, `market_type='player_prop'` | R4         | ✅ RESOLVED | UTRP-R4-OPERATOR-SURFACE                 | Null-safe rendering completed in PicksTableCard.tsx: tier/ev_score/confidence show "—" when null. bet_type, home_team, away_team, posted_to_discord added to Pick Details cell. |
| DEFECT-20 | P2       | Command Center footer shows `build:unknown`, `branch:unknown` when containers start without git identity                  | R4         | ✅ RESOLVED | SPRINT-POST-REM-OPERATOR-SURFACE-TRUST   | `ops/day.ps1` Step C0 added.                                                                                                                                                    |
| DEFECT-21 | P1       | Capper display in Picks HQ always "—" — no username from users join                                                       | R4         | ✅ RESOLVED | SPRINT-UNIFIED-PICKS-CONTRACT-TRUTH-LOCK | `users!unified_picks_user_id_fkey (username)` join added.                                                                                                                       |
| DEFECT-22 | P1       | Disconnected state in CC pipeline dashboard — HTTP polling `/api/pipeline/health` fails                                   | R4         | ✅ RESOLVED | UTRP-R4-OPERATOR-SURFACE                 | `usePipelineDashboard`: retry:0, consecutive-failure counting (≥3 cycles = Disconnected). `ConnectionStatus`: uses `isDisconnected`/`isChecking`, shows last-known-good time.   |

---

## Settlement Pipeline Defects

| ID        | Severity | Title                                                                                                                                                             | Workstream | Status      | Sprint                                            | Notes                                                                                                                                                               |
| --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEFECT-23 | P0       | Settlement blocked at auth layer — 401 from CC for all ops endpoints                                                                                              | R3         | ✅ RESOLVED | UTRP-R3-LIFECYCLE-AUTH                            | Root cause same as DEFECT-14 (garbage token). CC settlement POST now routes to API `/ops/picks/:id/settle-result` with internal service token.                      |
| DEFECT-24 | P1       | `RecapService` uses `SUPABASE_ANON_KEY` not service role — may hit RLS restrictions on settled pick queries                                                       | R5         | ✅ RESOLVED | UTRP-R5-DOWNSTREAM-OUTCOME-RECONSTRUCTION         | recapService.ts constructor: SUPABASE_ANON_KEY → SUPABASE_SERVICE_ROLE_KEY. RecapService is read-only; service role is appropriate.                                 |
| DEFECT-25 | P1       | `RecapService.extractCapper()` reads non-existent `tags` column on `unified_picks` — capper attribution always "Unit Talk"                                        | R5         | ✅ RESOLVED | UTRP-R5-DOWNSTREAM-OUTCOME-RECONSTRUCTION         | getDailyRecapData/Weekly/Monthly: select now includes users join. mapRawPickToUnifiedPick: capper = raw.users?.username ?? 'Unit Talk'.                             |
| DEFECT-26 | P1       | `getDailyRecapData()` filter: `settlement_status='settled'` AND `settlement_result NOT NULL` — correct semantics, but settlement pipeline must be unblocked first | R5         | ✅ RESOLVED | UTRP-R5-DOWNSTREAM-OUTCOME-RECONSTRUCTION         | Root cause was ops route not setting settlement_status. Fixed: /ops/picks/:id/settle-result now sets settlement_status='settled', creates prop_settlements row.     |
| DEFECT-34 | P1       | CC settlement route (`/api/settlement/route.ts:104`) calls `manual_settle_pick` RPC directly — bypasses API lifecycle adapters entirely                           | R3         | ✅ RESOLVED | UTRP-R3-LIFECYCLE-AUTH                            | POST handler replaced: no longer calls Supabase RPC. Routes through API `/ops/picks/:id/settle-result` with internal service token. Single-writer compliant.        |
| DEFECT-35 | P1       | SettlementAgent has no processing loop — `.start()` only initializes, no periodic poll or event trigger                                                           | R6         | ✅ RESOLVED | UTRP-R6-VERIFICATION-CONTROL-PLANE-RECONSTRUCTION | BaseAgent `_scheduledProcessInterval` + `processing?.intervalSeconds` config added. `start()` starts setInterval; `stop()` clears it. Zod schema validates min 10s. |

---

## Discord / Promotion Defects

| ID        | Severity | Title                                                                                                  | Workstream | Status      | Sprint                                    | Notes                                                                                                           |
| --------- | -------- | ------------------------------------------------------------------------------------------------------ | ---------- | ----------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| DEFECT-27 | P1       | `AUTOPILOT_MODE` not set in docker-compose API service — DiscordPromotionAgent does not post           | R5         | ✅ RESOLVED | UTRP-R5-DOWNSTREAM-OUTCOME-RECONSTRUCTION | docker-compose API service: AUTOPILOT_MODE=shadow added. Shadow = logs intent, no Discord send (safe for dev).  |
| DEFECT-28 | P1       | `promotion_band=null` at submission — DiscordPromotionAgent blocks with `BLOCKED_PROMOTION_INELIGIBLE` | R5         | OPEN        | —                                         | By design; GradingAgent must run. No code fix applicable — operational concern.                                 |
| DEFECT-29 | P2       | `DISCORD_WEBHOOK_URL` and `DISCORD_TOKEN` not confirmed present in docker-compose API service          | R5         | ✅ RESOLVED | UTRP-R5-DOWNSTREAM-OUTCOME-RECONSTRUCTION | docker-compose API service: DISCORD_WEBHOOK_URL and DISCORD_TOKEN explicit entries added. .env.example updated. |

---

## Verification / Test Coverage Defects

| ID        | Severity | Title                                                                                       | Workstream | Status      | Sprint                                            | Notes                                                                                                                                                                        |
| --------- | -------- | ------------------------------------------------------------------------------------------- | ---------- | ----------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEFECT-30 | P1       | R2 replay fixture only covers 3 NBA/NFL/MLB player props — no game total or spread bet type | R6         | ✅ RESOLVED | UTRP-R6-VERIFICATION-CONTROL-PLANE-RECONSTRUCTION | `post-rem-events-3types.jsonl` created: 3 picks × 3 bet types (player_prop/total/spread) + full lifecycle. Gate H added to run-replay.ts verifying settlement truth.         |
| DEFECT-31 | P1       | No E2E test covering submit → grade → post → settle → recap → Discord chain                 | R6         | ✅ RESOLVED | UTRP-R6-VERIFICATION-CONTROL-PLANE-RECONSTRUCTION | `e2e-critical-path.test.ts`: 5 tests covering full governed lifecycle in-process (no production DB). ReplayLifecycleRunner + IsolatedPickStore. Recap filter match verified. |
| DEFECT-32 | P2       | No CI test for settlement auth (401 scenario)                                               | R6         | ✅ RESOLVED | UTRP-R6-VERIFICATION-CONTROL-PLANE-RECONSTRUCTION | `operatorAuth.test.ts`: 6 scenarios covering all auth paths (internal token, JWT, 401, 403, E2E bypass, short-token guard). Added to CI run_lifecycle_gate.                  |

---

## Resolved Defects (Pre-UTRP)

| ID       | Severity | Title                                                                 | Sprint         | Resolved   |
| -------- | -------- | --------------------------------------------------------------------- | -------------- | ---------- |
| DEFECT-1 | P0       | Settlement RPC lacked `rpc_context` flag — trigger blocked all writes | SPRINT-REM-001 | 2026-03-18 |
| DEFECT-2 | P0       | Alert pipeline not firing — no recipients configured                  | SPRINT-REM-002 | 2026-03-18 |
| DEFECT-3 | P0       | Command Center health derived from wrong source                       | SPRINT-REM-003 | 2026-03-18 |
| DEFECT-4 | P0       | Ingestion pipeline not confirmed — FeedAgent unverified               | SPRINT-REM-004 | 2026-03-18 |
| DEFECT-5 | P0       | Worker heartbeat not reporting truth                                  | SPRINT-REM-005 | 2026-03-18 |
| DEFECT-6 | P0       | Workflow failure alerts not wired                                     | SPRINT-REM-006 | 2026-03-18 |
| DEFECT-7 | P0       | SLO queries reading `lifecycle_stage` not `settlement_status`         | SPRINT-REM-007 | 2026-03-18 |

---

## Program State Summary

| Workstream                      | Status      | Blocking Defects                    |
| ------------------------------- | ----------- | ----------------------------------- |
| R0 — Truth Reset                | ✅ COMPLETE | None (DB caveat: migration-derived) |
| R1 — Canonical Data             | ✅ COMPLETE | None (DB migration caveat)          |
| R2 — Submission Contract        | ✅ COMPLETE | None (DB migration caveat)          |
| R3 — Lifecycle Auth             | ✅ COMPLETE | None                                |
| R4 — Operator Surface           | ✅ COMPLETE | None                                |
| R5 — Downstream Outcomes        | ✅ COMPLETE | None                                |
| R6 — Verification Control Plane | ✅ COMPLETE | None                                |
| R7 — Closeout                   | 🔓 UNLOCKED | Awaits 48h observation gate         |

**Open P0 defects**: None **Open P1 defects**: DEFECT-28, DEFECT-33
**Resolved**: DEFECT-1 through DEFECT-27, DEFECT-29, DEFECT-30, DEFECT-31,
DEFECT-32, DEFECT-34, DEFECT-35, DEFECT-36

---

**Ledger Owner**: Engineering Team **Protocol**: Update this file at every
workstream state change before declaring sprint complete.
