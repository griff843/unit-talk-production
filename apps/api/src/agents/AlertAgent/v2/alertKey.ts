/**
 * AlertAgent V2 — Alert Key Generator
 *
 * Computes a stable, deterministic alert_key for idempotency.
 * Key composition: type + sport + market + entity_id + game_id + line + book + timestamp_bucket
 *
 * Created: 2026-01-29 (AlertAgent V2 Mission)
 */

import { createHash } from 'crypto';

import { AlertSignal, TIMESTAMP_BUCKET_MS } from './types';

/**
 * Compute the timestamp bucket for a given ISO timestamp.
 * Buckets are aligned to 5-minute intervals from epoch.
 */
export function computeTimestampBucket(
  isoTimestamp: string,
  bucketMs: number = TIMESTAMP_BUCKET_MS
): number {
  const ts = new Date(isoTimestamp).getTime();
  return Math.floor(ts / bucketMs) * bucketMs;
}

/**
 * Generate a stable, deterministic alert key from a signal.
 *
 * The key is a sha256 hex digest of the canonical fields joined by `|`.
 * Two identical signals in the same time bucket produce the same key.
 */
export function generateAlertKey(
  signal: AlertSignal,
  bucketMs: number = TIMESTAMP_BUCKET_MS
): string {
  const bucket = computeTimestampBucket(signal.timestamp, bucketMs);
  const entityId = signal.player_id || signal.team_id || signal.player_name || 'unknown';
  const parts = [
    signal.type,
    (signal.sport || 'unknown').toUpperCase(),
    (signal.market || 'unknown').toUpperCase(),
    entityId,
    signal.game_id || 'no_game',
    String(signal.line ?? 'no_line'),
    (signal.book || 'any').toUpperCase(),
    String(bucket),
  ];
  const canonical = parts.join('|');
  return createHash('sha256').update(canonical).digest('hex').slice(0, 24);
}
