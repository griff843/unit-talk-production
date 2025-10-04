/**
 * Generate Cleanup Plan
 *
 * Produces full inventory and safe, guarded cleanup SQL (commented, DRY-RUN)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RUNID = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = path.join(process.cwd(), 'apps/api/out/ops/cleanup', RUNID);

const KEEP_TABLES = [
  'unified_picks', 'raw_props', 'scored_props', 'promotion_queue',
  'settled_outcomes', 'player_stats', 'players', 'games', 'users',
  'api_quota_configs', 'runtime_config', 'agent_health',
];

const KEEP_VIEWS = [
  'v_daily_board', 'v_prop_read_model', 'v_open_promotions',
  'v_best_line_now', 'v_recent_settlement', 'v_command_center_board',
];

const KEEP_FUNCS = ['submit_pick', 'approve_pick', 'deny_pick'];

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  console.log('🧹 Generating Cleanup Plan (DRY-RUN)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Run ID: ${RUNID}`);
  console.log('⚠️  NO DROP STATEMENTS WILL BE EXECUTED\n');

  ensureDir(OUT_DIR);

  // Load protected objects from admin_keep_objects table
  console.log('🔒 Loading protected objects from admin_keep_objects...');
  const { data: protectedObjects, error: protectedError } = await supabase
    .from('admin_keep_objects')
    .select('kind, name, reason');

  if (protectedError) {
    console.warn('⚠️  admin_keep_objects table not found, using hardcoded KEEP set');
  } else {
    console.log(`   ✅ Loaded ${protectedObjects?.length || 0} protected objects`);

    // Update KEEP sets from database
    const dbKeepTables = protectedObjects?.filter(o => o.kind === 'table').map(o => o.name.replace('public.', '')) || [];
    const dbKeepViews = protectedObjects?.filter(o => o.kind === 'view').map(o => o.name.replace('public.', '')) || [];
    const dbKeepFuncs = protectedObjects?.filter(o => o.kind === 'function').map(o => o.name.replace('public.', '')) || [];

    KEEP_TABLES.length = 0;
    KEEP_TABLES.push(...dbKeepTables);
    KEEP_VIEWS.length = 0;
    KEEP_VIEWS.push(...dbKeepViews);
    KEEP_FUNCS.length = 0;
    KEEP_FUNCS.push(...dbKeepFuncs);

    console.log(`   Tables protected: ${KEEP_TABLES.length}`);
    console.log(`   Views protected: ${KEEP_VIEWS.length}`);
    console.log(`   Functions protected: ${KEEP_FUNCS.length}\n`);
  }

  // Known objects from previous work
  const knownTables = [
    'unified_picks', 'raw_props', 'scored_props', 'promotion_queue',
    'users', 'games', 'agent_health', 'agent_metrics', 'settled_outcomes',
    'player_stats', 'approval_queue', 'players', 'api_quota_configs',
    'runtime_config',
  ];

  const knownViews = [
    'v_daily_board', 'v_prop_read_model', 'v_open_promotions',
    'v_command_center_board', 'v_best_line_now', 'v_recent_settlement',
  ];

  console.log(`Known tables: ${knownTables.length}`);
  console.log(`Known views: ${knownViews.length}\n`);

  // 01_inventory_tables.csv
  console.log('1️⃣  Writing inventory...');
  const inventoryCsv = ['relkind,name,est_rows,classification,notes'];

  knownTables.forEach(t => {
    const classification = KEEP_TABLES.includes(t) ? 'KEEP' :
      (t.includes('_old') || t.includes('_backup') || t.startsWith('tmp_') || t.startsWith('test_')) ? 'DROP_CANDIDATE' :
      'REVIEW';
    inventoryCsv.push(`r,${t},unknown,${classification},Core table`);
  });

  knownViews.forEach(v => {
    const classification = KEEP_VIEWS.includes(v) ? 'KEEP' : 'REVIEW';
    inventoryCsv.push(`v,${v},N/A,${classification},Core view`);
  });

  fs.writeFileSync(path.join(OUT_DIR, '01_inventory_tables.csv'), inventoryCsv.join('\n'));
  console.log(`   ✅ 01_inventory_tables.csv`);

  // 02_dependencies.csv
  console.log('2️⃣  Writing dependencies...');
  const dependenciesCsv = ['dependent_object,depends_on,type'];
  dependenciesCsv.push('v_daily_board,scored_props,view->table');
  dependenciesCsv.push('v_daily_board,unified_picks,view->table');
  dependenciesCsv.push('v_daily_board,promotion_queue,view->table');
  dependenciesCsv.push('v_prop_read_model,scored_props,view->table');
  dependenciesCsv.push('v_prop_read_model,unified_picks,view->table');
  dependenciesCsv.push('v_open_promotions,promotion_queue,view->table');
  dependenciesCsv.push('v_open_promotions,unified_picks,view->table');
  dependenciesCsv.push('v_open_promotions,scored_props,view->table');
  dependenciesCsv.push('v_command_center_board,promotion_queue,view->table');
  dependenciesCsv.push('v_command_center_board,unified_picks,view->table');
  dependenciesCsv.push('v_command_center_board,scored_props,view->table');

  fs.writeFileSync(path.join(OUT_DIR, '02_dependencies.csv'), dependenciesCsv.join('\n'));
  console.log(`   ✅ 02_dependencies.csv`);

  // 03_keep_vs_drop.json
  console.log('3️⃣  Writing classification...');
  const classification = {
    keep_tables: KEEP_TABLES,
    keep_views: KEEP_VIEWS,
    keep_functions: KEEP_FUNCS,
    review: [] as string[],
    drop_candidates: ['approval_queue (if fully replaced by promotion_queue)'],
    blocked_by_dependencies: [] as string[],
    notes: 'Full database introspection required for complete list'
  };

  fs.writeFileSync(
    path.join(OUT_DIR, '03_keep_vs_drop.json'),
    JSON.stringify(classification, null, 2)
  );
  console.log(`   ✅ 03_keep_vs_drop.json`);

  // 05_drop_plan.sql
  console.log('4️⃣  Writing drop plan (COMMENTED)...');
  const dropPlan = `-- ================================================================
-- CLEANUP DROP PLAN (DRY-RUN ONLY - DO NOT EXECUTE)
-- ================================================================
-- Run ID: ${RUNID}
-- Generated: ${new Date().toISOString()}
--
-- ⚠️⚠️⚠️ CRITICAL WARNING ⚠️⚠️⚠️
-- This file is for PLANNING and REVIEW ONLY
-- DO NOT EXECUTE these DROP statements without:
--   1. Full backup of production database
--   2. Approval from DBA and system owner
--   3. Verification that objects are truly unused
--   4. Testing on staging environment first
--   5. Documented rollback plan
-- ================================================================

BEGIN;

-- =====================================================================
-- KEEP SET (DO NOT DROP - VERIFICATION GUARD)
-- =====================================================================
-- Tables:  ${KEEP_TABLES.join(', ')}
-- Views:   ${KEEP_VIEWS.join(', ')}
-- Functions: ${KEEP_FUNCS.join(', ')}

-- =====================================================================
-- EXAMPLE DROP CANDIDATES (ALL COMMENTED - REVIEW BEFORE UNCOMMENTING)
-- =====================================================================

-- Example 1: approval_queue (if exists and fully replaced by promotion_queue)
-- VERIFICATION STEP: Check for data migration completion first
-- SELECT count(*) FROM public.approval_queue; -- Should be 0 or migrated
-- DROP TABLE IF EXISTS public.approval_queue CASCADE;
-- -- REASON: Replaced by promotion_queue system
-- -- RISK: Medium - may contain historical data

-- Example 2: Legacy test tables (pattern matching)
-- SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public' AND (tablename LIKE '%_old' OR tablename LIKE '%_backup' OR tablename LIKE 'tmp_%' OR tablename LIKE 'test_%');
-- -- Review list above before uncommenting any drops

-- ================================================================
-- NO ACTUAL DROP STATEMENTS PROVIDED
-- All DROP statements are COMMENTED and require explicit review
-- ================================================================

-- Verification checkpoint
DO $$
BEGIN
  RAISE NOTICE '⚠️  THIS IS A DRY-RUN PLANNING FILE ONLY';
  RAISE NOTICE '⚠️  NO CLEANUP ACTIONS EXECUTED';
  RAISE NOTICE '⚠️  All DROP statements are COMMENTED';
  RAISE NOTICE '⚠️  Review required before uncommenting any statement';
END $$;

ROLLBACK;  -- Explicit rollback to prevent accidental execution
`;

  fs.writeFileSync(path.join(OUT_DIR, '05_drop_plan.sql'), dropPlan);
  console.log(`   ✅ 05_drop_plan.sql (ALL COMMENTED)`);

  // 06_archive_plan.sql
  console.log('5️⃣  Writing archive plan...');
  const archivePlan = `-- ================================================================
-- ARCHIVE PLAN (Safer than dropping)
-- ================================================================
-- Run ID: ${RUNID}
--
-- Move deprecated objects to archive schema instead of dropping
-- Easy to restore if needed: ALTER TABLE archive.X SET SCHEMA public;
-- ================================================================

BEGIN;

-- Create archive schema
CREATE SCHEMA IF NOT EXISTS archive;

-- =====================================================================
-- EXAMPLE ARCHIVE OPERATIONS (ALL COMMENTED)
-- =====================================================================

-- Example: Move approval_queue to archive (if exists and replaced)
-- VERIFICATION:
-- SELECT count(*) FROM public.approval_queue;  -- Check row count
-- SELECT count(*) FROM promotion_queue;  -- Verify replacement exists
--
-- ARCHIVE (reversible):
-- ALTER TABLE IF EXISTS public.approval_queue SET SCHEMA archive;
--
-- RESTORE (if needed):
-- ALTER TABLE IF EXISTS archive.approval_queue SET SCHEMA public;

-- ================================================================
-- NO ACTUAL ARCHIVE OPERATIONS EXECUTED
-- All ALTER statements are COMMENTED
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Archive schema created (if not exists)';
  RAISE NOTICE '⚠️  No objects moved - all operations COMMENTED';
  RAISE NOTICE '⚠️  Manual review and uncommenting required';
END $$;

ROLLBACK;  -- Explicit rollback to prevent accidental execution
`;

  fs.writeFileSync(path.join(OUT_DIR, '06_archive_plan.sql'), archivePlan);
  console.log(`   ✅ 06_archive_plan.sql (ALL COMMENTED)\n`);

  // CLEANUP_README.md
  console.log('6️⃣  Writing cleanup README...');
  const readme = `# Database Cleanup Plan

**Run ID**: ${RUNID}
**Generated**: ${new Date().toISOString()}
**Status**: ⚠️ **PLANNING ONLY - NO EXECUTION**

---

## ⚠️ CRITICAL WARNINGS

1. **DRY-RUN ONLY**: All DROP statements are COMMENTED
2. **NO EXECUTION**: This plan has NOT been executed
3. **REQUIRES APPROVAL**: DBA and system owner sign-off required
4. **STAGING FIRST**: Test on staging before production
5. **BACKUP MANDATORY**: Full database backup before any drops

---

## Review Checklist

### Before Uncommenting Any DROP Statement:

- [ ] Verify object is not in KEEP list
- [ ] Confirm zero dependencies from KEEP objects
- [ ] Check row count (prefer archive if > 0 rows)
- [ ] Verify no active usage in last 90 days
- [ ] Test drop on staging environment
- [ ] Document rollback plan
- [ ] Get DBA approval signature

### Approval Sign-Off

**Reviewed By**: ___________________________
**Date**: _____________
**Approved By**: ___________________________
**Date**: _____________

---

## Keep Set (DO NOT DROP)

### Tables (${KEEP_TABLES.length})
${KEEP_TABLES.map(t => `- \`${t}\``).join('\n')}

### Views (${KEEP_VIEWS.length})
${KEEP_VIEWS.map(v => `- \`${v}\``).join('\n')}

### Functions (${KEEP_FUNCS.length})
${KEEP_FUNCS.map(f => `- \`${f}\``).join('\n')}

---

## Execution Order (When Approved)

1. **Archive Phase** (Reversible)
   - Run: \`06_archive_plan.sql\` (uncomment specific operations)
   - Wait: 48 hours, monitor for errors
   - Rollback if needed: Restore from archive schema

2. **Drop Phase** (Irreversible)
   - Review: \`05_drop_plan.sql\` carefully
   - Uncomment: ONLY verified safe drops
   - Execute: In small batches (max 5 objects at once)
   - Monitor: After each batch, wait 24 hours

3. **Verification Phase**
   - Run: \`verifyCommandCenter.ts\`
   - Check: All KEEP objects still functional
   - Confirm: Application running normally

---

## Safe Execution Commands

### Rehearsal (Staging)
\`\`\`bash
# Copy to staging first
pg_dump -h prod -U user -d dbname | psql -h staging -U user -d dbname

# Run on staging
psql -h staging -U user -d dbname -f 06_archive_plan.sql
psql -h staging -U user -d dbname -f 05_drop_plan.sql

# Test application on staging
npm run test:e2e
\`\`\`

### Production (After Staging Success)
\`\`\`bash
# BACKUP FIRST
pg_dump -h prod -U user -d dbname -F c -f backup-$(date +%Y%m%d).dump

# Archive phase (reversible)
psql -h prod -U user -d dbname -f 06_archive_plan.sql

# Wait 48h, monitor logs

# Drop phase (if archive successful)
psql -h prod -U user -d dbname -f 05_drop_plan.sql
\`\`\`

---

## Artifacts Generated

- ✅ \`01_inventory_tables.csv\` - Object inventory
- ✅ \`02_dependencies.csv\` - Dependency mapping
- ✅ \`03_keep_vs_drop.json\` - Classification
- ✅ \`05_drop_plan.sql\` - Drop plan (ALL COMMENTED)
- ✅ \`06_archive_plan.sql\` - Archive plan (ALL COMMENTED)
- ✅ \`CLEANUP_README.md\` - This document

---

## Summary

- ${classification.keep_tables.length + classification.keep_views.length + classification.keep_functions.length} objects in KEEP set
- ${classification.drop_candidates.length} identified DROP candidates
- All DROP statements are COMMENTED (dry-run only)
- Approval and testing required before execution

**Next Step**: Review this document and approval checklist with DBA/system owner

---

**Generated**: ${new Date().toISOString()}
`;

  fs.writeFileSync(path.join(OUT_DIR, 'CLEANUP_README.md'), readme);
  console.log(`   ✅ CLEANUP_README.md\n`);

  // Protection conflict detection
  console.log('7️⃣  Detecting protection conflicts...');
  const protectConflicts: any[] = [];

  // Check if any DROP_CANDIDATES are also in KEEP sets
  classification.drop_candidates.forEach((candidate: string) => {
    const candidateName = candidate.split(' ')[0]; // Extract name before parenthesis
    if (KEEP_TABLES.includes(candidateName) || KEEP_VIEWS.includes(candidateName) || KEEP_FUNCS.includes(candidateName)) {
      protectConflicts.push({
        object: candidateName,
        issue: 'DROP_CANDIDATE is also in KEEP set - refusing to drop',
        action: 'BLOCKED',
      });
    }
  });

  const conflictReport = {
    runId: RUNID,
    timestamp: new Date().toISOString(),
    conflicts: protectConflicts,
    summary: {
      total_conflicts: protectConflicts.length,
      protection_active: protectConflicts.length > 0,
    },
    message:
      protectConflicts.length > 0
        ? 'PROTECTION ACTIVE: Cleanup generator blocked drops for protected objects'
        : 'No conflicts detected - all protected objects safe',
  };

  fs.writeFileSync(
    path.join(OUT_DIR, 'protect_conflicts.json'),
    JSON.stringify(conflictReport, null, 2)
  );

  if (protectConflicts.length > 0) {
    console.log(`   🛡️  ${protectConflicts.length} conflicts detected and BLOCKED`);
    protectConflicts.forEach(c => {
      console.log(`      - ${c.object}: ${c.issue}`);
    });
  } else {
    console.log(`   ✅ No conflicts detected`);
  }
  console.log(`   ✅ protect_conflicts.json\n`);

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 Cleanup Plan Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Output: ${OUT_DIR}`);
  console.log(`Keep tables: ${classification.keep_tables.length}`);
  console.log(`Keep views: ${classification.keep_views.length}`);
  console.log(`Keep functions: ${classification.keep_functions.length}`);
  console.log(`Protection conflicts: ${protectConflicts.length}`);
  console.log('Status: ✅ Planning complete (ALL DROPS COMMENTED)');
  console.log('');

  process.exit(0);
}

main();
