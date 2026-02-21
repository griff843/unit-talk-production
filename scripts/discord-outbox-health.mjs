#!/usr/bin/env node
/**
 * discord-outbox-health.mjs
 * Sprint: SPRINT-DISCORD-WORKER-AUTOSTART-087
 *
 * Health check script for ticket_discord_outbox.
 * Reports status counts, oldest pending age, and last posted timestamp.
 *
 * Usage:
 *   node scripts/discord-outbox-health.mjs
 *   node scripts/discord-outbox-health.mjs --max-pending-age 5  # Fail if pending > 5 minutes
 *
 * Exit codes:
 *   0 - Healthy
 *   1 - Unhealthy (pending items older than threshold)
 *   2 - Error (DB connection failed)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ---- CONFIG ----
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Default max pending age in minutes (5 minutes)
const DEFAULT_MAX_PENDING_AGE = 5;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---- PARSE ARGS ----
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    maxPendingAgeMinutes: DEFAULT_MAX_PENDING_AGE,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max-pending-age' && args[i + 1]) {
      config.maxPendingAgeMinutes = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--json') {
      config.json = true;
    }
  }

  return config;
}

// ---- MAIN ----
async function main() {
  const config = parseArgs();

  try {
    // Get counts by status
    const { data: statusCounts, error: countErr } = await supabase
      .from('ticket_discord_outbox')
      .select('status');

    if (countErr) {
      console.error('ERROR: Failed to query outbox:', countErr.message);
      process.exit(2);
    }

    const counts = {
      pending: 0,
      posted: 0,
      failed: 0,
      total: statusCounts?.length || 0,
    };

    for (const row of statusCounts || []) {
      if (row.status === 'pending') counts.pending++;
      else if (row.status === 'posted') counts.posted++;
      else if (row.status === 'failed') counts.failed++;
    }

    // Get oldest pending item
    const { data: oldestPending, error: oldestErr } = await supabase
      .from('ticket_discord_outbox')
      .select('id, ticket_id, created_at, retry_count')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (oldestErr) {
      console.error('ERROR: Failed to query oldest pending:', oldestErr.message);
      process.exit(2);
    }

    // Get last posted item
    const { data: lastPosted, error: lastErr } = await supabase
      .from('ticket_discord_outbox')
      .select('id, ticket_id, posted_at, discord_message_id')
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) {
      console.error('ERROR: Failed to query last posted:', lastErr.message);
      process.exit(2);
    }

    // Calculate oldest pending age
    let oldestPendingAgeMinutes = null;
    let oldestPendingAgeSec = null;
    if (oldestPending?.created_at) {
      const ageMs = Date.now() - new Date(oldestPending.created_at).getTime();
      oldestPendingAgeSec = Math.floor(ageMs / 1000);
      oldestPendingAgeMinutes = Math.floor(ageMs / 60000);
    }

    // Build report
    const report = {
      timestamp: new Date().toISOString(),
      status_counts: counts,
      oldest_pending: oldestPending
        ? {
            outbox_id: oldestPending.id,
            ticket_id: oldestPending.ticket_id,
            created_at: oldestPending.created_at,
            age_seconds: oldestPendingAgeSec,
            age_minutes: oldestPendingAgeMinutes,
            retry_count: oldestPending.retry_count,
          }
        : null,
      last_posted: lastPosted
        ? {
            outbox_id: lastPosted.id,
            ticket_id: lastPosted.ticket_id,
            posted_at: lastPosted.posted_at,
            discord_message_id: lastPosted.discord_message_id,
          }
        : null,
      config: {
        max_pending_age_minutes: config.maxPendingAgeMinutes,
      },
      health: 'HEALTHY',
    };

    // Check health threshold
    let exitCode = 0;
    if (
      counts.pending > 0 &&
      oldestPendingAgeMinutes !== null &&
      oldestPendingAgeMinutes > config.maxPendingAgeMinutes
    ) {
      report.health = 'UNHEALTHY';
      exitCode = 1;
    }

    // Output
    if (config.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('============================================================');
      console.log('DISCORD OUTBOX HEALTH CHECK');
      console.log('Sprint: SPRINT-DISCORD-WORKER-AUTOSTART-087');
      console.log('============================================================');
      console.log('');
      console.log(`Timestamp: ${report.timestamp}`);
      console.log('');
      console.log('--- STATUS COUNTS ---');
      console.log(`  Pending: ${counts.pending}`);
      console.log(`  Posted:  ${counts.posted}`);
      console.log(`  Failed:  ${counts.failed}`);
      console.log(`  Total:   ${counts.total}`);
      console.log('');

      if (report.oldest_pending) {
        console.log('--- OLDEST PENDING ---');
        console.log(`  Outbox ID:   ${report.oldest_pending.outbox_id}`);
        console.log(`  Ticket ID:   ${report.oldest_pending.ticket_id}`);
        console.log(`  Created At:  ${report.oldest_pending.created_at}`);
        console.log(`  Age:         ${report.oldest_pending.age_minutes} minutes (${report.oldest_pending.age_seconds} seconds)`);
        console.log(`  Retry Count: ${report.oldest_pending.retry_count}`);
        console.log('');
      } else {
        console.log('--- OLDEST PENDING ---');
        console.log('  (none)');
        console.log('');
      }

      if (report.last_posted) {
        console.log('--- LAST POSTED ---');
        console.log(`  Outbox ID:   ${report.last_posted.outbox_id}`);
        console.log(`  Ticket ID:   ${report.last_posted.ticket_id}`);
        console.log(`  Posted At:   ${report.last_posted.posted_at}`);
        console.log(`  Message ID:  ${report.last_posted.discord_message_id}`);
        console.log('');
      } else {
        console.log('--- LAST POSTED ---');
        console.log('  (none)');
        console.log('');
      }

      console.log('--- HEALTH ---');
      if (report.health === 'HEALTHY') {
        console.log(`  ✅ HEALTHY`);
      } else {
        console.log(`  ❌ UNHEALTHY: Pending items older than ${config.maxPendingAgeMinutes} minutes`);
      }
      console.log('');
      console.log('============================================================');
    }

    process.exit(exitCode);
  } catch (err) {
    console.error('ERROR:', err instanceof Error ? err.message : String(err));
    process.exit(2);
  }
}

main();
