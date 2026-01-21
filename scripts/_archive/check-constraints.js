require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  // Check constraint definition
  const result = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'public.unified_picks'::regclass
    AND contype = 'c';
  `);

  console.log('unified_picks check constraints:');
  for (const row of result.rows) {
    console.log(`  ${row.conname}: ${row.definition}`);
  }

  // Check picks workflow_stage values
  const picksValues = await client.query(`
    SELECT DISTINCT workflow_stage, COUNT(*) as count
    FROM public.picks
    GROUP BY workflow_stage;
  `);

  console.log('\npicks workflow_stage values:');
  for (const row of picksValues.rows) {
    console.log(`  ${row.workflow_stage}: ${row.count}`);
  }

  await client.end();
}

main().catch(console.error);
