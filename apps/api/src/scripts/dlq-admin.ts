#!/usr/bin/env ts-node
/**
 * Dead Letter Queue (DLQ) Admin CLI
 *
 * Purpose: Operational tool for inspecting and replaying DLQ events
 *
 * Usage:
 *   npm run dlq:list                    # List recent DLQ events
 *   npm run dlq:summary                 # Show DLQ summary statistics
 *   npm run dlq:inspect <id>            # Inspect a specific DLQ event
 *   npm run dlq:requeue <id>            # Requeue a DLQ event for replay
 *   npm run dlq:source <source>         # List events by source
 *
 * Phase 1 Modernization - DLQ Operations
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { DeadLetterQueueService } from '../services/DeadLetterQueueService';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const mockLogger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
};

const dlqService = new DeadLetterQueueService(supabase, mockLogger as any);

async function listRecentDLQ(limit = 50) {
  console.log(`\n📋 Recent DLQ Events (limit: ${limit})\n`);

  const events = await dlqService.getRecent(limit);

  if (events.length === 0) {
    console.log('✅ No events in DLQ (system healthy)');
    return;
  }

  console.table(
    events.map((e) => ({
      ID: e.id.substring(0, 8),
      Source: e.source,
      'Event ID': e.original_event_id?.substring(0, 8) || 'N/A',
      Error: e.error_message.substring(0, 50) + '...',
      'Retry Count': e.retry_count,
      'First Failed': new Date(e.first_failed_at).toLocaleString(),
      Status: e.replay_status || 'pending',
    }))
  );

  console.log(`\n💡 Tip: Use 'npm run dlq:inspect <id>' to see full details`);
}

async function showSummary() {
  console.log('\n📊 DLQ Summary Statistics\n');

  const summary = await dlqService.getSummary();

  if (!summary || summary.length === 0) {
    console.log('✅ No events in DLQ (system healthy)');
    return;
  }

  console.table(
    summary.map((s: any) => ({
      Source: s.source,
      'Total Events': s.total_events,
      Pending: s.pending_events,
      'Replayed (Success)': s.replayed_successfully,
      'Replayed (Failed)': s.replay_failed,
      'Oldest Failure': s.oldest_failure
        ? new Date(s.oldest_failure).toLocaleString()
        : 'N/A',
      'Avg Retries': s.avg_retry_count,
    }))
  );

  const totalPending = summary.reduce((acc: number, s: any) => acc + s.pending_events, 0);
  if (totalPending > 0) {
    console.log(`\n⚠️  ${totalPending} events pending manual review`);
  }
}

async function inspectEvent(id: string) {
  console.log(`\n🔍 Inspecting DLQ Event: ${id}\n`);

  const event = await dlqService.getById(id);

  if (!event) {
    console.error(`❌ Event not found: ${id}`);
    return;
  }

  console.log('📦 Event Details:');
  console.log(`   ID: ${event.id}`);
  console.log(`   Source: ${event.source}`);
  console.log(`   Original Event ID: ${event.original_event_id || 'N/A'}`);
  console.log(`   Original Table: ${event.original_table || 'N/A'}`);
  console.log();
  console.log('❌ Error Information:');
  console.log(`   Message: ${event.error_message}`);
  if (event.error_code) {
    console.log(`   Code: ${event.error_code}`);
  }
  if (event.error_stack) {
    console.log(`   Stack: ${event.error_stack.substring(0, 200)}...`);
  }
  console.log();
  console.log('🔄 Retry Information:');
  console.log(`   Retry Count: ${event.retry_count}`);
  console.log(`   Max Retries Attempted: ${event.max_retries_attempted || 'N/A'}`);
  console.log(`   First Failed: ${new Date(event.first_failed_at).toLocaleString()}`);
  console.log(`   Last Failed: ${new Date(event.last_failed_at).toLocaleString()}`);
  console.log();

  if (event.requeued_at) {
    console.log('↩️  Replay Information:');
    console.log(`   Requeued At: ${new Date(event.requeued_at).toLocaleString()}`);
    console.log(`   Requeued By: ${event.requeued_by}`);
    console.log(`   Replay Status: ${event.replay_status}`);
    if (event.replay_error) {
      console.log(`   Replay Error: ${event.replay_error}`);
    }
    console.log();
  }

  console.log('📄 Payload:');
  console.log(JSON.stringify(event.payload, null, 2));
  console.log();

  console.log('🏷️  Metadata:');
  console.log(JSON.stringify(event.metadata, null, 2));
  console.log();

  if (!event.requeued_at) {
    console.log(`💡 Tip: Use 'npm run dlq:requeue ${id}' to replay this event`);
  }
}

async function requeueEvent(id: string) {
  console.log(`\n↩️  Requeuing DLQ Event: ${id}\n`);

  const event = await dlqService.getById(id);

  if (!event) {
    console.error(`❌ Event not found: ${id}`);
    return;
  }

  if (event.requeued_at) {
    console.warn(`⚠️  Event already requeued at ${new Date(event.requeued_at).toLocaleString()}`);
    console.log(`   Status: ${event.replay_status}`);
    return;
  }

  const success = await dlqService.markForReplay(id, {
    requeued_by: 'dlq-admin-cli',
    notes: 'Manual requeue via CLI',
  });

  if (success) {
    console.log('✅ Event marked for replay');
    console.log();
    console.log('⚡ Next steps:');
    console.log('   1. BridgeWorker will automatically pick up this event');
    console.log('   2. Monitor logs for processing status');
    console.log('   3. Check replay status with `npm run dlq:inspect ${id}`');
  } else {
    console.error('❌ Failed to requeue event');
  }
}

async function listBySource(source: string) {
  console.log(`\n📋 DLQ Events for source: ${source}\n`);

  const events = await dlqService.getBySource(source as any);

  if (events.length === 0) {
    console.log(`✅ No events from source '${source}' in DLQ`);
    return;
  }

  console.table(
    events.map((e) => ({
      ID: e.id.substring(0, 8),
      'Event ID': e.original_event_id?.substring(0, 8) || 'N/A',
      Error: e.error_message.substring(0, 50) + '...',
      'Retry Count': e.retry_count,
      'First Failed': new Date(e.first_failed_at).toLocaleString(),
      Status: e.replay_status || 'pending',
    }))
  );

  console.log(`\n📊 Total: ${events.length} events`);
}

async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'list':
      await listRecentDLQ(parseInt(arg) || 50);
      break;

    case 'summary':
      await showSummary();
      break;

    case 'inspect':
      if (!arg) {
        console.error('❌ Usage: npm run dlq:inspect <id>');
        process.exit(1);
      }
      await inspectEvent(arg);
      break;

    case 'requeue':
      if (!arg) {
        console.error('❌ Usage: npm run dlq:requeue <id>');
        process.exit(1);
      }
      await requeueEvent(arg);
      break;

    case 'source':
      if (!arg) {
        console.error('❌ Usage: npm run dlq:source <source>');
        console.error('   Valid sources: bridge_worker, discord_publisher, grading_worker, ingestion_worker, temporal_activity, other');
        process.exit(1);
      }
      await listBySource(arg);
      break;

    default:
      console.log('Dead Letter Queue (DLQ) Admin CLI\n');
      console.log('Usage:');
      console.log('  npm run dlq:list [limit]        # List recent DLQ events');
      console.log('  npm run dlq:summary             # Show DLQ summary statistics');
      console.log('  npm run dlq:inspect <id>        # Inspect a specific DLQ event');
      console.log('  npm run dlq:requeue <id>        # Requeue a DLQ event for replay');
      console.log('  npm run dlq:source <source>     # List events by source');
      console.log();
      console.log('Valid sources: bridge_worker, discord_publisher, grading_worker,');
      console.log('               ingestion_worker, temporal_activity, other');
      process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
