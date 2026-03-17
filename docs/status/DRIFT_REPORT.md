# Drift Report

**Sprint**: SPRINT-PLATFORM-TRUTH-AUDIT (original) / Updated:
SPRINT-063-LIFECYCLE-TRUTH-RESTORATION **Date**: 2026-03-16 **Sources
Compared**: Blueprint docs, repo implementation, Linear issues, roadmap, runtime

---

## RESOLVED DRIFT (closed by completed sprints)

### ~~DRIFT-C1: Test Suite Fundamentally Broken~~ ✅ RESOLVED

- **Resolved by**: SPRINT-TEST-INFRA-RECOVERY
- **Evidence**: vitest 491/491 passing; `vitest.config.ts` scopes runner to
  `src/**/__tests__/`; Jest `test/` quarantined separately
- **Resolved**: 2026-03-09

### ~~DRIFT-C2: TypeScript Compilation Errors~~ ✅ RESOLVED

- **Resolved by**: SPRINT-TEST-INFRA-RECOVERY
- **Evidence**: `npm run type-check` → 0 errors; `apps/api/scripts/` excluded
  from root tsconfig
- **Resolved**: 2026-03-09

### ~~DRIFT-C3: Single-Writer Migration Overdue~~ ✅ RESOLVED

- **Resolved by**: SPRINT-SINGLE-WRITER-MIGRATION-COMPLETION
- **Evidence**: `npm run lifecycle:single-writer -- --strict` → 0 violations, 0
  allowlisted, 911 files scanned
- **Resolved**: 2026-03-09

### ~~DRIFT-H3: Promotion Policy Disabled by Default~~ ✅ RESOLVED

- **Resolved by**: SPRINT-PROMOTION-PIPELINE-ACTIVATION
- **Evidence**: `DiscordPromotionAgent` Temporal activities created +
  registered; shadow mode default fixed (opt-in); pipeline wired end-to-end
- **Remaining**: Runtime env config required (`AUTOPILOT_MODE=prod`,
  `DISCORD_WEBHOOK_URL`, `PROMOTION_CANARY_PERCENT>0`) — intentional fail-closed
- **Resolved**: 2026-03-09

### ~~DRIFT-H4: GitHub Integration Not Connected~~ ✅ RESOLVED

- **Resolved by**: SPRINT-GITHUB-LINEAR-INTEGRATION
- **Evidence**: Linear-GitHub integration connected; sprint workflow skills
  committed; UNI-14 Done
- **Resolved**: 2026-03-10

### ~~DRIFT-H1: Linear Not Synchronized~~ ✅ RESOLVED

- **Resolved by**: Active Linear MCP integration + sprint-by-sprint issue
  tracking
- **Evidence**: UNI-15, UNI-49, UNI-50 all marked Done; sprint issues created
  and updated each sprint
- **Resolved**: 2026-03-09

### ~~DRIFT-M-CONSENSUS: Multi-Book Consensus Pipeline Not Tested~~ ✅ RESOLVED

- **Resolved by**: SPRINT-MULTI-BOOK-CONSENSUS-SCORING
- **Evidence**: 76 unit tests added for `devigConsensus.ts`;
  `ShadowScoringService.ts` + `MarketOfferAggregator.ts` confirmed fully
  implemented; 567/567 tests passing; all weighting/fallback/determinism
  behavior documented and tested
- **Note**: `computeConsensus()`, `computeProbabilityLayer()`,
  `ShadowScoringService`, `MarketOfferAggregator` were all already fully
  implemented (UNI-11/12/13 were previously considered gaps but are complete)
- **Resolved**: 2026-03-09

### ~~DRIFT-H2: Sprint Naming Convention Inconsistency~~ ✅ RESOLVED

- **Resolved by**: SPRINT-053-GOVERNANCE-NAMING-CONVENTION
- **Evidence**: `docs/claude/SPRINT_NAMING_CONVENTION.md` created (canonical
  doc); CLAUDE.md §6 updated to reference it; `sprint-gate.js` updated to read
  from `NEXT_5_SPRINTS.md` (primary) + format validation; legacy tag mapping
  table included in naming convention doc
- **Canonical patterns**: Pattern A (`SPRINT-NNN-DESCRIPTIVE`), Pattern B
  (`SPRINT-DOMAIN-DESCRIPTOR`); deprecated: number-at-end, letter-prefix,
  `-COMPLETE` suffix
- **Resolved**: 2026-03-15

### ~~DRIFT-H5: Verification Infrastructure Not Committed to Git~~ ✅ RESOLVED

- **What**: Entire `apps/api/src/lib/verification/` directory (R1–R5 code) was
  untracked in git
- **Resolved by**: SPRINT-VERIFICATION-GIT-COMMIT + PR #157
- **Evidence**: `git ls-files apps/api/src/lib/verification/` shows 53 tracked
  files; squash-merged to origin/main via PR #157 (merge commit `a6f69276`,
  2026-03-13T23:51:52Z)
- **Resolved**: 2026-03-13

---

## ACTIVE DRIFT

### HIGH DRIFT

#### DRIFT-H6: Lifecycle Certification Gap — Recap NOT Operational (Scoring PARTIAL, Settlement RESOLVED)

- **What**: SPRINT-062 E2E truth audit proved transport (submit→post) but could
  not certify settlement, scoring, or recap. SPRINT-064 proved settlement.
  SPRINT-066 exercised scoring pipeline (V2 pipeline certified with synthetic
  data).
- **Settlement status**: **PARTIALLY RESOLVED** by SPRINT-064. lifecycleSettle()
  runtime-proven. SettlementAgent automatic trigger not tested (requires
  game_results from external API). manual_settle_pick() RPC broken (DEFECT-11).
- **Scoring status**: **PARTIALLY RESOLVED** by SPRINT-066. computeScoreV2 +
  evaluatePromotion exercised. CONSTITUTIONAL Gate 7 defect fixed
  (featureSnapshotId
  - featureVectorHash now generated). All 8 promotion gates proven satisfiable.
    Remaining: live provider_offers round-trip not tested; SCORING_ENGINE_V2 not
    wired in production agents.
- **Remaining**: Full E2E path (submit→score→post→settle→recap) never traversed.
  RecapAgent schema corrected by SPRINT-067 (play_status→status,
  outcome→settlement_result). Runtime certification pending.
- **Where**: Full lifecycle path not yet exercised end-to-end
- **Evidence**: `docs/status/LIFECYCLE_PROOF_MATRIX.md`,
  `out/sprints/SPRINT-067-RECAP-SCHEMA-FIX/2026-03-16/SPRINT_CLOSEOUT_REPORT.md`
- **Impact**: Cannot claim full lifecycle certification until full E2E path is
  traversed with runtime traces at every stage.
- **Severity**: **HIGH**
- **Owner**: SPRINT-068-E2E-LIFECYCLE-CERT
- **Added**: SPRINT-063, 2026-03-16 | **Updated**: SPRINT-067, 2026-03-16

#### DRIFT-H7: Embed Contract Defects — 5 Discord Output Issues

- **What**: Discord embeds leak `build:unknown` and `env:development` in
  footers, show inconsistent capper fields, fail silently on headshot lookups,
  and leak raw SNAKE_CASE enums in pick titles.
- **Where**: `apps/api/src/lib/buildInfo.ts`,
  `apps/api/src/services/pickPresentationBuilder.ts`,
  `apps/api/src/agents/DiscordPromotionAgent/index.ts`
- **Evidence**: `docs/audits/SPRINT-063_EMBED_CONTRACT_AUDIT.md`
- **Severity**: **HIGH** (user-facing data quality)
- **Owner**: SPRINT-070-EMBED-CONTRACT-FIX
- **Added**: SPRINT-063-LIFECYCLE-TRUTH-RESTORATION, 2026-03-16

---

### MEDIUM DRIFT

#### DRIFT-M1: Roadmap Sprints vs Completed Work Mismatch

- **What**: `INTELLIGENCE_PIPELINE_SPRINT_ORDER.md` locked at SPRINT-040 (TBD),
  but 044A-044E all completed
- **Where**: `docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md`
- **Expected**: Sprint order docs reflect completion status
- **Actual**: Architecture migration doc shows completion but intelligence
  pipeline doc lags
- **Severity**: **MEDIUM**
- **Owner**: Status sync sprint (future)

#### DRIFT-M2: Document Proliferation

- **What**: 4,271+ markdown files, many superseded or redundant
- **Where**: `docs/`, `governance/`, `architecture/`, `out/`
- **Expected**: Clear canonical set with archived superseded docs
- **Actual**: No clear distinction between canonical and obsolete docs
- **Impact**: New contributors cannot identify authoritative documents
- **Severity**: **MEDIUM**
- **Owner**: Doc cleanup sprint (future)

#### ~~DRIFT-M3: Optimal API Provider Not Wired to V3~~ ✅ CLOSED (Won't Fix)

- **Decision**: Optimal API is not in use — SGO + OddsAPI are the canonical
  providers. 2-provider consensus is the intended architecture.
- **Closed**: 2026-03-09

#### DRIFT-M4: Initiative/Project Ownership Gaps

- **What**: No owner on any Linear initiative, no lead on any project
- **Where**: Linear workspace
- **Expected**: At least engineering lead assigned
- **Actual**: All unassigned
- **Impact**: Accountability unclear
- **Severity**: **MEDIUM**
- **Owner**: Linear governance sprint (future)

#### ~~DRIFT-M5: Observability Package Build Fails~~ ✅ RESOLVED

- **Resolved by**: SPRINT-OBSERVABILITY-BUILD-FIX
- **Evidence**: `pnpm --filter @unit-talk/observability run build` exits 0;
  `@opentelemetry/api` was already declared in package.json — issue was pnpm
  Windows extraction producing empty directory; `pnpm install --force` resolves
- **Resolved**: 2026-03-10

---

### LOW DRIFT

#### DRIFT-L1: Sprint Cycle Overlap in Linear

- **What**: Sprint 029 (Mar 5-19) and SPRINT-032 (Mar 10-24) overlap
- **Where**: Linear cycles
- **Impact**: May cause confusion about which cycle work belongs to
- **Severity**: **LOW**

#### ~~DRIFT-L2: Quarantined Tests Not Tracked~~ ✅ RESOLVED

- **Resolved by**: SPRINT-JEST-QUARANTINE-CLEANUP (SPRINT-040), 2026-03-14
- **Resolution**: All 58 quarantined test files permanently deleted with
  documented rationale in `MANIFEST.md`. TST-001: archived agent tests; TST-002:
  type drift against replaced modules (covered by 898 vitest tests); TST-003:
  missing deps. Jest suite: 35 suites / 643 tests all passing.
- **Closed**: 2026-03-14

#### ~~DRIFT-L4: Worker Heartbeat False Negative in /api/health~~ ✅ FALSE POSITIVE — CLOSED

- **Investigated by**: SPRINT-RISK-DASHBOARD-MONITORING
- **Finding**: `health.ts` queries `worker_name` + `last_heartbeat_at` which
  exactly matches the migration schema
  (`20260221180000_ops_worker_heartbeats.sql`). Columns `worker_name TEXT` and
  `last_heartbeat_at TIMESTAMPTZ` exist. No mismatch. Any "missing" status is a
  runtime data issue (no heartbeat inserted), not a schema bug.
- **Closed**: 2026-03-14

#### DRIFT-L3: Deprecated Tables Still Referenced

- **What**: `daily_picks`, `players`, `teams` still referenced in some utility
  scripts
- **Where**: Various utility scripts
- **Impact**: Confusion about canonical tables
- **Severity**: **LOW**

---

## DRIFT SUMMARY

| Severity            | Count | Key Theme                                                               |
| ------------------- | ----- | ----------------------------------------------------------------------- |
| CRITICAL            | **0** | ~~All 3 CRITICAL items resolved~~                                       |
| HIGH                | **2** | DRIFT-H6: lifecycle certification gap; DRIFT-H7: embed defects          |
| MEDIUM              | 3     | Roadmap mismatch, doc bloat, ownership                                  |
| LOW                 | 2     | Cycle overlap, deprecated references                                    |
| **ACTIVE TOTAL**    | **7** |                                                                         |
| **Resolved/Closed** | 13    | C1, C2, C3, H1, H2, H3, H4, H5, M-CONSENSUS, M3, M5, L2, L4 (false +ve) |

**Drift Trend**: IMPROVING — 0 CRITICAL, **2 HIGH** as of 2026-03-16. SPRINT-067
resolved recap schema portion of DRIFT-H6 (RecapAgent column refs corrected,
R10: FAIL→PARTIAL). Sole remaining FAIL: R13 (full E2E). One sprint remaining to
close DRIFT-H6.

**Top 3 Active Actions**:

1. **Full E2E lifecycle certification** (DRIFT-H6) —
   SPRINT-068-E2E-LIFECYCLE-CERT
2. **Embed contract defects** (DRIFT-H7) — SPRINT-070-EMBED-CONTRACT-FIX
3. **Settlement RPC repair** (quality) — SPRINT-069-SETTLEMENT-RPC-REPAIR
