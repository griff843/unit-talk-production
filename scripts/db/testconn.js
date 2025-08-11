// Test connection script
require('dotenv').config({ path: '.env' });
const { Client } = require('pg');

async function test() {
  const url = process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL;
  if (!url) {
    console.error('No DB URL found');
    process.exit(1);
  }
  
  console.log('Testing:', url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@'));
  
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });
  
  try {
    await client.connect();
    const res = await client.query('SELECT 1');
    console.log('SUCCESS:', res.rows);
    await client.end();
  } catch (e) {
    console.error('FAILED:', e.message);
  }
}

test();