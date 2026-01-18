/**
 * Verify Raw Props Upcoming Events
 *
 * Queries LOCAL POSTGRES to verify raw_props has upcoming events in the next 48 hours.
 * This script does NOT print secrets.
 */

import { Pool } from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment
config({ path: resolve(__dirname, '../.env.shared') });
config({ path: resolve(__dirname, '../.env'), override: true });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/unit_talk_dev';

async function main() {
  console.log('🔍 Verifying raw_props upcoming events in LOCAL POSTGRES\n');

  // Redact password from connection string for display
  const safeDbUrl = DATABASE_URL.replace(/:[^:@]+@/, ':***@');
  console.log(`   Database: ${safeDbUrl}\n`);

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Check total rows
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM raw_props');
    const total = parseInt(totalResult.rows[0].total);

    // Check upcoming events in next 48 hours
    const upcomingResult = await pool.query(`
      SELECT COUNT(*) as upcoming_48h
      FROM raw_props
      WHERE event_time IS NOT NULL
        AND event_time >= NOW()
        AND event_time <= NOW() + INTERVAL '48 hours'
    `);
    const upcoming48h = parseInt(upcomingResult.rows[0].upcoming_48h);

    // Check event time range
    const rangeResult = await pool.query(`
      SELECT
        MIN(event_time) as min_upcoming,
        MAX(event_time) as max_upcoming,
        COUNT(*) as total_future
      FROM raw_props
      WHERE event_time >= NOW()
    `);
    const range = rangeResult.rows[0];

    console.log('📊 Results:');
    console.log(`   Total raw_props: ${total}`);
    console.log(`   Upcoming (next 48h): ${upcoming48h}`);
    console.log(`   Total future events: ${range.total_future}`);
    console.log(`   Earliest upcoming: ${range.min_upcoming || 'N/A'}`);
    console.log(`   Latest upcoming: ${range.max_upcoming || 'N/A'}`);
    console.log();

    if (upcoming48h === 0) {
      console.error('❌ FAIL: No upcoming events found in next 48 hours');
      console.error('   The E2E test will fail without upcoming events.');
      process.exit(1);
    }

    console.log(`✅ PASS: Found ${upcoming48h} upcoming events for E2E testing`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Error querying database:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
