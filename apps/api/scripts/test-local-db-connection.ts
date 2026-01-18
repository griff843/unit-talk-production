// Test Local PostgreSQL Connection from API Container

import { Pool } from 'pg';

async function main() {
  console.log('=== TESTING LOCAL DB CONNECTION ===\n');

  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/unit_talk_dev';
  console.log(`Connection String: ${connectionString.replace(/:[^:@]+@/, ':***@')}\n`);

  const pool = new Pool({ connectionString });

  try {
    // Test connection
    console.log('[1/3] Testing connection...');
    const client = await pool.connect();
    console.log('✅ Connection successful\n');

    // Test query
    console.log('[2/3] Testing SELECT COUNT(*) FROM raw_props...');
    const result = await client.query('SELECT COUNT(*) FROM raw_props');
    console.log(`✅ Query successful: ${result.rows[0].count} rows\n`);

    // List tables
    console.log('[3/3] Listing available tables...');
    const tables = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    console.log(`✅ Found ${tables.rows.length} tables:`);
    tables.rows.forEach((row: any, i: number) => {
      console.log(`  ${i + 1}. ${row.tablename}`);
    });

    client.release();

    console.log('\n✅ LOCAL DB CONNECTION TEST: PASSED');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ LOCAL DB CONNECTION TEST: FAILED');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
