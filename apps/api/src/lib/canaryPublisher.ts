/* eslint-disable complexity, max-lines-per-function */
/**
 * CANARY PUBLISHER
 * Sprint: CANARY-LIFECYCLE-TRIGGER-008
 *
 * Publishes exactly ONE pick through the REAL lifecycle pipeline to CANARY surface.
 * Used for staging verification with full execution telemetry.
 *
 * REQUIREMENTS:
 * - DISCORD_MODE=canary (fail-closed)
 * - Creates execution_events BEFORE Discord POST
 * - Updates execution_events AFTER with real snowflake
 * - Idempotent: second call returns success with idempotent=true
 */

import axios from 'axios';

import { resolveDiscordRoutingConfig } from '../config/discordRouting';
import { logger } from '../services/logging';

import { getBuildInfo } from './buildInfo';
import {
  createExecutionTelemetry,
  updateExecutionTelemetryPublished,
  updateExecutionTelemetryFailed,
} from './executionTelemetry';
import { atomicClaimForPost, lifecycleUpdate } from './lifecycle';

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface CanaryPublishParams {
  pickId: string;
  correlationId: string;
  operatorId: string;
  dryRun?: boolean;
}

export interface CanaryPublishResult {
  success: boolean;
  idempotent: boolean;
  discordMessageId?: string;
  executionEventId?: string;
  publishLatencyMs?: number;
  error?: string;
  reason?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Validate Discord snowflake format (17-20 digit numeric string)
 */
function isValidDiscordSnowflake(messageId: string | null | undefined): boolean {
  if (!messageId) return false;
  return /^\d{17,20}$/.test(messageId);
}

/**
 * Get canary webhook URL from routing config
 * Throws if not configured (fail-closed)
 */
function requireCanaryWebhookUrl(): string {
  const config = resolveDiscordRoutingConfig();
  if (!config.canaryWebhookUrl) {
    throw new Error('DISCORD_CANARY_WEBHOOK_URL is required in canary mode but not configured');
  }
  return config.canaryWebhookUrl;
}

/**
 * Build a simple canary embed from pick data
 */
function buildCanaryEmbed(pick: Record<string, unknown>): object {
  const title = pick.player_name
    ? `${pick.player_name} ${(pick.selection || pick.direction || '').toString().toUpperCase()} ${pick.line}`
    : pick.team
      ? `${pick.team} ${pick.line}`
      : `Pick ${pick.id}`;

  const odds =
    typeof pick.odds === 'number' ? (pick.odds > 0 ? `+${pick.odds}` : `${pick.odds}`) : '-110';

  return {
    title: `🎯 ${title}`,
    color: 0x00ff00, // Green for canary
    description: `**${pick.stat_type || 'Prop'}**\n${pick.sport || 'NBA'} • ${pick.matchup || 'Canary Test'}`,
    fields: [
      { name: 'Odds', value: odds, inline: true },
      { name: 'Tier', value: `${pick.tier || 'A'}-Tier`, inline: true },
      { name: 'Surface', value: 'CANARY', inline: true },
    ],
    footer: { text: `Canary | SPRINT-008 | ${new Date().toISOString().split('T')[0]}` },
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// MAIN PUBLISHER
// ============================================================================

/**
 * Publish exactly ONE pick to CANARY surface via the real lifecycle pipeline.
 *
 * Flow:
 * 1. Atomic claim (posted_to_discord = true)
 * 2. Create execution_events row BEFORE post
 * 3. Discord POST to canary webhook with ?wait=true
 * 4. Validate snowflake
 * 5. Confirm post (set discord_message_id)
 * 6. Update execution_events with receipt
 *
 * On failure:
 * - Reset posted_to_discord = false (allow retry)
 * - Record failure in execution_events
 *
 * @param supabase - Supabase client
 * @param params - Publish parameters
 * @returns Result with IDs and latency
 */
export async function publishOneToCanary(
  supabase: SupabaseClient,
  params: CanaryPublishParams
): Promise<CanaryPublishResult> {
  const { pickId, correlationId, operatorId, dryRun = false } = params;
  const requestStartTime = Date.now();

  logger.info(
    { pickId, correlationId, operatorId, dryRun },
    'CANARY-PUBLISH: Starting canary publish'
  );

  try {
    // ---- Step 1: Atomic claim ----
    const claim = await atomicClaimForPost(supabase, pickId);

    if (!claim.claimed) {
      // Already posted - idempotent success
      logger.info(
        { pickId, correlationId },
        'CANARY-PUBLISH: Pick already claimed (idempotent skip)'
      );
      return {
        success: true,
        idempotent: true,
        reason: 'ALREADY_POSTED',
      };
    }

    // ---- Step 2: Create execution telemetry BEFORE post ----
    const telemetryResult = await createExecutionTelemetry(supabase, {
      pickId,
      routeType: 'WEBHOOK',
      targetSurface: 'CANARY',
      targetChannelId: `canary:${correlationId}`,
      publishAttemptId: correlationId,
    });

    const executionEventId = telemetryResult.eventId;

    if (!telemetryResult.success) {
      logger.warn(
        { pickId, correlationId, error: telemetryResult.error },
        'CANARY-PUBLISH: Telemetry creation failed (non-blocking)'
      );
    }

    // ---- Step 3: Dry run check ----
    if (dryRun) {
      // Reset claim since we're not actually posting (via lifecycle adapter)
      await lifecycleUpdate(
        supabase,
        pickId,
        {
          posted_to_discord: false,
          promotion_posted_at: null,
        },
        {
          writerRole: 'poster',
          traceId: `canary-dryrun-${correlationId}`,
          skipTransitionValidation: true,
        }
      );

      logger.info(
        { pickId, correlationId, executionEventId },
        'CANARY-PUBLISH: Dry run complete (claim reset)'
      );

      return {
        success: true,
        idempotent: false,
        executionEventId,
        reason: 'DRY_RUN',
      };
    }

    // ---- Step 4: Fetch pick data ----
    const { data: pick, error: pickError } = await supabase
      .from('unified_picks')
      .select('*')
      .eq('id', pickId)
      .single();

    if (pickError || !pick) {
      logger.error(
        { pickId, correlationId, error: pickError?.message },
        'CANARY-PUBLISH: Pick not found'
      );
      return {
        success: false,
        idempotent: false,
        error: `Pick ${pickId} not found`,
      };
    }

    // ---- Step 5: Build embed and POST to Discord ----
    const embed = buildCanaryEmbed(pick);
    const webhookUrl = requireCanaryWebhookUrl();

    let messageId: string | null = null;
    try {
      const response = await axios.post(`${webhookUrl}?wait=true`, {
        username: 'Unit Talk CANARY',
        embeds: [embed],
      });
      messageId = response.data?.id || null;
    } catch (axiosError: unknown) {
      const errorMsg = axiosError instanceof Error ? axiosError.message : 'Discord POST failed';
      logger.error(
        { pickId, correlationId, error: errorMsg },
        'CANARY-PUBLISH: Discord POST failed'
      );

      // Reset claim on failure (via lifecycle adapter)
      await lifecycleUpdate(
        supabase,
        pickId,
        {
          posted_to_discord: false,
          promotion_posted_at: null,
        },
        {
          writerRole: 'poster',
          traceId: `canary-fail-${correlationId}`,
          skipTransitionValidation: true,
        }
      );

      // Record failure in telemetry
      await updateExecutionTelemetryFailed(supabase, {
        pickId,
        errorMessage: errorMsg,
        executionNotes: 'CANARY_DISCORD_POST_FAILED',
      });

      // Write audit log
      await supabase.from('audit_log').insert({
        actor: `canary-publisher:${operatorId}`,
        action: 'CANARY_DISCORD_POST_FAILED',
        entity_type: 'unified_picks',
        entity_id: pickId,
        details: {
          correlationId,
          error: errorMsg,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });

      return {
        success: false,
        idempotent: false,
        executionEventId,
        error: errorMsg,
      };
    }

    // ---- Step 6: Validate snowflake ----
    if (!isValidDiscordSnowflake(messageId)) {
      logger.error(
        { pickId, correlationId, messageId },
        'CANARY-PUBLISH: Invalid Discord snowflake'
      );

      // Reset claim on invalid snowflake (via lifecycle adapter)
      await lifecycleUpdate(
        supabase,
        pickId,
        {
          posted_to_discord: false,
          promotion_posted_at: null,
        },
        {
          writerRole: 'poster',
          traceId: `canary-invalid-${correlationId}`,
          skipTransitionValidation: true,
        }
      );

      // Record failure in telemetry
      await updateExecutionTelemetryFailed(supabase, {
        pickId,
        errorMessage: `Invalid Discord ID: ${messageId}`,
        executionNotes: 'CANARY_INVALID_SNOWFLAKE',
      });

      return {
        success: false,
        idempotent: false,
        executionEventId,
        error: `Invalid Discord message ID: ${messageId}`,
      };
    }

    // ---- Step 7: Confirm post with receipt ----
    const publishLatencyMs = Date.now() - requestStartTime;

    const confirmResult = await lifecycleUpdate(
      supabase,
      pickId,
      {
        discord_message_id: messageId,
      },
      {
        writerRole: 'poster',
        traceId: correlationId,
        skipTransitionValidation: true,
      }
    );

    if (!confirmResult.success) {
      logger.warn(
        { pickId, correlationId, error: confirmResult.error },
        'CANARY-PUBLISH: Failed to save discord_message_id (non-blocking)'
      );
    }

    // ---- Step 8: Persist Discord receipt in meta ----
    const buildInfo = getBuildInfo('canaryPublisher');
    const { data: currentPick } = await supabase
      .from('unified_picks')
      .select('meta')
      .eq('id', pickId)
      .single();

    const meta = {
      ...((currentPick?.meta as Record<string, unknown>) || {}),
      discord_receipt: {
        message_id: messageId,
        channel_id: 'CANARY',
        posted_at: new Date().toISOString(),
        poster: 'canaryPublisher',
        commit_sha: buildInfo.commit,
        commit_short: buildInfo.commitShort,
        environment: buildInfo.environment,
        correlation_id: correlationId,
        operator_id: operatorId,
      },
    };

    await lifecycleUpdate(
      supabase,
      pickId,
      { meta },
      {
        writerRole: 'poster',
        traceId: `canary-receipt-${pickId}`,
        skipTransitionValidation: true,
      }
    );

    // ---- Step 9: Update execution telemetry with receipt ----
    await updateExecutionTelemetryPublished(supabase, {
      pickId,
      discordMessageId: messageId!,
      publishLatencyMs,
    });

    // ---- Step 10: Write audit log ----
    await supabase.from('audit_log').insert({
      actor: `canary-publisher:${operatorId}`,
      action: 'CANARY_PUBLISH_SUCCESS',
      entity_type: 'unified_picks',
      entity_id: pickId,
      details: {
        correlationId,
        discord_message_id: messageId,
        execution_event_id: executionEventId,
        publish_latency_ms: publishLatencyMs,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    logger.info(
      {
        pickId,
        correlationId,
        discordMessageId: messageId,
        executionEventId,
        publishLatencyMs,
      },
      'CANARY-PUBLISH: Successfully published to canary'
    );

    return {
      success: true,
      idempotent: false,
      discordMessageId: messageId!,
      executionEventId,
      publishLatencyMs,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ pickId, correlationId, error: errorMsg }, 'CANARY-PUBLISH: Unexpected error');

    return {
      success: false,
      idempotent: false,
      error: errorMsg,
    };
  }
}
