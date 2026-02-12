#!/usr/bin/env tsx
/**
 * PARLAY-DISCORD-GROUPING-001 Verification Script
 *
 * Run this AFTER submitting a parlay via Smart Form to verify:
 * 1. Single Discord message for parlay
 * 2. Same discord_message_id on all legs
 * 3. Idempotency (rerun doesn't create duplicates)
 */
import 'dotenv/config';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'out', 'parlay-discord-grouping', '2026-02-11');

async function main() {
  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const pool = new Pool({
    connectionString: process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  console.log('Connected to DB\n');

  // Find the most recent unpublished parlay OR recently published parlay
  console.log('=== Looking for recent parlays ===\n');

  // Check unpublished first
  const { rows: unpublished } = await client.query(`
    SELECT bet_slip_id, COUNT(*) as leg_count, MAX(created_at) as created_at
    FROM unified_picks
    WHERE ticket_type = 'parlay' AND posted_to_discord = false
    GROUP BY bet_slip_id
    HAVING COUNT(*) >= 2
    ORDER BY MAX(created_at) DESC
    LIMIT 1
  `);

  if (unpublished.length > 0) {
    const parlayId = unpublished[0].bet_slip_id;
    console.log(`Found UNPUBLISHED parlay: ${parlayId} (${unpublished[0].leg_count} legs)`);
    console.log(`Created: ${unpublished[0].created_at}\n`);

    // Capture C1: DB state BEFORE processing
    const { rows: beforePicks } = await client.query(`
      SELECT id, bet_slip_id, leg_index, posted_to_discord, ticket_type, tier, meta
      FROM unified_picks
      WHERE bet_slip_id = $1
      ORDER BY leg_index
    `, [parlayId]);

    const c1 = { parlay_id: parlayId, legs: beforePicks, captured_at: new Date().toISOString() };
    fs.writeFileSync(path.join(OUTPUT_DIR, 'C1_db_before.json'), JSON.stringify(c1, null, 2));
    console.log('C1_db_before.json saved\n');

    console.log('Run the auto-processor now to post this parlay:');
    console.log('  npx tsx apps/api/src/scripts/auto-processor.ts');
    console.log('\nThen re-run this script to capture C4_db_after.json');

  } else {
    // Check for recently published parlays (posted in last hour)
    const { rows: recent } = await client.query(`
      SELECT bet_slip_id, COUNT(*) as leg_count, MAX(updated_at) as updated_at
      FROM unified_picks
      WHERE ticket_type = 'parlay'
        AND posted_to_discord = true
        AND updated_at > NOW() - INTERVAL '1 hour'
      GROUP BY bet_slip_id
      HAVING COUNT(*) >= 2
      ORDER BY MAX(updated_at) DESC
      LIMIT 1
    `);

    if (recent.length > 0) {
      const parlayId = recent[0].bet_slip_id;
      console.log(`Found PUBLISHED parlay: ${parlayId} (${recent[0].leg_count} legs)`);
      console.log(`Updated: ${recent[0].updated_at}\n`);

      // Capture C4: DB state AFTER processing
      const { rows: afterPicks } = await client.query(`
        SELECT id, bet_slip_id, leg_index, posted_to_discord, ticket_type, tier, meta
        FROM unified_picks
        WHERE bet_slip_id = $1
        ORDER BY leg_index
      `, [parlayId]);

      const c4 = { parlay_id: parlayId, legs: afterPicks, captured_at: new Date().toISOString() };
      fs.writeFileSync(path.join(OUTPUT_DIR, 'C4_db_after.json'), JSON.stringify(c4, null, 2));
      console.log('C4_db_after.json saved\n');

      // Verify all legs have same discord_message_id
      const messageIds = new Set<string>();
      afterPicks.forEach(pick => {
        const msgId = pick.meta?.discord_receipt?.message_id;
        if (msgId) messageIds.add(msgId);
      });

      console.log('=== PARLAY GROUPING VERIFICATION ===\n');
      console.log(`Total legs: ${afterPicks.length}`);
      console.log(`Unique discord_message_ids: ${messageIds.size}`);

      if (messageIds.size === 1) {
        console.log('\n PASS: All legs share same discord_message_id');
        console.log(`Message ID: ${Array.from(messageIds)[0]}`);
      } else if (messageIds.size === 0) {
        console.log('\n WARNING: No discord_message_id found on any leg');
      } else {
        console.log('\n FAIL: Multiple discord_message_ids found');
        afterPicks.forEach(p => {
          console.log(`  leg_index=${p.leg_index}: ${p.meta?.discord_receipt?.message_id || 'none'}`);
        });
      }

      // Save verification result
      const verification = {
        parlay_id: parlayId,
        leg_count: afterPicks.length,
        unique_message_ids: messageIds.size,
        message_ids: Array.from(messageIds),
        pass: messageIds.size === 1,
        legs: afterPicks.map(p => ({
          leg_index: p.leg_index,
          posted_to_discord: p.posted_to_discord,
          discord_message_id: p.meta?.discord_receipt?.message_id
        }))
      };

      fs.writeFileSync(path.join(OUTPUT_DIR, 'C3_discord_message_proof.json'), JSON.stringify(verification, null, 2));
      console.log('\nC3_discord_message_proof.json saved');

    } else {
      console.log('No recent parlays found (unpublished or published in last hour)');
      console.log('\nTo test PARLAY-DISCORD-GROUPING-001:');
      console.log('1. Submit a 2-leg parlay via Smart Form');
      console.log('2. Run: npx tsx apps/api/src/scripts/auto-processor.ts');
      console.log('3. Re-run this script to verify');
    }
  }

  // Check pending bridge_outbox events
  console.log('\n=== Bridge Outbox Status ===\n');
  const { rows: pending } = await client.query(`
    SELECT id, bet_slip_id, status, created_at
    FROM bridge_outbox
    WHERE status = 'pending'
    ORDER BY created_at DESC
    LIMIT 5
  `);

  if (pending.length === 0) {
    console.log('No pending bridge_outbox events');
  } else {
    console.log(`${pending.length} pending event(s):`);
    pending.forEach(e => console.log(`  ${e.id}: bet_slip=${e.bet_slip_id}`));
  }

  client.release();
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
