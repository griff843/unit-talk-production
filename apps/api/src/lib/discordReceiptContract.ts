/**
 * Discord Receipt Contract
 *
 * PHASE-2-PRODUCTION-READINESS-019: System Reconciliation
 *
 * Persists receipt data on successful Discord posts:
 * - discord_channel_id
 * - discord_message_id (or webhook receipt surrogate)
 * - posted_at
 * - posted_by (service + commit)
 * - outbox_event_id
 * - gauntlet_run_id
 */

import { logger } from '../services/logging';
import { supabase } from '../services/supabaseClient';

import { getBuildInfo } from './buildInfo';
import { lifecycleUpdate } from './lifecycle';

/**
 * Discord receipt data structure
 */
export interface DiscordReceipt {
  pick_id: string;
  discord_channel_id: string;
  discord_message_id: string;
  posted_at: string;
  posted_by: string;
  outbox_event_id?: string;
  gauntlet_run_id?: string;
  embed_title?: string;
  embed_footer?: string;
}

/**
 * Receipt storage result
 */
export interface ReceiptResult {
  success: boolean;
  receipt_id?: string;
  error?: string;
}

/**
 * Generate a webhook receipt surrogate ID when actual message ID unavailable
 */
export function generateWebhookReceiptId(): string {
  return `webhook-receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Persist Discord receipt to database
 */
export async function persistDiscordReceipt(receipt: DiscordReceipt): Promise<ReceiptResult> {
  const buildInfo = getBuildInfo('receipt-contract');

  try {
    // Ensure posted_by includes service and commit
    const postedBy = receipt.posted_by.includes(':')
      ? receipt.posted_by
      : `${receipt.posted_by}:${buildInfo.commitShort}`;

    const receiptData = {
      pick_id: receipt.pick_id,
      discord_channel_id: receipt.discord_channel_id,
      discord_message_id: receipt.discord_message_id,
      posted_at: receipt.posted_at,
      posted_by: postedBy,
      outbox_event_id: receipt.outbox_event_id || null,
      gauntlet_run_id: receipt.gauntlet_run_id || null,
      embed_title: receipt.embed_title || null,
      embed_footer: receipt.embed_footer || null,
      created_at: new Date().toISOString(),
    };

    // Try to insert into discord_receipts table
    const { data, error } = await supabase
      .from('discord_receipts')
      .insert(receiptData)
      .select('id')
      .single();

    if (error) {
      // If table doesn't exist, update unified_picks directly as fallback
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        logger.warn('discord_receipts table not found, updating unified_picks directly');

        const updateResult = await lifecycleUpdate(
          supabase,
          receipt.pick_id,
          { posted_to_discord: true, discord_post_id: receipt.discord_message_id },
          { writerRole: 'poster', skipTransitionValidation: true }
        );

        if (!updateResult.success) {
          throw new Error(updateResult.error || 'Failed to update unified_picks as fallback');
        }

        return {
          success: true,
          receipt_id: `fallback-${receipt.pick_id}`,
        };
      }

      throw error;
    }

    logger.info('Discord receipt persisted', {
      receiptId: data?.id,
      pickId: receipt.pick_id,
      channelId: receipt.discord_channel_id,
      messageId: receipt.discord_message_id,
    });

    return {
      success: true,
      receipt_id: data?.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to persist Discord receipt', {
      pickId: receipt.pick_id,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Query receipt by pick ID
 */
export async function getReceiptByPickId(pickId: string): Promise<DiscordReceipt | null> {
  try {
    // Try discord_receipts table first
    const { data, error } = await supabase
      .from('discord_receipts')
      .select('*')
      .eq('pick_id', pickId)
      .single();

    if (error) {
      // Fallback to unified_picks if table doesn't exist
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        const { data: pickData } = await supabase
          .from('unified_picks')
          .select('id, posted_to_discord, discord_post_id, updated_at')
          .eq('id', pickId)
          .single();

        if (pickData?.posted_to_discord && pickData?.discord_post_id) {
          return {
            pick_id: pickData.id,
            discord_channel_id: 'unknown',
            discord_message_id: pickData.discord_post_id,
            posted_at: pickData.updated_at,
            posted_by: 'unknown',
          };
        }
        return null;
      }

      return null;
    }

    return data as DiscordReceipt;
  } catch (error) {
    logger.error('Failed to query Discord receipt', {
      pickId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Verify receipt exists for gauntlet validation
 */
export async function verifyReceiptExists(pickId: string): Promise<boolean> {
  const receipt = await getReceiptByPickId(pickId);
  return receipt !== null;
}

/**
 * Create discord_receipts table migration SQL
 * This is for documentation and manual migration if needed
 */
export const RECEIPT_TABLE_MIGRATION = `
-- Discord Receipts Table
-- PHASE-2-PRODUCTION-READINESS-019
CREATE TABLE IF NOT EXISTS discord_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id TEXT NOT NULL,
  discord_channel_id TEXT NOT NULL,
  discord_message_id TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL,
  posted_by TEXT NOT NULL,
  outbox_event_id TEXT,
  gauntlet_run_id TEXT,
  embed_title TEXT,
  embed_footer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_pick_message UNIQUE (pick_id, discord_message_id)
);

CREATE INDEX IF NOT EXISTS idx_discord_receipts_pick_id ON discord_receipts(pick_id);
CREATE INDEX IF NOT EXISTS idx_discord_receipts_gauntlet ON discord_receipts(gauntlet_run_id);
`;

export default {
  persistDiscordReceipt,
  getReceiptByPickId,
  verifyReceiptExists,
  generateWebhookReceiptId,
  RECEIPT_TABLE_MIGRATION,
};
