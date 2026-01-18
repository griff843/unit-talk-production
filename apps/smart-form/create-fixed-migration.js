/**
 * Create properly fixed migration SQL
 * Only remove WHERE clause from CREATE INDEX, not from DELETE statements
 */

const fs = require('fs');
const path = require('path');

const originalFile = path.join(__dirname, '../../supabase/migrations/20251101_core_picks.sql');
const smartFormFile = path.join(__dirname, '../../supabase/migrations/20260115_smart_form_canonical_integration.sql');
const outputFile = path.join(__dirname, 'MIGRATION_FIXED_FINAL.sql');

console.log('📄 Reading migration files...');

// Read both migrations
const corePicks = fs.readFileSync(originalFile, 'utf8');
const smartForm = fs.readFileSync(smartFormFile, 'utf8');

console.log('🔧 Fixing smart form migration...');

// Fix only the problematic CREATE INDEX line 147-150
// Replace the index with NOW() in WHERE clause
const problematicPattern = /CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_cleanup\s+ON rate_limit_tracking\(created_at\)\s+WHERE created_at < NOW\(\) - INTERVAL '24 hours';/g;

const fixedSmartForm = smartForm.replace(
  problematicPattern,
  `CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_cleanup
  ON rate_limit_tracking(created_at);`
);

console.log('📦 Combining migrations...');

// Combine both
const combined = corePicks + '\n\n' + fixedSmartForm;

console.log('💾 Writing fixed migration...');
fs.writeFileSync(outputFile, combined, 'utf8');

console.log('✅ Created: MIGRATION_FIXED_FINAL.sql');
console.log(`   Size: ${(combined.length / 1024).toFixed(2)} KB`);
console.log('\n📋 This migration should now work without errors!');
