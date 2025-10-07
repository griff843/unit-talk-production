#!/usr/bin/env tsx
/**
 * Fix outcome calculations directly via Postgres
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL_POOLER,
  ssl: { rejectUnauthorized: false }
});

async function fixOutcomes() {
  console.log('🔧 Fixing outcome calculations for all sports\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('📝 Executing UPDATE...');

    const result = await client.query(`
      UPDATE settled_outcomes
      SET outcome = CASE
        WHEN actual_value > line THEN 'win'
        WHEN actual_value <= line THEN 'loss'
        ELSE outcome
      END
      WHERE actual_value IS NOT NULL
        AND outcome IN ('win', 'loss')
    `);

    console.log(`✅ Fixed ${result.rowCount} outcome records\n`);

    await client.query('COMMIT');

    // Verify the fix
    console.log('🔍 Verifying outcome distribution by sport...\n');

    const verifyResult = await client.query(`
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
    console.log('='.repeat(60));
    console.log('Sport'.padEnd(10), 'Outcome'.padEnd(10), 'Count'.padEnd(12), 'Percentage');
    console.log('='.repeat(60));

    for (const row of verifyResult.rows) {
      console.log(
        row.sport.padEnd(10),
        row.outcome.padEnd(10),
        row.count.toString().padEnd(12),
        `${row.percentage}%`
      );
    }

    console.log('='.repeat(60));
    console.log('\n✅ Migration complete - outcomes fixed for all sports');

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixOutcomes();
