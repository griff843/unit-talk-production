// src/agents/PlayerEnrichmentAgent/activities.ts

import { logger } from '../../utils/logger';
import { getMlbHeadshot } from '../enrichment/mlbEnrichment';
import { getNbaHeadshot } from '../enrichment/nbaEnrichment';
import { getNflHeadshot } from '../enrichment/nflEnrichment';
import { getNhlHeadshot } from '../enrichment/nhlEnrichment';
import { enrichAllPlayers, enrichPlayerById, SupportedLeague } from '../PlayerEnrichmentAgent';

import type { ActivityParams } from '../../types/activities';

/**
 * Activity to enrich all players missing headshots
 * Supports optional league filtering
 */
export async function enrichAllPlayersActivity(
  params: ActivityParams & { league?: SupportedLeague }
): Promise<void> {
  try {
    const { league } = params;
    const logMessage = league
      ? `Starting ${league} player enrichment activity`
      : 'Starting multi-league player enrichment activity';

    logger.info(logMessage, {
      activityId: params.activityId,
      league: league || 'ALL',
    });

    const summary = await enrichAllPlayers(league);

    logger.info('Player enrichment activity completed', {
      activityId: params.activityId,
      league: league || 'ALL',
      summary: {
        totalProcessed: summary.totalProcessed,
        successful: summary.successfulEnrichments,
        notFound: summary.notFound,
        errors: summary.errors,
        leagueBreakdown: summary.leagueBreakdown,
      },
    });

    if (summary.errors > 0) {
      logger.warn('Player enrichment completed with errors', {
        activityId: params.activityId,
        errorDetails: summary.errorDetails,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Player enrichment activity failed', {
      activityId: params.activityId,
      err: errorMessage,
    });
    throw error;
  }
}

/**
 * Activity to enrich a specific player by ID
 */
export async function enrichPlayerByIdActivity(
  params: ActivityParams & { playerId: string }
): Promise<void> {
  try {
    const { playerId } = params;

    logger.info('Starting player enrichment by ID activity', {
      activityId: params.activityId,
      playerId,
    });

    const result = await enrichPlayerById(playerId);

    if (result) {
      logger.info('Player enrichment by ID completed successfully', {
        activityId: params.activityId,
        playerId,
      });
    } else {
      logger.warn('Player enrichment by ID failed - player not found or no headshot available', {
        activityId: params.activityId,
        playerId,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Player enrichment by ID activity failed', {
      activityId: params.activityId,
      playerId: params.playerId,
      err: errorMessage,
    });
    throw error;
  }
}

/**
 * Activity to get headshot for a specific player and league
 */
export async function getPlayerHeadshotActivity(
  params: ActivityParams & { playerName: string; league: SupportedLeague }
): Promise<string | null> {
  try {
    const { playerName, league } = params;

    logger.info(`Starting ${league} headshot retrieval activity`, {
      activityId: params.activityId,
      playerName,
      league,
    });

    let result: string | null = null;

    switch (league) {
      case 'MLB':
        result = await getMlbHeadshot(playerName);
        break;
      case 'NBA':
        result = await getNbaHeadshot(playerName);
        break;
      case 'NFL':
        result = await getNflHeadshot(playerName);
        break;
      case 'NHL':
        result = await getNhlHeadshot(playerName);
        break;
      default:
        throw new Error(`Unsupported league: ${league}`);
    }

    if (result) {
      logger.info(`${league} headshot retrieval completed successfully`, {
        activityId: params.activityId,
        playerName,
        league,
        headshotUrl: result,
      });
    } else {
      logger.warn(`No ${league} headshot found for player`, {
        activityId: params.activityId,
        playerName,
        league,
      });
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`${params.league} headshot retrieval activity failed`, {
      activityId: params.activityId,
      playerName: params.playerName,
      league: params.league,
      error: errorMessage,
    });
    throw error;
  }
}

// Legacy activities for backward compatibility
export async function getMlbHeadshotActivity(
  params: ActivityParams & { playerName: string }
): Promise<string | null> {
  return getPlayerHeadshotActivity({
    ...params,
    league: 'MLB',
  });
}

export async function getNbaHeadshotActivity(
  params: ActivityParams & { playerName: string }
): Promise<string | null> {
  return getPlayerHeadshotActivity({
    ...params,
    league: 'NBA',
  });
}

export async function getNflHeadshotActivity(
  params: ActivityParams & { playerName: string }
): Promise<string | null> {
  return getPlayerHeadshotActivity({
    ...params,
    league: 'NFL',
  });
}

export async function getNhlHeadshotActivity(
  params: ActivityParams & { playerName: string }
): Promise<string | null> {
  return getPlayerHeadshotActivity({
    ...params,
    league: 'NHL',
  });
}
