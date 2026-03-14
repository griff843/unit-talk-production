# Drift Report

**Sprint**: SPRINT-PLATFORM-TRUTH-AUDIT (original) / Updated:
SPRINT-DISCORD-PROMOTION-BAND-NULL-FIX **Date**: 2026-03-14 **Sources
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

#### DRIFT-H2: Sprint Naming Convention Inconsistency

- **What**: Legacy git tags use `SPRINT-<NAME>-###` numbering; recent sprints
  use descriptive names only
- **Where**: Git tags vs Linear cycles
- **Expected**: Consistent naming across both systems
- **Actual**: Git: `SPRINT-044A`, `SPRINT-035A`; recent:
  `SPRINT-PROMOTION-PIPELINE-ACTIVATION` (no number)
- **Impact**: Cross-referencing sprints between systems requires manual mapping
- **Severity**: **HIGH**
- **Owner**: Governance tooling sprint (future)

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

#### DRIFT-L2: Quarantined Tests Not Tracked

- **What**: `test/__quarantine__/` contains broken tests with a MANIFEST.md; no
  migration path defined
- **Where**: `apps/api/test/__quarantine__/`
- **Impact**: Known broken tests accumulating without remediation
- **Severity**: **LOW**

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

| Severity            | Count | Key Theme                                                       |
| ------------------- | ----- | --------------------------------------------------------------- |
| CRITICAL            | **0** | ~~All 3 CRITICAL items resolved~~                               |
| HIGH                | 1     | Naming convention inconsistency (DRIFT-H2)                      |
| MEDIUM              | 3     | Roadmap mismatch, doc bloat, ownership                          |
| LOW                 | 3     | Cycle overlap, quarantined tests, deprecated references         |
| **ACTIVE TOTAL**    | **7** |                                                                 |
| **Resolved/Closed** | 11    | C1, C2, C3, H1, H3, H4, H5, M-CONSENSUS, M3, M5, L4 (false +ve) |

**Drift Trend**: IMPROVING — DRIFT-L4 closed as false positive (schema matches
query exactly, confirmed SPRINT-RISK-DASHBOARD-MONITORING 2026-03-14). 11 items
resolved/closed total.

**Top 3 Active Actions**:

1. Resolve sprint naming convention inconsistency (DRIFT-H2)
2. Triage quarantined Jest tests (DRIFT-L2)
3. Update roadmap sprint order doc (DRIFT-M1)
