#!/usr/bin/env tsx
/**
 * Check parlay ticket status for PARLAY-DISCORD-GROUPING-001 verification
 */
import 'dotenv/config';
import { Pool } from 'pg';

const PHASE_D_PARLAY_ID = '11ba140e-b5f0-41aa-bfd6-fd75e4b3d579';

async function main() {
  const pool = new Pool({
    connectionString: process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  console.log('Connected to DB\n');

  // Check Phase D parlay ticket
  const { rows: phaseD } = await client.query(`
    SELECT id, bet_slip_id, leg_index, posted_to_discord, ticket_type, meta
    FROM unified_picks
    WHERE bet_slip_id = $1
    ORDER BY leg_index
  `, [PHASE_D_PARLAY_ID]);

  console.log(`Phase D Parlay (${PHASE_D_PARLAY_ID}):`);
  if (phaseD.length === 0) {
    console.log('  NOT FOUND');
  } else {
    phaseD.forEach(p => {
      const msgId = p.meta?.discord_receipt?.message_id || 'none';
      console.log(`  leg_index=${p.leg_index}, posted=${p.posted_to_discord}, discord_msg=${msgId}`);
    });
  }

  // Check for any pending bridge_outbox events
  console.log('\nPending bridge_outbox events:');
  const { rows: pending } = await client.query(`
    SELECT id, bet_slip_id, status, created_at
    FROM bridge_outbox
    WHERE status = 'pending'
    ORDER BY created_at DESC
    LIMIT 5
  `);
  if (pending.length === 0) {
    console.log('  NONE');
  } else {
    pending.forEach(e => console.log(`  ${e.id}: bet_slip=${e.bet_slip_id}`));
  }

  // Check for any unpublished parlay tickets
  console.log('\nUnpublished parlays (posted_to_discord=false):');
  const { rows: unpublished } = await client.query(`
    SELECT bet_slip_id, COUNT(*) as leg_count
    FROM unified_picks
    WHERE ticket_type = 'parlay' AND posted_to_discord = false
    GROUP BY bet_slip_id
    HAVING COUNT(*) >= 2
    ORDER BY MIN(created_at) DESC
    LIMIT 5
  `);
  if (unpublished.length === 0) {
    console.log('  NONE');
  } else {
    unpublished.forEach(p => console.log(`  bet_slip_id=${p.bet_slip_id}, legs=${p.leg_count}`));
  }

  client.release();
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
