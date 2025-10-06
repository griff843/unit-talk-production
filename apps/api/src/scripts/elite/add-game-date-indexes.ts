#!/usr/bin/env tsx
/**
 * Deploy game_date indexes to Supabase for ML training performance
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function deployIndexes() {
  console.log('🚀 Deploying game_date indexes for ML training optimization\n');

  const sqlPath = path.join(process.cwd(), 'supabase/migrations/20251006_add_game_date_index.sql');

  if (!fs.existsSync(sqlPath)) {
    console.error('❌ SQL file not found:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log('📝 Executing SQL migration...\n');
  console.log(sql);
  console.log('\n' + '='.repeat(80) + '\n');

  const { error } = await supabase.rpc('exec_sql', { sql_string: sql });

  if (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n⚠️  Please run this SQL manually in Supabase SQL Editor:');
    console.log(sqlPath);
    process.exit(1);
  }

  console.log('✅ Indexes deployed successfully!\n');
  console.log('Created indexes:');
  console.log('  - idx_settled_outcomes_game_date (speeds up date filters)');
  console.log('  - idx_settled_outcomes_ml_training (composite: sport+date+outcome)');
  console.log('  - idx_settled_outcomes_sport (speeds up sport aggregations)\n');

  console.log('🎯 Ready to re-run ML training with optimized queries!');
}

deployIndexes();
