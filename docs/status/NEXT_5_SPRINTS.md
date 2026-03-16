# Next 5 Sprints

**Last Updated**: 2026-03-16 (SPRINT-066-SCORING-CERTIFICATION) **Source**:
SPRINT-066 certification + LAYER1_EXIT_REQUIREMENTS.md + drift report

> **Layer 1 NOT COMPLETE**: SPRINT-066 exercised scoring pipeline (R04/R05/R06
> FAIL→PARTIAL). RecapAgent still non-functional (wrong column names). Full
> lifecycle E2E path never traversed. Sprint queue targets Layer 1 closure. See
> `docs/status/LAYER1_EXIT_REQUIREMENTS.md` for full requirements matrix.

---

## Sprint Queue

> **SPRINT-066-SCORING-CERTIFICATION** completed 2026-03-16 (Lane 1 + 3).
> computeScoreV2 exercised. CONSTITUTIONAL gates 7+8 satisfied. GAP-L1-01/02
> closed. L1: 3P/8P/2F (was 3P/5P/5F). API vitest 1025. Next: recap fix.

| #   | Sprint                            | Priority | Phase | Focus                                                                               | Blocked By |
| --- | --------------------------------- | -------- | ----- | ----------------------------------------------------------------------------------- | ---------- |
| 1   | SPRINT-067-RECAP-SCHEMA-FIX       | P0       | L1    | Fix RecapAgent column refs (play_status→status); verify recap against settled picks | None       |
| 2   | SPRINT-068-E2E-LIFECYCLE-CERT     | P0       | L1    | One pick: submit→score→post→settle→recap (Layer 1 exit proof)                       | 067        |
| 3   | SPRINT-069-SETTLEMENT-RPC-REPAIR  | P1       | L2    | Fix manual_settle_pick RPC (7 missing DB objs) + attach guard trigger               | None       |
| 4   | SPRINT-070-EMBED-CONTRACT-FIX     | P2       | L3    | Fix 5 embed defects (build:unknown, enum leak)                                      | None       |
| 5   | SPRINT-071-SCORING-ENGINE-V2-WIRE | P1       | L1    | Set SCORING_ENGINE_V2 env in production agents; full live-data scoring round-trip   | 068        |

**Dependency chain**: **Layer 1 is NOT complete.** Recap broken. Full E2E path
never traversed. Sprint queue targets Layer 1 closure first. Sprints 1-2 are the
minimum remaining Layer 1 exit path. Sprint 3 (settlement RPC) is Layer 2
quality work. Sprint 4 (embed fix) is Layer 3. Sprint 5 (live scoring wire)
completes the scoring chain with real provider_offers data. **LIFECYCLE
CERTIFICATION**: Transport PASS (submit→post), Settlement PASS
(harness-bounded), Scoring PARTIAL (synthetic data). Recap and full E2E NOT
certified.

---

## Completed Sprint History

<details>
<summary>39 sprints completed (2026-03-10 through 2026-03-16) — click to expand</summary>

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

</details>
