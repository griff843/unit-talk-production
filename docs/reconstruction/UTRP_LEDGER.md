# UTRP Reconstruction Ledger

> **Authority**: UTRP Charter §6 — Ledger is updated at every state transition.
> This is the canonical source of program truth.
>
> **Last Updated**: 2026-03-19 | **Program Status**: R0 COMPLETE — R1 UNLOCKED

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

| ID        | Severity | Title                                                                                                                                       | Workstream | Status      | Sprint                                   | Notes                                                                                                                                     |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| DEFECT-8  | P0       | `chk_unified_picks_workflow_stage` only allows `pending_review`/`approved`                                                                  | R1         | ✅ RESOLVED | SPRINT-UNIFIED-PICKS-CONTRACT-TRUTH-LOCK | Migration `20260319120000_fix_workflow_stage_constraint.sql` applied. 9-value lifecycle set.                                              |
| DEFECT-9  | P0       | `prop_settlements` schema mismatch: code legacy paths use `pick_id`/`outcome`, DB has `final_pick_id`/`settlement_result`                   | R1         | OPEN        | —                                        | RPC uses correct names. API/route layer must be audited and aligned.                                                                      |
| DEFECT-10 | P1       | `atomic_submit_ticket` defaults `confidence` to `0` not `NULL` when form omits it                                                           | R1         | OPEN        | —                                        | Creates false EV signals. GradingAgent sees `confidence=0` as real data. R1 is canonical fix location; R2 verifies if not resolved in R1. |
| DEFECT-11 | P1       | `atomic_submit_ticket` has no `provider`/sportsbook param                                                                                   | R2         | OPEN        | —                                        | Provider is never written to `unified_picks`.                                                                                             |
| DEFECT-12 | P1       | `matchup` column exists in `unified_picks` but is never written by RPC or BridgeWorker                                                      | R2         | OPEN        | —                                        | Column exists (from migration) but neither V1 RPC nor V3 BridgeWorker writes to it. Always NULL.                                          |
| DEFECT-13 | P2       | `unified_picks.confidence` column has no CHECK constraint for valid range (0–100)                                                           | R1         | OPEN        | —                                        | Low-impact; schema correctness only.                                                                                                      |
| DEFECT-36 | P1       | `SettlementAgent` writes `pickId` (unified_picks.id) to `settlement_log.prop_settlement_id` (FK to prop_settlements.id) — FK value mismatch | R1         | OPEN        | —                                        | Line 904. Writes succeed only if `pickId` happens to match a prop_settlements row by coincidence.                                         |

---

## Auth / Security Defects

| ID        | Severity | Title                                                                                                                                                            | Workstream | Status | Sprint | Notes                                                                                                                            |
| --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| DEFECT-14 | P0       | CC→API operatorAuth returns 403 — CC sends `Bearer admin-internal` (non-JWT garbage token); JWT verify fails → 403. Dev passthrough only triggers with NO token. | R3         | OPEN   | —      | Blocks all CC ops actions: approve, reject, settle. API runs NODE_ENV=development but passthrough dead because CC sends a token. |
| DEFECT-15 | P1       | No `INTERNAL_SERVICE_TOKEN` mechanism for CC→API internal calls                                                                                                  | R3         | OPEN   | —      | Required fix for DEFECT-14.                                                                                                      |
| DEFECT-16 | P2       | CC uses `NODE_ENV=production` in docker-compose while API uses `NODE_ENV=development` — inconsistent per-service NODE_ENV                                        | R3         | OPEN   | —      | Only CC has production mode. API is development. Per-service review needed.                                                      |

---

## Submission Pipeline Defects

| ID        | Severity | Title                                                                                                                        | Workstream | Status      | Sprint                                   | Notes                                                                                                            |
| --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| DEFECT-17 | P1       | `home_team`/`away_team` only mapped for `source='manual'` in RPC — other sources lose team data                              | R2         | OPEN        | —                                        | Conditional mapping should be unconditional.                                                                     |
| DEFECT-18 | P1       | `/api/picks` was missing `bet_type`, `home_team`, `away_team`, `posted_to_discord`, and users join                           | R4         | ✅ RESOLVED | SPRINT-UNIFIED-PICKS-CONTRACT-TRUTH-LOCK | 4 fields + join added.                                                                                           |
| DEFECT-33 | P1       | BridgeWorker V3 maps only 10 of 26+ fields — drops provider, matchup, home_team, away_team, confidence, user_id, ticket_type | R2         | OPEN        | —                                        | `handleBridgeOutboxTicketSubmitted` lines 978-992. V1 RPC writes all 26; V3 path loses critical fields silently. |

---

## Operator Surface Defects

| ID        | Severity | Title                                                                                                                     | Workstream | Status      | Sprint                                   | Notes                                                                      |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| DEFECT-19 | P1       | Picks HQ rendered synthetic defaults: `capper='Unknown Capper'`, `tier='C'`, `confidence=50`, `market_type='player_prop'` | R4         | ✅ RESOLVED | SPRINT-POST-REM-OPERATOR-SURFACE-TRUST   | Null-safe rendering applied.                                               |
| DEFECT-20 | P2       | Command Center footer shows `build:unknown`, `branch:unknown` when containers start without git identity                  | R4         | ✅ RESOLVED | SPRINT-POST-REM-OPERATOR-SURFACE-TRUST   | `ops/day.ps1` Step C0 added.                                               |
| DEFECT-21 | P1       | Capper display in Picks HQ always "—" — no username from users join                                                       | R4         | ✅ RESOLVED | SPRINT-UNIFIED-PICKS-CONTRACT-TRUTH-LOCK | `users!unified_picks_user_id_fkey (username)` join added.                  |
| DEFECT-22 | P1       | Disconnected state in CC pipeline dashboard — HTTP polling `/api/pipeline/health` fails                                   | R4         | OPEN        | —                                        | Environmental when API is running. Needs resiliency fix (retry/reconnect). |

---

## Settlement Pipeline Defects

| ID        | Severity | Title                                                                                                                                                             | Workstream | Status | Sprint | Notes                                                                                                                |
| --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------ | -------------------------------------------------------------------------------------------------------------------- |
| DEFECT-23 | P0       | Settlement blocked at auth layer — 401 from CC for all ops endpoints                                                                                              | R3         | OPEN   | —      | Same root as DEFECT-14. Settlement pipeline cannot be exercised from CC.                                             |
| DEFECT-24 | P1       | `RecapService` uses `SUPABASE_ANON_KEY` not service role — may hit RLS restrictions on settled pick queries                                                       | R5         | OPEN   | —      | Even post-settlement, recap may return empty under RLS.                                                              |
| DEFECT-25 | P1       | `RecapService.extractCapper()` reads non-existent `tags` column on `unified_picks` — capper attribution always "Unit Talk"                                        | R5         | OPEN   | —      | Must join `users` table or read `user_id` instead.                                                                   |
| DEFECT-26 | P1       | `getDailyRecapData()` filter: `settlement_status='settled'` AND `settlement_result NOT NULL` — correct semantics, but settlement pipeline must be unblocked first | R5         | OPEN   | —      | Not a code bug; a dependency on R3/DEFECT-14 fix.                                                                    |
| DEFECT-34 | P1       | CC settlement route (`/api/settlement/route.ts:104`) calls `manual_settle_pick` RPC directly — bypasses API lifecycle adapters entirely                           | R3         | OPEN   | —      | Single-writer violation. CC must route through API, not direct Supabase RPC. Moot while DEFECT-14 blocks all CC ops. |
| DEFECT-35 | P1       | SettlementAgent has no processing loop — `.start()` only initializes, no periodic poll or event trigger                                                           | R5         | OPEN   | —      | Settlement is manual-only. Must add cron/poll or event-driven trigger for automated settlement.                      |

---

## Discord / Promotion Defects

| ID        | Severity | Title                                                                                                  | Workstream | Status | Sprint | Notes                                                                         |
| --------- | -------- | ------------------------------------------------------------------------------------------------------ | ---------- | ------ | ------ | ----------------------------------------------------------------------------- |
| DEFECT-27 | P1       | `AUTOPILOT_MODE` not set in docker-compose API service — DiscordPromotionAgent does not post           | R5         | OPEN   | —      | Must be `prod`, `canary`, or `shadow` for any posting.                        |
| DEFECT-28 | P1       | `promotion_band=null` at submission — DiscordPromotionAgent blocks with `BLOCKED_PROMOTION_INELIGIBLE` | R5         | OPEN   | —      | By design; GradingAgent must run. But GradingAgent must be confirmed running. |
| DEFECT-29 | P2       | `DISCORD_WEBHOOK_URL` and `DISCORD_TOKEN` not confirmed present in docker-compose API service          | R5         | OPEN   | —      | Posting will silently fail if unset even with AUTOPILOT_MODE set.             |

---

## Verification / Test Coverage Defects

| ID        | Severity | Title                                                                                       | Workstream | Status | Sprint | Notes                                                       |
| --------- | -------- | ------------------------------------------------------------------------------------------- | ---------- | ------ | ------ | ----------------------------------------------------------- |
| DEFECT-30 | P1       | R2 replay fixture only covers 3 NBA/NFL/MLB player props — no game total or spread bet type | R6         | OPEN   | —      | `post-rem-events.jsonl` needs game total + spread fixtures. |
| DEFECT-31 | P1       | No E2E test covering submit → grade → post → settle → recap → Discord chain                 | R6         | OPEN   | —      | Critical path has no automated verification.                |
| DEFECT-32 | P2       | No CI test for settlement auth (401 scenario)                                               | R6         | OPEN   | —      | Auth regression would be silent.                            |

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

| Workstream                      | Status         | Blocking Defects                    |
| ------------------------------- | -------------- | ----------------------------------- |
| R0 — Truth Reset                | ✅ COMPLETE    | None (DB caveat: migration-derived) |
| R1 — Canonical Data             | 🔓 UNLOCKED    | R0 complete                         |
| R2 — Submission Contract        | ⬜ NOT STARTED | Awaits R1                           |
| R3 — Lifecycle Auth             | ⬜ NOT STARTED | Awaits R1                           |
| R4 — Operator Surface           | ⬜ NOT STARTED | Awaits R1, R2, R3                   |
| R5 — Downstream Outcomes        | ⬜ NOT STARTED | Awaits R3, R4                       |
| R6 — Verification Control Plane | ⬜ NOT STARTED | Awaits R1–R5                        |
| R7 — Closeout                   | ⬜ NOT STARTED | Awaits R0–R6 + 48h gate             |

**Open P0 defects**: DEFECT-9, DEFECT-14, DEFECT-23 **Open P1 defects**:
DEFECT-10, DEFECT-11, DEFECT-12, DEFECT-15, DEFECT-17, DEFECT-22, DEFECT-24,
DEFECT-25, DEFECT-26, DEFECT-27, DEFECT-28, DEFECT-30, DEFECT-31, DEFECT-33,
DEFECT-34, DEFECT-35, DEFECT-36 **Resolved**: DEFECT-1 through DEFECT-8,
DEFECT-18, DEFECT-19, DEFECT-20, DEFECT-21

---

**Ledger Owner**: Engineering Team **Protocol**: Update this file at every
workstream state change before declaring sprint complete.
