#!/usr/bin/env tsx
/**
 * Fix outcomes by sport to avoid timeout
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

async function fixBySport() {
  // Encode password properly
  const connString = 'postgresql://postgres.lxqmuzmqtnnlpfapvief:' +
    encodeURIComponent('Adalise843!') +
    '@aws-0-us-west-1.pooler.supabase.com:5432/postgres?pgbouncer=true';

  const client = new Client({
    connectionString: connString,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120000 // 2 minutes per batch
  });

  await client.connect();
  console.log('✅ Connected to database\n');

  const sports = ['NFL', 'MLB', 'NBA', 'NHL'];
  let totalFixed = 0;

  for (const sport of sports) {
    console.log(`Processing ${sport}...`);

    try {
      const result = await client.query(`
        UPDATE settled_outcomes
        SET outcome = CASE
          WHEN actual_value > line THEN 'win'
          WHEN actual_value <= line THEN 'loss'
          ELSE outcome
        END
        WHERE actual_value IS NOT NULL
          AND outcome IN ('win', 'loss')
          AND sport = $1
      `, [sport]);

      console.log(`  ✅ Fixed ${result.rowCount} ${sport} records\n`);
      totalFixed += result.rowCount;
    } catch (error: any) {
      console.error(`  ❌ Error with ${sport}:`, error.message);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`✅ Total fixed: ${totalFixed} records`);
  console.log('='.repeat(70));

  // Verify
  console.log('\n🔍 Verifying results...\n');

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

fixBySport().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
