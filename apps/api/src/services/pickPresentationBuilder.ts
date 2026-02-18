/* eslint-disable max-lines, complexity, max-depth */
/**
 * Pick Presentation Builder
 *
 * Converts unified_picks rows to presentation-ready format for Discord embeds.
 * Handles all bet types: player props, spreads, moneylines, totals.
 *
 * DISCORD-UX-OVERHAUL-001: Standardized pick presentation
 * EMBED-PRODUCTION-CONTRACT-030: Production embed format
 *
 * @see docs/contracts/PICK_PRESENTATION_STANDARD.md
 */

import { createClient } from '@supabase/supabase-js';
import {
  PickPresentation,
  PickMarketType,
  UnifiedPickRow,
  formatUnitsDisplay,
  formatOddsAmerican,
} from '../types/pickPresentation';

// Supabase client for headshot lookups
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ---- HEADSHOT/LOGO URLs ----

/**
 * League logos for fallback
 */
const LEAGUE_LOGOS: Record<string, string> = {
  'NBA': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nba.png',
  'NFL': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nfl.png',
  'MLB': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/mlb.png',
  'NHL': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nhl.png',
  'NCAAF': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/ncaa.png',
  'NCAAB': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/ncaa.png',
  'WNBA': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/wnba.png',
};

/**
 * Default Unit Talk logo
 */
const UNIT_TALK_LOGO = 'https://i.imgur.com/YQKdYUn.png';

/**
 * EMBED-FIX-031: Team abbreviation mapping for ESPN CDN
 * Maps common team names to ESPN team abbreviations
 */
const TEAM_ABBREVIATIONS: Record<string, Record<string, string>> = {
  NBA: {
    // Eastern Conference
    'hawks': 'atl', 'atlanta': 'atl', 'atlanta hawks': 'atl',
    'celtics': 'bos', 'boston': 'bos', 'boston celtics': 'bos',
    'nets': 'bkn', 'brooklyn': 'bkn', 'brooklyn nets': 'bkn',
    'hornets': 'cha', 'charlotte': 'cha', 'charlotte hornets': 'cha',
    'bulls': 'chi', 'chicago': 'chi', 'chicago bulls': 'chi',
    'cavaliers': 'cle', 'cleveland': 'cle', 'cleveland cavaliers': 'cle', 'cavs': 'cle',
    'pistons': 'det', 'detroit': 'det', 'detroit pistons': 'det',
    'pacers': 'ind', 'indiana': 'ind', 'indiana pacers': 'ind',
    'heat': 'mia', 'miami': 'mia', 'miami heat': 'mia',
    'bucks': 'mil', 'milwaukee': 'mil', 'milwaukee bucks': 'mil',
    'knicks': 'ny', 'new york': 'ny', 'new york knicks': 'ny',
    'magic': 'orl', 'orlando': 'orl', 'orlando magic': 'orl',
    '76ers': 'phi', 'philadelphia': 'phi', 'philadelphia 76ers': 'phi', 'sixers': 'phi',
    'raptors': 'tor', 'toronto': 'tor', 'toronto raptors': 'tor',
    'wizards': 'wsh', 'washington': 'wsh', 'washington wizards': 'wsh',
    // Western Conference
    'mavericks': 'dal', 'dallas': 'dal', 'dallas mavericks': 'dal', 'mavs': 'dal',
    'nuggets': 'den', 'denver': 'den', 'denver nuggets': 'den',
    'warriors': 'gs', 'golden state': 'gs', 'golden state warriors': 'gs',
    'rockets': 'hou', 'houston': 'hou', 'houston rockets': 'hou',
    'clippers': 'lac', 'la clippers': 'lac',
    'lakers': 'lal', 'los angeles lakers': 'lal', 'la lakers': 'lal',
    'grizzlies': 'mem', 'memphis': 'mem', 'memphis grizzlies': 'mem',
    'timberwolves': 'min', 'minnesota': 'min', 'minnesota timberwolves': 'min', 'wolves': 'min',
    'pelicans': 'no', 'new orleans': 'no', 'new orleans pelicans': 'no',
    'thunder': 'okc', 'oklahoma city': 'okc', 'oklahoma city thunder': 'okc',
    'suns': 'phx', 'phoenix': 'phx', 'phoenix suns': 'phx',
    'trail blazers': 'por', 'portland': 'por', 'portland trail blazers': 'por', 'blazers': 'por',
    'kings': 'sac', 'sacramento': 'sac', 'sacramento kings': 'sac',
    'spurs': 'sa', 'san antonio': 'sa', 'san antonio spurs': 'sa',
    'jazz': 'utah', 'utah jazz': 'utah',
  },
  NFL: {
    // AFC
    'bills': 'buf', 'buffalo': 'buf', 'buffalo bills': 'buf',
    'dolphins': 'mia', 'miami dolphins': 'mia',
    'patriots': 'ne', 'new england': 'ne', 'new england patriots': 'ne',
    'jets': 'nyj', 'new york jets': 'nyj',
    'ravens': 'bal', 'baltimore': 'bal', 'baltimore ravens': 'bal',
    'bengals': 'cin', 'cincinnati': 'cin', 'cincinnati bengals': 'cin',
    'browns': 'cle', 'cleveland browns': 'cle',
    'steelers': 'pit', 'pittsburgh': 'pit', 'pittsburgh steelers': 'pit',
    'texans': 'hou', 'houston texans': 'hou',
    'colts': 'ind', 'indianapolis': 'ind', 'indianapolis colts': 'ind',
    'jaguars': 'jax', 'jacksonville': 'jax', 'jacksonville jaguars': 'jax',
    'titans': 'ten', 'tennessee': 'ten', 'tennessee titans': 'ten',
    'broncos': 'den', 'denver broncos': 'den',
    'chiefs': 'kc', 'kansas city': 'kc', 'kansas city chiefs': 'kc',
    'raiders': 'lv', 'las vegas': 'lv', 'las vegas raiders': 'lv',
    'chargers': 'lac', 'los angeles chargers': 'lac', 'la chargers': 'lac',
    // NFC
    'cowboys': 'dal', 'dallas cowboys': 'dal',
    'giants': 'nyg', 'new york giants': 'nyg',
    'eagles': 'phi', 'philadelphia eagles': 'phi',
    'commanders': 'wsh', 'washington commanders': 'wsh',
    'bears': 'chi', 'chicago bears': 'chi',
    'lions': 'det', 'detroit lions': 'det',
    'packers': 'gb', 'green bay': 'gb', 'green bay packers': 'gb',
    'vikings': 'min', 'minnesota vikings': 'min',
    'falcons': 'atl', 'atlanta falcons': 'atl',
    'panthers': 'car', 'carolina': 'car', 'carolina panthers': 'car',
    'saints': 'no', 'new orleans saints': 'no',
    'buccaneers': 'tb', 'tampa bay': 'tb', 'tampa bay buccaneers': 'tb', 'bucs': 'tb',
    'cardinals': 'ari', 'arizona': 'ari', 'arizona cardinals': 'ari',
    'rams': 'lar', 'los angeles rams': 'lar', 'la rams': 'lar',
    '49ers': 'sf', 'san francisco': 'sf', 'san francisco 49ers': 'sf', 'niners': 'sf',
    'seahawks': 'sea', 'seattle': 'sea', 'seattle seahawks': 'sea',
  },
  MLB: {
    // AL East
    'orioles': 'bal', 'baltimore orioles': 'bal',
    'red sox': 'bos', 'boston red sox': 'bos',
    'yankees': 'nyy', 'new york yankees': 'nyy',
    'rays': 'tb', 'tampa bay rays': 'tb',
    'blue jays': 'tor', 'toronto blue jays': 'tor',
    // AL Central
    'white sox': 'chw', 'chicago white sox': 'chw',
    'guardians': 'cle', 'cleveland guardians': 'cle',
    'tigers': 'det', 'detroit tigers': 'det',
    'royals': 'kc', 'kansas city royals': 'kc',
    'twins': 'min', 'minnesota twins': 'min',
    // AL West
    'astros': 'hou', 'houston astros': 'hou',
    'angels': 'laa', 'los angeles angels': 'laa', 'la angels': 'laa',
    'athletics': 'oak', 'oakland': 'oak', 'oakland athletics': 'oak', 'as': 'oak',
    'mariners': 'sea', 'seattle mariners': 'sea',
    'rangers': 'tex', 'texas': 'tex', 'texas rangers': 'tex',
    // NL East
    'braves': 'atl', 'atlanta braves': 'atl',
    'marlins': 'mia', 'miami marlins': 'mia',
    'mets': 'nym', 'new york mets': 'nym',
    'phillies': 'phi', 'philadelphia phillies': 'phi',
    'nationals': 'wsh', 'washington nationals': 'wsh',
    // NL Central
    'cubs': 'chc', 'chicago cubs': 'chc',
    'reds': 'cin', 'cincinnati reds': 'cin',
    'brewers': 'mil', 'milwaukee brewers': 'mil',
    'pirates': 'pit', 'pittsburgh pirates': 'pit',
    'cardinals': 'stl', 'st louis': 'stl', 'st. louis cardinals': 'stl',
    // NL West
    'diamondbacks': 'ari', 'arizona diamondbacks': 'ari', 'dbacks': 'ari',
    'rockies': 'col', 'colorado': 'col', 'colorado rockies': 'col',
    'dodgers': 'lad', 'los angeles dodgers': 'lad', 'la dodgers': 'lad',
    'padres': 'sd', 'san diego': 'sd', 'san diego padres': 'sd',
    'giants': 'sf', 'san francisco giants': 'sf',
  },
  NHL: {
    // Atlantic
    'bruins': 'bos', 'boston bruins': 'bos',
    'sabres': 'buf', 'buffalo sabres': 'buf',
    'red wings': 'det', 'detroit red wings': 'det',
    'panthers': 'fla', 'florida': 'fla', 'florida panthers': 'fla',
    'canadiens': 'mtl', 'montreal': 'mtl', 'montreal canadiens': 'mtl',
    'senators': 'ott', 'ottawa': 'ott', 'ottawa senators': 'ott',
    'lightning': 'tb', 'tampa bay lightning': 'tb',
    'maple leafs': 'tor', 'toronto maple leafs': 'tor', 'leafs': 'tor',
    // Metropolitan
    'hurricanes': 'car', 'carolina hurricanes': 'car',
    'blue jackets': 'cbj', 'columbus': 'cbj', 'columbus blue jackets': 'cbj',
    'devils': 'njd', 'new jersey': 'njd', 'new jersey devils': 'njd',
    'islanders': 'nyi', 'new york islanders': 'nyi',
    'rangers': 'nyr', 'new york rangers': 'nyr',
    'flyers': 'phi', 'philadelphia flyers': 'phi',
    'penguins': 'pit', 'pittsburgh penguins': 'pit',
    'capitals': 'wsh', 'washington capitals': 'wsh',
    // Central
    'blackhawks': 'chi', 'chicago blackhawks': 'chi',
    'avalanche': 'col', 'colorado avalanche': 'col',
    'stars': 'dal', 'dallas stars': 'dal',
    'wild': 'min', 'minnesota wild': 'min',
    'predators': 'nsh', 'nashville': 'nsh', 'nashville predators': 'nsh',
    'blues': 'stl', 'st louis blues': 'stl', 'st. louis blues': 'stl',
    'jets': 'wpg', 'winnipeg': 'wpg', 'winnipeg jets': 'wpg',
    // Pacific
    'ducks': 'ana', 'anaheim': 'ana', 'anaheim ducks': 'ana',
    'flames': 'cgy', 'calgary': 'cgy', 'calgary flames': 'cgy',
    'oilers': 'edm', 'edmonton': 'edm', 'edmonton oilers': 'edm',
    'kings': 'la', 'los angeles kings': 'la', 'la kings': 'la',
    'sharks': 'sj', 'san jose': 'sj', 'san jose sharks': 'sj',
    'kraken': 'sea', 'seattle kraken': 'sea',
    'canucks': 'van', 'vancouver': 'van', 'vancouver canucks': 'van',
    'golden knights': 'vgk', 'vegas': 'vgk', 'vegas golden knights': 'vgk',
  },
};

/**
 * Get player headshot URL based on sport and player ID
 * Returns null if no valid URL can be constructed
 */
function getPlayerHeadshotUrl(sport: string, playerId: string | number | null): string | null {
  if (!playerId) return null;

  const sportUpper = sport?.toUpperCase() || '';
  const id = String(playerId);

  switch (sportUpper) {
    case 'NBA':
      return `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/1040x760/${id}.png`;
    case 'NFL':
      return `https://a.espncdn.com/i/headshots/nfl/players/full/${id}.png`;
    case 'MLB':
      return `https://img.mlbstatic.com/mlb-photos/image/upload/w_213,q_100/v1/people/${id}/headshot/67/current`;
    case 'NHL':
      return `https://assets.nhle.com/mugs/nhl/20232024/${id}.png`;
    case 'WNBA':
      return `https://ak-static.cms.nba.com/wp-content/uploads/headshots/wnba/latest/260x190/${id}.png`;
    default:
      return null;
  }
}

/**
 * Get team abbreviation from team name
 * EMBED-FIX-031: Comprehensive team abbreviation lookup
 */
function getTeamAbbreviation(sport: string, teamName: string): string | null {
  const sportUpper = sport?.toUpperCase() || '';
  const teamLower = teamName.toLowerCase().trim();

  const sportMap = TEAM_ABBREVIATIONS[sportUpper];
  if (!sportMap) return null;

  return sportMap[teamLower] || null;
}

/**
 * Get team logo URL
 * Uses ESPN CDN for team logos
 * EMBED-FIX-031: Implemented team abbreviation mapping
 */
function getTeamLogoUrl(sport: string, teamName: string | null): string | null {
  if (!teamName) return null;

  const sportUpper = sport?.toUpperCase() || '';
  const abbr = getTeamAbbreviation(sportUpper, teamName);

  if (!abbr) {
    // Fallback to league logo if no abbreviation found
    return LEAGUE_LOGOS[sportUpper] || null;
  }

  // ESPN team logo CDN format
  switch (sportUpper) {
    case 'NBA':
      return `https://a.espncdn.com/i/teamlogos/nba/500/${abbr}.png`;
    case 'NFL':
      return `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr}.png`;
    case 'MLB':
      return `https://a.espncdn.com/i/teamlogos/mlb/500/${abbr}.png`;
    case 'NHL':
      return `https://a.espncdn.com/i/teamlogos/nhl/500/${abbr}.png`;
    default:
      return LEAGUE_LOGOS[sportUpper] || null;
  }
}

/**
 * Get league logo URL
 */
function getLeagueLogoUrl(sport: string): string {
  return LEAGUE_LOGOS[sport?.toUpperCase()] || UNIT_TALK_LOGO;
}

/**
 * Get thumbnail URL with proper fallback chain
 *
 * Player props: headshot -> team logo -> league logo
 * Team bets: team logo -> league logo
 */
async function getThumbnailUrl(pick: UnifiedPickRow): Promise<string> {
  const sport = pick.sport?.toUpperCase() || 'NBA';
  const isPlayerProp = !!pick.player_name;

  if (isPlayerProp) {
    // Try player headshot first
    if (pick.player_id) {
      const headshotUrl = getPlayerHeadshotUrl(sport, pick.player_id);
      if (headshotUrl) {
        return headshotUrl;
      }
    }

    // Try to look up player ID from database
    if (pick.player_name) {
      try {
        const { data: player } = await supabase
          .from('players')
          .select('id, headshot_url')
          .eq('full_name', pick.player_name)
          .single();

        if (player?.headshot_url) {
          return player.headshot_url;
        }
        if (player?.id) {
          const headshotUrl = getPlayerHeadshotUrl(sport, player.id);
          if (headshotUrl) {
            return headshotUrl;
          }
        }
      } catch {
        // Ignore lookup errors, fall through to team logo
      }
    }

    // Fallback to team logo
    const teamLogo = getTeamLogoUrl(sport, pick.team || null);
    if (teamLogo) {
      return teamLogo;
    }
  } else {
    // Team bet - try team logo first
    const teamLogo = getTeamLogoUrl(sport, pick.team || pick.selection || null);
    if (teamLogo) {
      return teamLogo;
    }
  }

  // Final fallback: league logo
  return getLeagueLogoUrl(sport);
}

// ---- STAT TYPE NORMALIZATION ----

/**
 * EMBED-FIX-031: Normalize stat_type for display
 * Converts database stat_types to user-friendly display format
 */
const STAT_TYPE_DISPLAY_MAP: Record<string, string> = {
  'pts': 'PTS',
  'points': 'PTS',
  'ast': 'AST',
  'assists': 'AST',
  'reb': 'REB',
  'rebounds': 'REB',
  'trb': 'REB',
  '3pm': '3PM',
  'three_pointers_made': '3PM',
  'threes': '3PM',
  'stl': 'STL',
  'steals': 'STL',
  'blk': 'BLK',
  'blocks': 'BLK',
  'to': 'TO',
  'turnovers': 'TO',
  'pra': 'PRA',
  'pts_reb_ast': 'PRA',
  'pr': 'P+R',
  'pts_reb': 'P+R',
  'pa': 'P+A',
  'pts_ast': 'P+A',
  'ra': 'R+A',
  'reb_ast': 'R+A',
  'dd': 'DD',
  'double_double': 'DD',
  'td': 'TD',
  'triple_double': 'TD',
};

function normalizeStatType(statType: string | undefined | null): string {
  if (!statType) return '';
  const lower = statType.toLowerCase().trim();
  return STAT_TYPE_DISPLAY_MAP[lower] || statType.toUpperCase();
}

// ---- SELECTION PARSING (EMBED-TRUTH-FIX-031) ----

/**
 * EMBED-TRUTH-FIX-031: Parse player name from selection string
 * Handles formats like "LeBron James Over 27.5 PTS", "Kevin Durant Over 29.5 PTS"
 */
function parsePlayerNameFromSelection(selection: string | undefined): string | null {
  if (!selection) return null;

  // Pattern: "Player Name Over/Under Line Stat" e.g., "LeBron James Over 27.5 PTS"
  const playerPropPattern = /^([A-Za-z\s.'-]+)\s+(over|under)\s+[\d.]+/i;
  const match = selection.match(playerPropPattern);

  if (match && match[1]) {
    return match[1].trim();
  }

  return null;
}

/**
 * EMBED-TRUTH-FIX-031: Detect bet type from selection and stat_type
 * Returns bet_type based on analysis of available data
 */
// eslint-disable-next-line complexity
function detectBetTypeFromData(pick: UnifiedPickRow): string {
  const selection = (pick.selection || '').toLowerCase();
  const statType = (pick.stat_type || '').toLowerCase();

  // Player prop patterns: "Name Over/Under Line Stat"
  const playerPropPattern = /^[a-z\s.'-]+\s+(over|under)\s+[\d.]+/i;
  if (playerPropPattern.test(selection)) {
    return 'player_prop';
  }

  // Stat type indicates player prop
  const propStats = ['pts', 'ast', 'reb', '3pm', 'stl', 'blk', 'to', 'pra', 'pr', 'pa', 'ra', 'dd', 'td',
    'points', 'assists', 'rebounds', 'steals', 'blocks', 'turnovers'];
  if (propStats.includes(statType)) {
    return 'player_prop';
  }

  // Spread pattern: "Team -3.5" or "Team +3.5"
  if (selection.match(/[-+]\d+\.?\d*$/) || statType === 'spread') {
    return 'spread';
  }

  // Total pattern: "OVER 224.5" or "UNDER 224.5"
  if (selection.match(/^(over|under)\s+\d+\.?\d*$/i) || statType === 'total') {
    return 'total';
  }

  // Team total pattern: "Team OVER/UNDER Line"
  if (statType === 'team_total' || selection.match(/\s+(over|under)\s+\d+\.?\d*$/i)) {
    // If has a team name before over/under, it's team_total
    const teamTotalPattern = /^([a-z\s]+)\s+(over|under)\s+\d+\.?\d*$/i;
    if (teamTotalPattern.test(selection)) {
      return 'team_total';
    }
  }

  // Moneyline pattern: just a team name like "Lakers", "Celtics ML"
  if (statType === 'moneyline' || statType === 'ml' || selection.endsWith(' ml')) {
    return 'moneyline';
  }

  return 'moneyline'; // Default fallback
}

// ---- MARKET TYPE DETECTION ----

/**
 * Detect market type from pick data
 * EMBED-TRUTH-FIX-031: Enhanced with robust fallbacks
 */
function detectMarketType(pick: UnifiedPickRow): PickMarketType {
  const statType = (pick.stat_type || '').toLowerCase();
  const betType = (pick.bet_type || '').toLowerCase();

  // First: Check explicit bet_type if not default 'moneyline'
  if (betType === 'player_prop') return 'player_prop';
  if (betType === 'spread') return 'spread';
  if (betType === 'total') return 'total';
  if (betType === 'team_total') return 'team_total';

  // Player prop detection - check player_name OR parse from selection
  if (pick.player_name) {
    return 'player_prop';
  }

  // EMBED-TRUTH-FIX-031: Fallback - parse selection to detect player prop
  const parsedPlayerName = parsePlayerNameFromSelection(pick.selection);
  if (parsedPlayerName) {
    return 'player_prop';
  }

  // EMBED-TRUTH-FIX-031: Check stat_type for player prop indicators
  const propStats = ['pts', 'ast', 'reb', '3pm', 'stl', 'blk', 'to', 'pra'];
  if (propStats.includes(statType)) {
    return 'player_prop';
  }

  // Moneyline detection
  const mlTypes = ['moneyline', 'ml', 'money line', 'winner', 'to_win'];
  if (mlTypes.some(t => statType.includes(t) || betType.includes(t))) {
    return 'moneyline';
  }

  // Spread detection
  if (statType.includes('spread') || betType.includes('spread')) {
    return 'spread';
  }

  // Team total detection
  if (statType.includes('team_total') || betType.includes('team_total')) {
    return 'team_total';
  }

  // Total detection
  if (
    statType.includes('total') ||
    betType.includes('total') ||
    statType.includes('over') ||
    statType.includes('under')
  ) {
    return 'total';
  }

  // EMBED-TRUTH-FIX-031: Last resort - use detectBetTypeFromData
  const detected = detectBetTypeFromData(pick);
  if (detected === 'player_prop') return 'player_prop';
  if (detected === 'spread') return 'spread';
  if (detected === 'total') return 'total';
  if (detected === 'team_total') return 'team_total';

  return 'unknown';
}

/**
 * Get market label for display
 * EMBED-FIX-031: Use normalized stat types for cleaner display
 */
function getMarketLabel(pick: UnifiedPickRow, marketType: PickMarketType): string {
  switch (marketType) {
    case 'player_prop': {
      const normalized = normalizeStatType(pick.stat_type);
      // EMBED-FIX-031: Cleaner format - just the stat type, no "OU"
      return normalized || 'Player Prop';
    }
    case 'spread':
      return 'Spread';
    case 'moneyline':
      return 'Moneyline';
    case 'total':
      return 'Game Total';
    case 'team_total':
      return 'Team Total';
    default:
      // EMBED-FIX-031: Normalize unknown stat types
      return normalizeStatType(pick.stat_type) || 'Pick';
  }
}

// ---- TITLE BUILDING ----

/**
 * Build pick title based on market type
 * EMBED-FIX-031: Include stat_type in player prop titles
 * EMBED-TRUTH-FIX-031: Use parsed player name as fallback
 */
function buildPickTitle(pick: UnifiedPickRow, marketType: PickMarketType): string {
  const direction = (pick.direction || pick.side || pick.selection || '').toUpperCase();
  const line = pick.line;

  switch (marketType) {
    case 'player_prop': {
      // EMBED-TRUTH-FIX-031: Use parsed player name if player_name is missing
      const player = pick.player_name || parsePlayerNameFromSelection(pick.selection) || 'Unknown';
      const directionDisplay = direction.includes('OVER') ? 'Over' :
        direction.includes('UNDER') ? 'Under' : direction;
      // EMBED-FIX-031: Include stat_type in title for clarity
      const statType = normalizeStatType(pick.stat_type);
      if (line !== null && line !== undefined) {
        return statType
          ? `${player} ${directionDisplay} ${line} ${statType}`
          : `${player} ${directionDisplay} ${line}`;
      }
      return statType ? `${player} ${directionDisplay} ${statType}` : `${player} ${directionDisplay}`;
    }

    case 'spread': {
      const team = pick.team || pick.selection || 'Unknown';
      if (line !== null && line !== undefined) {
        const lineStr = line > 0 ? `+${line}` : `${line}`;
        return `${team} ${lineStr}`;
      }
      return team;
    }

    case 'moneyline': {
      return pick.team || pick.selection || 'Unknown';
    }

    case 'total': {
      const directionDisplay = direction.includes('OVER') ? 'Over' :
        direction.includes('UNDER') ? 'Under' : direction;
      return line !== null && line !== undefined
        ? `${directionDisplay} ${line}`
        : directionDisplay;
    }

    case 'team_total': {
      const team = pick.team || 'Team';
      const directionDisplay = direction.includes('OVER') ? 'Over' :
        direction.includes('UNDER') ? 'Under' : direction;
      return line !== null && line !== undefined
        ? `${team} ${directionDisplay} ${line}`
        : `${team} ${directionDisplay}`;
    }

    default:
      return pick.selection || pick.player_name || pick.team || 'Unknown Pick';
  }
}

// ---- CONTEXT LINE ----

/**
 * Get matchup from pick data (various sources)
 */
function getMatchup(pick: UnifiedPickRow): string | null {
  if (pick.matchup) return pick.matchup;
  if (pick.manual_fields_blob?.matchup) return pick.manual_fields_blob.matchup as string;
  if (pick.manual_matchup_home && pick.manual_matchup_away) {
    return `${pick.manual_matchup_away} @ ${pick.manual_matchup_home}`;
  }
  if (pick.meta?.matchup) return pick.meta.matchup as string;
  return null;
}

/**
 * Build context line (Sport + Matchup)
 */
function buildContextLine(pick: UnifiedPickRow): string {
  const parts: string[] = [];

  if (pick.sport) {
    parts.push(pick.sport.toUpperCase());
  }

  const matchup = getMatchup(pick);
  if (matchup) {
    parts.push(matchup);
  }

  return parts.join(' • ');
}

// ---- CAPPER NAME ----

/**
 * Get capper name from pick data
 */
function getCapperName(pick: UnifiedPickRow): string {
  const meta = pick.meta || {};
  return (
    (meta.capper as string) ||
    (meta.capper_name as string) ||
    (meta.capper_username as string) ||
    'Unit Talk'
  );
}

// ---- MAIN BUILDER ----

/**
 * Build a PickPresentation from a unified_picks row
 *
 * This is the canonical builder for all single pick presentations.
 * Handles all bet types and provides consistent formatting.
 */
export async function buildPickPresentation(pick: UnifiedPickRow): Promise<PickPresentation> {
  const marketType = detectMarketType(pick);
  const title = buildPickTitle(pick, marketType);
  const marketLabel = getMarketLabel(pick, marketType);
  const contextLine = buildContextLine(pick);
  const thumbnailUrl = await getThumbnailUrl(pick);

  return {
    title,
    odds_american: formatOddsAmerican(pick.odds),
    units: formatUnitsDisplay(pick.unit_size ?? pick.units),
    tier: pick.tier || 'C',
    capper_name: getCapperName(pick),
    market_label: marketLabel,
    context_line: contextLine,
    thumbnail_url: thumbnailUrl,
    market_type: marketType,
  };
}

export default {
  buildPickPresentation,
  formatUnitsDisplay,
  formatOddsAmerican,
};
