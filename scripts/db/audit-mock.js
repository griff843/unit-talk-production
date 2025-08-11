// Mock audit script for testing report generation
const fs = require("fs");
const path = require("path");

const outDir = path.join("reports");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `db-audit-${new Date().toISOString().slice(0,10)}.md`);

function w(s) { fs.appendFileSync(outFile, s + "\n"); }

// Mock audit data for demonstration
const mockAuditResults = {
  nullCounts: [
    { table_name: 'unified_picks', column_name: 'result', null_count: 0 },
    { table_name: 'unified_picks', column_name: 'confidence_score', null_count: 15 },
    { table_name: 'raw_props', column_name: 'over_odds', null_count: 0 },
    { table_name: 'raw_props', column_name: 'game_id', null_count: 347 }
  ],
  duplicates: [
    { table_name: 'unified_picks', duplicate_count: 0 },
    { table_name: 'raw_props', duplicate_count: 23 }
  ],
  orphans: [
    { table_name: 'unified_picks', orphan_count: 0 },
    { table_name: 'agent_metrics', orphan_count: 2 }
  ],
  indexUsage: [
    { table_name: 'unified_picks', index_name: 'unified_picks_pkey', size: '8192 bytes', usage_count: 1547 },
    { table_name: 'raw_props', index_name: 'raw_props_game_id_idx', size: '16 kB', usage_count: 892 }
  ],
  tableSizes: [
    { table_name: 'unified_picks', row_count: 21954, size: '12 MB' },
    { table_name: 'raw_props', row_count: 45782, size: '28 MB' },
    { table_name: 'users', row_count: 127, size: '64 kB' }
  ]
};

w(`# DB Audit Report (Mock Data)`);
w(`Date: ${new Date().toISOString()}`);
w(``);
w(`> ⚠️ **Note**: This is a mock report for testing purposes. Unable to connect to the actual database.`);
w(``);

w(`## Null Value Analysis`);
w(`\`\`\`json`);
w(JSON.stringify(mockAuditResults.nullCounts, null, 2));
w(`\`\`\``);
w(``);

w(`## Duplicate Detection`);
w(`\`\`\`json`);
w(JSON.stringify(mockAuditResults.duplicates, null, 2));
w(`\`\`\``);
w(``);

w(`## Orphaned Records`);
w(`\`\`\`json`);
w(JSON.stringify(mockAuditResults.orphans, null, 2));
w(`\`\`\``);
w(``);

w(`## Index Usage Statistics`);
w(`\`\`\`json`);
w(JSON.stringify(mockAuditResults.indexUsage, null, 2));
w(`\`\`\``);
w(``);

w(`## Table Sizes`);
w(`\`\`\`json`);
w(JSON.stringify(mockAuditResults.tableSizes, null, 2));
w(`\`\`\``);
w(``);

w(`## Summary`);
w(`- **Tables Analyzed**: 5`);
w(`- **Total Null Values Found**: 362 across 2 columns`);
w(`- **Duplicate Records**: 23 in raw_props table`);
w(`- **Orphaned Records**: 2 in agent_metrics`);
w(`- **Most Used Index**: unified_picks_pkey (1547 uses)`);
w(`- **Largest Table**: raw_props (45,782 rows, 28 MB)`);
w(``);
w(`## Recommendations`);
w(`1. Add NOT NULL constraint to columns with 0 null values`);
w(`2. Investigate and clean up 23 duplicate records in raw_props`);
w(`3. Address 2 orphaned records in agent_metrics`);
w(`4. Consider adding index on raw_props.game_id (347 nulls may impact performance)`);
w(`5. Monitor unified_picks.confidence_score nulls (15 found)`);

console.log(`Wrote mock report: ${outFile}`);
console.log(`\nTop findings:`);
console.log(`- Null counts: 362 total (15 in unified_picks.confidence_score, 347 in raw_props.game_id)`);
console.log(`- Duplicates: 23 in raw_props`);
console.log(`- Orphans: 2 in agent_metrics`);
console.log(`- Index usage: unified_picks_pkey most used (1547 times)`);
console.log(`- Largest table: raw_props (45,782 rows, 28 MB)`);