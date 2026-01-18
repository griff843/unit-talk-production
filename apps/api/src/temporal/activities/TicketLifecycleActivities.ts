/**
 * Ticket Lifecycle Activities
 *
 * Activities for the end-to-end ticket processing workflow.
 * Each activity is idempotent and includes proper error handling.
 *
 * Phase 3 - Temporal End-to-End Orchestration
 *
 * Activities implement the following stages:
 * 1. Raw event fetching (from events/bridge_outbox)
 * 2. Canonical mapping (to picks table)
 * 3. Professional grading (8 features)
 * 4. CLV tracking initiation
 * 5. Publishing (outbox pattern)
 * 6. Alert detection (parallel)
 *
 * @module TicketLifecycleActivities
 */

import { createLogger } from '../../utils/logger';
import { supabaseClient } from '../../services/supabaseClient';
import { PicksDriverFactory } from '../../services/picks/PicksDriverFactory';
import { ProfessionalPropProcessor } from '../../services/ProfessionalPropProcessor';
import { CLVTrackingService } from '../../services/clv/CLVTrackingService';
import type { PickSubmissionInput } from '../../services/picks/types';

const logger = createLogger('TicketLifecycleActivities');

// ===== TYPE DEFINITIONS =====

export interface TicketLifecycleInput {
  // Event identification
  eventId?: string; // From events table
  bridgeOutboxId?: string; // From bridge_outbox table
  betSlipId: string; // Unique identifier for idempotency

  // Source information
  source: 'smart_form' | 'feed_agent' | 'manual';
  tenantId: string;
  userId: string;

  // Processing options
  skipProfessionalGrading?: boolean; // Default: false
  skipCLVTracking?: boolean; // Default: false
  autoApprove?: boolean; // Default: based on tier
  publishMode?: 'live' | 'shadow' | 'dry_run';
}

export interface FetchRawEventResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface CanonicalMappingResult {
  success: boolean;
  pickId?: string;
  error?: string;
}

export interface ProfessionalGradingResult {
  success: boolean;
  tier?: 'S' | 'A' | 'B' | 'C' | 'D';
  professionalScore?: number;
  confidence?: number;
  features?: Record<string, number>;
  error?: string;
}

export interface CLVTrackingResult {
  success: boolean;
  clvTrackingId?: string;
  initialEdge?: number;
  error?: string;
}

export interface PublishingResult {
  success: boolean;
  publishId?: string;
  error?: string;
}

export interface AlertDetectionResult {
  success: boolean;
  alerts?: Array<{
    type: 'injury' | 'hedge' | 'middle' | 'steam' | 'clv_milestone';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    metadata?: Record<string, any>;
  }>;
  error?: string;
}

export interface TicketLifecycleResult {
  workflowId: string;
  betSlipId: string;
  startTime: string;
  endTime: string;
  duration: number;

  canonicalMapping: CanonicalMappingResult & {
    canonicalPlayerId?: string;
  };

  professionalGrading: ProfessionalGradingResult;
  clvTracking: CLVTrackingResult;
  publishing: PublishingResult & {
    discordMessageId?: string;
  };

  overallSuccess: boolean;
  failureStage?: string;
  errors: Array<{
    stage: string;
    activity: string;
    error: string;
    timestamp: string;
  }>;
}

export interface TicketLifecycleMetrics {
  workflowId: string;
  betSlipId: string;
  source: string;
  duration: number;
  stages: {
    canonicalMapping: boolean;
    professionalGrading: boolean;
    clvTracking: boolean;
    publishing: boolean;
  };
  tier?: string;
  professionalScore?: number;
  success?: boolean;
  failureStage?: string;
}

// ===== STAGE 1: RAW EVENT FETCHING =====

/**
 * Fetch raw event data from source
 *
 * Sources:
 * - events table (smart_form submissions)
 * - bridge_outbox table (BridgeWorker processed events)
 * - Manual input (operator submissions)
 *
 * Idempotent: Safe to call multiple times
 */
export async function fetchRawEventActivity(
  input: TicketLifecycleInput
): Promise<FetchRawEventResult> {
  try {
    logger.info('[fetchRawEventActivity] Fetching raw event', {
      betSlipId: input.betSlipId,
      source: input.source,
      eventId: input.eventId,
      bridgeOutboxId: input.bridgeOutboxId,
    });

    let eventData: any = null;

    // Fetch from bridge_outbox if ID provided
    if (input.bridgeOutboxId) {
      const { data, error } = await supabaseClient
        .from('bridge_outbox')
        .select('*')
        .eq('id', input.bridgeOutboxId)
        .single();

      if (error) {
        logger.error('[fetchRawEventActivity] Bridge outbox fetch failed', {
          error: error.message,
          bridgeOutboxId: input.bridgeOutboxId,
        });
        return { success: false, error: error.message };
      }

      eventData = data.payload;
    }
    // Fetch from events table if ID provided
    else if (input.eventId) {
      const { data, error } = await supabaseClient
        .from('events')
        .select('*')
        .eq('id', input.eventId)
        .single();

      if (error) {
        logger.error('[fetchRawEventActivity] Events table fetch failed', {
          error: error.message,
          eventId: input.eventId,
        });
        return { success: false, error: error.message };
      }

      eventData = data;
    }
    // For manual/direct submissions, eventData is passed in input
    else {
      logger.info('[fetchRawEventActivity] Using direct input (manual submission)');
      eventData = input; // Input itself contains the event data
    }

    if (!eventData) {
      logger.error('[fetchRawEventActivity] No event data found');
      return { success: false, error: 'No event data found' };
    }

    logger.info('[fetchRawEventActivity] Event fetched successfully', {
      betSlipId: input.betSlipId,
      hasData: !!eventData,
    });

    return { success: true, data: eventData };
  } catch (error: any) {
    logger.error('[fetchRawEventActivity] Error fetching raw event', {
      error: error.message,
      betSlipId: input.betSlipId,
    });
    return { success: false, error: error.message };
  }
}

// ===== STAGE 2: CANONICAL MAPPING =====

/**
 * Resolve canonical IDs for player and game
 *
 * Maps player names and game identifiers to canonical entities table.
 * Uses fuzzy matching and aliases for robust resolution.
 */
export async function resolveCanonicalIdsActivity(eventData: any): Promise<{
  playerId?: string;
  gameId?: string;
}> {
  try {
    logger.info('[resolveCanonicalIdsActivity] Resolving canonical IDs', {
      playerName: eventData.playerName,
      gameId: eventData.gameId,
    });

    let playerId: string | undefined;
    let gameId: string | undefined;

    // Resolve player ID if player name provided
    if (eventData.playerName) {
      const { data: players, error: playerError } = await supabaseClient
        .from('canonical_players')
        .select('id')
        .ilike('name', `%${eventData.playerName}%`)
        .limit(1);

      if (!playerError && players && players.length > 0) {
        playerId = players[0].id;
        logger.info('[resolveCanonicalIdsActivity] Player resolved', {
          playerName: eventData.playerName,
          playerId,
        });
      } else {
        logger.warn('[resolveCanonicalIdsActivity] Player not found in canonical table', {
          playerName: eventData.playerName,
        });
      }
    }

    // Resolve game ID if provided
    if (eventData.gameId) {
      const { data: games, error: gameError } = await supabaseClient
        .from('canonical_games')
        .select('id')
        .eq('external_id', eventData.gameId)
        .limit(1);

      if (!gameError && games && games.length > 0) {
        gameId = games[0].id;
        logger.info('[resolveCanonicalIdsActivity] Game resolved', {
          externalGameId: eventData.gameId,
          canonicalGameId: gameId,
        });
      } else {
        logger.warn('[resolveCanonicalIdsActivity] Game not found in canonical table', {
          gameId: eventData.gameId,
        });
      }
    }

    return { playerId, gameId };
  } catch (error: any) {
    logger.error('[resolveCanonicalIdsActivity] Error resolving canonical IDs', {
      error: error.message,
    });
    // Don't fail - return empty IDs
    return {};
  }
}

/**
 * Insert pick into canonical picks table
 *
 * Uses CanonicalPicksDriver for:
 * - Idempotency (bet_slip_id deduplication)
 * - Schema validation
 * - Self-healing on schema errors
 * - RLS tenant isolation
 *
 * Idempotent: Returns existing pick if bet_slip_id already exists
 */
export async function insertCanonicalPickActivity(
  pickData: any
): Promise<CanonicalMappingResult> {
  try {
    logger.info('[insertCanonicalPickActivity] Inserting canonical pick', {
      betSlipId: pickData.bet_slip_id,
      tenantId: pickData.tenant_id,
      userId: pickData.user_id,
    });

    // Get driver from factory (handles schema probing)
    const driver = await PicksDriverFactory.getDriver();

    // Transform pickData to PickSubmissionInput format
    const pickInput: PickSubmissionInput = {
      tenantId: pickData.tenant_id,
      userId: pickData.user_id,
      betSlipId: pickData.bet_slip_id,
      idempotencyKey: pickData.idempotency_key,

      // Pick details
      playerId: pickData.prop_id,
      playerName: pickData.metadata?.player_name,
      league: pickData.metadata?.league,
      marketType: pickData.metadata?.market_type,
      line: pickData.metadata?.line,
      side: pickData.selection,
      odds: pickData.odds,
      stake: pickData.stake,

      // Game details
      gameId: pickData.game_id,
      gameDate: pickData.metadata?.game_date,

      // Additional metadata
      metadata: pickData.metadata,
      stakeText: pickData.metadata?.stake_text,
      userScore: pickData.confidence,
    };

    // Insert via driver (idempotent)
    const result = await driver.insertPick(pickInput);

    logger.info('[insertCanonicalPickActivity] Pick inserted successfully', {
      pickId: result.id,
      betSlipId: pickData.bet_slip_id,
    });

    return {
      success: true,
      pickId: result.id,
    };
  } catch (error: any) {
    logger.error('[insertCanonicalPickActivity] Error inserting canonical pick', {
      error: error.message,
      betSlipId: pickData.bet_slip_id,
    });
    return {
      success: false,
      error: error.message,
    };
  }
}

// ===== STAGE 3: PROFESSIONAL GRADING =====

/**
 * Run professional grading on pick
 *
 * Executes ProfessionalPropProcessor with 8 features:
 * 1. Steam Detection
 * 2. Closing Line Prediction
 * 3. Public vs Sharp
 * 4. Optimal Timing
 * 5. Line Shopping
 * 6. Market Timing
 * 7. Injury Timing
 * 8. Cross Market
 *
 * Returns tier (S/A/B/C/D) and professional score (0-5)
 */
export async function runProfessionalGradingActivity(
  pickId: string
): Promise<ProfessionalGradingResult> {
  try {
    logger.info('[runProfessionalGradingActivity] Running professional grading', {
      pickId,
    });

    // Fetch pick data
    const { data: pick, error: fetchError } = await supabaseClient
      .from('picks')
      .select('*')
      .eq('id', pickId)
      .single();

    if (fetchError || !pick) {
      logger.error('[runProfessionalGradingActivity] Pick not found', {
        pickId,
        error: fetchError?.message,
      });
      return { success: false, error: 'Pick not found' };
    }

    // Get professional processor instance
    const processor = ProfessionalPropProcessor.getInstance();

    // Process pick through professional pipeline
    // @ts-ignore - processProp method (professional processor interface)
    const gradingResult = await processor.processProp({
      ...pick,
      player_name: pick.metadata?.player_name,
      stat_type: pick.metadata?.market_type,
      line: pick.metadata?.line,
      sport: pick.metadata?.league,
    });

    logger.info('[runProfessionalGradingActivity] Professional grading completed', {
      pickId,
      tier: gradingResult.tier,
      professionalScore: gradingResult.professionalScore,
      confidence: gradingResult.confidence,
    });

    return {
      success: true,
      tier: gradingResult.tier,
      professionalScore: gradingResult.professionalScore,
      confidence: gradingResult.confidence,
      features: gradingResult.professional_insights?.feature_contributions,
    };
  } catch (error: any) {
    logger.error('[runProfessionalGradingActivity] Error running professional grading', {
      pickId,
      error: error.message,
    });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Update pick with grading results
 *
 * Stores professional score, tier, confidence, and feature contributions.
 * Updates workflow_stage based on tier and auto-approval settings.
 */
export async function updatePickWithGradingActivity(
  pickId: string,
  grading: ProfessionalGradingResult
): Promise<void> {
  try {
    logger.info('[updatePickWithGradingActivity] Updating pick with grading', {
      pickId,
      tier: grading.tier,
      professionalScore: grading.professionalScore,
    });

    // Determine workflow_stage based on tier
    let workflowStage = 'pending_review';
    let autoApproved = false;

    if (grading.tier === 'S' || grading.tier === 'A') {
      if (grading.professionalScore && grading.professionalScore >= 3.0) {
        workflowStage = 'approved';
        autoApproved = true;
      }
    }

    // Update pick
    const { error } = await supabaseClient
      .from('picks')
      .update({
        professional_score: grading.professionalScore,
        confidence: grading.confidence,
        workflow_stage: workflowStage,
        metadata: {
          tier: grading.tier,
          auto_approved: autoApproved,
          feature_contributions: grading.features,
        },
        grading_status: 'completed',
        graded_at: new Date().toISOString(),
      })
      .eq('id', pickId);

    if (error) {
      logger.error('[updatePickWithGradingActivity] Update failed', {
        pickId,
        error: error.message,
      });
      throw error;
    }

    logger.info('[updatePickWithGradingActivity] Pick updated successfully', {
      pickId,
      workflowStage,
      autoApproved,
    });
  } catch (error: any) {
    logger.error('[updatePickWithGradingActivity] Error updating pick', {
      pickId,
      error: error.message,
    });
    throw error;
  }
}

// ===== STAGE 4: CLV TRACKING =====

/**
 * Initiate CLV tracking for pick
 *
 * Creates entry in clv_tracking table with:
 * - Submitted line and odds
 * - Submission timestamp
 * - Game time
 * - Market identifiers
 *
 * Pick will be processed by CLVUpdateWorkflow after game completion.
 */
export async function initiateCLVTrackingActivity(
  pickId: string
): Promise<CLVTrackingResult> {
  try {
    logger.info('[initiateCLVTrackingActivity] Initiating CLV tracking', {
      pickId,
    });

    // Fetch pick data
    const { data: pick, error: fetchError } = await supabaseClient
      .from('picks')
      .select('*')
      .eq('id', pickId)
      .single();

    if (fetchError || !pick) {
      logger.error('[initiateCLVTrackingActivity] Pick not found', {
        pickId,
        error: fetchError?.message,
      });
      return { success: false, error: 'Pick not found' };
    }

    // Get CLV tracking service
    const clvService = CLVTrackingService.getInstance();

    // Create CLV tracking entry
    // @ts-ignore - create method (CLV tracking service interface)
    const clvEntry = await clvService.create({
      pick_id: pickId,
      tenant_id: pick.tenant_id,
      submitted_line: pick.metadata?.line || 0,
      submitted_odds: pick.odds,
      submitted_at: pick.created_at,
      bookmaker: pick.metadata?.book || 'unknown',
      metadata: {
        prop_id: pick.prop_id,
        player_name: pick.metadata?.player_name,
        stat_type: pick.metadata?.market_type,
        sport: pick.metadata?.league,
        game_time: pick.metadata?.game_date,
        game_id: pick.metadata?.game_id,
      },
    });

    // Calculate initial edge (simplified)
    const initialEdge = pick.professional_score
      ? (pick.professional_score - 2.5) * 2 // Convert 0-5 score to -5% to +5% edge
      : 0;

    logger.info('[initiateCLVTrackingActivity] CLV tracking initiated', {
      pickId,
      clvTrackingId: clvEntry.id,
      initialEdge,
    });

    return {
      success: true,
      clvTrackingId: clvEntry.id,
      initialEdge,
    };
  } catch (error: any) {
    logger.error('[initiateCLVTrackingActivity] Error initiating CLV tracking', {
      pickId,
      error: error.message,
    });
    return {
      success: false,
      error: error.message,
    };
  }
}

// ===== STAGE 5: PUBLISHING =====

/**
 * Create publish record for pick
 *
 * Inserts into pick_publish table using outbox pattern.
 * Pick will be published by DiscordPublishingWorker.
 *
 * Supports:
 * - Live publishing (immediate Discord post)
 * - Shadow mode (test without actual posting)
 * - Dry run (validation only)
 */
export async function createPublishRecordActivity(
  pickId: string,
  publishMode: string
): Promise<PublishingResult> {
  try {
    logger.info('[createPublishRecordActivity] Creating publish record', {
      pickId,
      publishMode,
    });

    // Fetch pick data
    const { data: pick, error: fetchError } = await supabaseClient
      .from('picks')
      .select('*')
      .eq('id', pickId)
      .single();

    if (fetchError || !pick) {
      logger.error('[createPublishRecordActivity] Pick not found', {
        pickId,
        error: fetchError?.message,
      });
      return { success: false, error: 'Pick not found' };
    }

    // Skip publishing for dry_run mode
    if (publishMode === 'dry_run') {
      logger.info('[createPublishRecordActivity] Dry run mode - skipping publish');
      return { success: true, publishId: 'dry-run' };
    }

    // Determine Discord channel based on tier and tenant
    const discordChannelId = pick.metadata?.discord_channel_id || process.env.DISCORD_DEFAULT_CHANNEL_ID;

    // Create publish record
    const { data: publishRecord, error: publishError } = await supabaseClient
      .from('pick_publish')
      .insert({
        pick_id: pickId,
        tenant_id: pick.tenant_id,
        channel: 'DISCORD',
        status: 'pending',
        discord_channel_id: discordChannelId,
        attempts: 0,
        max_attempts: 3,
        scheduled_for: new Date().toISOString(),
        metadata: {
          publish_mode: publishMode,
          tier: pick.metadata?.tier,
          professional_score: pick.professional_score,
        },
      })
      .select()
      .single();

    if (publishError) {
      logger.error('[createPublishRecordActivity] Publish record creation failed', {
        pickId,
        error: publishError.message,
      });
      return { success: false, error: publishError.message };
    }

    logger.info('[createPublishRecordActivity] Publish record created', {
      pickId,
      publishId: publishRecord.id,
      publishMode,
    });

    return {
      success: true,
      publishId: publishRecord.id,
    };
  } catch (error: any) {
    logger.error('[createPublishRecordActivity] Error creating publish record', {
      pickId,
      error: error.message,
    });
    return {
      success: false,
      error: error.message,
    };
  }
}

// ===== STAGE 6: ALERT DETECTION =====

/**
 * Detect alert conditions for pick
 *
 * Checks for high-priority opportunities:
 * - Injury alerts
 * - Hedge opportunities
 * - Middle opportunities
 * - Steam moves
 * - CLV milestones
 */
export async function detectAlertConditionsActivity(
  pickId: string
): Promise<AlertDetectionResult> {
  try {
    logger.info('[detectAlertConditionsActivity] Detecting alert conditions', {
      pickId,
    });

    // Fetch pick data
    const { data: pick, error: fetchError } = await supabaseClient
      .from('picks')
      .select('*')
      .eq('id', pickId)
      .single();

    if (fetchError || !pick) {
      logger.warn('[detectAlertConditionsActivity] Pick not found', {
        pickId,
        error: fetchError?.message,
      });
      return { success: false, error: 'Pick not found' };
    }

    const alerts: AlertDetectionResult['alerts'] = [];

    // Check for high-tier picks (auto-alert S/A tiers)
    if (pick.metadata?.tier === 'S' || pick.metadata?.tier === 'A') {
      alerts.push({
        type: 'steam',
        severity: 'high',
        message: `${pick.metadata?.tier}-tier pick detected: ${pick.metadata?.player_name} ${pick.metadata?.market_type}`,
        metadata: {
          tier: pick.metadata?.tier,
          professional_score: pick.professional_score,
        },
      });
    }

    // Check for CLV milestone (>5%)
    if (pick.professional_score && pick.professional_score >= 4.0) {
      alerts.push({
        type: 'clv_milestone',
        severity: 'medium',
        message: `High-value pick detected: Expected CLV >5%`,
        metadata: {
          professional_score: pick.professional_score,
        },
      });
    }

    logger.info('[detectAlertConditionsActivity] Alert detection completed', {
      pickId,
      alertCount: alerts.length,
    });

    return {
      success: true,
      alerts,
    };
  } catch (error: any) {
    logger.error('[detectAlertConditionsActivity] Error detecting alerts', {
      pickId,
      error: error.message,
    });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Create alert records in database
 *
 * Inserts alerts into alerts table.
 * AlertAgent subscribes to this table for real-time notifications.
 */
export async function createAlertRecordsActivity(
  alerts: Array<{
    type: string;
    severity: string;
    message: string;
    metadata?: Record<string, any>;
  }>
): Promise<void> {
  try {
    logger.info('[createAlertRecordsActivity] Creating alert records', {
      count: alerts.length,
    });

    // Insert alerts (batch operation)
    const alertRecords = alerts.map((alert) => ({
      alert_type: alert.type,
      severity: alert.severity,
      message: alert.message,
      status: 'active',
      metadata: alert.metadata,
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabaseClient.from('alerts').insert(alertRecords);

    if (error) {
      logger.error('[createAlertRecordsActivity] Alert creation failed', {
        error: error.message,
      });
      throw error;
    }

    logger.info('[createAlertRecordsActivity] Alerts created successfully', {
      count: alerts.length,
    });
  } catch (error: any) {
    logger.error('[createAlertRecordsActivity] Error creating alerts', {
      error: error.message,
    });
    throw error;
  }
}

// ===== COMPENSATING ACTIONS =====

/**
 * Delete canonical pick (compensation)
 */
export async function deleteCanonicalPickActivity(pickId: string): Promise<void> {
  try {
    logger.info('[deleteCanonicalPickActivity] Deleting pick (compensation)', {
      pickId,
    });

    const { error } = await supabaseClient.from('picks').delete().eq('id', pickId);

    if (error) {
      logger.error('[deleteCanonicalPickActivity] Deletion failed', {
        pickId,
        error: error.message,
      });
      throw error;
    }

    logger.info('[deleteCanonicalPickActivity] Pick deleted', { pickId });
  } catch (error: any) {
    logger.error('[deleteCanonicalPickActivity] Error deleting pick', {
      pickId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Clear grading data (compensation)
 */
export async function clearGradingDataActivity(pickId: string): Promise<void> {
  try {
    logger.info('[clearGradingDataActivity] Clearing grading data (compensation)', {
      pickId,
    });

    const { error } = await supabaseClient
      .from('picks')
      .update({
        professional_score: null,
        confidence: null,
        grading_status: 'pending',
        graded_at: null,
      })
      .eq('id', pickId);

    if (error) {
      logger.error('[clearGradingDataActivity] Clear failed', {
        pickId,
        error: error.message,
      });
      throw error;
    }

    logger.info('[clearGradingDataActivity] Grading data cleared', { pickId });
  } catch (error: any) {
    logger.error('[clearGradingDataActivity] Error clearing grading', {
      pickId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Remove CLV tracking (compensation)
 */
export async function removeCLVTrackingActivity(clvTrackingId: string): Promise<void> {
  try {
    logger.info('[removeCLVTrackingActivity] Removing CLV tracking (compensation)', {
      clvTrackingId,
    });

    const { error } = await supabaseClient.from('clv_tracking').delete().eq('id', clvTrackingId);

    if (error) {
      logger.error('[removeCLVTrackingActivity] Removal failed', {
        clvTrackingId,
        error: error.message,
      });
      throw error;
    }

    logger.info('[removeCLVTrackingActivity] CLV tracking removed', {
      clvTrackingId,
    });
  } catch (error: any) {
    logger.error('[removeCLVTrackingActivity] Error removing CLV tracking', {
      clvTrackingId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Cancel publish record (compensation)
 */
export async function cancelPublishRecordActivity(publishId: string): Promise<void> {
  try {
    logger.info('[cancelPublishRecordActivity] Cancelling publish record (compensation)', {
      publishId,
    });

    const { error } = await supabaseClient
      .from('pick_publish')
      .update({
        status: 'cancelled',
      })
      .eq('id', publishId);

    if (error) {
      logger.error('[cancelPublishRecordActivity] Cancellation failed', {
        publishId,
        error: error.message,
      });
      throw error;
    }

    logger.info('[cancelPublishRecordActivity] Publish record cancelled', {
      publishId,
    });
  } catch (error: any) {
    logger.error('[cancelPublishRecordActivity] Error cancelling publish', {
      publishId,
      error: error.message,
    });
    throw error;
  }
}

// ===== METRICS =====

/**
 * Emit workflow metrics to Prometheus
 */
export async function emitTicketLifecycleMetricsActivity(
  metrics: TicketLifecycleMetrics
): Promise<void> {
  try {
    logger.info('[emitTicketLifecycleMetricsActivity] Emitting workflow metrics', metrics);

    // Import metrics server
    const {
      workflowExecutionDuration,
      workflowExecutionTotal,
      professionalScoreDistribution,
    } = require('../../services/metricsServer');

    // Emit duration metric
    workflowExecutionDuration.observe(
      {
        workflow_type: 'ticket_lifecycle',
        source: metrics.source,
        success: metrics.success !== false,
      },
      metrics.duration / 1000 // Convert to seconds
    );

    // Emit execution count
    workflowExecutionTotal.inc({
      workflow_type: 'ticket_lifecycle',
      source: metrics.source,
      status: metrics.success !== false ? 'success' : 'failed',
      failure_stage: metrics.failureStage || 'none',
    });

    // Emit professional score distribution
    if (metrics.professionalScore) {
      professionalScoreDistribution.observe(
        {
          tier: metrics.tier || 'unknown',
          source: metrics.source,
        },
        metrics.professionalScore
      );
    }

    logger.info('[emitTicketLifecycleMetricsActivity] Metrics emitted successfully');
  } catch (error: any) {
    logger.error('[emitTicketLifecycleMetricsActivity] Error emitting metrics', {
      error: error.message,
      metrics,
    });
    // Don't throw - metric emission failure shouldn't fail the workflow
  }
}
