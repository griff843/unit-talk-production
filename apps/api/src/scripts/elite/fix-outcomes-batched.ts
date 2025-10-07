#!/usr/bin/env tsx
/**
 * Fix outcomes in date-based batches to avoid timeout
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

async function fixOutcomesBatched() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL_POOLER,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('🔧 Fixing outcomes in batches by date...\n');

  // Get date range
  const dateRange = await client.query(`
    SELECT
      MIN(game_date) as min_date,
      MAX(game_date) as max_date
    FROM settled_outcomes
    WHERE actual_value IS NOT NULL
      AND outcome IN ('win', 'loss')
  `);

  const minDate = new Date(dateRange.rows[0].min_date);
  const maxDate = new Date(dateRange.rows[0].max_date);

  console.log(`Date range: ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}\n`);

  let totalFixed = 0;
  let currentDate = new Date(minDate);
  const oneMonth = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

  while (currentDate <= maxDate) {
    const batchEnd = new Date(Math.min(currentDate.getTime() + oneMonth, maxDate.getTime()));
    const dateStr = currentDate.toISOString().split('T')[0];
    const endStr = batchEnd.toISOString().split('T')[0];

    console.log(`Processing ${dateStr} to ${endStr}...`);

    const result = await client.query(`
      UPDATE settled_outcomes
      SET outcome = CASE
        WHEN actual_value > line THEN 'win'
        WHEN actual_value <= line THEN 'loss'
        ELSE outcome
      END
      WHERE actual_value IS NOT NULL
        AND outcome IN ('win', 'loss')
        AND game_date >= $1
        AND game_date < $2
    `, [dateStr, endStr]);

    console.log(`  ✅ Fixed ${result.rowCount} records`);
    totalFixed += result.rowCount;

    currentDate = batchEnd;
  }

  console.log(`\n✅ Total fixed: ${totalFixed} records\n`);

  // Verify
  console.log('🔍 Verifying results...\n');

  const verify = await client.query(`
    SELECT
      sport,
      outcome,
      COUNT(*) as count,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY sport), 1) as percentage
    FROM settled_outcomes
    WHERE actual_value IS NOT NULL
      AND game_date >= '2024-01-01'
      AND outcome IN ('win', 'loss')
    GROUP BY sport, outcome
    ORDER BY sport, outcome
  `);

  console.log('Sport Distribution (2024+):');
  console.log('='.repeat(70));
  console.log('Sport'.padEnd(10), 'Outcome'.padEnd(10), 'Count'.padEnd(12), 'Percentage');
  console.log('='.repeat(70));

  verify.rows.forEach(r => {
    console.log(
      r.sport.padEnd(10),
      r.outcome.padEnd(10),
      r.count.toString().padEnd(12),
      r.percentage + '%'
    );
  });

  console.log('='.repeat(70));

  await client.end();
  console.log('\n✅ Migration complete');
}

fixOutcomesBatched().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
