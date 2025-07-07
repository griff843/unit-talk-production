import axios from 'axios';
import { logger } from '../../utils/logger';
import { PlayerPhysicals, PlayerPhysicalUtils } from '../../types/player';

/**
 * NHL API response interfaces
 */
interface NhlPlayerResponse {
  people: Array<{
    id: number;
    fullName: string;
    firstName: string;
    lastName: string;
    primaryNumber?: string;
    birthDate?: string;
    birthCity?: string;
    birthStateProvince?: string;
    birthCountry?: string;
    nationality?: string;
    height?: string;
    weight?: number;
    active?: boolean;
    alternateCaptain?: boolean;
    captain?: boolean;
    rookie?: boolean;
    shootsCatches?: string;
    rosterStatus?: string;
    currentTeam?: {
      id: number;
      name: string;
      link: string;
    };
    primaryPosition?: {
      code: string;
      name: string;
      type: string;
      abbreviation: string;
    };
  }>;
}


/**
 * NHL Player from roster API
 */
interface NhlRosterPlayer {
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
  nationality?: string;
  height?: string; // e.g., "6' 2\""
  weight?: number; // in pounds
  active: boolean;
  primaryPosition?: {
    code: string;
    name: string;
    type: string;
    abbreviation: string;
  };
  rosterStatus?: string;
}

interface NhlTeamRoster {
  roster: Array<{
    person: NhlRosterPlayer;
    jerseyNumber?: string;
    position: {
      code: string;
      name: string;
      type: string;
      abbreviation: string;
    };
  }>;
}

/**
 * Get NHL player headshot URL
 * @param playerName - Full name of the player
 * @returns Headshot URL or null if not found
 */
export async function getNhlHeadshot(playerName: string): Promise<string | null> {
  try {
    console.log(`Searching for NHL player: ${playerName}`);

    // Search for player using NHL API
    const searchUrl = `https://suggest.svc.nhl.com/svc/suggest/v1/minactiveplayers/${encodeURIComponent(playerName)}/99999`;
    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
      console.log(`NHL search API failed for ${playerName}: ${searchResponse.status} ${searchResponse.statusText}`);
      return null;
    }

    const searchData = await searchResponse.json() as { suggestions: string[] };

    if (!searchData.suggestions || searchData.suggestions.length === 0) {
      console.log(`No NHL player suggestions found for: ${playerName}`);
      return null;
    }

    // Extract player ID from the first suggestion
    const suggestion = searchData.suggestions[0];
    if (!suggestion) {
      console.log(`No valid suggestion found for: ${playerName}`);
      return null;
    }

    const playerIdMatch = suggestion?.match(/(\d+)/);

    if (!playerIdMatch) {
      console.log(`Could not extract player ID from suggestion: ${suggestion}`);
      return null;
    }

    const playerId = playerIdMatch[1];

    // Construct headshot URL using NHL's CDN pattern
    const headshotUrl = `https://cms.nhl.bamgrid.com/images/headshots/current/168x168/${playerId}.jpg`;

    console.log(`Found NHL headshot for ${playerName} (ID: ${playerId}): ${headshotUrl}`);
    return headshotUrl;

  } catch (error) {
    console.error(`Error fetching NHL headshot for ${playerName}:`, error);
    return null;
  }
}

/**
 * Get NHL player physical attributes (height, weight, birthday)
 * @param playerName - Full name of the player
 * @returns PlayerPhysicals object with height_cm, weight_kg, and birthday
 */
export async function getNhlPhysicals(playerName: string): Promise<PlayerPhysicals> {
  try {
    console.log(`Fetching NHL physicals for: ${playerName}`);

    // First, search for player using NHL suggest API
    const searchUrl = `https://suggest.svc.nhl.com/svc/suggest/v1/minactiveplayers/${encodeURIComponent(playerName)}/99999`;
    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
      console.log(`NHL search API failed for ${playerName}: ${searchResponse.status} ${searchResponse.statusText}`);
      return { height_cm: null, weight_kg: null, birthday: null };
    }

    const searchData = await searchResponse.json() as { suggestions: string[] };

    if (!searchData.suggestions || searchData.suggestions.length === 0) {
      console.log(`No NHL player suggestions found for: ${playerName}`);
      return { height_cm: null, weight_kg: null, birthday: null };
    }

    // Extract player ID from the first suggestion
    const suggestion = searchData.suggestions[0];
    if (!suggestion) {
      console.log(`No valid suggestion found for: ${playerName}`);
      return { height_cm: null, weight_kg: null, birthday: null };
    }

    const playerIdMatch = suggestion.match(/(\d+)/);

    if (!playerIdMatch) {
      console.log(`Could not extract player ID from suggestion: ${suggestion}`);
      return { height_cm: null, weight_kg: null, birthday: null };
    }

    const playerId = playerIdMatch[1];

    // Get detailed player info from NHL Stats API
    const playerUrl = `https://statsapi.web.nhl.com/api/v1/people/${playerId}`;
    const playerResponse = await fetch(playerUrl);

    if (!playerResponse.ok) {
      console.log(`NHL player API failed for ID ${playerId}: ${playerResponse.status} ${playerResponse.statusText}`);
      return { height_cm: null, weight_kg: null, birthday: null };
    }

    const playerData = await playerResponse.json() as NhlPlayerResponse;

    if (!playerData.people || playerData.people.length === 0) {
      console.log(`No NHL player data found for ID: ${playerId}`);
      return { height_cm: null, weight_kg: null, birthday: null };
    }

    const player = playerData.people[0];
    if (!player) {
      console.log(`No valid player data found for ID: ${playerId}`);
      return { height_cm: null, weight_kg: null, birthday: null };
    }

    // Parse physical attributes
    const height_cm = player.height
      ? PlayerPhysicalUtils.parseHeightToCm(player.height)
      : null;

    const weight_kg = player.weight
      ? PlayerPhysicalUtils.poundsToKg(player.weight)
      : null;

    const birthday = player.birthDate
      ? PlayerPhysicalUtils.parseBirthday(player.birthDate)
      : null;

    const result: PlayerPhysicals = {
      height_cm,
      weight_kg,
      birthday
    };

    console.log(`Found NHL physicals for ${playerName}:`, {
      height: player.height ? `${player.height} (${height_cm}cm)` : 'N/A',
      weight: player.weight ? `${player.weight}lbs (${weight_kg}kg)` : 'N/A',
      birthday: birthday || 'N/A'
    });

    return result;

  } catch (error) {
    console.error(`Error fetching NHL physicals for ${playerName}:`, error);
    return { height_cm: null, weight_kg: null, birthday: null };
  }
}

/**
 * Fetch all NHL team rosters
 */
export async function getNhlRosters(): Promise<NhlRosterPlayer[]> {
  try {
    logger.info('Fetching NHL team rosters...');

    // First get all teams
    const teamsResponse = await axios.get('https://statsapi.web.nhl.com/api/v1/teams');
    const teams = teamsResponse.data.teams;

    const allPlayers: NhlRosterPlayer[] = [];

    for (const team of teams) {
      try {
        logger.info(`Fetching NHL roster for ${team.name}...`);

        const rosterResponse = await axios.get(
          `https://statsapi.web.nhl.com/api/v1/teams/${team.id}/roster`
        );

        const roster: NhlTeamRoster = rosterResponse.data;

        roster.roster.forEach(entry => {
          if (entry.person.active) {
            allPlayers.push(entry.person);
          }
        });

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));

      } catch (error) {
        logger.error(`Error fetching NHL roster for team ${team.id}:`, error);
      }
    }

    logger.info(`Fetched ${allPlayers.length} NHL players from rosters`);
    return allPlayers;

  } catch (error) {
    logger.error('Error fetching NHL rosters:', error);
    throw error;
  }
}

/**
 * Convert NHL roster player to standardized format
 */
export function convertNhlRosterPlayer(player: NhlRosterPlayer) {
  const heightCm = player.height ? convertNhlHeightToCm(player.height) : null;
  const weightKg = player.weight ? Math.round(player.weight * 0.453592) : null;

  return {
    external_id: player.id.toString(),
    player_name: player.fullName,
    sport: 'NHL',
    height_cm: heightCm,
    weight_kg: weightKg,
    birthday: player.birthDate || null,
    photo_url: null, // Will be enriched separately
    position: player.primaryPosition?.name || null,
    jersey_number: player.primaryNumber || null,
    active: player.active
  };
}

/**
 * Convert NHL height format (e.g., "6' 2\"") to centimeters
 */
function convertNhlHeightToCm(height: string): number | null {
  const match = height.match(/(\d+)'\s*(\d+)"/);
  if (match && match[1] && match[2]) {
    const feet = parseInt(match[1]);
    const inches = parseInt(match[2]);
    return Math.round((feet * 12 + inches) * 2.54);
  }
  return null;
}