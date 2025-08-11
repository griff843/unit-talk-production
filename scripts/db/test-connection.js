// Test database connection
require('dotenv').config({ path: '.env' });
const { Client } = require('pg');

const urls = [
  process.env.DATABASE_URL,
  process.env.SUPABASE_DB_URL_POOLER,
  // Try direct URL with different formats
  'postgresql://postgres:Adalise843!@db.lxqmuzmqtnnlpfapvief.supabase.co:5432/postgres',
  'postgresql://postgres.lxqmuzmqtnnlpfapvief:Adalise843!@aws-0-us-west-1.pooler.supabase.com:5432/postgres',
  'postgresql://postgres.lxqmuzmqtnnlpfapvief:Adalise843!@aws-0-us-west-1.pooler.supabase.com:6543/postgres'
];

async function testConnection(url) {
  if (!url) return;
  
  const redacted = url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  console.log(`\nTesting: ${redacted}`);
  
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Connected! Server time:', result.rows[0].now);
    await client.end();
    return true;
  } catch (error) {
    console.log('❌ Failed:', error.code || error.message);
    return false;
  }
}

(async () => {
  console.log('Testing database connections...');
  
  for (const url of urls) {
    const success = await testConnection(url);
    if (success) {
      console.log('\n🎉 Found working connection!');
      break;
    }
  }
})();