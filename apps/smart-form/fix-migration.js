/**
 * Fix the migration file by removing the problematic NOW() function from index predicate
 */

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'CONSOLIDATED_MIGRATION.sql');
const outputFile = path.join(__dirname, 'CONSOLIDATED_MIGRATION_FIXED.sql');

console.log('📄 Reading migration file...');
let sql = fs.readFileSync(inputFile, 'utf8');

console.log('🔧 Fixing problematic index with NOW() function...');

// Replace the problematic index that uses NOW() in WHERE clause
// This index is for cleanup purposes and doesn't need the WHERE clause
const problematicIndex = `-- Auto-cleanup old rate limit records (keep last 24 hours)
CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_cleanup
  ON rate_limit_tracking(created_at)
  WHERE created_at < NOW() - INTERVAL '24 hours';`;

const fixedIndex = `-- Auto-cleanup old rate limit records (keep last 24 hours)
-- Note: Removed WHERE clause with NOW() as it's not IMMUTABLE
CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_cleanup
  ON rate_limit_tracking(created_at);`;

sql = sql.replace(problematicIndex, fixedIndex);

console.log('💾 Writing fixed migration file...');
fs.writeFileSync(outputFile, sql, 'utf8');

console.log('✅ Fixed migration file created: CONSOLIDATED_MIGRATION_FIXED.sql');
console.log('\n📋 Next steps:');
console.log('   1. Go to https://app.supabase.com/project/csbiuvcpbhttcenmqcqx/sql/new');
console.log('   2. Copy contents of CONSOLIDATED_MIGRATION_FIXED.sql');
console.log('   3. Paste and execute in SQL Editor');
