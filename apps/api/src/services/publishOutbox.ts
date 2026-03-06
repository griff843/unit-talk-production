/**
 * Publish Outbox Service
 * Sprint: SPRINT-023-PRODUCTION-SURFACE-LOCK
 *
 * Canonical interface for Discord publishing through the pick_publish outbox.
 * All Discord publishing MUST go through this module:
 *   1. enqueueForPublish() — create outbox row (idempotent via dedupe_key)
 *   2. markPublished() — write receipt (external_message_id + sent_at)
 *   3. markFailed() — record error with structured error_code
 *
 * INVARIANTS:
 * - No Discord post without an outbox row
 * - Duplicate dedupe_key inserts are silently ignored (idempotent)
 * - Receipt must be stored before pick is marked posted_to_discord
 */

import * as crypto from 'crypto';

import { createLogger } from '../utils/logger';

import type { SupabaseClient } from '@supabase/supabase-js';

const logger = createLogger('PublishOutbox');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnqueueParams {
  pickId: string;
  channel: string;
  discordChannelId?: string;
  threadId?: string;
  payload: Record<string, unknown>;
  promotionBand: string;
  tier: string;
  modelVersion?: string;
  tenantId?: string;
}

export interface OutboxRow {
  id: string;
  pick_id: string;
  status: string;
  dedupe_key: string;
  external_message_id: string | null;
  sent_at: string | null;
  confirmed_at: string | null;
  error: string | null;
  error_code: string | null;
  payload_hash: string | null;
  attempts: number;
}

export interface EnqueueResult {
  outboxId: string;
  dedupeKey: string;
  alreadyExists: boolean;
}

// ---------------------------------------------------------------------------
// Dedupe key generation
// ---------------------------------------------------------------------------

/**
 * Generate idempotency key for a publish job.
 * Format: pick_id:band:channel (deterministic, survives re-runs)
 */
function generateDedupeKey(pickId: string, band: string, channel: string): string {
  return `${pickId}:${band}:${channel}`;
}

/**
 * Generate payload hash for drift detection.
 * SHA-256 of JSON-stringified payload (sorted keys for determinism).
 */
function hashPayload(payload: Record<string, unknown>): string {
  const normalized = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Outbox operations
// ---------------------------------------------------------------------------

/**
 * Enqueue a pick for publishing. Idempotent: duplicate dedupe_key is a no-op.
 *
 * Returns the outbox row id and whether it already existed.
 */
export async function enqueueForPublish(
  supabase: SupabaseClient,
  params: EnqueueParams
): Promise<EnqueueResult> {
  const dedupeKey = generateDedupeKey(params.pickId, params.promotionBand, params.channel);
  const payloadHash = hashPayload(params.payload);

  // Check if already enqueued (idempotency)
  const { data: existing } = await supabase
    .from('pick_publish')
    .select('id, status')
    .eq('dedupe_key', dedupeKey)
    .limit(1)
    .single();

  if (existing) {
    logger.info(
      { pickId: params.pickId, dedupeKey, existingId: existing.id },
      'Outbox entry already exists — idempotent skip'
    );
    return {
      outboxId: existing.id,
      dedupeKey,
      alreadyExists: true,
    };
  }

  // Insert new outbox row
  const { data: inserted, error } = await supabase
    .from('pick_publish')
    .insert({
      pick_id: params.pickId,
      channel: params.channel,
      discord_channel_id: params.discordChannelId ?? null,
      thread_id: params.threadId ?? null,
      status: 'pending',
      dedupe_key: dedupeKey,
      payload_hash: payloadHash,
      tenant_id: params.tenantId ?? 'default',
      attempts: 0,
      max_attempts: 3,
      metadata: {
        promotion_band: params.promotionBand,
        tier: params.tier,
        model_version: params.modelVersion,
        payload: params.payload,
        enqueued_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  if (error) {
    // Handle unique constraint violation (race condition)
    if (error.code === '23505') {
      const { data: raceExisting } = await supabase
        .from('pick_publish')
        .select('id')
        .eq('dedupe_key', dedupeKey)
        .single();

      logger.info(
        { pickId: params.pickId, dedupeKey },
        'Outbox race condition resolved — entry exists'
      );
      return {
        outboxId: raceExisting?.id ?? 'unknown',
        dedupeKey,
        alreadyExists: true,
      };
    }

    logger.error({ pickId: params.pickId, error: error.message }, 'Failed to enqueue outbox row');
    throw new Error(`Outbox enqueue failed: ${error.message}`);
  }

  logger.info({ pickId: params.pickId, outboxId: inserted.id, dedupeKey }, 'Outbox entry created');
  return {
    outboxId: inserted.id,
    dedupeKey,
    alreadyExists: false,
  };
}

/**
 * Mark an outbox entry as published with Discord receipt.
 */
export async function markPublished(
  supabase: SupabaseClient,
  outboxId: string,
  receipt: {
    externalMessageId: string;
    channelId?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('pick_publish')
    .update({
      status: 'posted',
      external_message_id: receipt.externalMessageId,
      sent_at: now,
      confirmed_at: now,
      last_attempt_at: now,
    })
    .eq('id', outboxId);

  if (error) {
    logger.error({ outboxId, error: error.message }, 'Failed to mark outbox as published');
    throw new Error(`Outbox receipt write failed: ${error.message}`);
  }

  logger.info(
    { outboxId, messageId: receipt.externalMessageId },
    'Outbox marked as published with receipt'
  );
}

/**
 * Mark an outbox entry as failed with structured error.
 */
export async function markFailed(
  supabase: SupabaseClient,
  outboxId: string,
  failure: {
    errorCode: string;
    errorMessage: string;
  }
): Promise<void> {
  const now = new Date().toISOString();

  // Increment attempts and check against max
  const { data: current } = await supabase
    .from('pick_publish')
    .select('attempts, max_attempts')
    .eq('id', outboxId)
    .single();

  const attempts = (current?.attempts ?? 0) + 1;
  const maxAttempts = current?.max_attempts ?? 3;
  const finalStatus = attempts >= maxAttempts ? 'failed' : 'pending';

  const { error } = await supabase
    .from('pick_publish')
    .update({
      status: finalStatus,
      error: failure.errorMessage,
      error_code: failure.errorCode,
      last_error: failure.errorMessage,
      last_attempt_at: now,
      attempts,
      next_retry_at:
        finalStatus === 'pending' ? new Date(Date.now() + attempts * 60_000).toISOString() : null,
    })
    .eq('id', outboxId);

  if (error) {
    logger.error({ outboxId, error: error.message }, 'Failed to mark outbox as failed');
  }

  logger.info(
    { outboxId, errorCode: failure.errorCode, attempts, finalStatus },
    'Outbox marked as failed'
  );
}

/**
 * Fetch pending outbox entries for publishing (poll pattern).
 */
export async function fetchPendingOutboxEntries(
  supabase: SupabaseClient,
  limit: number = 50
): Promise<OutboxRow[]> {
  const { data, error } = await supabase
    .from('pick_publish')
    .select(
      'id, pick_id, status, dedupe_key, external_message_id, sent_at, confirmed_at, error, error_code, payload_hash, attempts'
    )
    .eq('status', 'pending')
    .or('next_retry_at.is.null,next_retry_at.lte.' + new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'Failed to fetch pending outbox entries');
    return [];
  }

  return (data ?? []) as OutboxRow[];
}

/**
 * Get outbox receipt for a pick (for verification).
 */
export async function getOutboxReceipt(
  supabase: SupabaseClient,
  pickId: string
): Promise<OutboxRow | null> {
  const { data, error } = await supabase
    .from('pick_publish')
    .select(
      'id, pick_id, status, dedupe_key, external_message_id, sent_at, confirmed_at, error, error_code, payload_hash, attempts'
    )
    .eq('pick_id', pickId)
    .eq('status', 'posted')
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as OutboxRow;
}
