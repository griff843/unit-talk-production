"use strict";
// src/agents/PlayerEnrichmentAgent.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichAllPlayers = enrichAllPlayers;
exports.enrichPlayerById = enrichPlayerById;
const supabase_js_1 = require("@supabase/supabase-js");
const logger_1 = require("../utils/logger");
const mlbEnrichment_1 = require("./enrichment/mlbEnrichment");
const nbaEnrichment_1 = require("./enrichment/nbaEnrichment");
const nflEnrichment_1 = require("./enrichment/nflEnrichment");
const nhlEnrichment_1 = require("./enrichment/nhlEnrichment");
/**
 * Initialize Supabase client
 */
const supabase = (0, supabase_js_1.createClient)(process.env['SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY']);
/**
 * Create empty enrichment summary
 */
function createEmptyEnrichmentSummary() {
    const emptyBreakdown = {
        processed: 0,
        successful: 0,
        notFound: 0,
        errors: 0
    };
    const emptyFieldBreakdown = {
        processed: 0,
        successful: 0,
        notFound: 0,
        errors: 0
    };
    return {
        totalProcessed: 0,
        successfulEnrichments: 0,
        notFound: 0,
        errors: 0,
        errorDetails: [],
        leagueBreakdown: {
            MLB: { ...emptyBreakdown },
            NBA: { ...emptyBreakdown },
            NFL: { ...emptyBreakdown },
            NHL: { ...emptyBreakdown }
        },
        fieldBreakdown: {
            headshot: { ...emptyFieldBreakdown },
            height_cm: { ...emptyFieldBreakdown },
            weight_kg: { ...emptyFieldBreakdown },
            birthday: { ...emptyFieldBreakdown }
        }
    };
}
/**
 * Get league-specific enrichment functions
 */
function getLeagueEnrichmentFunctions(league) {
    switch (league) {
        case 'MLB':
            return { getHeadshot: mlbEnrichment_1.getMlbHeadshot, getPhysicals: mlbEnrichment_1.getMlbPhysicals };
        case 'NBA':
            return { getHeadshot: nbaEnrichment_1.getNbaHeadshot, getPhysicals: nbaEnrichment_1.getNbaPhysicals };
        case 'NFL':
            return { getHeadshot: nflEnrichment_1.getNflHeadshot, getPhysicals: nflEnrichment_1.getNflPhysicals };
        case 'NHL':
            return { getHeadshot: nhlEnrichment_1.getNhlHeadshot, getPhysicals: nhlEnrichment_1.getNhlPhysicals };
        default:
            throw new Error(`Unsupported league: ${league}`);
    }
}
/**
 * Check if player needs enrichment for any field
 */
function needsEnrichment(player, forceUpdate = false) {
    if (forceUpdate) {
        return true;
    }
    return (!player.photo_url ||
        !player.height_cm ||
        !player.weight_kg ||
        !player.birthday);
}
/**
 * Get fields that need enrichment
 */
function getFieldsToEnrich(player, forceUpdate = false) {
    const fields = [];
    if (forceUpdate || !player.photo_url) {
        fields.push('headshot');
    }
    if (forceUpdate || !player.height_cm) {
        fields.push('height_cm');
    }
    if (forceUpdate || !player.weight_kg) {
        fields.push('weight_kg');
    }
    if (forceUpdate || !player.birthday) {
        fields.push('birthday');
    }
    return fields;
}
/**
 * Update field breakdown in summary
 */
function updateFieldBreakdown(summary, field, status) {
    summary.fieldBreakdown[field].processed++;
    summary.fieldBreakdown[field][status === 'error' ? 'errors' : status]++;
}
/**
 * Update league breakdown in summary
 */
function updateLeagueBreakdown(summary, league, status) {
    summary.leagueBreakdown[league].processed++;
    summary.leagueBreakdown[league][status === 'error' ? 'errors' : status]++;
}
/**
 * Enrich a single player with headshot and physical attributes
 */
async function enrichSinglePlayer(player, summary, forceUpdate = false) {
    const league = player.sport.toUpperCase();
    if (!['MLB', 'NBA', 'NFL', 'NHL'].includes(league)) {
        logger_1.logger.warn(`Unsupported league for player ${player.player_name}: ${league}`);
        return false;
    }
    try {
        const { getHeadshot, getPhysicals } = getLeagueEnrichmentFunctions(league);
        const fieldsToEnrich = getFieldsToEnrich(player, forceUpdate);
        if (fieldsToEnrich.length === 0) {
            logger_1.logger.info(`Player ${player.player_name} already has all enrichment data`);
            return false;
        }
        logger_1.logger.info(`Enriching ${player.player_name} (${league}) for fields: ${fieldsToEnrich.join(', ')}`);
        const enrichmentData = {
            headshot_url: player.photo_url,
            height_cm: player.height_cm,
            weight_kg: player.weight_kg,
            birthday: player.birthday
        };
        let hasNewData = false;
        // Enrich headshot if needed
        if (fieldsToEnrich.includes('headshot')) {
            try {
                const headshot = await getHeadshot(player.player_name || '');
                if (headshot) {
                    enrichmentData.headshot_url = headshot;
                    hasNewData = true;
                    updateFieldBreakdown(summary, 'headshot', 'successful');
                    logger_1.logger.info(`Found headshot for ${player.player_name}: ${headshot}`);
                }
                else {
                    updateFieldBreakdown(summary, 'headshot', 'notFound');
                    logger_1.logger.info(`No headshot found for ${player.player_name}`);
                }
            }
            catch (error) {
                updateFieldBreakdown(summary, 'headshot', 'error');
                const errorMsg = `Error getting headshot for ${player.player_name}: ${error instanceof Error ? error.message : String(error)}`;
                logger_1.logger.error(errorMsg);
                summary.errorDetails.push(errorMsg);
            }
        }
        // Enrich physical attributes if needed
        const physicalFields = fieldsToEnrich.filter(f => ['height_cm', 'weight_kg', 'birthday'].includes(f));
        if (physicalFields.length > 0) {
            try {
                const physicals = await getPhysicals(player.player_name || '');
                if (fieldsToEnrich.includes('height_cm') && physicals.height_cm !== null) {
                    enrichmentData.height_cm = physicals.height_cm;
                    hasNewData = true;
                    updateFieldBreakdown(summary, 'height_cm', 'successful');
                    logger_1.logger.info(`Found height for ${player.player_name}: ${physicals.height_cm} cm`);
                }
                else if (fieldsToEnrich.includes('height_cm')) {
                    updateFieldBreakdown(summary, 'height_cm', 'notFound');
                }
                if (fieldsToEnrich.includes('weight_kg') && physicals.weight_kg !== null) {
                    enrichmentData.weight_kg = physicals.weight_kg;
                    hasNewData = true;
                    updateFieldBreakdown(summary, 'weight_kg', 'successful');
                    logger_1.logger.info(`Found weight for ${player.player_name}: ${physicals.weight_kg} kg`);
                }
                else if (fieldsToEnrich.includes('weight_kg')) {
                    updateFieldBreakdown(summary, 'weight_kg', 'notFound');
                }
                if (fieldsToEnrich.includes('birthday') && physicals.birthday !== null) {
                    enrichmentData.birthday = physicals.birthday;
                    hasNewData = true;
                    updateFieldBreakdown(summary, 'birthday', 'successful');
                    logger_1.logger.info(`Found birthday for ${player.player_name}: ${physicals.birthday}`);
                }
                else if (fieldsToEnrich.includes('birthday')) {
                    updateFieldBreakdown(summary, 'birthday', 'notFound');
                }
            }
            catch (error) {
                physicalFields.forEach(field => updateFieldBreakdown(summary, field, 'error'));
                const errorMsg = `Error getting physical attributes for ${player.player_name}: ${error instanceof Error ? error.message : String(error)}`;
                logger_1.logger.error(errorMsg);
                summary.errorDetails.push(errorMsg);
            }
        }
        // Update database if we have new data
        if (hasNewData) {
            const updateData = {};
            if (enrichmentData.headshot_url && enrichmentData.headshot_url !== player.photo_url) {
                updateData.photo_url = enrichmentData.headshot_url;
            }
            if (enrichmentData.height_cm !== null && enrichmentData.height_cm !== player.height_cm) {
                updateData.height_cm = enrichmentData.height_cm;
            }
            if (enrichmentData.weight_kg !== null && enrichmentData.weight_kg !== player.weight_kg) {
                updateData.weight_kg = enrichmentData.weight_kg;
            }
            if (enrichmentData.birthday && enrichmentData.birthday !== player.birthday) {
                updateData.birthday = enrichmentData.birthday;
            }
            if (Object.keys(updateData).length > 0) {
                const { error: updateError } = await supabase
                    .from('players')
                    .update(updateData)
                    .eq('id', player.id);
                if (updateError) {
                    updateLeagueBreakdown(summary, league, 'error');
                    const errorMsg = `Error updating player ${player.player_name}: ${updateError.message}`;
                    logger_1.logger.error(errorMsg);
                    summary.errorDetails.push(errorMsg);
                    return false;
                }
                updateLeagueBreakdown(summary, league, 'successful');
                logger_1.logger.info(`Successfully updated ${player.player_name} with new enrichment data`);
                return true;
            }
        }
        updateLeagueBreakdown(summary, league, 'notFound');
        logger_1.logger.info(`No new enrichment data found for ${player.player_name}`);
        return false;
    }
    catch (error) {
        updateLeagueBreakdown(summary, league, 'error');
        const errorMsg = `Error enriching player ${player.player_name}: ${error instanceof Error ? error.message : String(error)}`;
        logger_1.logger.error(errorMsg);
        summary.errorDetails.push(errorMsg);
        return false;
    }
}
/**
 * Enrich all players or players from a specific league
 */
async function enrichAllPlayers(league) {
    const forceUpdate = process.env['FORCE_UPDATE'] === 'true';
    const summary = createEmptyEnrichmentSummary();
    try {
        logger_1.logger.info(`Starting player enrichment${league ? ` for ${league}` : ' for all leagues'}${forceUpdate ? ' (FORCE_UPDATE=true)' : ''}`);
        // Build query
        let query = supabase
            .from('players')
            .select('id, player_name, sport, photo_url, height_cm, weight_kg, birthday');
        if (league) {
            query = query.eq('sport', league);
        }
        else {
            query = query.in('sport', ['MLB', 'NBA', 'NFL', 'NHL']);
        }
        const { data: players, error } = await query;
        if (error) {
            logger_1.logger.error('Error fetching players:', error.message);
            summary.errors = 1;
            summary.errorDetails.push(`Database error: ${error.message}`);
            return summary;
        }
        if (!players || players.length === 0) {
            logger_1.logger.info(`No players found${league ? ` for ${league}` : ''}`);
            return summary;
        }
        logger_1.logger.info(`Found ${players.length} players to process`);
        // Process each player
        for (const player of players) {
            summary.totalProcessed++;
            // Skip if player doesn't need enrichment (unless force update)
            if (!needsEnrichment(player, forceUpdate)) {
                logger_1.logger.info(`Player ${player.player_name} already has all enrichment data, skipping`);
                continue;
            }
            const success = await enrichSinglePlayer(player, summary, forceUpdate);
            if (success) {
                summary.successfulEnrichments++;
            }
        }
        // Calculate final totals
        summary.notFound = summary.totalProcessed - summary.successfulEnrichments - summary.errors;
        logger_1.logger.info(`Enrichment completed: ${summary.successfulEnrichments}/${summary.totalProcessed} players enriched`);
        return summary;
    }
    catch (error) {
        const errorMsg = `Fatal error during enrichment: ${error instanceof Error ? error.message : String(error)}`;
        logger_1.logger.error(errorMsg);
        summary.errors++;
        summary.errorDetails.push(errorMsg);
        return summary;
    }
}
/**
 * Enrich a specific player by ID
 */
async function enrichPlayerById(playerId) {
    const forceUpdate = process.env['FORCE_UPDATE'] === 'true';
    try {
        logger_1.logger.info(`Enriching player by ID: ${playerId}${forceUpdate ? ' (FORCE_UPDATE=true)' : ''}`);
        const { data: playerData, error } = await supabase
            .from('players')
            .select('id, player_name, sport, photo_url, height_cm, weight_kg, birthday')
            .eq('id', playerId)
            .single();
        if (error) {
            logger_1.logger.error(`Error fetching player ${playerId}:`, error.message);
            return false;
        }
        if (!playerData) {
            logger_1.logger.error(`Player not found: ${playerId}`);
            return false;
        }
        // Skip if player doesn't need enrichment (unless force update)
        if (!needsEnrichment(playerData, forceUpdate)) {
            logger_1.logger.info(`Player ${playerData.player_name} already has all enrichment data`);
            return false;
        }
        const summary = createEmptyEnrichmentSummary();
        const success = await enrichSinglePlayer(playerData, summary, forceUpdate);
        if (success) {
            logger_1.logger.info(`Successfully enriched player ${playerData.player_name}`);
            return true;
        }
        else {
            logger_1.logger.info(`No new enrichment data found for ${playerData.player_name}`);
            return false;
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error(`Error enriching player ${playerId}:`, errorMessage);
        return false;
    }
}
