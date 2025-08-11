// scripts/db/audit.js
require('dotenv').config({ path: '.env' });
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const { tryConnect } = require('./pgConnect');

// Get database URL with fallback support - prefer pooler for better connectivity
const pooler = process.env.SUPABASE_DB_URL_POOLER || '';
const direct = process.env.DATABASE_URL || 
               process.env.SUPABASE_DB_URL_STAGING || 
               process.env.SUPABASE_DATABASE_URL ||
               '';

// Try pooler first if available (better connectivity in restricted environments)
const raw = pooler || direct;

if (!raw) {
  console.error('Missing SUPABASE_DB_URL_POOLER or DATABASE_URL');
  console.error('Please set one of these environment variables in your .env file');
  process.exit(1);
}

// For pooler connections, ensure pgbouncer param; for direct, ensure sslmode
const url = pooler ? 
  (pooler.includes('pgbouncer=true') ? pooler : pooler + (pooler.includes('?') ? '&' : '?') + 'pgbouncer=true') :
  (raw.includes('sslmode=') ? raw : raw + (raw.includes('?') ? '&' : '?') + 'sslmode=require');

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
    console.error('[audit] Connect failed:', e.code || e.message);
    
    // If we were using pooler, try direct as fallback
    if (pooler && direct) {
      const fallbackUrl = direct.includes('sslmode=') ? direct : 
                          direct + (direct.includes('?') ? '&' : '?') + 'sslmode=require';
      const redactedFallback = fallbackUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
      console.log('[audit] Trying fallback direct URL:', redactedFallback);
      
      try {
        client = await tryConnect(fallbackUrl);
      } catch (fallbackError) {
        console.error('[audit] Fallback also failed:', fallbackError.code || fallbackError.message);
        process.exit(1);
      }
    } else {
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
