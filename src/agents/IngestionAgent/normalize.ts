import { RawProp, NormalizationResult } from './types';

/**
 * Normalize a raw prop for consistent data storage
 * @param prop - The raw prop to normalize
 * @returns RawProp - The normalized prop
 */
export function normalizeRawProp(prop: RawProp): RawProp {
  const normalized: RawProp = {
    ...prop,
    // Normalize string fields
    player_name: normalizeString(prop.player_name),
    team: normalizeTeam(prop.team),
    sport: normalizeString(prop.sport),
    stat_type: normalizeStatType(prop.stat_type),
    outcome: normalizeString(prop.outcome),
    direction: normalizeString(prop.direction),
    player_slug: normalizeSlug(prop.player_slug || prop.player_name),
    matchup: normalizeMatchup(prop.matchup),
    sport_key: normalizeString(prop.sport_key),
    provider: normalizeString(prop.provider),
    source: normalizeString(prop.source),
    
    // Normalize numeric fields
    line: normalizeNumber(prop.line),
    over_odds: normalizeOdds(prop.over_odds),
    under_odds: normalizeOdds(prop.under_odds),
    odds: normalizeOdds(prop.odds),
    
    // Normalize dates
    game_time: normalizeDate(prop.game_time),
    game_date: normalizeGameDate(prop.game_date || prop.game_time),
    scraped_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    
    // Normalize boolean fields
    is_valid: prop.is_valid ?? true,
    is_primary: prop.is_primary ?? false,
    is_alt_line: prop.is_alt_line ?? false,
    auto_approved: prop.auto_approved ?? false,
    context_flag: prop.context_flag ?? false,
    promoted: prop.promoted ?? false,
    is_promoted: prop.is_promoted ?? false,
    promoted_to_picks: prop.promoted_to_picks ?? false,
  };

  return normalized;
}

/**
 * Normalize a raw prop with detailed change tracking
 * @param prop - The raw prop to normalize
 * @returns NormalizationResult - Detailed normalization result
 */
export function normalizeRawPropDetailed(prop: RawProp): NormalizationResult {
  const original = { ...prop };
  const normalized = normalizeRawProp(prop);
  const changes: string[] = [];
  const warnings: string[] = [];

  // Track changes
  Object.keys(normalized).forEach(key => {
    const originalValue = (original as any)[key];
    const normalizedValue = (normalized as any)[key];
    if (originalValue !== normalizedValue) {
      changes.push(`${key}: "${originalValue}" -> "${normalizedValue}"`);
    }
  });

  // Add warnings for potential data quality issues
  if (!normalized.player_name) {
    warnings.push('Missing player name after normalization');
  }
  if (!normalized.stat_type) {
    warnings.push('Missing stat type after normalization');
  }
  if (normalized.line === null || normalized.line === undefined) {
    warnings.push('Missing line value after normalization');
  }

  return {
    normalized,
    changes,
    warnings
  };
}

/**
 * Normalize string fields - trim and handle nulls
 */
function normalizeString(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Normalize team names - uppercase and standardize
 */
function normalizeTeam(team: string | null | undefined): string | null {
  const normalized = normalizeString(team);
  if (!normalized) return null;
  
  // Convert to uppercase and handle common variations
  const upper = normalized.toUpperCase();
  
  // Team name mappings for consistency
  const teamMappings: Record<string, string> = {
    'LA LAKERS': 'LAL',
    'LOS ANGELES LAKERS': 'LAL',
    'GOLDEN STATE WARRIORS': 'GSW',
    'GOLDEN STATE': 'GSW',
    'BOSTON CELTICS': 'BOS',
    'NEW YORK KNICKS': 'NYK',
    'NEW YORK': 'NYK',
    // Add more mappings as needed
  };

  return teamMappings[upper] || upper;
}

/**
 * Normalize stat types - standardize common variations
 */
function normalizeStatType(statType: string | null | undefined): string | null {
  const normalized = normalizeString(statType);
  if (!normalized) return null;
  
  const upper = normalized.toUpperCase();
  
  // Stat type mappings for consistency
  const statMappings: Record<string, string> = {
    'POINTS': 'PTS',
    'ASSISTS': 'AST',
    'REBOUNDS': 'REB',
    'THREE_POINTERS_MADE': '3PM',
    'THREE POINTERS MADE': '3PM',
    'THREES_MADE': '3PM',
    'STEALS': 'STL',
    'BLOCKS': 'BLK',
    'TURNOVERS': 'TO',
    'FIELD_GOALS_MADE': 'FGM',
    'FIELD GOALS MADE': 'FGM',
    // Add more mappings as needed
  };

  return statMappings[upper] || upper;
}

/**
 * Normalize player slug - create URL-friendly version
 */
function normalizeSlug(name: string | null | undefined): string | null {
  const normalized = normalizeString(name);
  if (!normalized) return null;
  
  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Normalize matchup strings
 */
function normalizeMatchup(matchup: string | null | undefined): string | null {
  const normalized = normalizeString(matchup);
  if (!normalized) return null;
  
  // Standardize matchup format (TEAM1 vs TEAM2 or TEAM1 @ TEAM2)
  return normalized
    .replace(/\s+vs?\s+/gi, ' vs ')
    .replace(/\s+@\s+/gi, ' @ ')
    .toUpperCase();
}

/**
 * Normalize numeric values
 */
function normalizeNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? null : num;
}

/**
 * Normalize odds values
 */
function normalizeOdds(odds: number | string | null | undefined): number | null {
  const normalized = normalizeNumber(odds);
  if (normalized === null) return null;
  
  // Ensure odds are in American format (negative for favorites)
  // If odds are positive and less than 100, they might be decimal odds
  if (normalized > 0 && normalized < 100) {
    // Convert decimal odds to American odds
    return Math.round((normalized - 1) * 100);
  }
  
  return Math.round(normalized);
}

/**
 * Normalize date strings
 */
function normalizeDate(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return null;
    return dateObj.toISOString();
  } catch {
    return null;
  }
}

/**
 * Normalize game date (date only, no time)
 */
function normalizeGameDate(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return null;
    return dateObj.toISOString().split('T')[0]; // Return YYYY-MM-DD format
  } catch {
    return null;
  }
}