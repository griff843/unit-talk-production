/**
 * Run Outbox Publisher
 *
 * Processes pending pick_publish records through OutboxPublisher
 *
 * Usage:
 *   npx tsx apps/api/scripts/run-outbox-publisher.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// CRITICAL: Load .env BEFORE any other imports that depend on env vars
const envPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: envPath });

// Verify Discord token is loaded
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN not loaded from .env');
  process.exit(1);
}

console.log(`✅ DISCORD_BOT_TOKEN loaded: ${process.env.DISCORD_BOT_TOKEN.substring(0, 20)}...`);

// Now import modules that depend on env vars
import { createClient } from '@supabase/supabase-js';
import { OutboxPublisher } from '../src/publish/outbox-publisher';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function runOutboxPublisher(): Promise<void> {
  console.log('🚀 Running Outbox Publisher\n');

  try {
    // Check for pending jobs
    const { data: pendingJobs, error: pendingError } = await supabase
      .from('pick_publish')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (pendingError) {
      throw new Error(`Failed to fetch pending jobs: ${pendingError.message}`);
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('ℹ️  No pending jobs found\n');
      process.exit(0);
    }

    console.log(`📋 Found ${pendingJobs.length} pending job(s):\n`);

    for (const job of pendingJobs) {
      console.log(`   - ${job.id} (pick: ${job.pick_id}, channel: ${job.channel})`);
    }

    console.log('\n🔄 Processing jobs...\n');

    // Create OutboxPublisher instance
    const publisher = new OutboxPublisher(supabase);

    // Run pending jobs
    const processed = await publisher.runPending(10);

    console.log(`\n✅ Processed ${processed} job(s)\n`);

    // Check results
    const { data: results, error: resultsError } = await supabase
      .from('pick_publish')
      .select('*')
      .in('id', pendingJobs.map(j => j.id));

    if (resultsError) {
      throw new Error(`Failed to fetch results: ${resultsError.message}`);
    }

    console.log('📊 Results:\n');

    for (const result of results || []) {
      const status = result.status === 'sent' ? '✅' : result.status === 'failed' ? '❌' : '⏳';
      console.log(`   ${status} ${result.id}`);
      console.log(`      Status: ${result.status}`);
      console.log(`      Attempts: ${result.attempts}`);
      console.log(`      Channel: ${result.channel}`);
      console.log(`      Discord Channel ID: ${result.discord_channel_id}`);

      if (result.external_message_id) {
        console.log(`      Discord Message ID: ${result.external_message_id}`);
      }

      if (result.last_error) {
        console.log(`      Last Error: ${result.last_error.substring(0, 100)}`);
      }

      console.log('');
    }

    const sent = results?.filter(r => r.status === 'sent').length || 0;
    const failed = results?.filter(r => r.status === 'failed').length || 0;
    const pending = results?.filter(r => r.status === 'pending').length || 0;

    console.log('Summary:');
    console.log(`   ✅ Sent: ${sent}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⏳ Pending: ${pending}\n`);

    if (sent > 0) {
      console.log('✅ SUCCESS! Check Discord CANARY channel (#✨・vip-canary) for messages\n');
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

runOutboxPublisher().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
