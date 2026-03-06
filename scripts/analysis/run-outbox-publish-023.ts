#!/usr/bin/env tsx
/**
 * Outbox Publish Proof Runner
 * Sprint: SPRINT-023-PRODUCTION-SURFACE-LOCK
 *
 * Creates a single outbox row for a known eligible pick,
 * verifies the outbox flow, and prints receipt.
 *
 * Usage:
 *   npx tsx scripts/analysis/run-outbox-publish-023.ts
 *
 * Environment:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env)
 *   PICK_ID (optional — specific pick to test, else picks latest HARD-band pick)
 *   DRY_RUN (optional, default: true — set "false" to write to outbox)
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env['SUPABASE_URL'];
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const PICK_ID = process.env['PICK_ID'];
const DRY_RUN = process.env['DRY_RUN'] !== 'false'; // default true for safety

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Import outbox functions
// ---------------------------------------------------------------------------
import {
  enqueueForPublish,
  markPublished,
  markFailed,
  getOutboxReceipt,
  fetchPendingOutboxEntries,
} from '../../apps/api/src/services/publishOutbox';

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== SPRINT-023 Outbox Publish Proof ===');
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Step 1: Find an eligible pick
  let pick: any;
  if (PICK_ID) {
    const { data, error } = await supabase
      .from('unified_picks')
      .select('id, player_name, stat_type, line, odds, tier, promotion_band, posted_to_discord')
      .eq('id', PICK_ID)
      .single();
    if (error || !data) {
      console.error(`Pick ${PICK_ID} not found:`, error?.message);
      process.exit(1);
    }
    pick = data;
  } else {
    // Find latest HARD-band pick (already posted or not)
    const { data, error } = await supabase
      .from('unified_picks')
      .select('id, player_name, stat_type, line, odds, tier, promotion_band, posted_to_discord')
      .eq('promotion_band', 'HARD')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) {
      console.error('No HARD-band picks found:', error?.message);
      process.exit(1);
    }
    pick = data;
  }

  console.log('Pick selected:');
  console.log(`  ID: ${pick.id}`);
  console.log(`  Player: ${pick.player_name}`);
  console.log(`  Stat: ${pick.stat_type}`);
  console.log(`  Line: ${pick.line}`);
  console.log(`  Odds: ${pick.odds}`);
  console.log(`  Tier: ${pick.tier}`);
  console.log(`  Band: ${pick.promotion_band}`);
  console.log(`  Already posted: ${pick.posted_to_discord}\n`);

  // Step 2: Check existing outbox state
  const existingReceipt = await getOutboxReceipt(supabase, pick.id);
  if (existingReceipt) {
    console.log('Existing outbox receipt found:');
    console.log(`  Outbox ID: ${existingReceipt.id}`);
    console.log(`  Status: ${existingReceipt.status}`);
    console.log(`  Message ID: ${existingReceipt.external_message_id}`);
    console.log(`  Sent at: ${existingReceipt.sent_at}\n`);
  } else {
    console.log('No existing outbox receipt for this pick.\n');
  }

  // Step 3: Enqueue to outbox
  if (DRY_RUN) {
    console.log('[DRY RUN] Would enqueue pick to outbox:');
    console.log(`  pickId: ${pick.id}`);
    console.log(`  channel: proof-test`);
    console.log(`  promotionBand: ${pick.promotion_band}`);
    console.log(`  tier: ${pick.tier}`);
    console.log('  (skipping actual write)\n');
  } else {
    console.log('Enqueueing pick to outbox...');
    const enqueueResult = await enqueueForPublish(supabase, {
      pickId: pick.id,
      channel: 'proof-test',
      promotionBand: pick.promotion_band || 'HARD',
      tier: pick.tier || 'C',
      payload: {
        pick_id: pick.id,
        player_name: pick.player_name,
        stat_type: pick.stat_type,
        line: pick.line,
        odds: pick.odds,
      },
    });

    console.log('Enqueue result:');
    console.log(`  Outbox ID: ${enqueueResult.outboxId}`);
    console.log(`  Dedupe Key: ${enqueueResult.dedupeKey}`);
    console.log(`  Already Exists: ${enqueueResult.alreadyExists}\n`);

    // Step 4: Simulate receipt (proof-test mode — no real Discord post)
    console.log('Writing simulated receipt (proof-test, no real Discord post)...');
    await markPublished(supabase, enqueueResult.outboxId, {
      externalMessageId: `proof-test-${Date.now()}`,
    });
    console.log('Receipt written.\n');

    // Step 5: Verify receipt
    const receipt = await getOutboxReceipt(supabase, pick.id);
    console.log('Verified receipt:');
    console.log(`  Outbox ID: ${receipt?.id}`);
    console.log(`  Status: ${receipt?.status}`);
    console.log(`  External Message ID: ${receipt?.external_message_id}`);
    console.log(`  Sent at: ${receipt?.sent_at}`);
    console.log(`  Confirmed at: ${receipt?.confirmed_at}\n`);
  }

  // Step 6: Show pending outbox entries
  const pending = await fetchPendingOutboxEntries(supabase, 10);
  console.log(`Pending outbox entries: ${pending.length}`);
  for (const entry of pending.slice(0, 5)) {
    console.log(`  ${entry.id} | pick=${entry.pick_id} | attempts=${entry.attempts}`);
  }

  // Step 7: Write proof artifact
  const artifactDir = path.resolve(
    __dirname,
    '../../out/sprints/SPRINT-023-PRODUCTION-SURFACE-LOCK/2026-03-04'
  );
  fs.mkdirSync(path.join(artifactDir, 'proofs'), { recursive: true });

  const proofData = {
    timestamp: new Date().toISOString(),
    dry_run: DRY_RUN,
    pick: {
      id: pick.id,
      player_name: pick.player_name,
      stat_type: pick.stat_type,
      line: pick.line,
      tier: pick.tier,
      promotion_band: pick.promotion_band,
    },
    existing_receipt: existingReceipt
      ? {
          outbox_id: existingReceipt.id,
          status: existingReceipt.status,
          external_message_id: existingReceipt.external_message_id,
        }
      : null,
    pending_count: pending.length,
  };

  const proofPath = path.join(artifactDir, 'OUTBOX_PROOF.json');
  fs.writeFileSync(proofPath, JSON.stringify(proofData, null, 2));
  console.log(`\nProof artifact written to: ${proofPath}`);
  console.log('\n=== SPRINT-023 Outbox Proof Complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
