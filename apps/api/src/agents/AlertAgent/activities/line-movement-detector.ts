/**
 * Line Movement Detector Activity
 *
 * Detects and analyzes line movements from real-time prop data ingestion.
 * Triggers alerts for significant line changes, velocity calculations, and arbitrage opportunities.
 *
 * Phase 7: AlertAgent Integration for Real-Time Line Movement Alerts
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../../shared/logger/types';
import { requireSupabase } from '../../../utils/supabaseUtils';
import { withCircuitBreaker } from '../../../services/enhanced-circuit-breaker';

export interface LineMovementResult {
  propId: string;
  externalPropId: string;
  playerName: string;
  market: string;
  sport: string;
  bookmaker: string;
  oldLine: number;
  newLine: number;
  lineChange: number;
  lineVelocity: number; // Points moved per minute
  timeElapsed: number; // Minutes since previous prop
  odds: number;
  overOdds: number | null;
  underOdds: number | null;
  gameDate: string;
  team: string;
  opponent: string;
  alertPriority: 'low' | 'medium' | 'high' | 'critical';
  metadata: Record<string, any>;
}

export interface LineMovementThresholds {
  minLineChange: number; // Minimum line change to trigger alert (e.g., 2.0 points)
  criticalLineChange: number; // Critical line change threshold (e.g., 5.0 points)
  highVelocityThreshold: number; // High velocity threshold (e.g., 1.0 point/min)
  lookbackMinutes: number; // How far back to look for previous lines (e.g., 60 minutes)
}

const DEFAULT_THRESHOLDS: LineMovementThresholds = {
  minLineChange: 2.0,
  criticalLineChange: 5.0,
  highVelocityThreshold: 1.0,
  lookbackMinutes: 60,
};

/**
 * Detect line movements from newly inserted raw_props records
 */
export async function detectLineMovements(
  newProp: any,
  logger: Logger,
  thresholds: Partial<LineMovementThresholds> = {}
): Promise<LineMovementResult | null> {
  const startTime = Date.now();
  const config = { ...DEFAULT_THRESHOLDS, ...thresholds };

  try {
    logger.info('🔍 Analyzing line movement for new prop', {
      propId: newProp.id,
      externalPropId: newProp.external_prop_id,
      playerName: newProp.player_name,
      market: newProp.stat_type,
      line: newProp.line,
      alertMode: newProp.metadata?.alert_mode,
    });

    // Query previous prop with same external_prop_id base (player + market)
    const previousProp = await getPreviousProp(newProp, config.lookbackMinutes, logger);

    if (!previousProp) {
      logger.debug('No previous prop found for comparison', {
        externalPropId: newProp.external_prop_id,
        playerName: newProp.player_name,
      });
      return null;
    }

    // Calculate line change
    const lineChange = Math.abs(newProp.line - previousProp.line);

    // Check if line change meets minimum threshold
    if (lineChange < config.minLineChange) {
      logger.debug('Line change below threshold', {
        lineChange,
        threshold: config.minLineChange,
        playerName: newProp.player_name,
      });
      return null;
    }

    // Calculate time elapsed and velocity
    const timeElapsed = calculateTimeElapsed(previousProp.created_at, newProp.created_at);
    const lineVelocity = timeElapsed > 0 ? lineChange / timeElapsed : 0;

    // Determine alert priority
    const alertPriority = determineAlertPriority(lineChange, lineVelocity, config);

    const result: LineMovementResult = {
      propId: newProp.id,
      externalPropId: newProp.external_prop_id,
      playerName: newProp.player_name,
      market: newProp.stat_type,
      sport: newProp.sport,
      bookmaker: newProp.bookmaker_key,
      oldLine: previousProp.line,
      newLine: newProp.line,
      lineChange,
      lineVelocity,
      timeElapsed,
      odds: newProp.odds,
      overOdds: newProp.over_odds,
      underOdds: newProp.under_odds,
      gameDate: newProp.game_date,
      team: newProp.team,
      opponent: newProp.opponent,
      alertPriority,
      metadata: {
        bookmakerTitle: newProp.bookmaker_title,
        matchup: newProp.matchup,
        previousPropId: previousProp.id,
        pollingCycle: newProp.metadata?.poll_count,
        source: newProp.metadata?.source || 'alert_polling',
      },
    };

    const processingTime = Date.now() - startTime;
    logger.info('✅ Line movement detected', {
      playerName: result.playerName,
      market: result.market,
      oldLine: result.oldLine,
      newLine: result.newLine,
      lineChange: result.lineChange,
      lineVelocity: result.lineVelocity.toFixed(2),
      alertPriority: result.alertPriority,
      processingTimeMs: processingTime,
    });

    return result;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('❌ Error detecting line movement', {
      propId: newProp.id,
      playerName: newProp.player_name,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs: processingTime,
    });
    return null;
  }
}

/**
 * Get previous prop for the same player and market
 */
async function getPreviousProp(
  newProp: any,
  lookbackMinutes: number,
  logger: Logger
): Promise<any | null> {
  try {
    const supabase = requireSupabase();
    const lookbackTime = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();

    // Extract base external_prop_id without bookmaker suffix
    const baseExternalPropId = newProp.external_prop_id
      ? newProp.external_prop_id.split('_').slice(0, -1).join('_') // Remove bookmaker suffix
      : `${newProp.external_game_id}_${newProp.stat_type}_${newProp.player_name}`;

    const { data, error } = await withCircuitBreaker.supabase(
      async () => {
        return await supabase
          .from('raw_props')
          .select('*')
          .eq('player_name', newProp.player_name)
          .eq('stat_type', newProp.stat_type)
          .eq('bookmaker_key', newProp.bookmaker_key)
          .neq('id', newProp.id) // Exclude current prop
          .gte('created_at', lookbackTime)
          .order('created_at', { ascending: false })
          .limit(1);
      },
      async () => {
        logger.warn('Circuit breaker open, unable to fetch previous prop');
        return { data: null, error: new Error('Circuit breaker open') };
      }
    );

    if (error) {
      logger.warn('Failed to fetch previous prop', {
        error: error.message,
        playerName: newProp.player_name,
      });
      return null;
    }

    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    logger.error('Error fetching previous prop', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Calculate time elapsed in minutes between two timestamps
 */
function calculateTimeElapsed(previousTime: string, currentTime: string): number {
  const prevDate = new Date(previousTime);
  const currDate = new Date(currentTime);
  const elapsedMs = currDate.getTime() - prevDate.getTime();
  return elapsedMs / (1000 * 60); // Convert to minutes
}

/**
 * Determine alert priority based on line change and velocity
 */
function determineAlertPriority(
  lineChange: number,
  lineVelocity: number,
  config: LineMovementThresholds
): 'low' | 'medium' | 'high' | 'critical' {
  // Critical: Major line move or extremely fast velocity
  if (lineChange >= config.criticalLineChange || lineVelocity >= config.highVelocityThreshold * 2) {
    return 'critical';
  }

  // High: Significant line move or high velocity
  if (
    lineChange >= config.criticalLineChange * 0.7 ||
    lineVelocity >= config.highVelocityThreshold
  ) {
    return 'high';
  }

  // Medium: Moderate line move
  if (lineChange >= config.minLineChange * 1.5) {
    return 'medium';
  }

  // Low: Just above minimum threshold
  return 'low';
}

/**
 * Batch detect line movements for multiple new props
 */
export async function detectBatchLineMovements(
  newProps: any[],
  logger: Logger,
  thresholds: Partial<LineMovementThresholds> = {}
): Promise<LineMovementResult[]> {
  const results: LineMovementResult[] = [];

  for (const prop of newProps) {
    const result = await detectLineMovements(prop, logger, thresholds);
    if (result) {
      results.push(result);
    }
  }

  return results;
}

/**
 * Store line movement detection in database for historical tracking
 */
export async function storeLineMovementDetection(
  movement: LineMovementResult,
  logger: Logger
): Promise<void> {
  try {
    const supabase = requireSupabase();

    await withCircuitBreaker.supabase(
      async () => {
        const { error } = await supabase.from('line_movements').insert({
          prop_id: movement.propId,
          external_prop_id: movement.externalPropId,
          player_name: movement.playerName,
          market: movement.market,
          sport: movement.sport,
          bookmaker: movement.bookmaker,
          old_line: movement.oldLine,
          new_line: movement.newLine,
          line_change: movement.lineChange,
          line_velocity: movement.lineVelocity,
          time_elapsed_minutes: movement.timeElapsed,
          alert_priority: movement.alertPriority,
          game_date: movement.gameDate,
          metadata: movement.metadata,
          detected_at: new Date().toISOString(),
        });

        if (error) {
          throw new Error(`Failed to store line movement: ${error.message}`);
        }

        logger.info('✅ Line movement stored in database', {
          propId: movement.propId,
          playerName: movement.playerName,
          lineChange: movement.lineChange,
        });
      },
      async () => {
        logger.warn('Failed to store line movement, circuit breaker open', {
          propId: movement.propId,
        });
      }
    );
  } catch (error) {
    logger.error('Error storing line movement detection', {
      propId: movement.propId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
