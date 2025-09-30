# Legacy Code Audit Report
**Date**: 2025-09-30
**Auditor**: Release Engineering
**Scope**: GradingAgent and raw_props references

---

## Executive Summary

**GradingAgent References**: 105 files
**raw_props References**: 420+ files
**rawProps References**: 67 files
**raw-props References**: 2 files

### Critical Findings

1. **GradingAgent code deleted but references remain** in:
   - Documentation files (*.md)
   - Test files
   - Command Center UI components
   - API routes and scripts

2. **raw_props table still heavily referenced** despite migration to `unified_picks`

3. **No feature flags** currently gating legacy modules

4. **No startup guards** to prevent legacy module registration

---

## Category 1: GradingAgent References (105 files)

### High Priority - Active Code Paths

#### API Core
- `apps/api/src/api-server.ts` - May register GradingAgent
- `apps/api/src/worker.ts` - Worker orchestration
- `apps/api/src/config/agentConfig.ts` - Agent configuration

#### Scripts & Runners (Must Remove/Flag)
- `apps/api/src/runner/testE2ERealDataFixed.ts`
- `apps/api/src/runner/testE2ERealData.ts`
- `apps/api/src/runner/productionMonitoring.ts`
- `apps/api/src/runner/e2eProductionTest.ts`
- `apps/api/src/scripts/system-health-validator.ts`
- `apps/api/src/scripts/check-grading-status.ts`
- `apps/api/src/scripts/analyze-grading-promotion.ts`

#### Command Center (UI References - Must Update)
- `apps/command-center/src/components/monitoring/GradingQueue.tsx`
- `apps/command-center/src/app/dashboard/grading/page.tsx`
- `apps/command-center/src/app/api/grading/picks/route.ts`
- `apps/command-center/src/app/api/grading/agents/route.ts`
- `apps/command-center/src/hooks/useAgentMonitoring.ts`
- `apps/command-center/src/lib/agentMonitoring.ts`

### Medium Priority - Documentation

#### Root Documentation (Misleading)
- `PRODUCTION_AUDIT_FINAL_SEPT30.md` - Line 157
- `LIVE_SYSTEM_AUDIT_REPORT.md`
- `CLAUDE_ACCURATE.md`
- `UNIT_TALK_COMPREHENSIVE_AUDIT_REPORT.md`
- `DOCUMENTATION_AUDIT_REPORT.md`
- `CHANGELOG.md`
- `AGENT_SYSTEM_STATUS.md`

#### Docs Folder
- `docs/ARCHITECTURE.md`
- `docs/CLAUDE.md`
- `docs/E2E_SYSTEM_ANALYSIS_REPORT.md`
- `docs/MONITORING_ARCHITECTURE_2025.md`

### Low Priority - Test/Legacy Scripts

#### Root Scripts (Likely Unused)
- `smoke-test-scoring-agent.js`
- `trigger-gradingagent.js`
- `proof-grading-system.js`
- `show-grading-proof.js`

---

## Category 2: raw_props References (420+ files)

### Critical - Active Data Pipelines

#### FeedAgent (Event ingestion)
- `apps/api/src/agents/FeedAgent/index.ts` - Lines TBD
- `apps/api/src/agents/FeedAgent/dataSourceRouter.ts` - Lines TBD
- `apps/api/src/agents/FeedAgent/activities/index.ts`
- `apps/api/src/agents/FeedAgent/utils/dedupePublicProps.ts`

#### ScoringAgent
- `apps/api/src/agents/ScoringAgent/ScoringAgent.ts` - May read from raw_props

#### Other Agents
- `apps/api/src/agents/IngestionAgent/index.ts`
- `apps/api/src/agents/IngestionAgent/fetchRawProps.ts` - **MUST DELETE**
- `apps/api/src/agents/SettlementAgent/index.ts`
- `apps/api/src/agents/EligibilityAgent/promoteToDailyPicks.ts`

#### Database Layer
- `apps/api/src/db/types/supabase.ts` - Type definitions
- `apps/api/src/types/supabase.ts` - Type definitions
- `apps/api/src/activities/ingestion.ts`
- `apps/api/src/activities/backfill.ts`

### High Priority - SQL Migrations

#### Migration Files (Must Comment/Disable)
- `migrations/024_switch_views_to_raw_props_and_recreate_rpc.sql` - **ROLLBACK**
- `scripts/db/migrate-raw-props-to-unified.ts` - Migration script
- `scripts/db/archive-raw-props.sql` - Archive script
- `supabase/migrations/20250925_unified_picks_all_props.sql`

### Medium Priority - Smart Form

#### Smart Form API
- `apps/smart-form/app/api/props/route.ts`
- `apps/smart-form/app/api/players/route.ts`
- `apps/smart-form/app/api/users/[id]/analytics/route.ts`
- `apps/smart-form/lib/supabase-queries.ts`
- `apps/smart-form/types/supabase.ts`

### Low Priority - Command Center

#### Command Center Database
- `apps/command-center/src/lib/supabase/client.ts`
- `apps/command-center/src/components/monitoring/RealTimeDataFlow.tsx`
- `apps/command-center/src/app/api/grading/picks/route.ts`

---

## Category 3: rawProps (camelCase) - 67 files

### Active Code (Must Refactor)
- `apps/api/src/agents/FeedAgent/oddsApi.ts`
- `apps/api/src/agents/FeedAgent/optimal.ts`
- `apps/api/src/agents/FeedAgent/utils/normalizePublicProps.ts`
- `apps/api/src/services/ProfessionalPropProcessor.ts`
- `apps/api/src/orchestration/PipelineOrchestrator.ts`

---

## Recommended Actions

### Phase 1: Immediate (Today)

1. **Add Feature Flags**
   ```typescript
   // apps/api/src/config/featureFlags.ts
   export const FEATURES = {
     GRADING_AGENT: false,     // LEGACY_DISABLED 2025-09-30
     RAW_PROPS_TABLE: false,   // LEGACY_DISABLED 2025-09-30
     UNIFIED_PICKS_ONLY: true  // PRODUCTION FLOW
   }
   ```

2. **Add Startup Guard**
   ```typescript
   // apps/api/src/api-server.ts
   if (registeredAgents.includes('GradingAgent')) {
     console.error('❌ FATAL: GradingAgent is disabled');
     process.exit(1);
   }
   ```

3. **Update docker-compose.yml**
   - Remove any grading-worker services
   - Ensure only FeedAgent, ScoringAgent, AlertAgent run

4. **Update dev.sh**
   - Add service validation
   - Log enabled/disabled agents on startup

### Phase 2: Code Cleanup (Next 2 days)

1. **Delete Files**
   - `apps/api/src/agents/IngestionAgent/fetchRawProps.ts`
   - All deleted GradingAgent files (already done)

2. **Refactor Data Pipelines**
   - FeedAgent: Remove raw_props writes, direct to unified_picks
   - ScoringAgent: Read only from unified_picks
   - Remove all raw_props TypeScript types

3. **Update Command Center**
   - Replace GradingQueue with ScoringQueue
   - Update /grading routes to /scoring
   - Fix agent monitoring hooks

### Phase 3: SQL Migrations (Next 3 days)

1. **Comment Out Legacy SQL**
   ```sql
   -- LEGACY_DISABLED 2025-09-30: raw_props table no longer used
   -- CREATE TABLE raw_props (...);
   ```

2. **Create Rollback Scripts**
   - Document rollback procedures
   - Test rollback in staging

### Phase 4: Documentation (Next 4 days)

1. **Update All Markdown Files**
   - Replace GradingAgent → ScoringAgent
   - Replace raw_props → unified_picks
   - Update architecture diagrams

2. **Create Migration Guide**
   - For operators
   - For developers

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking prod data flow | **CRITICAL** | Feature flags + gradual rollout |
| Lost historical data | **HIGH** | Archive raw_props before dropping |
| Command Center UI breaks | **MEDIUM** | Update UI before backend |
| Documentation confusion | **LOW** | Comprehensive update |

---

## Success Criteria

✅ Zero GradingAgent references in active code
✅ Zero raw_props writes in data pipeline
✅ All tests passing with unified_picks only
✅ Startup logs show correct agent list
✅ API fails fast if legacy module loaded
✅ Documentation reflects current architecture

---

## Next Steps

1. Review this report
2. Execute Phase 1 (feature flags + guards)
3. Run smoke tests
4. Proceed with Phase 2-4 based on results