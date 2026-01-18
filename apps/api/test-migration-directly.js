const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_DIRECT_URL,
  max: 1,
});

async function test() {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync('../../supabase/migrations/20251030_backfill_unified_to_canonical.sql', 'utf-8');
    console.log('Executing migration...\n');
    const result = await client.query(sql);
    console.log('✅ Migration successful!');
    console.log('Result:', result);
  } catch (error) {
    console.error('❌ Migration failed:');
    console.error('Error message:', error.message);
    console.error('Error detail:', error.detail);
    console.error('Error hint:', error.hint);
    console.error('Error position:', error.position);
  } finally {
    client.release();
    await pool.end();
  }
}

test();
