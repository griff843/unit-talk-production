"use strict";
// src/agents/PlayerEnrichmentAgent/activities.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichAllPlayersActivity = enrichAllPlayersActivity;
exports.enrichPlayerByIdActivity = enrichPlayerByIdActivity;
exports.getPlayerHeadshotActivity = getPlayerHeadshotActivity;
exports.getMlbHeadshotActivity = getMlbHeadshotActivity;
exports.getNbaHeadshotActivity = getNbaHeadshotActivity;
exports.getNflHeadshotActivity = getNflHeadshotActivity;
exports.getNhlHeadshotActivity = getNhlHeadshotActivity;
const logger_1 = require("../../utils/logger");
const mlbEnrichment_1 = require("../enrichment/mlbEnrichment");
const nbaEnrichment_1 = require("../enrichment/nbaEnrichment");
const nflEnrichment_1 = require("../enrichment/nflEnrichment");
const nhlEnrichment_1 = require("../enrichment/nhlEnrichment");
const PlayerEnrichmentAgent_1 = require("../PlayerEnrichmentAgent");
/**
 * Activity to enrich all players missing headshots
 * Supports optional league filtering
 */
async function enrichAllPlayersActivity(params) {
    try {
        const { league } = params;
        const logMessage = league
            ? `Starting ${league} player enrichment activity`
            : 'Starting multi-league player enrichment activity';
        logger_1.logger.info(logMessage, {
            activityId: params.activityId,
            league: league || 'ALL'
        });
        const summary = await (0, PlayerEnrichmentAgent_1.enrichAllPlayers)(league);
        logger_1.logger.info('Player enrichment activity completed', {
            activityId: params.activityId,
            league: league || 'ALL',
            summary: {
                totalProcessed: summary.totalProcessed,
                successful: summary.successfulEnrichments,
                notFound: summary.notFound,
                errors: summary.errors,
                leagueBreakdown: summary.leagueBreakdown
            }
        });
        if (summary.errors > 0) {
            logger_1.logger.warn('Player enrichment completed with errors', {
                activityId: params.activityId,
                errorDetails: summary.errorDetails
            });
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error('Player enrichment activity failed', {
            activityId: params.activityId,
            err: errorMessage
        });
        throw error;
    }
}
/**
 * Activity to enrich a specific player by ID
 */
async function enrichPlayerByIdActivity(params) {
    try {
        const { playerId } = params;
        logger_1.logger.info('Starting player enrichment by ID activity', {
            activityId: params.activityId,
            playerId
        });
        const result = await (0, PlayerEnrichmentAgent_1.enrichPlayerById)(playerId);
        if (result) {
            logger_1.logger.info('Player enrichment by ID completed successfully', {
                activityId: params.activityId,
                playerId
            });
        }
        else {
            logger_1.logger.warn('Player enrichment by ID failed - player not found or no headshot available', {
                activityId: params.activityId,
                playerId
            });
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error('Player enrichment by ID activity failed', {
            activityId: params.activityId,
            playerId: params.playerId,
            err: errorMessage
        });
        throw error;
    }
}
/**
 * Activity to get headshot for a specific player and league
 */
async function getPlayerHeadshotActivity(params) {
    try {
        const { playerName, league } = params;
        logger_1.logger.info(`Starting ${league} headshot retrieval activity`, {
            activityId: params.activityId,
            playerName,
            league
        });
        let result = null;
        switch (league) {
            case 'MLB':
                result = await (0, mlbEnrichment_1.getMlbHeadshot)(playerName);
                break;
            case 'NBA':
                result = await (0, nbaEnrichment_1.getNbaHeadshot)(playerName);
                break;
            case 'NFL':
                result = await (0, nflEnrichment_1.getNflHeadshot)(playerName);
                break;
            case 'NHL':
                result = await (0, nhlEnrichment_1.getNhlHeadshot)(playerName);
                break;
            default:
                throw new Error(`Unsupported league: ${league}`);
        }
        if (result) {
            logger_1.logger.info(`${league} headshot retrieval completed successfully`, {
                activityId: params.activityId,
                playerName,
                league,
                headshotUrl: result
            });
        }
        else {
            logger_1.logger.warn(`No ${league} headshot found for player`, {
                activityId: params.activityId,
                playerName,
                league
            });
        }
        return result;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error(`${params.league} headshot retrieval activity failed`, {
            activityId: params.activityId,
            playerName: params.playerName,
            league: params.league,
            error: errorMessage
        });
        throw error;
    }
}
// Legacy activities for backward compatibility
async function getMlbHeadshotActivity(params) {
    return getPlayerHeadshotActivity({
        ...params,
        league: 'MLB'
    });
}
async function getNbaHeadshotActivity(params) {
    return getPlayerHeadshotActivity({
        ...params,
        league: 'NBA'
    });
}
async function getNflHeadshotActivity(params) {
    return getPlayerHeadshotActivity({
        ...params,
        league: 'NFL'
    });
}
async function getNhlHeadshotActivity(params) {
    return getPlayerHeadshotActivity({
        ...params,
        league: 'NHL'
    });
}
