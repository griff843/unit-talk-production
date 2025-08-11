// scripts/db/audit.js
require('dotenv').config({ path: '.env' });
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const { tryConnect } = require('./pgConnect');

// Get database URL with fallback support
const raw = process.env.SUPABASE_DB_URL_STAGING || 
           process.env.DATABASE_URL || 
           process.env.SUPABASE_DATABASE_URL ||
           '';

if (!raw) {
  console.error('Missing SUPABASE_DB_URL_STAGING or DATABASE_URL');
  console.error('Please set one of these environment variables in your .env file');
  process.exit(1);
}

// Ensure SSL mode is set
const url = raw.includes('sslmode=') ? raw : raw + (raw.includes('?') ? '&' : '?') + 'sslmode=require';

// Redacted log for debugging
const redacted = url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
console.log('[audit] Using DB URL:', redacted);

const outDir = path.join("reports");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `db-audit-${new Date().toISOString().slice(0,10)}.md`);

function w(s) { fs.appendFileSync(outFile, s + "\n"); }

(async () => {
  let client;
  
  try {
    client = await tryConnect(url);
  } catch (e) {
    console.error('[audit] Direct connect failed:', e.code || e.message);
    
    // Fallback: optional pooler URL if provided
    const pooler = process.env.SUPABASE_DB_URL_POOLER || '';
    if (!pooler) {
      console.error('[audit] No SUPABASE_DB_URL_POOLER provided for fallback');
      process.exit(1);
    }
    
    // Pooler connections might not need sslmode parameter
    const poolerUrl = pooler;
    const redactedPool = poolerUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
    console.log('[audit] Trying pooler:', redactedPool);
    
    try {
      client = await tryConnect(poolerUrl);
    } catch (poolerError) {
      console.error('[audit] Pooler connect also failed:', poolerError.code || poolerError.message);
      process.exit(1);
    }
  }

  const sql = fs.readFileSync("scripts/db/audit.sql", "utf8");
  const queries = sql.split(/;\s*\n/).map(q => q.trim()).filter(Boolean);

  w(`# DB Audit Report\nDate: ${new Date().toISOString()}\n`);

  for (const q of queries) {
    try {
      const res = await client.query(q);
      w(`\n## Query\n\`\`\`sql\n${q};\n\`\`\`\n### Result\n\`\`\`json\n${JSON.stringify(res.rows, null, 2)}\n\`\`\``);
    } catch (e) {
      w(`\n## Query FAILED\n\`\`\`sql\n${q};\n\`\`\`\nError: ${e.message}`);
    }
  }

  await client.end();
  console.log(`Wrote report: ${outFile}`);
})();
