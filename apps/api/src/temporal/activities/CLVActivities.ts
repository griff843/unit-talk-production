/**
 * CLV (Closing Line Value) Temporal Activities
 *
 * Activities for automated closing line fetching and CLV calculation.
 * These activities are used by the CLVUpdateWorkflow to automatically
 * update CLV for submitted picks.
 *
 * Phase 2 - CLV Automation
 */

import { createLogger } from '../../utils/logger';
import { supabaseClient } from '../../services/supabaseClient';
import { clvTrackingService, CLVEntry } from '../../services/clv/CLVTrackingService';
import axios from 'axios';
import {
  clvCoveragePercent,
  clvDistributionHistogram,
  clvBeatingClosingLineTotal,
  clvClosingLineFetchTotal,
  clvClosingLineFreshness,
  clvPendingUpdatesGauge,
  clvAvgPercentage,
} from '../../services/metricsServer';

const logger = createLogger('CLVActivities');

export interface PendingCLVPick {
  pick_id: string;
  tenant_id: string;
  prop_id?: string;
  player_name?: string;
  stat_type?: string;
  sport?: string;
  game_time?: string;
  submitted_line: number;
  submitted_odds: number;
  submitted_at: string;
  book?: string;
}

export interface ClosingLineData {
  pickId: string;
  closingLine: number;
  closingOdds: number;
  source: 'odds_api' | 'optimal_api' | 'manual';
  fetchedAt: string;
}

export interface CLVUpdateResult {
  pickId: string;
  success: boolean;
  clvPercentage?: number;
  beatClosingLine?: boolean;
  error?: string;
}

export interface CLVCycleMetrics {
  picksQueried: number;
  closingLinesFetched: number;
  clvUpdatesSuccessful: number;
  clvUpdatesFailed: number;
  clvCoveragePercent: number;
  avgClvPercentage: number;
  beatClosingLineCount: number;
  cycleDurationSeconds: number;
}

/**
 * Query for picks that need CLV updates
 *
 * Looks for picks where:
 * 1. Game has started or is within 15 minutes of start time
 * 2. CLV tracking exists but closing_line is NULL
 * 3. Pick is not too old (within last 7 days)
 */
export async function queryPendingCLVActivity(): Promise<PendingCLVPick[]> {
  try {
    logger.info('[CLVActivities] Querying for pending CLV updates');

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Query picks that need CLV calculation
    // Join clv_tracking with picks to get game/prop information
    const { data, error } = await supabaseClient
      .from('clv_tracking')
      .select(`
        id,
        pick_id,
        tenant_id,
        submitted_line,
        submitted_odds,
        submitted_at,
        bookmaker,
        metadata
      `)
      .is('closing_line', null) // No closing line yet
      .gte('submitted_at', sevenDaysAgo.toISOString()) // Not too old
      .limit(100); // Process in batches

    if (error) {
      logger.error('[CLVActivities] Failed to query pending CLV', { error: error.message });
      throw error;
    }

    if (!data || data.length === 0) {
      logger.info('[CLVActivities] No pending CLV updates found');
      return [];
    }

    // Transform to PendingCLVPick format
    const pendingPicks: PendingCLVPick[] = data.map((row: any) => ({
      pick_id: row.pick_id,
      tenant_id: row.tenant_id,
      submitted_line: row.submitted_line,
      submitted_odds: row.submitted_odds,
      submitted_at: row.submitted_at,
      book: row.bookmaker,
      // Extract from metadata if available
      prop_id: row.metadata?.prop_id,
      player_name: row.metadata?.player_name,
      stat_type: row.metadata?.stat_type,
      sport: row.metadata?.sport,
      game_time: row.metadata?.game_time,
    }));

    logger.info('[CLVActivities] Found pending CLV updates', { count: pendingPicks.length });

    // Emit metric for pending updates
    clvPendingUpdatesGauge.set(pendingPicks.length);

    return pendingPicks;
  } catch (error: any) {
    logger.error('[CLVActivities] Error querying pending CLV', { error: error.message });
    throw error;
  }
}

/**
 * Fetch closing line from Odds API or Optimal API
 *
 * Priority:
 * 1. Odds API (if configured and available)
 * 2. Optimal API (fallback)
 * 3. Return null if neither available
 */
export async function fetchClosingLineActivity(
  pick: PendingCLVPick
): Promise<ClosingLineData | null> {
  try {
    logger.info('[CLVActivities] Fetching closing line', { pickId: pick.pick_id });

    // Check if game has started (only fetch closing lines after game starts)
    if (pick.game_time) {
      const gameTime = new Date(pick.game_time);
      const now = new Date();

      // Only fetch if game started or is within 15 minutes of starting
      if (now.getTime() < gameTime.getTime() - 15 * 60 * 1000) {
        logger.debug('[CLVActivities] Game has not started yet, skipping', {
          pickId: pick.pick_id,
          gameTime: pick.game_time,
        });
        return null;
      }
    }

    // Try Odds API first
    const oddsApiResult = await fetchFromOddsAPI(pick);
    if (oddsApiResult) {
      clvClosingLineFetchTotal.inc({ source: 'odds_api', status: 'success' });
      return oddsApiResult;
    }

    // Fallback to Optimal API
    const optimalApiResult = await fetchFromOptimalAPI(pick);
    if (optimalApiResult) {
      clvClosingLineFetchTotal.inc({ source: 'optimal_api', status: 'success' });
      return optimalApiResult;
    }

    // If neither API has data, log warning
    logger.warn('[CLVActivities] No closing line data available from any source', {
      pickId: pick.pick_id,
    });
    clvClosingLineFetchTotal.inc({ source: 'both', status: 'no_data' });
    return null;
  } catch (error: any) {
    logger.error('[CLVActivities] Error fetching closing line', {
      pickId: pick.pick_id,
      error: error.message,
    });
    // Don't throw - return null so workflow can continue
    return null;
  }
}

/**
 * Fetch closing line from Odds API
 */
async function fetchFromOddsAPI(pick: PendingCLVPick): Promise<ClosingLineData | null> {
  try {
    const oddsApiKey = process.env.ODDS_API_KEY;
    if (!oddsApiKey) {
      logger.debug('[CLVActivities] Odds API key not configured');
      return null;
    }

    // Build Odds API query based on pick details
    // This is a simplified implementation - actual implementation would need
    // to map player names, stat types, etc. to Odds API parameters
    const sport = pick.sport?.toLowerCase() || 'baseball';
    const market = mapStatTypeToOddsApiMarket(pick.stat_type);

    if (!market) {
      logger.debug('[CLVActivities] Cannot map stat type to Odds API market', {
        statType: pick.stat_type,
      });
      return null;
    }

    // Query Odds API for current odds (which become closing odds after game starts)
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds`;
    const params = {
      apiKey: oddsApiKey,
      regions: 'us',
      markets: market,
      oddsFormat: 'american',
    };

    const response = await axios.get(url, { params, timeout: 5000 });

    // Parse response and extract closing line
    // This is simplified - production would need robust parsing
    const closingData = parseOddsAPIResponse(response.data, pick);

    if (closingData) {
      logger.info('[CLVActivities] Fetched closing line from Odds API', {
        pickId: pick.pick_id,
        closingLine: closingData.closingLine,
      });
      return {
        ...closingData,
        source: 'odds_api',
        fetchedAt: new Date().toISOString(),
      };
    }

    return null;
  } catch (error: any) {
    logger.warn('[CLVActivities] Odds API fetch failed', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Fetch closing line from Optimal API
 */
async function fetchFromOptimalAPI(pick: PendingCLVPick): Promise<ClosingLineData | null> {
  try {
    const optimalApiKey = process.env.OPTIMAL_API_KEY;
    if (!optimalApiKey) {
      logger.debug('[CLVActivities] Optimal API key not configured');
      return null;
    }

    // Query Optimal API
    // This is a placeholder - actual implementation would use the Optimal API client
    // from apps/api/src/agents/FeedAgent/optimal.ts

    logger.debug('[CLVActivities] Optimal API integration not yet implemented');
    return null;
  } catch (error: any) {
    logger.warn('[CLVActivities] Optimal API fetch failed', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Update CLV tracking with closing line data
 */
export async function updateCLVActivity(
  closingLineData: ClosingLineData
): Promise<CLVUpdateResult> {
  try {
    logger.info('[CLVActivities] Updating CLV', { pickId: closingLineData.pickId });

    // Call CLVTrackingService to update
    const updatedEntry = await clvTrackingService.updateClosingLine(
      closingLineData.pickId,
      closingLineData.closingLine,
      closingLineData.closingOdds
    );

    logger.info('[CLVActivities] CLV updated successfully', {
      pickId: closingLineData.pickId,
      clvPercentage: updatedEntry.clvPercentage,
      beatClosingLine: updatedEntry.beatsClosing,
    });

    // Emit metrics
    if (updatedEntry.clvPercentage !== null && updatedEntry.clvPercentage !== undefined) {
      clvDistributionHistogram.observe(updatedEntry.clvPercentage);
    }
    if (updatedEntry.beatsClosing) {
      clvBeatingClosingLineTotal.inc();
    }

    // Update freshness metric
    clvClosingLineFreshness.observe(0); // Just updated, so freshness is 0

    return {
      pickId: closingLineData.pickId,
      success: true,
      clvPercentage: updatedEntry.clvPercentage,
      beatClosingLine: updatedEntry.beatsClosing,
    };
  } catch (error: any) {
    logger.error('[CLVActivities] Failed to update CLV', {
      pickId: closingLineData.pickId,
      error: error.message,
    });

    return {
      pickId: closingLineData.pickId,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Helper: Map stat type to Odds API market
 */
function mapStatTypeToOddsApiMarket(statType: string | undefined): string | null {
  if (!statType) return null;

  const marketMap: Record<string, string> = {
    points: 'player_points',
    rebounds: 'player_rebounds',
    assists: 'player_assists',
    strikeouts: 'pitcher_strikeouts',
    hits: 'player_hits',
    home_runs: 'player_home_runs',
    // Add more mappings as needed
  };

  return marketMap[statType.toLowerCase()] || null;
}

/**
 * Helper: Parse Odds API response to extract closing line
 */
function parseOddsAPIResponse(
  data: any,
  pick: PendingCLVPick
): { pickId: string; closingLine: number; closingOdds: number } | null {
  try {
    // This is a simplified parser - production would need robust implementation
    // based on actual Odds API response structure

    // For now, return null to indicate parsing not implemented
    return null;
  } catch (error) {
    logger.error('[CLVActivities] Failed to parse Odds API response', { error });
    return null;
  }
}

/**
 * Emit cycle-level metrics
 *
 * Called at the end of each CLV update cycle to emit Prometheus metrics.
 * This must be a separate activity because Temporal workflows cannot directly
 * access Node.js modules like Prometheus.
 */
export async function emitCLVCycleMetricsActivity(metrics: CLVCycleMetrics): Promise<void> {
  try {
    logger.info('[CLVActivities] Emitting CLV cycle metrics', metrics);

    // Emit CLV coverage percentage
    clvCoveragePercent.set(metrics.clvCoveragePercent);

    // Emit average CLV percentage
    clvAvgPercentage.set(metrics.avgClvPercentage);

    // Emit cycle duration
    const {
      clvUpdateCycleDuration,
      clvUpdateCycleTotal,
    } = require('../../services/metricsServer');

    clvUpdateCycleDuration.observe(metrics.cycleDurationSeconds);

    // Determine cycle status
    const status =
      metrics.clvUpdatesFailed === 0
        ? 'success'
        : metrics.clvUpdatesSuccessful > 0
          ? 'partial'
          : 'failed';

    clvUpdateCycleTotal.inc({ status });

    logger.info('[CLVActivities] CLV cycle metrics emitted', { status });
  } catch (error: any) {
    logger.error('[CLVActivities] Failed to emit CLV cycle metrics', {
      error: error.message,
    });
    // Don't throw - metric emission failure shouldn't fail the workflow
  }
}
