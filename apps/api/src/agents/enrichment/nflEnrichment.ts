import axios from 'axios';

import { PlayerPhysicals, PlayerPhysicalUtils } from '../../types/player';
import { logger } from '../../utils/logger';

/**
 * NFL player enrichment using ESPN API
 * Fetches headshot URLs and physical attributes for NFL players
 */

interface EspnPlayerSearchResponse {
  athletes: Array<{
    id: string;
    uid: string;
    guid: string;
    displayName: string;
    shortName: string;
    weight: number;
    height: number;
    age: number;
    dateOfBirth: string;
    birthPlace: {
      city: string;
      state: string;
      country: string;
    };
    headshot: {
      href: string;
      alt: string;
    };
    position: {
      id: string;
      name: string;
      displayName: string;
      abbreviation: string;
    };
    team: {
      id: string;
      abbreviation: string;
      displayName: string;
      shortDisplayName: string;
      name: string;
      nickname: string;
      location: string;
      color: string;
      alternateColor: string;
    };
  }>;
}

/**
 * NFL Player from ESPN API
 */
interface NflRosterPlayer {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  jersey?: string;
  position?: {
    name: string;
    abbreviation: string;
  };
  age?: number;
  height?: number; // in inches
  weight?: number; // in pounds
  birthPlace?: {
    city: string;
    state: string;
    country: string;
  };
  dateOfBirth?: string;
  headshot?: {
    href: string;
  };
  active: boolean;
}

interface NflTeamRoster {
  athletes: Array<{
    items: NflRosterPlayer[];
  }>;
}

/**
 * Get NFL player headshot URL
 * @param playerName - Full name of the player
 * @returns Headshot URL or null if not found
 */
export async function getNflHeadshot(playerName: string): Promise<string | null> {
  try {
    logger.info(`Searching for NFL player: ${playerName}`);

    // Search using ESPN API
    const searchUrl = `https://site.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(playerName)}&type=athlete&sport=football&league=nfl`;
    const response = await fetch(searchUrl);

    if (!response.ok) {
      logger.warn(
        `ESPN API request failed for ${playerName}: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = (await response.json()) as { results: EspnPlayerSearchResponse[] };

    if (
      !data.results ||
      data.results.length === 0 ||
      !data.results[0]?.athletes ||
      data.results[0].athletes.length === 0
    ) {
      logger.warn(`No NFL player found for name: ${playerName}`);
      return null;
    }

    const player = data.results[0]?.athletes?.[0];
    if (!player) {
      logger.warn(`No valid player data found for: ${playerName}`);
      return null;
    }

    // Use ESPN's headshot URL or construct one
    let headshotUrl: string;
    if (player.headshot && player.headshot.href) {
      headshotUrl = player.headshot.href;
    } else {
      // Fallback to ESPN's standard headshot pattern
      headshotUrl = `https://a.espncdn.com/i/headshots/nfl/players/full/${player.id}.png`;
    }

    logger.info(`Found NFL headshot for ${playerName} (ID: ${player.id}): ${headshotUrl}`);
    return headshotUrl;
  } catch (error) {
    logger.error(`Error fetching NFL headshot for ${playerName}:`, error);
    return null;
  }
}

/**
 * Get NFL player physical attributes (height, weight, birthday)
 * @param playerName - Full name of the player
 * @returns PlayerPhysicals object with height_cm, weight_kg, and birthday
 */
export async function getNflPhysicals(playerName: string): Promise<PlayerPhysicals> {
  try {
    logger.info(`Fetching NFL physicals for: ${playerName}`);

    // Search using ESPN API
    const searchUrl = `https://site.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(playerName)}&type=athlete&sport=football&league=nfl`;
    const response = await fetch(searchUrl);

    if (!response.ok) {
      logger.warn(
        `ESPN API request failed for ${playerName}: ${response.status} ${response.statusText}`
      );
      return { height_cm: null, weight_kg: null, birthday: null };
    }

    const data = (await response.json()) as { results: EspnPlayerSearchResponse[] };

    if (
      !data.results ||
      data.results.length === 0 ||
      !data.results[0]?.athletes ||
      data.results[0].athletes.length === 0
    ) {
      logger.warn(`No NFL player found for name: ${playerName}`);
      return { height_cm: null, weight_kg: null, birthday: null };
    }

    const player = data.results[0]?.athletes?.[0];
    if (!player) {
      logger.warn(`No valid player data found for: ${playerName}`);
      return { height_cm: null, weight_kg: null, birthday: null };
    }

    // Parse physical attributes
    // ESPN provides height in inches and weight in pounds
    const height_cm = player.height
      ? Math.round(player.height * 2.54) // Convert inches to cm
      : null;

    const weight_kg = player.weight ? PlayerPhysicalUtils.poundsToKg(player.weight) : null;

    const birthday = player.dateOfBirth
      ? PlayerPhysicalUtils.parseBirthday(player.dateOfBirth)
      : null;

    const result: PlayerPhysicals = {
      height_cm,
      weight_kg,
      birthday,
    };

    logger.info(`Found NFL physicals for ${playerName}:`, {
      height: player.height ? `${player.height}" (${height_cm}cm)` : 'N/A',
      weight: player.weight ? `${player.weight}lbs (${weight_kg}kg)` : 'N/A',
      birthday: birthday || 'N/A',
    });

    return result;
  } catch (error) {
    logger.error(`Error fetching NFL physicals for ${playerName}:`, error);
    return { height_cm: null, weight_kg: null, birthday: null };
  }
}

/**
 * Fetch all NFL team rosters
 */
export async function getNflRosters(): Promise<NflRosterPlayer[]> {
  try {
    logger.info('Fetching NFL team rosters...');

    // NFL team abbreviations
    const teams = [
      'ARI',
      'ATL',
      'BAL',
      'BUF',
      'CAR',
      'CHI',
      'CIN',
      'CLE',
      'DAL',
      'DEN',
      'DET',
      'GB',
      'HOU',
      'IND',
      'JAX',
      'KC',
      'LV',
      'LAC',
      'LAR',
      'MIA',
      'MIN',
      'NE',
      'NO',
      'NYG',
      'NYJ',
      'PHI',
      'PIT',
      'SF',
      'SEA',
      'TB',
      'TEN',
      'WAS',
    ];

    const allPlayers: NflRosterPlayer[] = [];

    for (const team of teams) {
      try {
        logger.info(`Fetching NFL roster for ${team}...`);

        const rosterResponse = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${team}/roster`
        );

        const roster: NflTeamRoster = rosterResponse.data;

        roster.athletes.forEach(group => {
          group.items.forEach(player => {
            if (player.active) {
              allPlayers.push(player);
            }
          });
        });

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        logger.error(`Error fetching NFL roster for team ${team}:`, error);
      }
    }

    logger.info(`Fetched ${allPlayers.length} NFL players from rosters`);
    return allPlayers;
  } catch (error) {
    logger.error('Error fetching NFL rosters:', error);
    throw error;
  }
}

/**
 * Convert NFL roster player to standardized format
 */
export function convertNflRosterPlayer(player: NflRosterPlayer) {
  const heightCm = player.height ? Math.round(player.height * 2.54) : null;
  const weightKg = player.weight ? Math.round(player.weight * 0.453592) : null;

  return {
    external_id: player.id,
    player_name: player.displayName,
    sport: 'NFL',
    height_cm: heightCm,
    weight_kg: weightKg,
    birthday: player.dateOfBirth || null,
    photo_url: player.headshot?.href || null,
    position: player.position?.name || null,
    jersey_number: player.jersey || null,
    active: player.active,
  };
}
