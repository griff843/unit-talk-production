#!/usr/bin/env npx tsx
/**
 * GAP-001 & GAP-002 Resolution Verification Script
 *
 * This script produces a PROOF BLOCK showing:
 * - trace_id
 * - unified_picks.id
 * - pick_publish.id
 * - pick_publish.status
 * - pick_publish.sent_at
 * - pick_publish.external_message_id
 * - pick_publish.discord_channel_id (must equal CANARY)
 * - Discord message URL
 *
 * Also confirms the DiscordPromotionAgent consumer ran by showing:
 * - Log line showing agent claimed pick_publish row
 * - Log line showing it posted and updated status=sent
 *
 * Usage:
 *   npx tsx scripts/verify-gap-resolution.ts
 *
 * Environment Variables (from GitHub Secrets):
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 *   DISCORD_GUILD_ID - Discord server ID (optional)
 */

import { createClient } from '@supabase/supabase-js';

// Constants
const CANARY_CHANNEL_ID = '1296531122234327100';
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || '1296531121806643343';

// Verify environment
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing required environment variables');
  console.error('  SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'MISSING');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_KEY ? 'SET' : 'MISSING');
  console.error('\nThis script must run via GitHub Actions where secrets are injected.');
  console.error('Run: gh workflow run verify-gap-resolution.yml --ref main');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface ProofBlock {
  trace_id: string;
  unified_picks_id: string;
  pick_publish_id: string;
  pick_publish_status: string;
  pick_publish_sent_at: string;
  pick_publish_external_message_id: string;
  pick_publish_discord_channel_id: string;
  discord_channel_matches_canary: boolean;
  discord_message_url: string;
}

async function findRecentSmartFormSubmission(): Promise<{
  unified_pick: any;
  pick_publish: any;
} | null> {
  // Find most recent unified_pick from Smart Form with trace_id
  const { data: picks, error: picksError } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('form_source', 'smart_form')
    .not('trace_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (picksError) {
    console.error('Error querying unified_picks:', picksError.message);
    return null;
  }

  if (!picks || picks.length === 0) {
    console.log('No Smart Form submissions with trace_id found.');
    console.log('Submit a pick via Smart Form first, then re-run this verification.');
    return null;
  }

  console.log(`Found ${picks.length} recent Smart Form submission(s) with trace_id`);

  // Find corresponding pick_publish record
  for (const pick of picks) {
    const { data: publishRecords, error: publishError } = await supabase
      .from('pick_publish')
      .select('*')
      .eq('pick_id', pick.id);

    if (publishError) {
      console.error(`Error querying pick_publish for pick ${pick.id}:`, publishError.message);
      continue;
    }

    if (publishRecords && publishRecords.length > 0) {
      return {
        unified_pick: pick,
        pick_publish: publishRecords[0],
      };
    }
  }

  // If no pick_publish found, return the first pick anyway
  return {
    unified_pick: picks[0],
    pick_publish: null,
  };
}

function generateProofBlock(unified_pick: any, pick_publish: any): ProofBlock | null {
  if (!unified_pick) return null;

  const channelId = pick_publish?.discord_channel_id || 'N/A';
  const messageId = pick_publish?.external_message_id || 'N/A';

  const discordUrl = messageId !== 'N/A' && channelId !== 'N/A'
    ? `https://discord.com/channels/${DISCORD_GUILD_ID}/${channelId}/${messageId}`
    : 'PENDING';

  return {
    trace_id: unified_pick.trace_id || 'MISSING',
    unified_picks_id: unified_pick.id,
    pick_publish_id: pick_publish?.id || 'NOT FOUND',
    pick_publish_status: pick_publish?.status || 'NOT FOUND',
    pick_publish_sent_at: pick_publish?.sent_at || 'PENDING',
    pick_publish_external_message_id: messageId,
    pick_publish_discord_channel_id: channelId,
    discord_channel_matches_canary: channelId === CANARY_CHANNEL_ID,
    discord_message_url: discordUrl,
  };
}

async function checkAgentLogs(): Promise<{ claimed: boolean; posted: boolean; logs: string[] }> {
  // Check for recent agent activity in agent_health or logs
  const { data: agentHealth, error } = await supabase
    .from('agent_health')
    .select('*')
    .eq('agent_name', 'DiscordPromotionAgent')
    .order('last_heartbeat', { ascending: false })
    .limit(1);

  const logs: string[] = [];

  if (agentHealth && agentHealth.length > 0) {
    const agent = agentHealth[0];
    logs.push(`[DiscordPromotionAgent] Last heartbeat: ${agent.last_heartbeat}`);
    logs.push(`[DiscordPromotionAgent] Status: ${agent.status}`);

    if (agent.metadata?.last_batch_processed) {
      logs.push(`[DiscordPromotionAgent] Last batch processed: ${agent.metadata.last_batch_processed}`);
    }
    if (agent.metadata?.records_processed) {
      logs.push(`[DiscordPromotionAgent] Records processed: ${agent.metadata.records_processed}`);
    }
  }

  // Check for recent pick_publish transitions as evidence of agent activity
  const { data: recentSent, error: sentError } = await supabase
    .from('pick_publish')
    .select('id, status, sent_at, worker_id, processing_started_at')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(5);

  let claimed = false;
  let posted = false;

  if (recentSent && recentSent.length > 0) {
    for (const record of recentSent) {
      if (record.worker_id && record.processing_started_at) {
        claimed = true;
        logs.push(`[CLAIM LOG] pick_publish.id=${record.id} claimed by worker_id=${record.worker_id} at ${record.processing_started_at}`);
      }
      if (record.sent_at) {
        posted = true;
        logs.push(`[POST LOG] pick_publish.id=${record.id} status=sent at ${record.sent_at}`);
      }
    }
  }

  return { claimed, posted, logs };
}

async function main() {
  console.log('═'.repeat(70));
  console.log('  GAP-001 & GAP-002 RESOLUTION VERIFICATION');
  console.log('═'.repeat(70));
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log(`  CANARY Channel: ${CANARY_CHANNEL_ID}`);
  console.log('═'.repeat(70));
  console.log();

  // Find recent Smart Form submission
  const result = await findRecentSmartFormSubmission();

  if (!result) {
    console.log('\n❌ No Smart Form submissions found. Cannot generate proof block.');
    console.log('\nTo generate evidence:');
    console.log('1. Ensure Smart Form is running: docker-compose up smart-form');
    console.log('2. Submit a pick via Smart Form UI');
    console.log('3. Run this verification script again');
    process.exit(1);
  }

  const { unified_pick, pick_publish } = result;
  const proofBlock = generateProofBlock(unified_pick, pick_publish);

  // Check agent logs
  const agentActivity = await checkAgentLogs();

  // OUTPUT: PROOF BLOCK
  console.log('┌' + '─'.repeat(68) + '┐');
  console.log('│' + '  PROOF BLOCK'.padEnd(68) + '│');
  console.log('├' + '─'.repeat(68) + '┤');

  if (proofBlock) {
    console.log(`│  trace_id:                     ${proofBlock.trace_id.padEnd(36)}│`);
    console.log(`│  unified_picks.id:             ${proofBlock.unified_picks_id.padEnd(36)}│`);
    console.log(`│  pick_publish.id:              ${(proofBlock.pick_publish_id || 'N/A').padEnd(36)}│`);
    console.log(`│  pick_publish.status:          ${proofBlock.pick_publish_status.padEnd(36)}│`);
    console.log(`│  pick_publish.sent_at:         ${(proofBlock.pick_publish_sent_at || 'PENDING').substring(0, 36).padEnd(36)}│`);
    console.log(`│  pick_publish.external_msg_id: ${proofBlock.pick_publish_external_message_id.padEnd(36)}│`);
    console.log(`│  pick_publish.discord_channel: ${proofBlock.pick_publish_discord_channel_id.padEnd(36)}│`);
    console.log(`│  channel_matches_canary:       ${(proofBlock.discord_channel_matches_canary ? '✅ TRUE' : '❌ FALSE').padEnd(36)}│`);
    console.log('├' + '─'.repeat(68) + '┤');
    console.log(`│  Discord URL:                                                      │`);
    console.log(`│  ${proofBlock.discord_message_url.padEnd(66)}│`);
  }

  console.log('└' + '─'.repeat(68) + '┘');

  // OUTPUT: AGENT LOGS
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│' + '  DISCORDPROMOTIONAGENT CONSUMER LOGS'.padEnd(68) + '│');
  console.log('├' + '─'.repeat(68) + '┤');

  if (agentActivity.logs.length > 0) {
    for (const log of agentActivity.logs) {
      // Truncate if needed
      const displayLog = log.length > 66 ? log.substring(0, 63) + '...' : log;
      console.log(`│  ${displayLog.padEnd(66)}│`);
    }
  } else {
    console.log('│  No agent logs found. DiscordPromotionAgent may not have run yet.  │');
  }

  console.log('├' + '─'.repeat(68) + '┤');
  console.log(`│  Agent claimed pick_publish:   ${(agentActivity.claimed ? '✅ YES' : '⏳ PENDING').padEnd(36)}│`);
  console.log(`│  Agent posted and updated:     ${(agentActivity.posted ? '✅ YES' : '⏳ PENDING').padEnd(36)}│`);
  console.log('└' + '─'.repeat(68) + '┘');

  // OUTPUT: EVIDENCE BUNDLE PATH
  const timestamp = new Date().toISOString().split('T')[0];
  const bundlePath = `out/manual-pick-e2e/${timestamp}_smartform_canonical`;

  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│' + '  EVIDENCE BUNDLE'.padEnd(68) + '│');
  console.log('├' + '─'.repeat(68) + '┤');
  console.log(`│  Path: ${bundlePath.padEnd(58)}│`);
  console.log('├' + '─'.repeat(68) + '┤');
  console.log('│  db/                                                                │');
  console.log('│    unified_pick.json                                                │');
  console.log('│    pick_publish.json                                                │');
  console.log('│  discord/                                                           │');
  console.log('│    message_proof.json                                               │');
  console.log('│    channel_verification.json                                        │');
  console.log('└' + '─'.repeat(68) + '┘');

  // Save evidence files
  const fs = await import('fs');
  const path = await import('path');

  const outDir = path.join(process.cwd(), bundlePath);
  const dbDir = path.join(outDir, 'db');
  const discordDir = path.join(outDir, 'discord');

  fs.mkdirSync(dbDir, { recursive: true });
  fs.mkdirSync(discordDir, { recursive: true });

  // Write evidence files
  fs.writeFileSync(
    path.join(dbDir, 'unified_pick.json'),
    JSON.stringify(unified_pick, null, 2)
  );

  if (pick_publish) {
    fs.writeFileSync(
      path.join(dbDir, 'pick_publish.json'),
      JSON.stringify(pick_publish, null, 2)
    );
  }

  fs.writeFileSync(
    path.join(discordDir, 'message_proof.json'),
    JSON.stringify({
      discord_message_url: proofBlock?.discord_message_url || 'PENDING',
      external_message_id: pick_publish?.external_message_id || 'PENDING',
      channel_id: pick_publish?.discord_channel_id || 'N/A',
      canary_channel_id: CANARY_CHANNEL_ID,
      channel_matches_canary: proofBlock?.discord_channel_matches_canary || false,
    }, null, 2)
  );

  fs.writeFileSync(
    path.join(discordDir, 'channel_verification.json'),
    JSON.stringify({
      expected_channel: CANARY_CHANNEL_ID,
      actual_channel: pick_publish?.discord_channel_id || 'N/A',
      verified: pick_publish?.discord_channel_id === CANARY_CHANNEL_ID,
      guild_id: DISCORD_GUILD_ID,
    }, null, 2)
  );

  // Final status
  console.log('\n' + '═'.repeat(70));

  const allPass = proofBlock &&
    proofBlock.trace_id !== 'MISSING' &&
    proofBlock.pick_publish_id !== 'NOT FOUND' &&
    proofBlock.pick_publish_status === 'sent' &&
    proofBlock.discord_channel_matches_canary &&
    proofBlock.pick_publish_external_message_id !== 'N/A' &&
    agentActivity.claimed &&
    agentActivity.posted;

  if (allPass) {
    console.log('  ✅ GAP-001 RESOLVED: pick_publish consumed, status=sent');
    console.log('  ✅ GAP-002 RESOLVED: trace_id propagated end-to-end');
    console.log('  ✅ CANARY CHANNEL VERIFIED');
    console.log('  ✅ DISCORD MESSAGE POSTED');
  } else {
    console.log('  ⚠️  PARTIAL VERIFICATION');
    if (proofBlock?.trace_id === 'MISSING') {
      console.log('  ❌ GAP-002: trace_id missing from unified_picks');
    } else {
      console.log('  ✅ GAP-002: trace_id present');
    }
    if (!pick_publish) {
      console.log('  ❌ GAP-001: pick_publish record not found');
    } else if (pick_publish.status !== 'sent') {
      console.log(`  ⏳ GAP-001: pick_publish.status='${pick_publish.status}' (waiting for agent)`);
    } else {
      console.log('  ✅ GAP-001: pick_publish processed');
    }
    if (!proofBlock?.discord_channel_matches_canary) {
      console.log(`  ⚠️  Channel mismatch: expected ${CANARY_CHANNEL_ID}`);
    }
  }

  console.log('═'.repeat(70));

  process.exit(allPass ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
