#!/usr/bin/env tsx
/**
 * Fix outcomes for all sports using correct pooler credentials
 */

import { Client } from 'pg';

async function fixAllSports() {
  const client = new Client({
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.lxqmuzmqtnnlpfapvief',
    password: 'Adalise843!',
    ssl: { rejectUnauthorized: false },
    statement_timeout: 180000 // 3 minutes per sport
  });

  await client.connect();
  console.log('✅ Connected to Supabase pooler\n');

  const sports = ['NFL', 'NBA', 'NHL'];
  let totalFixed = 0;

  for (const sport of sports) {
    console.log(`Fixing ${sport}...`);

    try {
      const result = await client.query(`
        UPDATE settled_outcomes
        SET outcome = CASE
          WHEN actual_value > line THEN 'win'
          ELSE 'loss'
        END
        WHERE actual_value IS NOT NULL
          AND outcome IN ('win', 'loss')
          AND sport = $1
      `, [sport]);

      console.log(`  ✅ Fixed ${result.rowCount} ${sport} records\n`);
      totalFixed += result.rowCount;
    } catch (error: any) {
      console.error(`  ❌ Error fixing ${sport}:`, error.message);
    }
  }

  console.log('='.repeat(70));
  console.log(`✅ Total fixed: ${totalFixed} records`);
  console.log('='.repeat(70));

  // Verify
  console.log('\n🔍 Verifying all sports...\n');

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
  console.log('\n✅ Migration complete - all sports fixed');
}

fixAllSports().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
