/**
 * CANARY TEST ROUTE
 *
 * Minimal endpoint to create pick_publish outbox record for testing
 * Bypasses schema complexity for operational verification
 */

import express from 'express';
import { supabaseClient } from '../services/supabaseClient';
import { logger } from '../shared/logger';

const router = express.Router();

/**
 * POST /canary-test/publish/:pickId
 *
 * Directly create outbox record for CANARY testing
 */
router.post('/publish/:pickId', async (req, res) => {
  const { pickId } = req.params;
  const { channel = 'CANARY' } = req.body;

  const correlationId = `canary-test-${pickId}`;
  const requestLogger = logger.child({ correlationId, endpoint: '/canary-test/publish' });

  try {
    requestLogger.info('Creating CANARY outbox record', { pickId, channel });

    // 1. Verify pick exists
    const { data: pick, error: pickError } = await supabaseClient
      .from('picks')
      .select('id, tenant_id, user_id, selection, odds, stake, status')
      .eq('id', pickId)
      .single();

    if (pickError || !pick) {
      return res.status(404).json({
        success: false,
        error: 'Pick not found',
        pickId,
        correlationId
      });
    }

    // 2. Create pick_publish outbox record
    const { data: publishRecord, error: publishError } = await supabaseClient
      .from('pick_publish')
      .insert({
        pick_id: pickId,
        tenant_id: pick.tenant_id,
        channel: channel,
        status: 'pending',
        discord_channel_id: process.env.DISCORD_CANARY_CHANNEL_ID || '',
        message_type: 'new_pick',
        metadata: {
          selection: pick.selection,
          odds: pick.odds,
          stake: pick.stake,
          source: 'canary_test',
          created_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (publishError) {
      throw new Error(`Failed to create publish record: ${publishError.message}`);
    }

    requestLogger.info('CANARY outbox record created successfully', {
      pickId,
      publishId: publishRecord.id,
      channel
    });

    return res.json({
      success: true,
      pickId,
      publishId: publishRecord.id,
      channel,
      status: 'pending',
      correlationId
    });

  } catch (error) {
    requestLogger.error('Failed to create CANARY outbox record', {
      pickId,
      error: error instanceof Error ? error.message : String(error)
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to create outbox record',
      message: error instanceof Error ? error.message : 'Unknown error',
      correlationId
    });
  }
});

export default router;
