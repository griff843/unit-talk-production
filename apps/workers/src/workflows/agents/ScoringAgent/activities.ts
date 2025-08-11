/**
 * ScoringAgent Activities - Temporal activity implementations
 * 
 * Activities for the MLB settlement pipeline workflow.
 * These functions run outside the workflow sandbox and can make external API calls.
 */

import { logger } from '../../../utils/logger';
import { selectUnsettledPicks as selectPicksFromQueue, type UnsettledPick } from './queue';
import { resolveGamePk, lookupPlayerStat } from './adapters/mlb.statsapi';
import { findESPNGameId, lookupPlayerStatESPN } from './adapters/mlb.espn';
import { computeMLBSettlement, validateMLBMarket } from './compute/mlb';
import { 
  writeSettlement, 
  updateSettlementHeartbeat as updateHeartbeatWriter,
  type WriteResult,
  type HeartbeatUpdate 
} from './writer';

export interface SelectUnsettledPicksParams {
  league: string;
  limit: number;
  lookbackHours: number;
  finalBufferMinutes: number;
}

export interface GradePickParams {
  pick: UnsettledPick;
  dryRun?: boolean;
}

export interface GradePickResult {
  success: boolean;
  actual?: number;
  result?: 'WIN' | 'LOSS' | 'PUSH';
  source?: string;
  error?: string;
  details?: any;
  skipped?: boolean;
}

export interface EnvironmentConfig {
  SCORING_ENABLED: boolean;
  SCORING_BATCH_SIZE: number;
  SCORING_FINAL_BUFFER_MIN: number;
  MLB_STATSAPI_BASE: string;
  MLB_HTTP_TIMEOUT_MS: number;
  MLB_HTTP_RETRIES: number;
  ESPN_BASE: string;
}

/**
 * Get environment configuration for the scoring pipeline
 */
export async function getEnvironmentConfig(): Promise<EnvironmentConfig> {
  return {
    SCORING_ENABLED: process.env.SCORING_ENABLED === 'true',
    SCORING_BATCH_SIZE: parseInt(process.env.SCORING_BATCH_SIZE || '200'),
    SCORING_FINAL_BUFFER_MIN: parseInt(process.env.SCORING_FINAL_BUFFER_MIN || '20'),
    MLB_STATSAPI_BASE: process.env.MLB_STATSAPI_BASE || 'https://statsapi.mlb.com',
    MLB_HTTP_TIMEOUT_MS: parseInt(process.env.MLB_HTTP_TIMEOUT_MS || '8000'),
    MLB_HTTP_RETRIES: parseInt(process.env.MLB_HTTP_RETRIES || '3'),
    ESPN_BASE: process.env.ESPN_BASE || 'https://site.api.espn.com'
  };
}

/**
 * Select unsettled picks ready for grading
 */
export async function selectUnsettledPicks(params: SelectUnsettledPicksParams): Promise<UnsettledPick[]> {
  logger.info('Selecting unsettled picks', params);
  
  try {
    const picks = await selectPicksFromQueue(params);
    
    logger.info('Selected unsettled picks', { 
      count: picks.length, 
      league: params.league 
    });
    
    return picks;
    
  } catch (error) {
    logger.error('Error selecting unsettled picks', {
      error: error instanceof Error ? error.message : String(error),
      params
    });
    throw error;
  }
}

/**
 * Grade a single pick using MLB data sources
 */
export async function gradePick(params: GradePickParams): Promise<GradePickResult> {
  const { pick, dryRun = false } = params;
  
  logger.debug('Grading pick', {
    pickId: pick.id,
    player: pick.player,
    market: pick.market,
    line: pick.line,
    dryRun
  });

  try {
    // Validate market type
    const marketValidation = validateMLBMarket(pick.market);
    if (!marketValidation.valid) {
      return {
        success: false,
        error: marketValidation.error,
        skipped: true
      };
    }

    // Try to resolve game context
    let gamePk: number | undefined;
    let gameContext: any = {};

    if (pick.external_game_id && /^\d+$/.test(pick.external_game_id)) {
      gamePk = parseInt(pick.external_game_id);
      gameContext.gamePk = gamePk;
    } else if (pick.home_team && pick.away_team && pick.game_start_time) {
      const gameResolution = await resolveGamePk({
        home_team: pick.home_team,
        away_team: pick.away_team,
        game_start_time: pick.game_start_time
      });

      if (gameResolution.found) {
        gamePk = gameResolution.gamePk;
        gameContext = {
          gamePk,
          status: gameResolution.status,
          homeTeam: gameResolution.homeTeam,
          awayTeam: gameResolution.awayTeam
        };
      }
    }

    if (!gamePk) {
      return {
        success: false,
        error: 'Could not resolve MLB game ID',
        skipped: true
      };
    }

    // Try MLB StatsAPI first (primary source)
    let statResult = await lookupPlayerStat(
      gamePk,
      pick.player,
      pick.market,
      pick.team
    );

    let source = 'mlb_statsapi';
    
    // Fallback to ESPN if StatsAPI fails
    if (!statResult.found) {
      logger.info('StatsAPI failed, trying ESPN fallback', {
        pickId: pick.id,
        gamePk,
        error: statResult.error
      });

      const espnGameResult = await findESPNGameId(
        pick.home_team || gameContext.homeTeam,
        pick.away_team || gameContext.awayTeam,
        pick.game_start_time || pick.event_time
      );

      if (espnGameResult.found && espnGameResult.gameId) {
        const espnStatResult = await lookupPlayerStatESPN(
          espnGameResult.gameId,
          pick.player,
          pick.market,
          pick.team
        );

        if (espnStatResult.found && espnStatResult.actualValue !== undefined) {
          statResult = {
            found: true,
            actualValue: espnStatResult.actualValue,
            playerName: espnStatResult.playerName,
            teamSide: espnStatResult.teamSide
          };
          source = 'espn_fallback';
          gameContext.espnGameId = espnGameResult.gameId;
        }
      }
    }

    if (!statResult.found || statResult.actualValue === undefined) {
      return {
        success: false,
        error: `No stat data found: ${statResult.error || 'Unknown error'}`,
        details: { source, gameContext, statResult }
      };
    }

    // Compute settlement result
    const settlement = computeMLBSettlement({
      market: pick.market,
      line: pick.line,
      actualValue: statResult.actualValue,
      direction: 'OVER', // Assume OVER for now - could be enhanced to parse from pick data
      book: pick.book
    });

    // Write settlement to database
    const writeResult: WriteResult = await writeSettlement({
      pickId: pick.id,
      actualResult: settlement.actualValue,
      result: settlement.result,
      settlementSource: source,
      settlementDetails: {
        adapter: source,
        gamePk: gamePk,
        gameId: pick.game_id,
        teams: gameContext.homeTeam ? {
          home: gameContext.homeTeam,
          away: gameContext.awayTeam
        } : undefined,
        playerStats: {
          playerName: statResult.playerName,
          playerId: statResult.playerId,
          teamSide: statResult.teamSide,
          rawStats: statResult.rawStats
        },
        market: pick.market,
        line: pick.line,
        direction: settlement.direction,
        confidence: settlement.confidence,
        computedAt: new Date().toISOString(),
        notes: settlement.notes
      },
      dryRun
    });

    if (!writeResult.success) {
      return {
        success: false,
        error: `Write failed: ${writeResult.error}`,
        actual: settlement.actualValue,
        result: settlement.result,
        details: { writeResult, settlement }
      };
    }

    logger.info('Pick graded successfully', {
      pickId: pick.id,
      player: pick.player,
      market: pick.market,
      line: pick.line,
      actual: settlement.actualValue,
      result: settlement.result,
      source,
      alreadySettled: writeResult.alreadySettled
    });

    return {
      success: true,
      actual: settlement.actualValue,
      result: settlement.result,
      source,
      details: {
        settlement,
        writeResult,
        gameContext,
        playerStats: statResult
      }
    };

  } catch (error) {
    logger.error('Error grading pick', {
      pickId: pick.id,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Update settlement pipeline heartbeat
 */
export async function updateSettlementHeartbeat(params: HeartbeatUpdate): Promise<void> {
  logger.debug('Updating settlement heartbeat', params);
  
  try {
    const result = await updateHeartbeatWriter(params);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to update heartbeat');
    }
    
    logger.debug('Heartbeat updated successfully', { pipelineName: params.pipelineName });
    
  } catch (error) {
    logger.error('Error updating settlement heartbeat', {
      pipelineName: params.pipelineName,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Health check activity for monitoring
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  timestamp: string;
  version: string;
  environment: string;
}> {
  return {
    healthy: true,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  };
}