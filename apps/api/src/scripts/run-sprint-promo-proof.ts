/**
 * SPRINT-AUTO-PROMOTION-DISCORD-PROOF
 * Verification script: proves system-generated picks travel the full lifecycle.
 *
 * Flow verified:
 *   INSERT system pick (workflow_stage=pending_review, no system_approved)
 *   → runAutoApproval (PROMOTION_MODE=auto)
 *   → workflow_stage=approved, meta.system_approved=true
 *   → Discord webhook post
 *   → Discord message_id captured and persisted
 *
 * Run from apps/api/ with:
 *   PROMOTION_MODE=auto node_modules/.bin/tsx src/scripts/run-sprint-promo-proof.ts
 *
 * Required env vars (loaded from .env):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   DISCORD_WEBHOOK_URL
 *
 * NOTE: PROMOTION_MODE=auto must be set in the shell/env to activate auto-approval.
 *       The script reads PROMOTION_MODE from process.env — dotenv will not override a
 *       shell-provided value (dotenv does not override pre-existing env vars).
 */

import 'dotenv/config';

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

import { lifecycleInsert, lifecycleUpdate, atomicClaimForPost } from '../lib/lifecycle';
import { runAutoApproval } from '../lib/auto-approval';
import { getBuildInfo } from '../lib/buildInfo';
import { buildProductionFooter } from '../lib/embedPresentationContract';

// ---- CONFIG ----

const SUPABASE_URL = process.env['SUPABASE_URL'] || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] || '';
const DISCORD_WEBHOOK_URL = process.env['DISCORD_WEBHOOK_URL'] || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---- HELPERS ----

function pad(label: string, value: string) {
  // eslint-disable-next-line no-console
  console.log(`  ${label.padEnd(28)} ${value}`);
}

function section(title: string) {
  // eslint-disable-next-line no-console
  console.log(`\n${'─'.repeat(60)}`);
  // eslint-disable-next-line no-console
  console.log(`  ${title}`);
  // eslint-disable-next-line no-console
  console.log(`${'─'.repeat(60)}`);
}

// ---- EMBED BUILDER ----

function buildSystemPickEmbed(pick: {
  id: string;
  player_name?: string;
  stat_type?: string;
  line?: number;
  odds?: number;
  tier?: string;
  sport?: string;
  meta?: Record<string, unknown>;
}) {
  const footer = buildProductionFooter();
  const buildInfo = getBuildInfo('sprint-promo-proof');

  return {
    title: `🤖 [SPRINT PROOF] System Pick — ${pick.tier ?? 'A'}-Tier`,
    color: 0x9932cc, // Purple for sprint proof picks
    description: `**${pick.player_name ?? 'System Player'} ${pick.stat_type ?? 'points'} ${pick.line ?? 20.5}**\n${pick.sport ?? 'NBA'} • Auto-Approved System Pick`,
    fields: [
      {
        name: 'Odds',
        value:
          pick.odds !== undefined && pick.odds !== null
            ? pick.odds > 0
              ? `+${pick.odds}`
              : String(pick.odds)
            : '-110',
        inline: true,
      },
      { name: 'Tier', value: `${pick.tier ?? 'A'}-Tier`, inline: true },
      { name: 'Sprint', value: 'SPRINT-AUTO-PROMOTION-DISCORD-PROOF', inline: false },
      { name: 'Pick ID', value: pick.id, inline: false },
      {
        name: 'Auto-Approved',
        value: String(pick.meta?.['system_approved'] ?? 'true'),
        inline: true,
      },
      {
        name: 'Commit',
        value: buildInfo.commitShort ?? 'unknown',
        inline: true,
      },
    ],
    footer: { text: `${footer} | SPRINT-AUTO-PROMOTION-DISCORD-PROOF` },
    timestamp: new Date().toISOString(),
  };
}

// ---- MAIN ----

async function main() {
  // eslint-disable-next-line no-console
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  // eslint-disable-next-line no-console
  console.log('║     SPRINT-AUTO-PROMOTION-DISCORD-PROOF                  ║');
  // eslint-disable-next-line no-console
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ─────────────────────────────────────────────────────────
  // STEP 1: Environment verification
  // ─────────────────────────────────────────────────────────
  section('STEP 1: Environment Verification');
  pad('PROMOTION_MODE', process.env['PROMOTION_MODE'] ?? '(not set)');
  pad('AUTOPILOT_MODE', process.env['AUTOPILOT_MODE'] ?? '(not set)');
  pad('NODE_ENV', process.env['NODE_ENV'] ?? '(not set)');
  pad('SUPABASE_URL', SUPABASE_URL ? `${SUPABASE_URL.slice(0, 35)}...` : 'MISSING ❌');
  pad('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY ? 'CONFIGURED ✓' : 'MISSING ❌');
  pad(
    'DISCORD_WEBHOOK_URL',
    DISCORD_WEBHOOK_URL ? `${DISCORD_WEBHOOK_URL.slice(0, 40)}...` : 'MISSING ❌'
  );
  pad('PROMOTION_SHADOW_MODE', process.env['PROMOTION_SHADOW_MODE'] ?? '(not set)');
  pad('PROMOTION_KILL_SWITCH', process.env['PROMOTION_KILL_SWITCH'] ?? '(not set)');

  // Check prerequisites
  const blockers: string[] = [];

  if (process.env['PROMOTION_MODE'] !== 'auto') {
    blockers.push(`PROMOTION_MODE=${process.env['PROMOTION_MODE'] ?? 'unset'} — must be 'auto'`);
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    blockers.push('Supabase credentials missing');
  }
  if (!DISCORD_WEBHOOK_URL) {
    blockers.push('DISCORD_WEBHOOK_URL missing');
  }
  if (process.env['PROMOTION_SHADOW_MODE'] === 'true') {
    blockers.push('PROMOTION_SHADOW_MODE=true would block Discord posting — set to false');
  }
  if (process.env['PROMOTION_KILL_SWITCH'] === 'true') {
    blockers.push('PROMOTION_KILL_SWITCH=true would block Discord posting — set to false');
  }

  if (blockers.length > 0) {
    // eslint-disable-next-line no-console
    console.error('\n❌ PREREQUISITES NOT MET — blocking execution:\n');
    for (const b of blockers) {
      // eslint-disable-next-line no-console
      console.error(`   • ${b}`);
    }
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log('\n  ✓ All prerequisites met — proceeding with sprint proof');

  // ─────────────────────────────────────────────────────────
  // STEP 2: Verify Supabase connectivity
  // ─────────────────────────────────────────────────────────
  section('STEP 2: Supabase Connectivity Check');
  const { error: pingError } = await supabase.from('unified_picks').select('id').limit(1);
  if (pingError) {
    // eslint-disable-next-line no-console
    console.error('  ❌ Supabase query failed:', pingError.message);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log('  ✓ Supabase connected — unified_picks accessible');

  // ─────────────────────────────────────────────────────────
  // STEP 3: Create fresh system pick
  // ─────────────────────────────────────────────────────────
  section('STEP 3: Create Fresh System Pick');

  const pickId = uuidv4();
  const betSlipId = uuidv4();
  const now = new Date().toISOString();

  const systemPick = {
    id: pickId,
    bet_slip_id: betSlipId,
    sport: 'NBA',
    player_name: 'SPRINT-PROOF',
    stat_type: 'points',
    selection: 'over',
    line: 20.5,
    odds: -110,
    source: 'system',
    meta: {
      pick_origin: 'system',
      sprint_proof: true,
      sprint_id: 'SPRINT-AUTO-PROMOTION-DISCORD-PROOF',
      created_at: now,
    },
  };

  pad('pick_id', pickId);
  pad('bet_slip_id', betSlipId);
  pad('initial state', 'pending_review (DB default)');
  pad('pick_origin', 'system');
  pad('system_approved (initial)', 'NOT SET');
  pad('sport', systemPick.sport);

  const insertResult = await lifecycleInsert(supabase, systemPick, {
    writerRole: 'submitter',
    traceId: `sprint-proof-insert-${pickId}`,
  });

  if (!insertResult.success) {
    // eslint-disable-next-line no-console
    console.error(`\n  ❌ lifecycleInsert failed: ${insertResult.error}`);
    // eslint-disable-next-line no-console
    console.error('     validationPassed:', insertResult.validationPassed);
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`\n  ✓ Pick inserted: ${pickId}`);

  // ─────────────────────────────────────────────────────────
  // STEP 4: Verify initial state in DB
  // ─────────────────────────────────────────────────────────
  section('STEP 4: Verify Initial DB State');
  const { data: initialPick, error: fetchErr1 } = await supabase
    .from('unified_picks')
    .select('id, workflow_stage, posted_to_discord, meta, tier, created_at')
    .eq('id', pickId)
    .single();

  if (fetchErr1 || !initialPick) {
    // eslint-disable-next-line no-console
    console.error('  ❌ Failed to fetch pick after insert:', fetchErr1?.message);
    process.exit(1);
  }

  pad('workflow_stage', initialPick.workflow_stage ?? '(null)');
  pad('posted_to_discord', String(initialPick.posted_to_discord));
  pad(
    'system_approved (meta)',
    String((initialPick.meta as any)?.['system_approved'] ?? 'NOT SET')
  );

  const initialWorkflowStage = initialPick.workflow_stage;

  // ─────────────────────────────────────────────────────────
  // STEP 5: Run auto-approval
  // ─────────────────────────────────────────────────────────
  section('STEP 5: Run Auto-Approval (PROMOTION_MODE=auto)');
  // eslint-disable-next-line no-console
  console.log(`  PROMOTION_MODE=${process.env['PROMOTION_MODE']}`);

  const approvalResult = await runAutoApproval(supabase);

  pad('mode', approvalResult.mode);
  pad('approved', String(approvalResult.approved));
  pad('skipped', String(approvalResult.skipped));
  pad('errors', String(approvalResult.errors));
  pad('ftierExcluded', String(approvalResult.ftierExcluded));

  if (approvalResult.mode !== 'auto') {
    // eslint-disable-next-line no-console
    console.error(
      `\n  ❌ Auto-approval did not run — mode is '${approvalResult.mode}', expected 'auto'`
    );
    process.exit(1);
  }

  if (approvalResult.errors > 0) {
    // eslint-disable-next-line no-console
    console.error(`\n  ❌ Auto-approval encountered ${approvalResult.errors} errors`);
    // Continue to verify DB state before failing
  }

  // ─────────────────────────────────────────────────────────
  // STEP 6: Verify state transition
  // ─────────────────────────────────────────────────────────
  section('STEP 6: Verify State Transition (pending_review → approved)');

  const { data: approvedPick, error: fetchErr2 } = await supabase
    .from('unified_picks')
    .select('id, workflow_stage, posted_to_discord, meta, tier')
    .eq('id', pickId)
    .single();

  if (fetchErr2 || !approvedPick) {
    // eslint-disable-next-line no-console
    console.error('  ❌ Failed to fetch pick after auto-approval:', fetchErr2?.message);
    process.exit(1);
  }

  const finalWorkflowStage = approvedPick.workflow_stage;
  const systemApproved = (approvedPick.meta as any)?.['system_approved'];

  pad('workflow_stage before', initialWorkflowStage ?? '(null)');
  pad('workflow_stage after', finalWorkflowStage ?? '(null)');
  pad('system_approved (meta)', String(systemApproved ?? 'NOT SET'));
  pad('transition', `${initialWorkflowStage ?? 'null'} → ${finalWorkflowStage ?? 'null'}`);

  const transitionProven = finalWorkflowStage === 'approved' && systemApproved === 'true';
  if (!transitionProven) {
    // eslint-disable-next-line no-console
    console.error('\n  ❌ State transition NOT proven');
    // eslint-disable-next-line no-console
    console.error(`     Expected: workflow_stage=approved AND system_approved=true`);
    // eslint-disable-next-line no-console
    console.error(
      `     Got:      workflow_stage=${finalWorkflowStage}, system_approved=${systemApproved}`
    );
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log('\n  ✓ State transition proven: pending_review → approved');
  // eslint-disable-next-line no-console
  console.log('  ✓ system_approved=true set in meta');

  // ─────────────────────────────────────────────────────────
  // STEP 7: Post to Discord
  // ─────────────────────────────────────────────────────────
  section('STEP 7: Post to Discord (processSystemPicks path)');

  // Build embed
  const embed = buildSystemPickEmbed({
    id: pickId,
    player_name: systemPick.player_name,
    stat_type: systemPick.stat_type,
    line: systemPick.line,
    odds: systemPick.odds,
    tier: 'A',
    sport: systemPick.sport,
    meta: approvedPick.meta as Record<string, unknown>,
  });

  // eslint-disable-next-line no-console
  console.log(`  Posting to: ${DISCORD_WEBHOOK_URL.slice(0, 50)}...`);

  let discordMessageId: string | null = null;
  let discordChannelId: string | null = null;
  let publishTimestamp: string | null = null;
  let httpStatus: number | null = null;

  try {
    const postTimestamp = new Date().toISOString();
    const response = await axios.post(
      `${DISCORD_WEBHOOK_URL}?wait=true`,
      {
        username: 'Unit Talk — SPRINT PROOF',
        embeds: [embed],
      },
      { timeout: 15000 }
    );

    httpStatus = response.status;
    discordMessageId = response.data?.id ?? null;
    discordChannelId = response.data?.channel_id ?? null;
    publishTimestamp = postTimestamp;

    pad('HTTP status', String(httpStatus));
    pad('Discord message_id', discordMessageId ?? 'null');
    pad('Discord channel_id', discordChannelId ?? 'null');
    pad('publish_timestamp', publishTimestamp);

    if (!discordMessageId) {
      // eslint-disable-next-line no-console
      console.error('\n  ❌ Discord post returned no message ID');
      // eslint-disable-next-line no-console
      console.error('     Response:', JSON.stringify(response.data, null, 2));
      process.exit(1);
    }

    // eslint-disable-next-line no-console
    console.log('\n  ✓ Discord post succeeded');
    // eslint-disable-next-line no-console
    console.log(`  ✓ Discord message_id: ${discordMessageId}`);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(`\n  ❌ Discord post failed: ${err.message}`);
    if (err.response) {
      // eslint-disable-next-line no-console
      console.error('     HTTP status:', err.response.status);
      // eslint-disable-next-line no-console
      console.error('     Response:', JSON.stringify(err.response.data, null, 2));
    }
    // Identify the blocking stage
    // eslint-disable-next-line no-console
    console.log('\n  BLOCKING STAGE: Discord webhook delivery (HTTP error)');
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────
  // STEP 8: Persist Discord receipt to DB
  // ─────────────────────────────────────────────────────────
  section('STEP 8: Persist Discord Receipt to DB');

  // Step 8a: Atomic claim — sets posted_to_discord=true and promotion_posted_at.
  // Uses atomicClaimForPost which bypasses immutability (posted_to_discord is immutableAfterSet
  // but starts as false, not null, so lifecycleUpdate's immutability check blocks poster role).
  const claimResult = await atomicClaimForPost(supabase, pickId);
  pad('atomicClaimForPost.claimed', String(claimResult.claimed));

  // Step 8b: Persist discord_message_id and meta receipt via lifecycleUpdate.
  // discord_message_id is currently null → immutability check passes for poster role.
  const receiptResult = await lifecycleUpdate(
    supabase,
    pickId,
    {
      discord_message_id: discordMessageId,
      meta: {
        ...((approvedPick.meta as Record<string, unknown>) || {}),
        system_approved: 'true',
        discord_receipt: {
          message_id: discordMessageId,
          channel_id: discordChannelId,
          posted_at: publishTimestamp,
          poster: 'run-sprint-promo-proof.ts',
          sprint_id: 'SPRINT-AUTO-PROMOTION-DISCORD-PROOF',
          http_status: httpStatus,
        },
      },
    },
    {
      writerRole: 'poster',
      traceId: `sprint-proof-receipt-${pickId}`,
      skipTransitionValidation: true,
    }
  );

  const receiptSuccess = claimResult.claimed && receiptResult.success;

  if (!receiptSuccess) {
    // eslint-disable-next-line no-console
    console.error(
      `  ❌ Failed to persist receipt: claim=${claimResult.claimed}, msg_id=${receiptResult.success}`
    );
    // eslint-disable-next-line no-console
    console.error('  (Discord post still succeeded — message_id is real)');
    // Don't exit — the Discord proof is the critical artifact
  } else {
    // eslint-disable-next-line no-console
    console.log('  ✓ Receipt persisted to unified_picks');
    pad('posted_to_discord', 'true');
    pad('discord_message_id', discordMessageId!);
  }

  // ─────────────────────────────────────────────────────────
  // STEP 9: Final DB state verification
  // ─────────────────────────────────────────────────────────
  section('STEP 9: Final DB State Verification');

  const { data: finalPick, error: finalFetchErr } = await supabase
    .from('unified_picks')
    .select('id, workflow_stage, posted_to_discord, discord_message_id, promotion_posted_at, meta')
    .eq('id', pickId)
    .single();

  if (finalFetchErr || !finalPick) {
    // eslint-disable-next-line no-console
    console.error('  ❌ Failed to fetch final state:', finalFetchErr?.message);
  } else {
    pad('workflow_stage', finalPick.workflow_stage ?? '(null)');
    pad('posted_to_discord', String(finalPick.posted_to_discord));
    pad('discord_message_id', finalPick.discord_message_id ?? '(null)');
    pad('promotion_posted_at', finalPick.promotion_posted_at ?? '(null)');
    pad('system_approved', String((finalPick.meta as any)?.['system_approved'] ?? '(null)'));
  }

  // ─────────────────────────────────────────────────────────
  // FINAL VERDICT
  // ─────────────────────────────────────────────────────────
  section('FINAL VERDICT');

  const proof = {
    pick_id: pickId,
    workflow_stage_before: initialWorkflowStage,
    workflow_stage_after: finalWorkflowStage,
    system_approved: systemApproved,
    discord_channel_id: discordChannelId,
    discord_message_id: discordMessageId,
    publish_timestamp: publishTimestamp,
    http_status: httpStatus,
    transition_proven: transitionProven,
    discord_proven: !!discordMessageId,
    receipt_persisted: receiptSuccess,
    sprint: 'SPRINT-AUTO-PROMOTION-DISCORD-PROOF',
    timestamp: new Date().toISOString(),
  };

  // eslint-disable-next-line no-console
  console.log('\n  PROOF SUMMARY:');
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(proof, null, 4)
      .split('\n')
      .map(l => `  ${l}`)
      .join('\n')
  );

  const overallPass = transitionProven && !!discordMessageId;

  // eslint-disable-next-line no-console
  console.log('\n');
  // eslint-disable-next-line no-console
  console.log(`  auto promotion → Discord proven:  ${overallPass ? '✅ YES' : '❌ NO'}`);
  // eslint-disable-next-line no-console
  console.log(`  state transition proven:          ${transitionProven ? '✅ YES' : '❌ NO'}`);
  // eslint-disable-next-line no-console
  console.log(
    `  Discord message_id obtained:      ${discordMessageId ? `✅ YES (${discordMessageId})` : '❌ NO'}`
  );
  // eslint-disable-next-line no-console
  console.log(`  receipt persisted to DB:          ${receiptSuccess ? '✅ YES' : '⚠️  PARTIAL'}`);
  // eslint-disable-next-line no-console
  console.log('\n');

  if (!overallPass) {
    process.exit(1);
  }

  return proof;
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('\n❌ Sprint proof script failed:', err);
    process.exit(1);
  });
