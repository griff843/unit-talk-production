#!/usr/bin/env tsx
import 'dotenv/config';
import { Pool } from 'pg';

const PARLAY_ID = '6e0e3d2c-21d6-4a78-beb5-d760ae3a6512';

async function main() {
  const pool = new Pool({
    connectionString: process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  const { rows } = await client.query(
    `
    SELECT id, bet_slip_id, leg_index, ticket_type, meta
    FROM unified_picks
    WHERE bet_slip_id = $1
    ORDER BY leg_index
  `,
    [PARLAY_ID]
  );

  console.log(`Parlay ${PARLAY_ID}:\n`);
  rows.forEach(p => {
    const meta = p.meta || {};
    console.log(`leg_index=${p.leg_index}`);
    console.log(`  pick_origin: ${meta.pick_origin || 'NOT SET'}`);
    console.log(`  discord_receipt:`, JSON.stringify(meta.discord_receipt, null, 2));
  });

  client.release();
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
