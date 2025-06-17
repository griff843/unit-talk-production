import { RawProp } from './types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface NormalizationResult {
  normalizedProp: RawProp;
  changes: string[];
  warnings: string[];
}

export function validateRawProp(prop: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (!prop.player_name && !prop.team) {
    errors.push('Either player_name or team must be provided');
  }

  if (!prop.stat_type) {
    errors.push('stat_type is required');
  }

  if (prop.line === null || prop.line === undefined) {
    errors.push('line is required');
  }

  if (!prop.over_odds && !prop.under_odds) {
    warnings.push('No odds provided');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function normalizeRawProp(prop: any): NormalizationResult {
  const changes: string[] = [];
  const warnings: string[] = [];

  const normalizedProp: RawProp = {
    ...prop,
    id: prop.id || crypto.randomUUID(),
    created_at: prop.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    scraped_at: prop.scraped_at || new Date().toISOString(),
    // Ensure all required fields have defaults
    player_name: prop.player_name || null,
    team: prop.team || null,
    stat_type: prop.stat_type || null,
    line: prop.line || null,
    over_odds: prop.over_odds || null,
    under_odds: prop.under_odds || null,
    game_time: prop.game_time || null,
    sport: prop.sport || null,
    matchup: prop.matchup || null,
    provider: prop.provider || null,
    external_game_id: prop.external_game_id || null,
    // Set all other optional fields to null if not provided
    edge_score: prop.edge_score || null,
    auto_approved: prop.auto_approved || null,
    context_flag: prop.context_flag || null,
    promoted_to_picks: prop.promoted_to_picks || null,
    game_id: prop.game_id || null,
    outcomes: prop.outcomes || null,
    player_id: prop.player_id || null,
    promoted_at: prop.promoted_at || null,
    unit_size: prop.unit_size || null,
    promoted: prop.promoted || null,
    ev_percent: prop.ev_percent || null,
    trend_score: prop.trend_score || null,
    matchup_score: prop.matchup_score || null,
    line_score: prop.line_score || null,
    role_score: prop.role_score || null,
    is_promoted: prop.is_promoted || null,
    is_alt_line: prop.is_alt_line || null,
    is_primary: prop.is_primary || null,
    is_valid: prop.is_valid || null,
    game_date: prop.game_date || null,
    trend_confidence: prop.trend_confidence || null,
    matchup_quality: prop.matchup_quality || null,
    line_value_score: prop.line_value_score || null,
    role_stability: prop.role_stability || null,
    confidence_score: prop.confidence_score || null,
    opponent: prop.opponent || null,
    direction: prop.direction || null,
    player_slug: prop.player_slug || null,
    sport_key: prop.sport_key || null,
    fair_odds: prop.fair_odds || null,
    source: prop.source || null,
    raw_data: prop.raw_data || null,
    odds: prop.odds || null,
    outcome: prop.outcome || null
  };

  if (!prop.id) {
    changes.push('Generated new UUID for id');
  }

  if (!prop.created_at) {
    changes.push('Set created_at to current timestamp');
  }

  return {
    normalizedProp,
    changes,
    warnings
  };
}