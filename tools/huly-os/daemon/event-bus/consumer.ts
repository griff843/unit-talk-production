// SPRINT-EVENT-BUS-011: Event bus consumer loop
// Reads events from Redis Stream, decides action, runs report-runner.
// Overlap lock prevents concurrent runs. Failure-isolated — never crashes.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT } from '../config.js';
import { runReport } from '../report-runner.js';

import {
  ackEvent,
  checkDedupe,
  createRedisStreamClient,
  disconnectRedis,
  readEvents,
} from './redis-stream.js';

import type { DaemonConfig } from '../config.js';
import type { BusEvent } from './event-types.js';
import type { RedisStreamClient } from './redis-stream.js';

/** Events that trigger a live (deep) run when conditions are met */
const DEEP_TRIGGER_TYPES = new Set(['ci.workflow_failed']);

export interface ConsumerState {
  running: boolean;
  eventsProcessed: number;
  eventsDeduped: number;
  lastEventAt: string | null;
  lastError: string | null;
  stopped: boolean;
}

export interface EventReceipt {
  eventId: string;
  entryId: string;
  type: string;
  source: string;
  dedupeKey: string | null;
  action: 'dry-run' | 'deep' | 'deduped' | 'skipped';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  ok: boolean;
  error: string | null;
}

/**
 * Start the event bus consumer. Blocks until stopped via signal.
 * Hard guards:
 *   - CI=true without EVENTBUS_CI_ALLOW=true => refuse
 *   - Live publish impossible in CI regardless of config
 */
export async function startConsumer(config: DaemonConfig): Promise<void> {
  // CI hard guard
  const isCI = process.env.CI === 'true';
  if (isCI && !config.EVENTBUS_CI_ALLOW) {
    throw new Error('Event bus consumer refused in CI (set EVENTBUS_CI_ALLOW=true to override)');
  }

  const client = await createRedisStreamClient(config);
  console.log(
    `Event bus consumer: connected (stream=${config.EVENTBUS_STREAM}, ` +
      `group=${config.EVENTBUS_GROUP}, consumer=${client.consumer})`
  );

  const state: ConsumerState = {
    running: false,
    eventsProcessed: 0,
    eventsDeduped: 0,
    lastEventAt: null,
    lastError: null,
    stopped: false,
  };

  // Graceful shutdown handlers
  const shutdown = async () => {
    console.log('\nEvent bus consumer: shutting down...');
    state.stopped = true;
    await disconnectRedis(client);
    console.log(
      `Event bus consumer: stopped (${state.eventsProcessed} processed, ${state.eventsDeduped} deduped)`
    );
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  // Consumer loop
  while (!state.stopped) {
    try {
      const entries = await readEvents(client, config.EVENTBUS_BLOCK_MS, config.EVENTBUS_MAX_BATCH);

      for (const entry of entries) {
        await handleEvent(client, entry.entryId, entry.event, config, state, isCI);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Connection errors may be transient — log and retry after delay
      if (msg.includes('ECONNREFUSED') || msg.includes('ENOTCONN') || msg.includes('Connection')) {
        console.warn(`Event bus consumer: connection error — ${msg}, retrying in 5s`);
        await sleep(5000);
      } else {
        console.error(`Event bus consumer: unexpected error — ${msg}`);
        state.lastError = msg;
        await sleep(1000);
      }
    }
  }
}

async function handleEvent(
  client: RedisStreamClient,
  entryId: string,
  event: BusEvent,
  config: DaemonConfig,
  state: ConsumerState,
  isCI: boolean
): Promise<void> {
  const startedAt = new Date().toISOString();

  // Dedupe check
  if (event.dedupeKey) {
    const isDuplicate = await checkDedupe(client, event.dedupeKey);
    if (isDuplicate) {
      state.eventsDeduped++;
      console.log(`Event bus: deduped event ${event.id} (key=${event.dedupeKey})`);
      await ackEvent(client, entryId);
      writeEventReceipt({
        eventId: event.id,
        entryId,
        type: event.type,
        source: event.source,
        dedupeKey: event.dedupeKey,
        action: 'deduped',
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: 0,
        ok: true,
        error: null,
      });
      return;
    }
  }

  // Overlap lock — skip if already running a report
  if (state.running) {
    console.log(`Event bus: skipping event ${event.id} (report already running)`);
    // Don't ACK — will be redelivered on next read
    return;
  }

  // Decide action
  const wantsDeep = DEEP_TRIGGER_TYPES.has(event.type) || event.severity === 'high';
  const allowLive = config.OPERATOR_ENABLED && config.EVENTBUS_ALLOW_LIVE && !isCI; // CI hard guard — never live publish
  const isDeep = wantsDeep && allowLive;
  const action: 'dry-run' | 'deep' = isDeep ? 'deep' : 'dry-run';

  console.log(
    `Event bus: handling ${event.type} (id=${event.id}, severity=${event.severity ?? 'none'}, action=${action})`
  );

  state.running = true;
  let ok = true;
  let error: string | null = null;

  try {
    await runReport({
      dryRun: !isDeep,
      suppressExit: true,
    });
  } catch (err) {
    ok = false;
    error = err instanceof Error ? err.message : String(err);
    console.warn(`Event bus: report failed for ${event.id} — ${error}`);
    state.lastError = error;
  }

  state.running = false;
  state.eventsProcessed++;
  state.lastEventAt = new Date().toISOString();

  const finishedAt = new Date().toISOString();
  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

  console.log(`Event bus: ${event.type} ${ok ? 'completed' : 'failed'} in ${durationMs}ms`);

  // ACK after handling (success or failure — we wrote a receipt either way)
  await ackEvent(client, entryId);

  writeEventReceipt({
    eventId: event.id,
    entryId,
    type: event.type,
    source: event.source,
    dedupeKey: event.dedupeKey ?? null,
    action,
    startedAt,
    finishedAt,
    durationMs,
    ok,
    error,
  });
}

/**
 * Write event receipt to out/operator-events/<date>/.
 * Best-effort — never throws.
 */
function writeEventReceipt(receipt: EventReceipt): void {
  try {
    const dateStr = receipt.startedAt.slice(0, 10);
    const outDir = join(REPO_ROOT, 'out', 'operator-events', dateStr);
    mkdirSync(outDir, { recursive: true });

    const timestamp = receipt.startedAt.replace(/[:.]/g, '-');
    const filename = `event-${receipt.eventId.slice(0, 8)}-${timestamp}.json`;

    writeFileSync(join(outDir, filename), JSON.stringify(receipt, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`Event bus: failed to write receipt — ${(err as Error).message}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
