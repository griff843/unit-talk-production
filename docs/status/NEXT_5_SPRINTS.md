# Next 5 Sprints

**Last Updated**: 2026-03-16 (SPRINT-069-SETTLEMENT-RPC-REPAIR) **Source**:
SPRINT-069 settlement RPC repair + drift report

> **Layer 1 COMPLETE**: Full lifecycle E2E path certified (R13: FAIL→CERTIFIED).
> One pick traversed SUBMIT→SCORE→PROMOTE→POST→SETTLE→RECAP. Layer 1: 4P/9P/0F.
> DRIFT-H6 RESOLVED. See `docs/status/LAYER1_EXIT_REQUIREMENTS.md` for full
> matrix.

---

## Sprint Queue

> **SPRINT-069-SETTLEMENT-RPC-REPAIR** completed 2026-03-16 (Lane 1 + 3).
> Created 7 missing DB objects for manual_settle_pick() + correct_settlement()
> RPCs. DEFECT-10/11/12 resolved. TypeScript types updated. 1025/1025 vitest.
> Commit: 0345bafb. UNI-101 Done. SPRINT-072 removed (DEFECT-10/12 now
> resolved).

| #   | Sprint                            | Priority | Phase | Focus                                                                             | Blocked By |
| --- | --------------------------------- | -------- | ----- | --------------------------------------------------------------------------------- | ---------- |
| 1   | SPRINT-070-EMBED-CONTRACT-FIX     | P2       | L3    | Fix 5 embed defects (build:unknown, enum leak)                                    | None       |
| 2   | SPRINT-071-SCORING-ENGINE-V2-WIRE | P1       | L1    | Set SCORING_ENGINE_V2 env in production agents; full live-data scoring round-trip | None       |
| 3   | SPRINT-073-LAYER3-PHASE12-NEXT    | P2       | L3    | Next Layer 3 / Phase 12 deliverable (TBD from sprint-plan)                        | None       |
| 4   | SPRINT-074-TBD                    | P3       | TBD   | TBD from sprint-plan                                                              | None       |
| 5   | SPRINT-075-TBD                    | P3       | TBD   | TBD from sprint-plan                                                              | None       |

**Dependency chain**: **Layer 1 is COMPLETE.** Full E2E certified (SPRINT-068).
Settlement RPC repair COMPLETE (SPRINT-069). Sprint 1 (embed fix) is Layer 3
polish. Sprint 2 (live scoring wire) connects the scoring chain to production
agents. **LIFECYCLE CERTIFICATION**: Full lifecycle
(submit→score→promote→post→settle→recap) CERTIFIED (SPRINT-068). Settlement PASS
(harness-bounded; RPC objects now in place). Scoring PARTIAL (synthetic data,
live-data wire pending SPRINT-071). Recap PARTIAL (schema+query fixed, not
exercised via Temporal scheduling).

---

## Completed Sprint History

<details>
<summary>41 sprints completed (2026-03-10 through 2026-03-16) — click to expand</summary>

| Sprint                             | Date       | PR   | Linear    | Layer/Phase |
| ---------------------------------- | ---------- | ---- | --------- | ----------- |
| RISK-BANKROLL-KELLY                | 2026-03-10 | #141 | UNI-53    | Ph 3        |
| RISK-EXPOSURE-CORRELATION          | 2026-03-10 | #142 | UNI-54    | Ph 3        |
| OBSERVABILITY-BUILD-FIX            | 2026-03-10 | #146 | UNI-55    | Ph 1        |
| PROMOTION-RUNTIME-ACTIVATION       | 2026-03-10 | #149 | UNI-56    | Ph 1→3      |
| DISCORD-RECAP-VERIFICATION         | 2026-03-10 | #152 | UNI-57    | Ph 4        |
| LAYER1-PHASE5-E2E-CLOSURE          | 2026-03-14 | #163 | —         | L1/Ph 5     |
| CLAUDE-OS-UPGRADE-COS001-005       | 2026-03-14 | #170 | UNI-64–68 | Meta        |
| RISK-DASHBOARD-MONITORING          | 2026-03-14 | #177 | UNI-69    | L2/Ph 7     |
| JEST-QUARANTINE-CLEANUP            | 2026-03-14 | —    | UNI-70    | L1/Ph 0     |
| 041-MARKET-TYPE-EXPOSURE-CAPS      | 2026-03-14 | #185 | UNI-72    | Ph 3        |
| 042-LAYER2-PHASE6-OPERATOR-CP      | 2026-03-14 | #189 | —         | L2/Ph 6     |
| 043-LAYER2-PHASE7-RELIABILITY      | 2026-03-14 | #191 | UNI-74    | L2/Ph 7     |
| 044-LAYER2-PHASE8-RECOVERY         | 2026-03-14 | #199 | UNI-77    | L2/Ph 8     |
| PLATFORM-VERIFICATION-LOCK         | 2026-03-14 | —    | —         | L2          |
| 045-OPERATOR-AUTH-HARDENING        | 2026-03-14 | —    | —         | L2/Sec      |
| 045-SCHEMA-TYPE-SYNC               | 2026-03-14 | —    | —         | Infra       |
| 046-OPERATOR-AUDIT-TRAIL           | 2026-03-14 | #210 | —         | L2/Sec      |
| 047-INGESTION-UNIT-COVERAGE-LOCK   | 2026-03-14 | #211 | UNI-81    | L2/Ph 7     |
| 048-TRUTH-RECONCILIATION-LAYER3    | 2026-03-15 | #215 | UNI-82    | Meta        |
| COS-007-SPRINT-CLOSE-VALIDATION    | 2026-03-15 | #217 | UNI-83    | Claude OS   |
| 049-LAYER3-PHASE10-CC-AUTH-FNDTN   | 2026-03-15 | #221 | UNI-84    | L3/Ph 10    |
| 050-LAYER3-PHASE10-CC-PERM-ENF     | 2026-03-15 | #224 | UNI-85    | L3/Ph 10    |
| 051-LAYER3-PHASE9-SMARTFORM-UX     | 2026-03-15 | #227 | UNI-86    | L3/Ph 9     |
| 052-LAYER3-PHASE11-OP-WORKFLOW     | 2026-03-15 | #230 | UNI-87    | L3/Ph 11    |
| 053-GOVERNANCE-NAMING-CONVENTION   | 2026-03-15 | #234 | UNI-88    | Meta        |
| 055-MCP-LAYER-PARITY-FIX           | 2026-03-15 | #238 | UNI-89    | MCP/Infra   |
| 056-OBSERVABILITY-SKILLS           | 2026-03-15 | #243 | UNI-90    | Skills/MCP  |
| 057-CHATGPT-ENHANCEMENT-LAYER      | 2026-03-15 | #247 | UNI-91    | AI/Docs     |
| 054-LAYER3-PHASE10-REPLAY-ENDPOINT | 2026-03-15 | #252 | UNI-92    | L3/Ph 10    |
| 058-LAYER3-PHASE10-CC-HEALTH-DASH  | 2026-03-15 | #255 | UNI-93    | L3/Ph 10    |
| 059-AI-OS-WAVE2-AGENTS             | 2026-03-16 | #259 | UNI-94    | AI OS       |
| 060-LAYER3-PHASE11-CC-WORKFLOW     | 2026-03-16 | #262 | UNI-95    | L3/Ph 11    |
| 061-LAYER3-PHASE10-CC-ALERT-DASH   | 2026-03-16 | #265 | UNI-96    | L3/Ph 10    |
| 062-FULL-LIFECYCLE-E2E-TRUTH-AUDIT | 2026-03-16 | #269 | —         | Audit       |
| 063-LIFECYCLE-TRUTH-RESTORATION    | 2026-03-16 | —    | —         | Audit/Docs  |
| 064-SETTLEMENT-LIFECYCLE-FIX       | 2026-03-16 | —    | —         | Audit/L1    |
| 065-LAYER1-COMPLETION-VERIFICATION | 2026-03-16 | —    | UNI-97    | Audit/L1    |
| 066-SCORING-CERTIFICATION          | 2026-03-16 | —    | UNI-98    | L1/Ph 2     |
| 067-RECAP-SCHEMA-FIX               | 2026-03-16 | —    | UNI-99    | L1/Ph 1     |
| 068-E2E-LIFECYCLE-CERT             | 2026-03-16 | —    | UNI-100   | L1 Exit     |
| 069-SETTLEMENT-RPC-REPAIR          | 2026-03-16 | #275 | UNI-101   | Schema/L2   |

</details>
