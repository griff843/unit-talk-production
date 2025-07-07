import axios from 'axios';
import { PlayerPhysicals, PlayerPhysicalUtils } from '../../types/player';
import { logger } from '../../utils/logger';

/**
 * NBA player enrichment using Ball Don't Lie API
 * Fetches headshot URLs and physical attributes for NBA players
 */

interface BallDontLiePlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  height_feet?: number;
  height_inches?: number;
  weight_pounds?: number;
  team: {
    id: number;
    abbreviation: string;
    city: string;
    conference: string;
    division: string;
    full_name: string;
    name: string;
  };
}

interface BallDontLieResponse {
  data: BallDontLiePlayer[];
  meta: {
    total_pages: number;
    current_page: number;
    next_page: number | null;
    per_page: number;
    total_count: number;
  };
}

interface NbaStatsResponse {
  resultSets: Array<{
    rowSet: Array<Array<any>>;
  }>;
}

/**
 * NBA Player from roster API
 */
interface NbaRosterPlayer {
  personId: number;
  firstName: string;
  lastName: string;
  displayName: string;
  jersey: string;
  pos: string;
  heightFeet: number;
  heightInches: number;
  weightPounds: number;
  dateOfBirthUTC: string;
  nbaDebutYear: number;
  yearsPro: number;
  collegeName: string;
  country: string;
  isActive: boolean;
}

interface NbaTeamRoster {
  league: {
    standard: NbaRosterPlayer[];
  };
}

/**
 * Fetch all NBA team rosters
 */
export async function getNbaRosters(): Promise<NbaRosterPlayer[]> {
  try {
    logger.info('Fetching NBA team rosters...');

    // NBA teams (30 teams)
    const teamIds = [
      1610612737, 1610612738, 1610612751, 1610612766, 1610612741, 1610612739, 1610612742, 1610612743,
      1610612765, 1610612744, 1610612745, 1610612754, 1610612746, 1610612747, 1610612763, 1610612748,
      1610612749, 1610612750, 1610612740, 1610612752, 1610612760, 1610612753, 1610612755, 1610612756,
      1610612757, 1610612758, 1610612759, 1610612761, 1610612762, 1610612764
    ];

    const allPlayers: NbaRosterPlayer[] = [];

    for (const teamId of teamIds) {
      try {
        logger.info(`Fetching NBA roster for team ${teamId}...`);

        const rosterResponse = await axios.get(
          `https://data.nba.net/prod/v1/2023/teams/${teamId}/roster.json`
        );

        const roster: NbaTeamRoster = rosterResponse.data;

        roster.league.standard.forEach(player => {
          if (player.isActive) {
            allPlayers.push(player);
          }
        });

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        logger.error(`Error fetching NBA roster for team ${teamId}:`, error);
      }
    }

    logger.info(`Fetched ${allPlayers.length} NBA players from rosters`);
    return allPlayers;

  } catch (error) {
    logger.error('Error fetching NBA rosters:', error);
    throw error;
  }
}

/**
 * Convert NBA roster player to standardized format
 */
export function convertNbaRosterPlayer(player: NbaRosterPlayer) {
  const heightCm = player.heightFeet && player.heightInches
    ? Math.round((player.heightFeet * 12 + player.heightInches) * 2.54)
    : null;

  const weightKg = player.weightPounds
    ? Math.round(player.weightPounds * 0.453592)
    : null;

  return {
    external_id: player.personId.toString(),
    player_name: player.displayName,
    sport: 'NBA',
    height_cm: heightCm,
    weight_kg: weightKg,
    birthday: player.dateOfBirthUTC || null,
    photo_url: null, // Will be enriched separately
    position: player.pos || null,
    jersey_number: player.jersey || null,
    active: player.isActive
  };
}

/**
 * Get NBA player headshot URL
 * @param playerName - Full name of the player
 * @returns Headshot URL or null if not found
 */
export async function getNbaHeadshot(playerName: string): Promise<string | null> {
  try {
    console.log(`Searching for NBA player: ${playerName}`);

    // Split name for search
    const nameParts = playerName.trim().split(' ');
    if (nameParts.length < 2) {
      console.log(`Invalid name format for NBA search: ${playerName}`);
      return null;
    }

    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    // Search using Ball Don't Lie API
    const searchUrl = `https://www.balldontlie.io/api/v1/players?search=${encodeURIComponent(playerName)}`;
    const response = await fetch(searchUrl);

    if (!response.ok) {
      console.log(`NBA API request failed for ${playerName}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json() as BallDontLieResponse;

    if (!data.data || data.data.length === 0) {
      console.log(`No NBA player found for name: ${playerName}`);
      return null;
    }

    // Find best match
    const player = data.data.find(p =>
      firstName && p.first_name.toLowerCase() === firstName.toLowerCase() &&
      p.last_name.toLowerCase() === lastName.toLowerCase()
    ) || data.data[0];

    if (!player) {
      console.log(`No valid player data found for: ${playerName}`);
      return null;
    }

    // NBA headshot URL pattern
    const headshotUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.id}.png`;

    console.log(`Found NBA headshot for ${playerName} (ID: ${player.id}): ${headshotUrl}`);
    return headshotUrl;

  } catch (error) {
    console.error(`Error fetching NBA headshot for ${playerName}:`, error);
    return null;
  }
}

/**
 * Get NBA player physical attributes (height, weight, birthday)
 * @param playerName - Full name of the player
 * @returns PlayerPhysicals object with height_cm, weight_kg, and birthday
 */
export async function getNbaPhysicals(playerName: string): Promise<PlayerPhysicals> {
  try {
    console.log(`Fetching NBA physicals for: ${playerName}`);

    // Split name for search
    const nameParts = playerName.trim().split(' ');
    if (nameParts.length < 2) {
      console.log(`Invalid name format for NBA search: ${playerName}`);
      return { height_cm: null, weight_kg: null, birthday: null };
    }

    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    // Search using Ball Don't Lie API
    const searchUrl = `https://www.balldontlie.io/api/v1/players?search=${encodeURIComponent(playerName)}`;
    const response = await fetch(searchUrl);

    if (!response.ok) {
      console.log(`NBA API request failed for ${playerName}: ${response.status} ${response.statusText}`);
      return { height_cm: null, weight_kg: null, birthday: null };
    }

    const data = await response.json() as BallDontLieResponse;

    if (!data.data || data.data.length === 0) {
      console.log(`No NBA player found for name: ${playerName}`);
      return { height_cm: null, weight_kg: null, birthday: null };
    }

    // Find best match
    const player = data.data.find(p =>
      firstName && p.first_name.toLowerCase() === firstName.toLowerCase() &&
      p.last_name.toLowerCase() === lastName.toLowerCase()
    ) || data.data[0];

    if (!player) {
      console.log(`No valid player data found for: ${playerName}`);
      return { height_cm: null, weight_kg: null, birthday: null };
    }

    // Parse physical attributes
    const height_cm = (player.height_feet && player.height_inches !== undefined)
      ? PlayerPhysicalUtils.feetInchesToCm(player.height_feet, player.height_inches)
      : null;

    const weight_kg = player.weight_pounds
      ? PlayerPhysicalUtils.poundsToKg(player.weight_pounds)
      : null;

    // Ball Don't Lie API doesn't provide birthday, so we'll try NBA.com API as fallback
    let birthday: string | null = null;
    try {
      // Try to get birthday from NBA.com stats API
      const statsUrl = `https://stats.nba.com/stats/commonplayerinfo?PlayerID=${player.id}`;
      const statsResponse = await fetch(statsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.nba.com/',
        }
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json() as NbaStatsResponse;
        if (statsData.resultSets &&
            statsData.resultSets[0] &&
            statsData.resultSets[0].rowSet &&
            statsData.resultSets[0].rowSet[0]) {
          const playerInfo = statsData.resultSets[0].rowSet[0];
          const birthDateStr = playerInfo[7]; // BIRTHDATE is typically at index 7
          if (typeof birthDateStr === 'string') {
            birthday = PlayerPhysicalUtils.parseBirthday(birthDateStr);
          }
        }
      }
    } catch (birthdayError) {
      console.log(`Could not fetch birthday for ${playerName}:`, birthdayError);
    }

    const result: PlayerPhysicals = {
      height_cm,
      weight_kg,
      birthday
    };

    console.log(`Found NBA physicals for ${playerName}:`, {
      height: (player.height_feet && player.height_inches !== undefined)
        ? `${player.height_feet}'${player.height_inches}" (${height_cm}cm)`
        : 'N/A',
      weight: player.weight_pounds ? `${player.weight_pounds}lbs (${weight_kg}kg)` : 'N/A',
      birthday: birthday || 'N/A'
    });

    return result;

  } catch (error) {
    console.error(`Error fetching NBA physicals for ${playerName}:`, error);
    return { height_cm: null, weight_kg: null, birthday: null };
  }
}