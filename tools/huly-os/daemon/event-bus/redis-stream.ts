// SPRINT-EVENT-BUS-011: Redis Streams wrapper
// XADD for publishing, XREADGROUP for consumption, XACK for acknowledgment.
// Dedupe via SET NX EX on ut:events:dedupe:<dedupeKey>.

import { hostname } from 'node:os';

import Redis from 'ioredis';

import { BusEventSchema } from './event-types.js';

import type { BusEvent } from './event-types.js';
import type { DaemonConfig } from '../config.js';

export interface RedisStreamClient {
  redis: Redis;
  stream: string;
  group: string;
  consumer: string;
  dedupeTtl: number;
}

/**
 * Create a Redis Stream client from config.
 * Ensures the consumer group exists (XGROUP CREATE ... MKSTREAM).
 */
export async function createRedisStreamClient(config: DaemonConfig): Promise<RedisStreamClient> {
  const url = config.EVENTBUS_REDIS_URL;
  if (!url) throw new Error('EVENTBUS_REDIS_URL is required');

  const redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  await redis.connect();

  const stream = config.EVENTBUS_STREAM;
  const group = config.EVENTBUS_GROUP;
  const consumer = config.EVENTBUS_CONSUMER || `${getHostname()}-${process.pid}`;
  const dedupeTtl = config.EVENTBUS_DEDUPE_TTL_SECONDS;

  // Create consumer group if it doesn't exist
  try {
    await redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM');
  } catch (err) {
    // BUSYGROUP = group already exists — safe to ignore
    if (!(err instanceof Error && err.message.includes('BUSYGROUP'))) {
      throw err;
    }
  }

  return { redis, stream, group, consumer, dedupeTtl };
}

/**
 * Publish an event to the stream via XADD.
 * Returns the stream entry ID.
 */
export async function publishEvent(client: RedisStreamClient, event: BusEvent): Promise<string> {
  const data = JSON.stringify(event);
  const entryId = await client.redis.xadd(client.stream, '*', 'data', data);
  if (!entryId) throw new Error('XADD returned null — stream write failed');
  return entryId;
}

export interface StreamEntry {
  entryId: string;
  event: BusEvent;
  raw: string;
}

/**
 * Read a batch of events from the stream using XREADGROUP.
 * Returns parsed events. Invalid entries are logged and skipped.
 */
export async function readEvents(
  client: RedisStreamClient,
  blockMs: number,
  maxBatch: number
): Promise<StreamEntry[]> {
  const results = (await client.redis.xreadgroup(
    'GROUP',
    client.group,
    client.consumer,
    'COUNT',
    maxBatch,
    'BLOCK',
    blockMs,
    'STREAMS',
    client.stream,
    '>'
  )) as [string, [string, string[]][]][] | null;

  if (!results) return [];

  const entries: StreamEntry[] = [];

  for (const [, messages] of results) {
    for (const [entryId, fields] of messages) {
      const dataIndex = fields.indexOf('data');
      if (dataIndex === -1 || dataIndex + 1 >= fields.length) {
        console.warn(`Event bus: entry ${entryId} missing 'data' field, skipping`);
        await ackEvent(client, entryId);
        continue;
      }

      const raw = fields[dataIndex + 1];
      try {
        const parsed = JSON.parse(raw);
        const event = BusEventSchema.parse(parsed);
        entries.push({ entryId, event, raw });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`Event bus: entry ${entryId} invalid — ${msg}, acking to prevent redelivery`);
        await ackEvent(client, entryId);
      }
    }
  }

  return entries;
}

/**
 * Acknowledge a processed event.
 */
export async function ackEvent(client: RedisStreamClient, entryId: string): Promise<void> {
  await client.redis.xack(client.stream, client.group, entryId);
}

/**
 * Check deduplication for an event. Returns true if this is a duplicate (should skip).
 * Uses SET NX EX to atomically check-and-set a dedupe key.
 */
export async function checkDedupe(client: RedisStreamClient, dedupeKey: string): Promise<boolean> {
  const key = `${client.stream}:dedupe:${dedupeKey}`;
  const result = await client.redis.set(key, '1', 'EX', client.dedupeTtl, 'NX');
  // result is 'OK' if key was set (not a duplicate), null if key already existed (duplicate)
  return result === null;
}

/**
 * Disconnect the Redis client.
 */
export async function disconnectRedis(client: RedisStreamClient): Promise<void> {
  client.redis.disconnect();
}

function getHostname(): string {
  try {
    return hostname();
  } catch {
    return 'unknown';
  }
}
