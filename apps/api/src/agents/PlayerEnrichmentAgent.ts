// src/agents/PlayerEnrichmentAgent.ts

import { createClient } from '@supabase/supabase-js';

import { PlayerEnrichmentData } from '../types/player';
import { logger } from '../utils/logger';

import { getMlbHeadshot, getMlbPhysicals } from './enrichment/mlbEnrichment';
import { getNbaHeadshot, getNbaPhysicals } from './enrichment/nbaEnrichment';
import { getNflHeadshot, getNflPhysicals } from './enrichment/nflEnrichment';
import { getNhlHeadshot, getNhlPhysicals } from './enrichment/nhlEnrichment';

/**
 * Supported leagues for player enrichment
 */
export type SupportedLeague = 'MLB' | 'NBA' | 'NFL' | 'NHL';

/**
 * Enrichment field types
 */
export type EnrichmentField = 'headshot' | 'height_cm' | 'weight_kg' | 'birthday';

/**
 * League-specific breakdown for enrichment summary
 */
interface LeagueBreakdown {
  processed: number;
  successful: number;
  notFound: number;
  errors: number;
}

/**
 * Field-specific breakdown for enrichment summary
 */
interface FieldBreakdown {
  processed: number;
  successful: number;
  notFound: number;
  errors: number;
}

/**
 * Comprehensive enrichment summary with league and field breakdowns
 */
export interface EnrichmentSummary {
  totalProcessed: number;
  successfulEnrichments: number;
  notFound: number;
  errors: number;
  errorDetails: string[];
  leagueBreakdown: {
    MLB: LeagueBreakdown;
    NBA: LeagueBreakdown;
    NFL: LeagueBreakdown;
    NHL: LeagueBreakdown;
  };
  fieldBreakdown: {
    headshot: FieldBreakdown;
    height_cm: FieldBreakdown;
    weight_kg: FieldBreakdown;
    birthday: FieldBreakdown;
  };
}

/**
 * Player data structure (internal enrichment shape).
 * SPRINT-044E: Now derived from `participants` table rows via participantToPlayerData().
 */
interface PlayerData {
  id: string;
  player_name: string | null;
  sport: string;
  photo_url: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  birthday: string | null;
}

/**
 * SPRINT-044E: Convert a participants row to the internal PlayerData shape.
 * Keeps enrichment modules untouched — they consume PlayerData.
 */
function participantToPlayerData(row: any): PlayerData {
  const meta = row.meta || {};
  return {
    id: row.id,
    player_name: row.name,
    sport: row.sport,
    photo_url: meta.headshot_url || null,
    height_cm: meta.height_cm ?? null,
    weight_kg: meta.weight_kg ?? null,
    birthday: meta.birthday || null,
  };
}

/**
 * Initialize Supabase client
 */
const supabase = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!
);

/**
 * Create empty enrichment summary
 */
function createEmptyEnrichmentSummary(): EnrichmentSummary {
  const emptyBreakdown: LeagueBreakdown = {
    processed: 0,
    successful: 0,
    notFound: 0,
    errors: 0,
  };

  const emptyFieldBreakdown: FieldBreakdown = {
    processed: 0,
    successful: 0,
    notFound: 0,
    errors: 0,
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
      NHL: { ...emptyBreakdown },
    },
    fieldBreakdown: {
      headshot: { ...emptyFieldBreakdown },
      height_cm: { ...emptyFieldBreakdown },
      weight_kg: { ...emptyFieldBreakdown },
      birthday: { ...emptyFieldBreakdown },
    },
  };
}

/**
 * Get league-specific enrichment functions
 */
function getLeagueEnrichmentFunctions(league: SupportedLeague) {
  switch (league) {
    case 'MLB':
      return { getHeadshot: getMlbHeadshot, getPhysicals: getMlbPhysicals };
    case 'NBA':
      return { getHeadshot: getNbaHeadshot, getPhysicals: getNbaPhysicals };
    case 'NFL':
      return { getHeadshot: getNflHeadshot, getPhysicals: getNflPhysicals };
    case 'NHL':
      return { getHeadshot: getNhlHeadshot, getPhysicals: getNhlPhysicals };
    default:
      throw new Error(`Unsupported league: ${league}`);
  }
}

/**
 * Check if player needs enrichment for any field
 */
function needsEnrichment(player: PlayerData, forceUpdate: boolean = false): boolean {
  if (forceUpdate) {
    return true;
  }

  return !player.photo_url || !player.height_cm || !player.weight_kg || !player.birthday;
}

/**
 * Get fields that need enrichment
 */
function getFieldsToEnrich(player: PlayerData, forceUpdate: boolean = false): EnrichmentField[] {
  const fields: EnrichmentField[] = [];

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
function updateFieldBreakdown(
  summary: EnrichmentSummary,
  field: EnrichmentField,
  status: 'successful' | 'notFound' | 'error'
) {
  summary.fieldBreakdown[field].processed++;
  summary.fieldBreakdown[field][status === 'error' ? 'errors' : status]++;
}

/**
 * Update league breakdown in summary
 */
function updateLeagueBreakdown(
  summary: EnrichmentSummary,
  league: SupportedLeague,
  status: 'successful' | 'notFound' | 'error'
) {
  summary.leagueBreakdown[league].processed++;
  summary.leagueBreakdown[league][status === 'error' ? 'errors' : status]++;
}

/**
 * Enrich a single player with headshot and physical attributes
 */
async function enrichSinglePlayer(
  player: PlayerData,
  summary: EnrichmentSummary,
  forceUpdate: boolean = false
): Promise<boolean> {
  const league = player.sport.toUpperCase() as SupportedLeague;

  if (!['MLB', 'NBA', 'NFL', 'NHL'].includes(league)) {
    logger.warn(`Unsupported league for player ${player.player_name}: ${league}`);
    return false;
  }

  try {
    const { getHeadshot, getPhysicals } = getLeagueEnrichmentFunctions(league);
    const fieldsToEnrich = getFieldsToEnrich(player, forceUpdate);

    if (fieldsToEnrich.length === 0) {
      logger.info(`Player ${player.player_name} already has all enrichment data`);
      return false;
    }

    logger.info(
      `Enriching ${player.player_name} (${league}) for fields: ${fieldsToEnrich.join(', ')}`
    );

    const enrichmentData: PlayerEnrichmentData = {
      headshot_url: player.photo_url,
      height_cm: player.height_cm,
      weight_kg: player.weight_kg,
      birthday: player.birthday,
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
          logger.info(`Found headshot for ${player.player_name}: ${headshot}`);
        } else {
          updateFieldBreakdown(summary, 'headshot', 'notFound');
          logger.info(`No headshot found for ${player.player_name}`);
        }
      } catch (error) {
        updateFieldBreakdown(summary, 'headshot', 'error');
        const errorMsg = `Error getting headshot for ${player.player_name}: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(errorMsg);
        summary.errorDetails.push(errorMsg);
      }
    }

    // Enrich physical attributes if needed
    const physicalFields = fieldsToEnrich.filter(f =>
      ['height_cm', 'weight_kg', 'birthday'].includes(f)
    );
    if (physicalFields.length > 0) {
      try {
        const physicals = await getPhysicals(player.player_name || '');

        if (fieldsToEnrich.includes('height_cm') && physicals.height_cm !== null) {
          enrichmentData.height_cm = physicals.height_cm;
          hasNewData = true;
          updateFieldBreakdown(summary, 'height_cm', 'successful');
          logger.info(`Found height for ${player.player_name}: ${physicals.height_cm} cm`);
        } else if (fieldsToEnrich.includes('height_cm')) {
          updateFieldBreakdown(summary, 'height_cm', 'notFound');
        }

        if (fieldsToEnrich.includes('weight_kg') && physicals.weight_kg !== null) {
          enrichmentData.weight_kg = physicals.weight_kg;
          hasNewData = true;
          updateFieldBreakdown(summary, 'weight_kg', 'successful');
          logger.info(`Found weight for ${player.player_name}: ${physicals.weight_kg} kg`);
        } else if (fieldsToEnrich.includes('weight_kg')) {
          updateFieldBreakdown(summary, 'weight_kg', 'notFound');
        }

        if (fieldsToEnrich.includes('birthday') && physicals.birthday !== null) {
          enrichmentData.birthday = physicals.birthday;
          hasNewData = true;
          updateFieldBreakdown(summary, 'birthday', 'successful');
          logger.info(`Found birthday for ${player.player_name}: ${physicals.birthday}`);
        } else if (fieldsToEnrich.includes('birthday')) {
          updateFieldBreakdown(summary, 'birthday', 'notFound');
        }
      } catch (error) {
        physicalFields.forEach(field =>
          updateFieldBreakdown(summary, field as EnrichmentField, 'error')
        );
        const errorMsg = `Error getting physical attributes for ${player.player_name}: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(errorMsg);
        summary.errorDetails.push(errorMsg);
      }
    }

    // Update database if we have new data
    // SPRINT-044E: Write enrichment data into participants.meta JSONB
    if (hasNewData) {
      const metaUpdates: Record<string, any> = {};
      if (enrichmentData.headshot_url && enrichmentData.headshot_url !== player.photo_url) {
        metaUpdates.headshot_url = enrichmentData.headshot_url;
      }
      if (enrichmentData.height_cm !== null && enrichmentData.height_cm !== player.height_cm) {
        metaUpdates.height_cm = enrichmentData.height_cm;
      }
      if (enrichmentData.weight_kg !== null && enrichmentData.weight_kg !== player.weight_kg) {
        metaUpdates.weight_kg = enrichmentData.weight_kg;
      }
      if (enrichmentData.birthday && enrichmentData.birthday !== player.birthday) {
        metaUpdates.birthday = enrichmentData.birthday;
      }

      if (Object.keys(metaUpdates).length > 0) {
        // Fetch current meta to merge (participants.meta is JSONB)
        const { data: current } = await supabase
          .from('participants')
          .select('meta')
          .eq('id', player.id)
          .single();

        const mergedMeta = { ...(current?.meta || {}), ...metaUpdates };

        const { error: updateError } = await supabase
          .from('participants')
          .update({ meta: mergedMeta })
          .eq('id', player.id);

        if (updateError) {
          updateLeagueBreakdown(summary, league, 'error');
          const errorMsg = `Error updating participant ${player.player_name}: ${updateError.message}`;
          logger.error(errorMsg);
          summary.errorDetails.push(errorMsg);
          return false;
        }

        updateLeagueBreakdown(summary, league, 'successful');
        logger.info(`Successfully updated ${player.player_name} with new enrichment data`);
        return true;
      }
    }

    updateLeagueBreakdown(summary, league, 'notFound');
    logger.info(`No new enrichment data found for ${player.player_name}`);
    return false;
  } catch (error) {
    updateLeagueBreakdown(summary, league, 'error');
    const errorMsg = `Error enriching player ${player.player_name}: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMsg);
    summary.errorDetails.push(errorMsg);
    return false;
  }
}

/**
 * Enrich all players or players from a specific league
 */
export async function enrichAllPlayers(league?: SupportedLeague): Promise<EnrichmentSummary> {
  const forceUpdate = process.env['FORCE_UPDATE'] === 'true';
  const summary = createEmptyEnrichmentSummary();

  try {
    logger.info(
      `Starting player enrichment${league ? ` for ${league}` : ' for all leagues'}${forceUpdate ? ' (FORCE_UPDATE=true)' : ''}`
    );

    // SPRINT-044E: Query from canonical participants table instead of deprecated players
    let query = supabase.from('participants').select('id, name, sport, meta').eq('type', 'player');

    if (league) {
      query = query.eq('sport', league);
    } else {
      query = query.in('sport', ['MLB', 'NBA', 'NFL', 'NHL']);
    }

    const { data: participants, error } = await query;

    if (error) {
      logger.error('Error fetching participants:', error.message);
      summary.errors = 1;
      summary.errorDetails.push(`Database error: ${error.message}`);
      return summary;
    }

    if (!participants || participants.length === 0) {
      logger.info(`No participants found${league ? ` for ${league}` : ''}`);
      return summary;
    }

    logger.info(`Found ${participants.length} participants to process`);

    // Convert to internal PlayerData shape for enrichment modules
    const players = participants.map(participantToPlayerData);

    // Process each player
    for (const player of players) {
      summary.totalProcessed++;

      // Skip if player doesn't need enrichment (unless force update)
      if (!needsEnrichment(player, forceUpdate)) {
        logger.info(`Player ${player.player_name} already has all enrichment data, skipping`);
        continue;
      }

      const success = await enrichSinglePlayer(player, summary, forceUpdate);
      if (success) {
        summary.successfulEnrichments++;
      }
    }

    // Calculate final totals
    summary.notFound = summary.totalProcessed - summary.successfulEnrichments - summary.errors;

    logger.info(
      `Enrichment completed: ${summary.successfulEnrichments}/${summary.totalProcessed} players enriched`
    );
    return summary;
  } catch (error) {
    const errorMsg = `Fatal error during enrichment: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMsg);
    summary.errors++;
    summary.errorDetails.push(errorMsg);
    return summary;
  }
}

/**
 * Enrich a specific player by ID
 */
export async function enrichPlayerById(playerId: string): Promise<boolean> {
  const forceUpdate = process.env['FORCE_UPDATE'] === 'true';

  try {
    logger.info(`Enriching player by ID: ${playerId}${forceUpdate ? ' (FORCE_UPDATE=true)' : ''}`);

    // SPRINT-044E: Query from canonical participants table
    const { data: participantRow, error } = await supabase
      .from('participants')
      .select('id, name, sport, meta')
      .eq('id', playerId)
      .eq('type', 'player')
      .single();
    const playerData = participantRow ? participantToPlayerData(participantRow) : null;

    if (error) {
      logger.error(`Error fetching player ${playerId}:`, error.message);
      return false;
    }

    if (!playerData) {
      logger.error(`Player not found: ${playerId}`);
      return false;
    }

    // Skip if player doesn't need enrichment (unless force update)
    if (!needsEnrichment(playerData, forceUpdate)) {
      logger.info(`Player ${playerData.player_name} already has all enrichment data`);
      return false;
    }

    const summary = createEmptyEnrichmentSummary();
    const success = await enrichSinglePlayer(playerData, summary, forceUpdate);

    if (success) {
      logger.info(`Successfully enriched player ${playerData.player_name}`);
      return true;
    } else {
      logger.info(`No new enrichment data found for ${playerData.player_name}`);
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error enriching player ${playerId}:`, errorMessage);
    return false;
  }
}
