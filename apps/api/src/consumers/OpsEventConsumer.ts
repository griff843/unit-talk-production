/**
 * OpsEventConsumer — Processes PICK_SETTLED events and emits RECAP_REQUESTED.
 *
 * UNIFIED-OPS-002 Step 3: Settlement Event Consumption
 *
 * This consumer polls the `events` table for unprocessed PICK_SETTLED events,
 * marks them as processed, and emits a RECAP_REQUESTED event for the recap system.
 *
 * Gated behind ENABLE_OPS_EVENT_CONSUMERS=true (default OFF, fail-closed).
 * Idempotent: processing the same event twice does not duplicate recap requests
 * (idempotency_key on events table prevents duplicates).
 *
 * Providerless compatible — no external API keys required.
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('OpsEventConsumer');

// Poll interval in ms (default 15 seconds)
const POLL_INTERVAL = parseInt(process.env['OPS_EVENT_POLL_INTERVAL'] || '15000', 10);
const BATCH_SIZE = 10;

let isRunning = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Process a batch of unprocessed PICK_SETTLED events.
 * For each event:
 *   1. Mark as processed (set processed_at)
 *   2. Emit RECAP_REQUESTED event (idempotent via idempotency_key)
 */
async function processBatch(): Promise<number> {
  const { supabaseClient } = await import('../services/supabaseClient');

  // Fetch unprocessed PICK_SETTLED events
  const { data: events, error: fetchErr } = await supabaseClient
    .from('events')
    .select('id, event_type, aggregate_id, event_data, metadata, created_at')
    .eq('event_type', 'PICK_SETTLED')
    .is('processed_at', null)
    .is('failed_at', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr) {
    logger.error('Failed to fetch PICK_SETTLED events', { error: fetchErr.message });
    return 0;
  }

  if (!events || events.length === 0) {
    return 0;
  }

  logger.info(`Processing ${events.length} PICK_SETTLED event(s)`);

  let processed = 0;

  for (const event of events) {
    try {
      const eventData = event.event_data as Record<string, unknown>;
      const pickId = eventData?.pick_id as string;
      const result = eventData?.result as string;
      const settledAt = eventData?.settled_at as string;

      // 1. Mark event as processed
      const { error: updateErr } = await supabaseClient
        .from('events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', event.id);

      if (updateErr) {
        logger.error('Failed to mark event as processed', {
          eventId: event.id,
          error: updateErr.message
        });
        // Mark as failed with retry
        await supabaseClient
          .from('events')
          .update({
            failed_at: new Date().toISOString(),
            retry_count: 1
          })
          .eq('id', event.id);
        continue;
      }

      // 2. Emit RECAP_REQUESTED event (idempotent via key)
      //    One RECAP_REQUESTED per day, keyed by date
      const settleDate = (settledAt || new Date().toISOString()).split('T')[0];
      const recapKey = `RECAP_REQUESTED:daily:${settleDate}`;

      const { error: emitErr } = await supabaseClient
        .from('events')
        .upsert(
          {
            event_type: 'RECAP_REQUESTED',
            aggregate_id: event.aggregate_id,
            aggregate_type: 'recap',
            event_data: {
              mode: 'daily',
              date: settleDate,
              triggered_by: 'PICK_SETTLED',
              source_event_id: event.id,
              pick_id: pickId,
              result: result
            },
            metadata: {
              source: 'OpsEventConsumer',
              settlement_count: 1
            },
            idempotency_key: recapKey,
            created_by: 'OpsEventConsumer',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          { onConflict: 'idempotency_key', ignoreDuplicates: true }
        );

      if (emitErr) {
        // Duplicate key is expected (idempotent) — not an error
        if (!emitErr.message.includes('duplicate') && !emitErr.message.includes('conflict')) {
          logger.warn('Failed to emit RECAP_REQUESTED', {
            eventId: event.id,
            error: emitErr.message
          });
        }
      }

      processed++;

      logger.info('Processed PICK_SETTLED event', {
        eventId: event.id,
        pickId,
        result,
        recapDate: settleDate
      });

    } catch (err) {
      logger.error('Error processing event', {
        eventId: event.id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  return processed;
}

/**
 * Start the OpsEventConsumer polling loop.
 * Only runs when ENABLE_OPS_EVENT_CONSUMERS=true.
 */
export async function startOpsEventConsumer(): Promise<void> {
  if (process.env.ENABLE_OPS_EVENT_CONSUMERS !== 'true') {
    logger.info('OpsEventConsumer SKIPPED (ENABLE_OPS_EVENT_CONSUMERS not set to true)');
    return;
  }

  if (isRunning) {
    logger.warn('OpsEventConsumer already running');
    return;
  }

  isRunning = true;
  logger.info('OpsEventConsumer started', { pollInterval: POLL_INTERVAL, batchSize: BATCH_SIZE });

  // Initial processing
  try {
    const count = await processBatch();
    if (count > 0) {
      logger.info(`Initial batch: processed ${count} event(s)`);
    }
  } catch (err) {
    logger.error('Initial batch failed (non-fatal)', {
      error: err instanceof Error ? err.message : String(err)
    });
  }

  // Start polling
  pollTimer = setInterval(async () => {
    try {
      await processBatch();
    } catch (err) {
      logger.error('Poll cycle failed (non-fatal)', {
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }, POLL_INTERVAL);
}

/**
 * Stop the OpsEventConsumer.
 */
export function stopOpsEventConsumer(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  isRunning = false;
  logger.info('OpsEventConsumer stopped');
}

/**
 * Check if the consumer is running.
 */
export function isOpsEventConsumerRunning(): boolean {
  return isRunning;
}
