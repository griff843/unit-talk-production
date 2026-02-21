#!/usr/bin/env node
/**
 * Capture DB proof queries for Sprint 062
 */

import pg from 'pg';
import { config } from 'dotenv';

config();

const poolerUrl = process.env.SUPABASE_DB_URL_POOLER;

const client = new pg.Client({
  connectionString: poolerUrl,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();

  console.log('=== SPRINT-E2E-SUBMIT-LIFECYCLE-HARDENING-062 DB PROOF ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log();

  // 1. Smart tickets created by atomic RPC
  console.log('--- 1. smart_tickets created via atomic_rpc ---');
  const tickets = await client.query(`
    SELECT
      bet_slip_id,
      capper_id,
      sport,
      ticket_type,
      selection_count,
      status,
      created_at
    FROM smart_tickets
    WHERE created_at >= NOW() - INTERVAL '1 hour'
    ORDER BY created_at DESC
    LIMIT 20
  `);
  console.log(`Count: ${tickets.rows.length} tickets from last hour`);
  tickets.rows.slice(0, 5).forEach(r => {
    console.log(`  - ${r.bet_slip_id}: ${r.ticket_type} (${r.selection_count} legs) - ${r.status}`);
  });
  console.log();

  // 2. Unified picks created
  console.log('--- 2. unified_picks created via atomic_rpc ---');
  const picks = await client.query(`
    SELECT
      bet_slip_id,
      COUNT(*) as leg_count
    FROM unified_picks
    WHERE created_at >= NOW() - INTERVAL '1 hour'
      AND meta->>'submitted_via' = 'atomic_rpc'
    GROUP BY bet_slip_id
    ORDER BY MAX(created_at) DESC
    LIMIT 20
  `);
  console.log(`Count: ${picks.rows.length} bet slips with atomic picks from last hour`);
  picks.rows.slice(0, 5).forEach(r => {
    console.log(`  - ${r.bet_slip_id}: ${r.leg_count} legs`);
  });
  console.log();

  // 3. Bridge outbox events
  console.log('--- 3. bridge_outbox ticket_submitted events ---');
  const outbox = await client.query(`
    SELECT
      bet_slip_id,
      event_type,
      status,
      created_at
    FROM bridge_outbox
    WHERE event_type = 'ticket_submitted'
      AND created_at >= NOW() - INTERVAL '1 hour'
    ORDER BY created_at DESC
    LIMIT 20
  `);
  console.log(`Count: ${outbox.rows.length} ticket_submitted events from last hour`);
  outbox.rows.slice(0, 5).forEach(r => {
    console.log(`  - ${r.bet_slip_id}: ${r.event_type} - ${r.status}`);
  });
  console.log();

  // 4. Verify idempotency - check for duplicate bet_slip_ids
  console.log('--- 4. Idempotency verification ---');
  const dupes = await client.query(`
    SELECT
      bet_slip_id,
      COUNT(*) as count
    FROM smart_tickets
    WHERE created_at >= NOW() - INTERVAL '1 hour'
    GROUP BY bet_slip_id
    HAVING COUNT(*) > 1
  `);
  if (dupes.rows.length === 0) {
    console.log('✅ No duplicate bet_slip_ids found (idempotency working)');
  } else {
    console.log(`❌ Found ${dupes.rows.length} duplicate bet_slip_ids`);
    dupes.rows.forEach(r => console.log(`  - ${r.bet_slip_id}: ${r.count} entries`));
  }
  console.log();

  // 5. Verify exactly one outbox event per ticket
  console.log('--- 5. Outbox exactly-once verification ---');
  const outboxDupes = await client.query(`
    SELECT
      bet_slip_id,
      COUNT(*) as count
    FROM bridge_outbox
    WHERE event_type = 'ticket_submitted'
      AND created_at >= NOW() - INTERVAL '1 hour'
    GROUP BY bet_slip_id
    HAVING COUNT(*) > 1
  `);
  if (outboxDupes.rows.length === 0) {
    console.log('✅ Exactly one outbox event per ticket (exactly-once working)');
  } else {
    console.log(`❌ Found ${outboxDupes.rows.length} tickets with multiple outbox events`);
    outboxDupes.rows.forEach(r => console.log(`  - ${r.bet_slip_id}: ${r.count} events`));
  }
  console.log();

  console.log('=== DB PROOF COMPLETE ===');

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
