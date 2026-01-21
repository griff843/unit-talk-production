/* eslint-disable no-console */
/**
 * Apply pick_publish migration using direct PostgreSQL connection
 */
import pg from 'pg';

const DATABASE_URL =
  process.env.DATABASE_DIRECT_URL ||
  'postgresql://postgres.cqfnsozknjzvyiziwicl:Adalise843!@aws-1-us-east-2.pooler.supabase.com:6543/postgres';

async function main() {
  console.log('=== APPLYING PICK_PUBLISH MIGRATION ===\n');

  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Add worker_id column
    console.log('1. Adding worker_id column...');
    await client.query(`
      ALTER TABLE pick_publish
      ADD COLUMN IF NOT EXISTS worker_id TEXT DEFAULT NULL
    `);
    console.log('   ✓ worker_id column added\n');

    // Add processing_started_at column
    console.log('2. Adding processing_started_at column...');
    await client.query(`
      ALTER TABLE pick_publish
      ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ DEFAULT NULL
    `);
    console.log('   ✓ processing_started_at column added\n');

    // Add error column
    console.log('3. Adding error column...');
    await client.query(`
      ALTER TABLE pick_publish
      ADD COLUMN IF NOT EXISTS error TEXT DEFAULT NULL
    `);
    console.log('   ✓ error column added\n');

    // Verify columns exist
    console.log('4. Verifying columns...');
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'pick_publish'
      AND column_name IN ('worker_id', 'processing_started_at', 'error')
    `);

    console.log('   Columns found:');
    for (const row of result.rows) {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    }

    console.log('\n=== MIGRATION COMPLETE ===');
  } catch (err: any) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
