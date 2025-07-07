import axios from 'axios';
import { logger } from '../../utils/logger';
import { PlayerPhysicals, PlayerPhysicalUtils } from '../../types/player';

/**
 * MLB player enrichment using MLB Stats API
 * Fetches headshot URLs and physical attributes for MLB players
 */

/**
 * MLB Player from roster API
 */
interface MlbRosterPlayer {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  primaryNumber?: string;
  birthDate?: string;
  currentAge?: number;
  birthCity?: string;
  birthStateProvince?: string;
  birthCountry?: string;
  height?: string;
  weight?: number;
  active: boolean;
  primaryPosition?: {
    code: string;
    name: string;
    type: string;
    abbreviation: string;
  };
}

interface MlbTeamRoster {
  roster: Array<{
    person: MlbRosterPlayer;
    status: {
      code: string;
      description: string;
    };
  }>;
}

interface MlbPlayerSearchResponse {
  people: Array<{
    id: number;
    fullName: string;
    firstName: string;
    lastName: string;
    birthDate?: string;
    height?: string;
    weight?: number;
    active: boolean;
  }>;
}

interface MlbPlayerDetailResponse {
  people: Array<{
    id: number;
    fullName: string;
    firstName: string;
    lastName: string;
    birthDate?: string;
    height?: string;
    weight?: number;
    active: boolean;
  }>;
}

/**
 * Fetch all MLB team rosters
 */
export async function getMlbRosters(): Promise<MlbRosterPlayer[]> {
  try {
    logger.info('Fetching MLB team rosters...');

    // First get all teams
    const teamsResponse = await axios.get('https://statsapi.mlb.com/api/v1/teams?sportId=1');
    const teams = teamsResponse.data.teams;

    const allPlayers: MlbRosterPlayer[] = [];

    for (const team of teams) {
      try {
        logger.info(`Fetching roster for ${team.name}...`);

        const rosterResponse = await axios.get(
          `https://statsapi.mlb.com/api/v1/teams/${team.id}/roster?rosterType=active`
        );

        const roster: MlbTeamRoster = rosterResponse.data;

        roster.roster.forEach(entry => {
          if (entry.person.active) {
            allPlayers.push(entry.person);
          }
        });

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        logger.error(`Error fetching roster for team ${team.id}:`, error);
      }
    }

    logger.info(`Fetched ${allPlayers.length} MLB players from rosters`);
    return allPlayers;

  } catch (error) {
    logger.error('Error fetching MLB rosters:', error);
    throw error;
  }
}

/**
 * Convert MLB roster player to standardized format
 */
export function convertMlbRosterPlayer(player: MlbRosterPlayer) {
  return {
    external_id: player.id.toString(),
    player_name: player.fullName,
    sport: 'MLB',
    height_cm: player.height ? convertHeightToCm(player.height) : null,
    weight_kg: player.weight ? Math.round(player.weight * 0.453592) : null, // lbs to kg
    birthday: player.birthDate || null,
    photo_url: null, // Will be enriched separately
    position: player.primaryPosition?.name || null,
    jersey_number: player.primaryNumber || null,
    active: player.active
  };
}

/**
 * Convert MLB height format (e.g., "6' 2\"") to centimeters
 */
function convertHeightToCm(height: string): number | null {
  const match = height.match(/(\d+)'\s*(\d+)"/);
  if (match && match[1] && match[2]) {
    const feet = parseInt(match[1]);
    const inches = parseInt(match[2]);
    return Math.round((feet * 12 + inches) * 2.54);
  }
  return null;
}

/**
 * Get MLB player headshot URL
 * @param playerName - Full name of the player
 * @returns Headshot URL or null if not found
 */
export async function getMlbHeadshot(playerName: string): Promise<string | null> {
  try {
    console.log(`Searching for MLB player: ${playerName}`);

    // Search for player by name
    const searchUrl = `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(playerName)}`;
    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
      console.log(`MLB API search failed for ${playerName}: ${searchResponse.status} ${searchResponse.statusText}`);
      return null;
    }

    const searchData = await searchResponse.json() as MlbPlayerSearchResponse;

    if (!searchData.people || searchData.people.length === 0) {
      console.log(`No MLB player found for name: ${playerName}`);
      return null;
    }

    // Get the first matching player (most relevant)
    const player = searchData.people[0];
    if (!player) {
      console.log(`No valid player data found for: ${playerName}`);
      return null;
    }

    const playerId = player.id;

    // Construct headshot URL using MLB's CDN pattern
    const headshotUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/w_213,d_people:generic:headshot:silo:current.png,q_auto:best,f_auto/v1/people/${playerId}/headshot/67/current`;

    console.log(`Found MLB headshot for ${playerName} (ID: ${playerId}): ${headshotUrl}`);
    return headshotUrl;

  } catch (error) {
    console.error(`Error fetching MLB headshot for ${playerName}:`, error);
    return null;
  }
}

/**
 * Get MLB player physical attributes (height, weight, birthday)
 * @param playerName - Full name of the player
 * @returns PlayerPhysicals object with height_cm, weight_kg, and birthday
 */
export async function getMlbPhysicals(playerName: string): Promise<PlayerPhysicals> {
  try {
    console.log(`Fetching MLB physicals for: ${playerName}`);

    // Search for player by name
    const searchUrl = `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(playerName)}`;
    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
      console.log(`MLB API search failed for ${playerName}: ${searchResponse.status} ${searchResponse.statusText}`);
      return { height_cm: null, weight_kg: null, birthday: null };
    }

    const searchData = await searchResponse.json() as MlbPlayerSearchResponse;

    if (!searchData.people || searchData.people.length === 0) {
      console.log(`No MLB player found for name: ${playerName}`);
      return { height_cm: null, weight_kg: null, birthday: null };
    }

    // Get the first matching player (most relevant)
    const player = searchData.people[0];
    if (!player) {
      console.log(`No valid player data found for: ${playerName}`);
      return { height_cm: null, weight_kg: null, birthday: null };
    }

    // Get detailed player info if needed
    let detailedPlayer = player;
    if (!player.height || !player.weight || !player.birthDate) {
      try {
        const detailUrl = `https://statsapi.mlb.com/api/v1/people/${player.id}`;
        const detailResponse = await fetch(detailUrl);

        if (detailResponse.ok) {
          const detailData = await detailResponse.json() as MlbPlayerDetailResponse;
          if (detailData.people && detailData.people.length > 0 && detailData.people[0]) {
            detailedPlayer = detailData.people[0];
          }
        }
      } catch (detailError) {
        console.log(`Could not fetch detailed info for ${playerName}:`, detailError);
      }
    }

    // Parse physical attributes
    const height_cm = detailedPlayer.height
      ? PlayerPhysicalUtils.parseHeightToCm(detailedPlayer.height)
      : null;

    const weight_kg = detailedPlayer.weight
      ? PlayerPhysicalUtils.poundsToKg(detailedPlayer.weight)
      : null;

    const birthday = detailedPlayer.birthDate
      ? PlayerPhysicalUtils.parseBirthday(detailedPlayer.birthDate)
      : null;

    const result: PlayerPhysicals = {
      height_cm,
      weight_kg,
      birthday
    };

    console.log(`Found MLB physicals for ${playerName}:`, {
      height: detailedPlayer.height ? `${detailedPlayer.height} (${height_cm}cm)` : 'N/A',
      weight: detailedPlayer.weight ? `${detailedPlayer.weight}lbs (${weight_kg}kg)` : 'N/A',
      birthday: birthday || 'N/A'
    });

    return result;

  } catch (error) {
    console.error(`Error fetching MLB physicals for ${playerName}:`, error);
    return { height_cm: null, weight_kg: null, birthday: null };
  }
}