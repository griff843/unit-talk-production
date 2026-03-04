// SPRINT-EVENT-BUS-011: Event producer utility
// Publishes events to the Redis Stream. Used by CLI and programmatic callers.

import { randomUUID } from 'node:crypto';

import { createRedisStreamClient, disconnectRedis, publishEvent } from './redis-stream.js';

import type { DaemonConfig } from '../config.js';
import type { BusEvent, EventSource, EventType, Severity } from './event-types.js';

export interface EmitOptions {
  type: EventType;
  source?: EventSource;
  payload?: Record<string, unknown>;
  dedupeKey?: string;
  severity?: Severity;
}

/**
 * Emit a single event to the Redis Stream.
 * Returns the stream entry ID.
 */
export async function emitEvent(
  config: DaemonConfig,
  options: EmitOptions
): Promise<{ entryId: string; event: BusEvent }> {
  const event: BusEvent = {
    id: randomUUID(),
    type: options.type,
    ts: new Date().toISOString(),
    source: options.source ?? 'manual',
    payload: options.payload ?? {},
    dedupeKey: options.dedupeKey,
    severity: options.severity,
  };

  const client = await createRedisStreamClient(config);
  try {
    const entryId = await publishEvent(client, event);
    return { entryId, event };
  } finally {
    await disconnectRedis(client);
  }
}
