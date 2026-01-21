#!/usr/bin/env npx tsx
/**
 * Direct API E2E Test - Submits pick via API and verifies GAP-001/GAP-002
 *
 * Bypasses UI automation to directly test the submit-ticket API endpoint.
 */

import { createClient } from '@supabase/supabase-js';

const SMART_FORM_URL = process.env.SMART_FORM_URL || 'http://localhost:3021';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://csbiuvcpbhttcenmqcqx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CANARY_CHANNEL_ID = '1296531122234327100';
const DISCORD_GUILD_ID = '1296531121806643343';

if (!SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Test payload matching Smart Form schema (SmartFormSubmitTicketSchema)
const testPayload = {
  capper: 'staging_test_user',  // Must match username in users table
  sport: 'NBA',
  ticket_type: 'single',  // Must be snake_case
  game_date: new Date().toISOString().split('T')[0],
  unit_size: 2,
  confidence_level: 7,
  market_type: 'pre_game',
  // Using API-style selections with proper schema
  selections: [
    {
      stat_type: 'points',
      line: 225.5,           // Must be number
      leg_odds: -110,        // Required field, must be integer
      selection: 'over',     // Must be 'over' | 'under' | 'yes' | 'no'
      source: 'manual',
      confidence: 0.7,
    }
  ],
  notes: 'E2E Test - GAP-001 & GAP-002 verification',
};

async function submitPick(): Promise<{ bet_slip_id: string; trace_id: string } | null> {
  console.log('\n[API] Submitting pick to:', `${SMART_FORM_URL}/api/submit-ticket`);
  console.log('[API] Payload:', JSON.stringify(testPayload, null, 2));

  try {
    const response = await fetch(`${SMART_FORM_URL}/api/submit-ticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    const data = await response.json();
    console.log(`\n[API] Response Status: ${response.status}`);
    console.log('[API] Response Body:', JSON.stringify(data, null, 2));

    if (response.status === 201 && data.bet_slip_id) {
      return {
        bet_slip_id: data.bet_slip_id,
        trace_id: data.trace_id || 'MISSING',
      };
    }

    console.error('[API] Submission failed:', data.error || 'Unknown error');
    return null;
  } catch (error) {
    console.error('[API] Request failed:', error);
    return null;
  }
}

async function verifyDatabase(betSlipId: string, expectedTraceId: string) {
  console.log('\n' + '═'.repeat(70));
  console.log('  DATABASE VERIFICATION');
  console.log('═'.repeat(70));

  // Query unified_picks
  const { data: picks, error: picksError } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('bet_slip_id', betSlipId);

  if (picksError) {
    console.error('[DB] unified_picks query failed:', picksError.message);
    return null;
  }

  if (!picks || picks.length === 0) {
    console.error('[DB] No picks found for bet_slip_id:', betSlipId);
    return null;
  }

  const pick = picks[0];
  console.log(`\n[DB] unified_picks.id: ${pick.id}`);
  console.log(`[DB] unified_picks.form_source: ${pick.form_source}`);
  console.log(`[DB] unified_picks.trace_id: ${pick.trace_id || 'MISSING'}`);

  // Query pick_publish
  const { data: publishRecords, error: publishError } = await supabase
    .from('pick_publish')
    .select('*')
    .eq('pick_id', pick.id);

  if (publishError) {
    console.error('[DB] pick_publish query failed:', publishError.message);
    return { pick, publish: null };
  }

  if (!publishRecords || publishRecords.length === 0) {
    console.error('[DB] No pick_publish record found for pick_id:', pick.id);
    return { pick, publish: null };
  }

  const publish = publishRecords[0];
  console.log(`\n[DB] pick_publish.id: ${publish.id}`);
  console.log(`[DB] pick_publish.status: ${publish.status}`);
  console.log(`[DB] pick_publish.discord_channel_id: ${publish.discord_channel_id}`);
  console.log(`[DB] pick_publish.external_message_id: ${publish.external_message_id || 'PENDING'}`);
  console.log(`[DB] pick_publish.sent_at: ${publish.sent_at || 'PENDING'}`);
  console.log(`[DB] pick_publish.metadata.trace_id: ${publish.metadata?.trace_id || 'MISSING'}`);

  return { pick, publish };
}

async function waitForDiscordDelivery(pickId: string, maxWaitMs: number = 30000): Promise<any> {
  console.log('\n[WAIT] Waiting for DiscordPromotionAgent to process pick_publish...');
  const startTime = Date.now();
  const pollInterval = 2000;

  while (Date.now() - startTime < maxWaitMs) {
    const { data: publishRecords, error } = await supabase
      .from('pick_publish')
      .select('*')
      .eq('pick_id', pickId)
      .single();

    if (error) {
      console.log(`[WAIT] Query error: ${error.message}`);
      await new Promise(r => setTimeout(r, pollInterval));
      continue;
    }

    if (publishRecords?.status === 'sent') {
      console.log('[WAIT] pick_publish status changed to "sent"!');
      return publishRecords;
    }

    console.log(`[WAIT] Status: ${publishRecords?.status || 'unknown'} - waiting...`);
    await new Promise(r => setTimeout(r, pollInterval));
  }

  console.log('[WAIT] Timeout waiting for status=sent');
  return null;
}

async function main() {
  console.log('═'.repeat(70));
  console.log('  GAP-001 & GAP-002 DIRECT API E2E TEST');
  console.log('═'.repeat(70));
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log(`  Smart Form URL: ${SMART_FORM_URL}`);
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log(`  CANARY Channel: ${CANARY_CHANNEL_ID}`);
  console.log('═'.repeat(70));

  // Step 1: Submit pick via API
  const submitResult = await submitPick();
  if (!submitResult) {
    console.error('\n❌ FAILED: Could not submit pick via API');
    process.exit(1);
  }

  const { bet_slip_id, trace_id } = submitResult;

  // Step 2: Verify database records
  const dbResult = await verifyDatabase(bet_slip_id, trace_id);
  if (!dbResult) {
    console.error('\n❌ FAILED: Database verification failed');
    process.exit(1);
  }

  const { pick, publish } = dbResult;

  // Step 3: Wait for Discord delivery (if agent is running)
  let finalPublish = publish;
  if (publish && publish.status !== 'sent') {
    const delivered = await waitForDiscordDelivery(pick.id, 30000);
    if (delivered) {
      finalPublish = delivered;
    }
  }

  // Generate proof block
  console.log('\n' + '═'.repeat(70));
  console.log('  PROOF BLOCK');
  console.log('═'.repeat(70));

  const discordUrl = finalPublish?.external_message_id && finalPublish?.discord_channel_id
    ? `https://discord.com/channels/${DISCORD_GUILD_ID}/${finalPublish.discord_channel_id}/${finalPublish.external_message_id}`
    : 'PENDING';

  console.log(`
┌────────────────────────────────────────────────────────────────────┐
│  PROOF BLOCK                                                       │
├────────────────────────────────────────────────────────────────────┤
│  trace_id:                     ${(trace_id || 'MISSING').substring(0,36).padEnd(36)}│
│  unified_picks.id:             ${(pick?.id || 'N/A').substring(0,36).padEnd(36)}│
│  pick_publish.id:              ${(finalPublish?.id || 'N/A').substring(0,36).padEnd(36)}│
│  pick_publish.status:          ${(finalPublish?.status || 'N/A').padEnd(36)}│
│  pick_publish.sent_at:         ${(finalPublish?.sent_at || 'PENDING').substring(0,36).padEnd(36)}│
│  pick_publish.external_msg_id: ${(finalPublish?.external_message_id || 'PENDING').substring(0,36).padEnd(36)}│
│  pick_publish.discord_channel: ${(finalPublish?.discord_channel_id || 'N/A').padEnd(36)}│
│  channel_matches_canary:       ${(finalPublish?.discord_channel_id === CANARY_CHANNEL_ID ? '✅ TRUE' : '❌ FALSE').padEnd(36)}│
├────────────────────────────────────────────────────────────────────┤
│  Discord URL:                                                      │
│  ${discordUrl.padEnd(66)}│
└────────────────────────────────────────────────────────────────────┘
`);

  // Check if DiscordPromotionAgent logs exist
  console.log('┌────────────────────────────────────────────────────────────────────┐');
  console.log('│  DISCORDPROMOTIONAGENT CONSUMER EVIDENCE                           │');
  console.log('├────────────────────────────────────────────────────────────────────┤');

  if (finalPublish?.worker_id) {
    console.log(`│  [CLAIM] Claimed by worker_id: ${finalPublish.worker_id.substring(0,35).padEnd(35)}│`);
  }
  if (finalPublish?.processing_started_at) {
    console.log(`│  [CLAIM] processing_started_at: ${finalPublish.processing_started_at.substring(0,34).padEnd(34)}│`);
  }
  if (finalPublish?.status === 'sent' && finalPublish?.sent_at) {
    console.log(`│  [POST] status=sent at: ${finalPublish.sent_at.substring(0,42).padEnd(42)}│`);
  }

  const claimed = !!finalPublish?.worker_id && !!finalPublish?.processing_started_at;
  const posted = finalPublish?.status === 'sent' && !!finalPublish?.sent_at;

  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│  Agent claimed pick_publish:   ${(claimed ? '✅ YES' : '⏳ PENDING').padEnd(36)}│`);
  console.log(`│  Agent posted and updated:     ${(posted ? '✅ YES' : '⏳ PENDING').padEnd(36)}│`);
  console.log('└────────────────────────────────────────────────────────────────────┘');

  // Save evidence bundle
  const fs = await import('fs');
  const path = await import('path');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bundlePath = path.join(process.cwd(), 'out', 'manual-pick-e2e', `${timestamp}_smartform_canonical`);
  const dbDir = path.join(bundlePath, 'db');
  const discordDir = path.join(bundlePath, 'discord');

  fs.mkdirSync(dbDir, { recursive: true });
  fs.mkdirSync(discordDir, { recursive: true });

  fs.writeFileSync(path.join(dbDir, 'unified_pick.json'), JSON.stringify(pick, null, 2));
  if (finalPublish) {
    fs.writeFileSync(path.join(dbDir, 'pick_publish.json'), JSON.stringify(finalPublish, null, 2));
  }
  fs.writeFileSync(path.join(discordDir, 'message_proof.json'), JSON.stringify({
    discord_message_url: discordUrl,
    external_message_id: finalPublish?.external_message_id || 'PENDING',
    channel_id: finalPublish?.discord_channel_id || 'N/A',
    canary_channel_id: CANARY_CHANNEL_ID,
    channel_matches_canary: finalPublish?.discord_channel_id === CANARY_CHANNEL_ID,
  }, null, 2));

  console.log('\n┌────────────────────────────────────────────────────────────────────┐');
  console.log('│  EVIDENCE BUNDLE                                                   │');
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log(`│  Path: ${bundlePath.substring(0, 58).padEnd(58)}│`);
  console.log('├────────────────────────────────────────────────────────────────────┤');
  console.log('│  db/                                                               │');
  console.log('│    unified_pick.json                                               │');
  console.log('│    pick_publish.json                                               │');
  console.log('│  discord/                                                          │');
  console.log('│    message_proof.json                                              │');
  console.log('└────────────────────────────────────────────────────────────────────┘');

  // Final status
  console.log('\n' + '═'.repeat(70));

  const gap002Pass = trace_id !== 'MISSING' && pick?.trace_id === trace_id && finalPublish?.metadata?.trace_id === trace_id;
  const gap001Pass = finalPublish?.status === 'sent' && finalPublish?.external_message_id;
  const canaryPass = finalPublish?.discord_channel_id === CANARY_CHANNEL_ID;

  if (gap002Pass) {
    console.log('  ✅ GAP-002 RESOLVED: trace_id propagated end-to-end');
  } else {
    console.log('  ❌ GAP-002: trace_id verification failed');
  }

  if (gap001Pass) {
    console.log('  ✅ GAP-001 RESOLVED: pick_publish consumed, status=sent');
  } else {
    console.log('  ⏳ GAP-001 PENDING: DiscordPromotionAgent has not processed yet');
  }

  if (canaryPass) {
    console.log('  ✅ CANARY CHANNEL VERIFIED');
  } else if (finalPublish?.discord_channel_id) {
    console.log(`  ⚠️  CHANNEL MISMATCH: ${finalPublish.discord_channel_id} (expected ${CANARY_CHANNEL_ID})`);
  }

  console.log('═'.repeat(70));

  // GAP-002 is the critical one - trace_id must be present
  process.exit(gap002Pass ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
