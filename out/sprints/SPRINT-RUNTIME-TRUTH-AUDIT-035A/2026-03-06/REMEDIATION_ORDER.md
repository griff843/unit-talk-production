# REMEDIATION ORDER

**Sprint**: SPRINT-RUNTIME-TRUTH-AUDIT-035A
**Date**: 2026-03-06
**Purpose**: Ordered list of truth decisions and implementation fixes derived from the audit

---

## SECTION A — Truth Decisions

These decisions must be answered by an operator/architect BEFORE any implementation fixes begin. Each answer determines the scope and direction of downstream fixes.

### TD-1: Is `raw_props` a canonical table?

**Context**: FeedAgent writes 3000+ records per cycle to `raw_props` via direct `supabaseClient.from('raw_props').insert()`. The table is actively used as the ingestion staging area. It is NOT listed in CLAUDE.md canonical tables.

**Options**:
- **(A) YES — add to canonical tables**: Add `raw_props` to CLAUDE.md with FeedAgent as designated writer. Direct inserts are acceptable since it's a staging table, not lifecycle-governed.
- **(B) YES — add AND require lifecycle adapter**: Add to canonical tables AND create a `lifecycleIngest` adapter for write discipline.
- **(C) NO — it's an internal staging table**: Keep it off the canonical list. Direct writes are fine. Document it as "internal" in `apps/api/CLAUDE.md` only.

**Impact**: Determines whether FeedAgent raw_props writes need adapter migration (significant work) or just documentation.

### TD-2: Is `games` a canonical table?

**Context**: FeedAgent upserts to `games` table via `supabaseClient.from('games').upsert()`. Not listed in CLAUDE.md.

**Options**: Same as TD-1.

### TD-3: Is IngestionAgent canonical or is FeedAgent the sole ingestion agent?

**Context**: `apps/api/CLAUDE.md` lists both under "Data Pipeline". In reality, FeedAgent is the registered agent. IngestionAgent is a utility module (`fetchRawProps.ts`) imported by FeedAgent.

**Recommendation**: Remove IngestionAgent from the agent listing. FeedAgent is the canonical ingestion agent. IngestionAgent is an internal utility.

### TD-4: Is Optimal API still a viable provider?

**Context**: `dataSourceRouter.ts` routes MLB/NBA/NFL/NHL to Optimal as primary. At runtime, Optimal returns 503 / no events. OddsAPI serves all traffic.

**Options**:
- **(A) Keep dual-provider**: Leave code as-is. Optimal may recover. OddsAPI fallback is working.
- **(B) Make OddsAPI primary**: Reconfigure routing to use OddsAPI first for all sports. Keep Optimal as optional fallback.
- **(C) Remove Optimal**: Strip Optimal references entirely. Simplify to OddsAPI-only.

**Impact**: Affects `dataSourceRouter.ts`, `ENV_CONTRACT.md`, type definitions for `ingestFallbackProps`.

### TD-5: Is SGO a real provider or a stub?

**Context**: `types/activities.ts` references `provider: 'SGO' | 'OddsAPI'` in `ingestFallbackProps`. `ENV_CONTRACT.md` lists `SGO_API_KEY` as optional. No SGO API client implementation exists.

**Recommendation**: Remove SGO references. No implementation exists and none is planned.

### TD-6: Are the 7 AlertAgent USP detection activities intended to be built?

**Context**: `syndicate-scheduler.ts` calls `detectSteamMovement`, `detectLineMovement`, `detectHedgeOpportunities`, `detectMiddleOpportunities`, `detectStaleLines`, `detectInjuryImpacts`, `detectSuspiciousActivity`. None are implemented. They represent an aspirational "Unique Selling Proposition" detection system.

**Options**:
- **(A) Build them**: Implement all 7 detection activities. Major feature work.
- **(B) Remove from syndicate-scheduler**: Strip the `uspProcessingWorkflow()` call. Remove type definitions. Accept that USP detection is not a current capability.
- **(C) Stub them**: Register no-op activities that log and return empty arrays. Prevents runtime errors while preserving the workflow structure for future implementation.

**Impact**: Determines whether syndicate-scheduler.ts needs to be simplified or USP activities need implementation.

### TD-7: Should `types/activities.ts` be the source of truth, or should it be derived from actual implementations?

**Context**: The type file defines 75+ activity methods. Only ~20 are implemented and registered. The type file serves as the interface for `proxyActivities<T>()` — workflows can call any method on the proxy, but only registered ones work at runtime. The type contract creates a false sense of completeness.

**Options**:
- **(A) Type contract is aspirational**: Keep full type definitions. Workflows must check which activities actually exist.
- **(B) Type contract matches reality**: Strip type definitions to only include implemented and registered activities. Compile errors will flag any workflow calling unimplemented activities.

**Recommendation**: Option B. The type contract should be the single source of truth. Compiling should catch missing activities, not runtime errors.

---

## SECTION B — Implementation Fixes

Ordered by dependency. Each fix references which Truth Decision(s) it depends on.

### Fix Priority 1: Unblock Grading Pipeline

**Depends on**: None (no truth decisions needed — all parties agree these activities should exist)

#### B-1. Export GradingAgent workflow activities from barrel

**File**: `apps/api/src/agents/GradingAgent/activities/index.ts`
**Change**: Export `gradeNewProps`, `scoreTopTierPicks`, `updateUnifiedPicks`, `getNewUnifiedPicks` as direct activity functions (NOT factory functions).

**Pattern** (each should create a singleton impl and delegate):
```typescript
export async function gradeNewProps(params: { league: string; isLiveMode: boolean; cycleCount: number }) {
  const impl = getOrCreateImpl();
  return impl.gradeNewProps(params);
}
```

**Impact**: Unblocks the entire grading → promotion → posting pipeline. This is the single highest-value fix.

#### B-2. Fix GradingAgent single-writer violation

**File**: `apps/api/src/agents/GradingAgent/GradingAgent.ts:757`
**Change**: Replace `supabase.from('unified_picks').insert(...)` with `lifecycleInsert(supabase, pick, { writerRole: 'promoter' })`
**Depends on**: None — Level 1 doc requires this unconditionally

#### B-3. Fix RecapAgent single-writer violation

**File**: `apps/api/src/agents/RecapAgent/index.ts:693`
**Change**: Replace `supabase.from('unified_picks').update(...)` with `lifecycleUpdate(supabase, pickId, updates, { writerRole: 'poster' })`
**Depends on**: None — Level 1 doc requires this unconditionally

### Fix Priority 2: Resolve Name Collisions

#### B-4. Fix `sendNotification` name collision

**Files**: `agents/AlertAgent/activities/index.ts`, `agents/NotificationAgent/activities/index.ts`
**Change**: Rename AlertAgent's export to `sendAlertNotification` or `triggerAlertAgent`. NotificationAgent's parameterized `sendNotification(params)` is the correct version.
**Depends on**: None

#### B-5. Fix `performHealthCheck` name collision

**Files**: `activities/healthMonitoring.ts`, `agents/AnalyticsAgent/activities/index.ts`
**Change**: Rename AnalyticsAgent's export to `performAnalyticsHealthCheck`. The healthMonitoring version is the system-level check.
**Depends on**: None

#### B-6. Fix `initialize` name collision

**Files**: `agents/BaseAgent/activities.ts`, `agents/GradingAgent/activities/index.ts`
**Change**: GradingAgent barrel should NOT export `initialize` as a top-level activity (it's a factory function with wrong signature anyway). Remove from barrel exports.
**Depends on**: B-1 (barrel rewrite)

### Fix Priority 3: Fix Other RUNTIME BROKEN Activities

#### B-7. Fix `checkApiQuota` registration

**Depends on**: TD-4 (provider viability)
**File**: Needs implementation — `checkApiQuota` is defined in `OperatorAgentActivities` type but not implemented anywhere. `monitorAPIQuota` exists in `activities/operator.ts` with different signature.
**Options**:
- Rename `monitorAPIQuota` to `checkApiQuota` and adjust signature
- OR implement `checkApiQuota` in OperatorAgent barrel

#### B-8. Fix `runAnalyticsAgent` name mismatch

**File**: `workflows/analyticsWorkflow.ts` OR `agents/AnalyticsAgent/activities/index.ts`
**Change**: Either rename the workflow proxy call from `runAnalyticsAgent` to `runAnalyticsAgentActivity`, or add an alias export `export { runAnalyticsAgentActivity as runAnalyticsAgent }` in the barrel.

### Fix Priority 4: Remove Dead References (depends on Truth Decisions)

#### B-9. Remove FeedAgent aspirational activities

**Depends on**: TD-5 (SGO), TD-6 (USP)
**Files**: `types/activities.ts`, `workflows/syndicate-scheduler.ts`
**Change**: Remove `ingestFallbackProps`, `deduplicateAndNormalize`, `triggerGrading`, `ingestOptimalProps`, `deduplicateProps`, `normalizeProps` from type contract. Remove `ingestFallbackProps` call from `leagueIngestionWorkflow`. Remove `deduplicateAndNormalize` and `triggerGrading` calls.

#### B-10. Remove or stub AlertAgent USP activities

**Depends on**: TD-6
**Change**: Per truth decision — either implement, stub, or remove 7 USP detection activities and the `uspProcessingWorkflow()` from syndicate-scheduler.

#### B-11. Remove or implement NotificationAgent Discord activities

**Depends on**: TD-6 (same architectural question)
**Change**: `buildPickEmbeds`, `sendCriticalDiscordAlerts`, `batchDiscordAlerts` — either implement or remove from syndicate-scheduler's `discordAlertWorkflow`.

#### B-12. Remove archived agent types

**Depends on**: None
**File**: `types/activities.ts`
**Change**: Delete `CampaignAgentActivities` and `ContestAgentActivities` interfaces. Remove proxy creation in `workflows/index.ts` (lines 54-60).

### Fix Priority 5: Documentation Updates

#### B-13. Update `apps/api/CLAUDE.md` agent listing

**Depends on**: TD-3
**Change**: Remove ScoringAgent, DataAgent, IngestionAgent from agent listing. Verify remaining agents match actual registered agents.

#### B-14. Add `raw_props` and `games` to canonical tables

**Depends on**: TD-1, TD-2
**File**: `CLAUDE.md` (root)
**Change**: Add tables per truth decisions.

#### B-15. Reconcile `types/activities.ts` with reality

**Depends on**: TD-7, all other fixes complete
**File**: `types/activities.ts`
**Change**: Strip type definitions to only include implemented and registered activities.

#### B-16. Resolve syndicate-scheduler dual implementation

**Depends on**: None but should be addressed with B-1
**Files**: `workflows/syndicate-scheduler.ts`, `workflows/support-workflows.ts`
**Change**: Remove `syndicateSchedulerWorkflow` from `support-workflows.ts`. The comprehensive version in `syndicate-scheduler.ts` should be the sole implementation. Update `start-all-workflows.ts` to import from the correct source.

---

## Implementation Order Summary

```
Round 1 (No truth decisions needed):
  B-1  GradingAgent barrel export ← HIGHEST VALUE
  B-2  GradingAgent single-writer fix
  B-3  RecapAgent single-writer fix
  B-4  sendNotification collision fix
  B-5  performHealthCheck collision fix
  B-12 Remove archived agent types
  B-16 Resolve syndicate-scheduler dual implementation

Round 2 (After truth decisions TD-1 through TD-7):
  B-7  checkApiQuota registration
  B-8  runAnalyticsAgent name mismatch
  B-9  Remove FeedAgent dead activities
  B-10 AlertAgent USP resolution
  B-11 NotificationAgent Discord resolution

Round 3 (Documentation):
  B-6  initialize collision (part of B-1)
  B-13 Update apps/api/CLAUDE.md
  B-14 Add raw_props/games to canonical tables
  B-15 Reconcile types/activities.ts
```

---

**Generated**: 2026-03-06T20:20:00-05:00
**Sprint**: SPRINT-RUNTIME-TRUTH-AUDIT-035A
