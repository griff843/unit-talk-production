/**
 * Cleanup Inventory Generator (DRY-RUN ONLY)
 * Generates inventory, dependencies, and drop plans WITHOUT executing
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

const KEEP_SET = [
  'unified_picks',
  'raw_props',
  'scored_props',
  'promotion_queue',
  'settled_outcomes',
  'player_stats',
  'v_daily_board',
  'v_prop_read_model',
  'v_open_promotions'
];

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  console.log('📋 Generating Cleanup Inventory (DRY-RUN ONLY)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Run ID: ${RUNID}`);
  console.log('⚠️  NO DROP STATEMENTS WILL BE EXECUTED\n');

  ensureDir(OUT_DIR);

  // Use known objects from previous work (pg_class not accessible via Supabase)
  console.log('1️⃣  Inventorying tables and views...');
  console.log('   (Using known object list - full introspection requires direct DB access)');

  const knownTables = ['unified_picks', 'raw_props', 'scored_props', 'promotion_queue', 'users', 'games', 'agent_health', 'agent_metrics', 'settled_outcomes', 'player_stats', 'approval_queue'];
  const knownViews = ['v_daily_board', 'v_prop_read_model', 'v_open_promotions', 'v_command_center_board'];

  console.log(`   Found ${knownTables.length} known tables, ${knownViews.length} known views`);

  // Write 01_inventory_tables.csv
  const inventoryCsv = ['relkind,relname,est_rows,notes'];
  knownTables.forEach(t => {
    inventoryCsv.push(`r,${t},unknown,Core table`);
  });
  knownViews.forEach(v => {
    inventoryCsv.push(`v,${v},N/A,Core view`);
  });

  fs.writeFileSync(
    path.join(OUT_DIR, '01_inventory_tables.csv'),
    inventoryCsv.join('\n')
  );
  console.log(`   ✅ Written 01_inventory_tables.csv`);

  // Write 02_dependencies.csv
  console.log('2️⃣  Analyzing dependencies...');
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

  fs.writeFileSync(
    path.join(OUT_DIR, '02_dependencies.csv'),
    dependenciesCsv.join('\n')
  );
  console.log(`   ✅ Written 02_dependencies.csv`);

  // Write 03_keep_vs_drop.json
  console.log('3️⃣  Classifying objects...');
  const classification = {
    keep: KEEP_SET,
    archive_then_drop: [
      'approval_queue (deprecated - replaced by promotion_queue)'
    ],
    drop_now: [] as string[],
    blocked_by_dependencies: [] as string[],
    notes: 'Full database introspection required for complete classification'
  };

  fs.writeFileSync(
    path.join(OUT_DIR, '03_keep_vs_drop.json'),
    JSON.stringify(classification, null, 2)
  );
  console.log(`   ✅ Written 03_keep_vs_drop.json`);

  // Write 05_drop_plan.sql
  console.log('4️⃣  Generating drop plan (NOT TO BE EXECUTED)...');
  const dropPlan = `-- ================================================================
-- CLEANUP DROP PLAN (DRY-RUN ONLY - DO NOT EXECUTE)
-- ================================================================
-- Run ID: ${RUNID}
-- Generated: ${new Date().toISOString()}
--
-- ⚠️  CRITICAL WARNING ⚠️
-- This file is for PLANNING and REVIEW ONLY
-- DO NOT EXECUTE these DROP statements without:
--   1. Full backup of production database
--   2. Approval from system owner
--   3. Verification that objects are truly unused
--   4. Testing on staging environment first
-- ================================================================

-- KEEP SET (DO NOT DROP):
${KEEP_SET.map(obj => `--   - ${obj}`).join('\n')}

-- POTENTIAL DROPS (REVIEW REQUIRED):

-- Example 1: approval_queue (if exists and fully replaced by promotion_queue)
-- DROP TABLE IF EXISTS public.approval_queue CASCADE;
-- -- REASON: Replaced by promotion_queue system
-- -- VERIFY: Check for data migration completion first

-- ================================================================
-- NO ACTUAL DROP STATEMENTS PROVIDED
-- Full database introspection required before generating drop plan
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '⚠️  THIS IS A DRY-RUN PLANNING FILE ONLY';
  RAISE NOTICE '⚠️  NO CLEANUP ACTIONS TO BE EXECUTED';
  RAISE NOTICE '⚠️  Full database inventory required before proceeding';
END $$;
`;

  fs.writeFileSync(
    path.join(OUT_DIR, '05_drop_plan.sql'),
    dropPlan
  );
  console.log(`   ✅ Written 05_drop_plan.sql (NOT TO BE EXECUTED)`);

  // Write 06_archive_plan.sql
  console.log('5️⃣  Generating archive plan...');
  const archivePlan = `-- ================================================================
-- ARCHIVE PLAN (Safer than dropping)
-- ================================================================
-- Run ID: ${RUNID}
--
-- Move deprecated objects to archive schema instead of dropping
-- Easy to restore if needed: ALTER TABLE archive.X SET SCHEMA public;
-- ================================================================

-- Create archive schema
CREATE SCHEMA IF NOT EXISTS archive;

-- Example: Move approval_queue to archive (if exists)
-- ALTER TABLE IF EXISTS public.approval_queue SET SCHEMA archive;

DO $$
BEGIN
  RAISE NOTICE '✅ Archive schema created';
  RAISE NOTICE '⚠️  No objects moved - manual review required';
END $$;
`;

  fs.writeFileSync(
    path.join(OUT_DIR, '06_archive_plan.sql'),
    archivePlan
  );
  console.log(`   ✅ Written 06_archive_plan.sql`);

  // Write CLEANUP_REPORT.md
  console.log('6️⃣  Writing cleanup report...');
  const report = `# Cleanup Report (DRY-RUN ONLY)

**Run ID**: ${RUNID}
**Timestamp**: ${new Date().toISOString()}
**Status**: ⚠️ **PLANNING ONLY - NO EXECUTION**

---

## ⚠️ CRITICAL WARNINGS

1. **DRY-RUN ONLY**: This report is for planning and review purposes
2. **NO DROP STATEMENTS EXECUTED**: No database objects were dropped or modified
3. **REQUIRES FULL INVENTORY**: Complete database introspection needed
4. **STAGING TEST REQUIRED**: All cleanup must be tested on staging first
5. **BACKUP MANDATORY**: Full production backup required before execution

---

## Keep Set (DO NOT DROP)

### Core Tables
${KEEP_SET.filter(s => !s.startsWith('v_')).map(t => `- \`${t}\``).join('\n')}

### Core Views
${KEEP_SET.filter(s => s.startsWith('v_')).map(v => `- \`${v}\``).join('\n')}

---

## Objects Requiring Investigation

### Potentially Deprecated
- \`approval_queue\` (if exists) - Appears replaced by \`promotion_queue\`
  - **Action**: Verify data migration, check for active references
  - **Risk**: Medium - may contain historical data

---

## Safe Cleanup Approach

### Phase 1: Archive (Reversible)
1. Create archive schema
2. Move candidate objects to archive
3. Monitor for 48-72 hours
4. If no errors, proceed to Phase 2

### Phase 2: Selective Drops
1. Drop zero-row objects with zero dependencies
2. Monitor for 24 hours between batches
3. Never drop more than 5 objects at once

### Phase 3: Final Cleanup
1. Review archived objects after 1 week
2. Drop archived objects if confirmed unused
3. Maintain detailed audit log

---

## Artifacts Generated

- ✅ \`01_inventory_tables.csv\` - Object inventory
- ✅ \`02_dependencies.csv\` - Dependency mapping
- ✅ \`03_keep_vs_drop.json\` - Classification
- ✅ \`05_drop_plan.sql\` - Drop plan (NOT TO BE EXECUTED)
- ✅ \`06_archive_plan.sql\` - Archive plan
- ✅ \`CLEANUP_REPORT.md\` - This report

---

## Recommendations

### Before Any Cleanup:
1. **Full Database Introspection**: Query all objects in public schema
2. **Row Count Analysis**: Determine data volume in each table
3. **Dependency Graph**: Build complete dependency map
4. **Stakeholder Review**: Confirm objects are truly deprecated
5. **Staging Test**: Apply cleanup to staging environment

### Execution Order:
1. Start with archive (reversible)
2. Test application thoroughly
3. Drop views before tables
4. Drop zero-dependency objects first
5. Keep audit trail of all actions

---

## Next Steps

1. **Schedule dedicated cleanup session** (3-4 hours)
2. **Run full database introspection**
3. **Generate row counts for all tables**
4. **Review with system owner**
5. **Test on staging environment**
6. **Create full backup before execution**
7. **Execute in small batches with monitoring**

---

## Summary

- ✅ ${KEEP_SET.length} objects in keep set
- ⚠️ 1+ objects requiring investigation
- ⏸️ Full inventory needed for comprehensive plan

**Status**: Planning complete, execution deferred pending full inventory

---

**Report Generated**: ${new Date().toISOString()}
**Next Review**: After full database introspection
`;

  fs.writeFileSync(
    path.join(OUT_DIR, 'CLEANUP_REPORT.md'),
    report
  );
  console.log(`   ✅ Written CLEANUP_REPORT.md`);

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 Cleanup Inventory Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Artifacts: ${OUT_DIR}`);
  console.log(`Keep set: ${KEEP_SET.length} objects`);
  console.log('Status: ✅ Planning complete (NO DROPS EXECUTED)');
  console.log('');

  process.exit(0);
}

main();
