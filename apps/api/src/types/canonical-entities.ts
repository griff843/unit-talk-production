/**
 * Canonical Entity Types
 *
 * Type definitions for canonical entity resolution system.
 * Supports multi-feed mapping from Odds API, Optimal API, and other sources.
 *
 * Phase 2 - Step 1: Canonical Entity Resolution
 */

export type Sport = 'NFL' | 'NBA' | 'MLB' | 'NHL' | 'NCAAF' | 'NCAAB' | 'WNBA' | 'MLS' | 'EPL';

export type GameStatus = 'scheduled' | 'in_progress' | 'completed' | 'postponed' | 'cancelled';

export type PlayerStatus = 'active' | 'inactive' | 'injured' | 'suspended' | 'retired';

export type MappingSource = 'odds_api' | 'optimal_api' | 'manual' | 'espn' | 'sportsdata';

export type MappingMethod = 'exact' | 'fuzzy' | 'manual' | 'heuristic' | 'ml';

// =====================================================
// Canonical Entity Types
// =====================================================

export interface CanonicalGame {
  id: string;
  sport: Sport;
  league: string;
  season: string;
  home_team: string;
  away_team: string;
  home_team_alias?: string;
  away_team_alias?: string;
  game_time: string; // ISO 8601 timestamp
  venue?: string;
  status: GameStatus;
  home_score?: number;
  away_score?: number;
  external_ids: Record<string, string>; // e.g., { odds_api: "abc123", optimal_api: "xyz789" }
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CanonicalPlayer {
  id: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  sport: Sport;
  current_team?: string;
  position?: string;
  jersey_number?: string;
  status: PlayerStatus;
  name_variations: string[]; // For fuzzy matching
  external_ids: Record<string, string>;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Mapping Types
// =====================================================

export interface GameMapping {
  id: string;
  canonical_game_id: string;
  source: MappingSource;
  external_game_id: string;
  confidence_score: number; // 0.0 to 1.0
  mapping_method: MappingMethod;
  is_primary: boolean;
  conflict_count: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  last_verified_at?: string;
}

export interface PlayerMapping {
  id: string;
  canonical_player_id: string;
  source: MappingSource;
  external_player_id?: string;
  external_player_name: string;
  confidence_score: number;
  mapping_method: MappingMethod;
  similarity_score?: number; // For fuzzy matching
  is_primary: boolean;
  conflict_count: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  last_verified_at?: string;
}

export interface PropMapping {
  id: string;
  canonical_game_id?: string;
  canonical_player_id?: string;
  stat_type: string;
  line: number;
  source: MappingSource;
  external_prop_id: string;
  over_odds?: number;
  under_odds?: number;
  confidence_score: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Input Types for Mapping
// =====================================================

export interface ExternalGameData {
  source: MappingSource;
  external_game_id: string;
  sport: Sport;
  league: string;
  home_team: string;
  away_team: string;
  game_time: string;
  venue?: string;
  season?: string;
  metadata?: Record<string, any>;
}

export interface ExternalPlayerData {
  source: MappingSource;
  external_player_id?: string;
  player_name: string; // Name as it appears in external source
  sport: Sport;
  team?: string;
  position?: string;
  metadata?: Record<string, any>;
}

export interface ExternalPropData {
  source: MappingSource;
  external_prop_id: string;
  external_game_id?: string;
  player_name: string;
  stat_type: string;
  line: number;
  over_odds?: number;
  under_odds?: number;
  sport: Sport;
  metadata?: Record<string, any>;
}

// =====================================================
// Mapping Result Types
// =====================================================

export interface GameMappingResult {
  success: boolean;
  canonical_game_id?: string;
  canonical_game?: CanonicalGame;
  mapping?: GameMapping;
  confidence_score: number;
  method: MappingMethod;
  is_new_game: boolean;
  conflicts?: GameMappingConflict[];
  error?: string;
}

export interface PlayerMappingResult {
  success: boolean;
  canonical_player_id?: string;
  canonical_player?: CanonicalPlayer;
  mapping?: PlayerMapping;
  confidence_score: number;
  similarity_score?: number;
  method: MappingMethod;
  is_new_player: boolean;
  conflicts?: PlayerMappingConflict[];
  error?: string;
}

export interface PropMappingResult {
  success: boolean;
  prop_mapping_id?: string;
  canonical_game_id?: string;
  canonical_player_id?: string;
  confidence_score: number;
  error?: string;
}

// =====================================================
// Conflict Types
// =====================================================

export interface GameMappingConflict {
  external_game_id: string;
  source: MappingSource;
  possible_matches: Array<{
    canonical_game_id: string;
    canonical_game: CanonicalGame;
    confidence_score: number;
    reason: string;
  }>;
}

export interface PlayerMappingConflict {
  external_player_name: string;
  source: MappingSource;
  possible_matches: Array<{
    canonical_player_id: string;
    canonical_player: CanonicalPlayer;
    confidence_score: number;
    similarity_score: number;
    reason: string;
  }>;
}

// =====================================================
// Mapping Configuration
// =====================================================

export interface MappingConfig {
  // Confidence score thresholds
  exact_match_threshold: number; // Default: 1.0
  high_confidence_threshold: number; // Default: 0.9
  medium_confidence_threshold: number; // Default: 0.7
  low_confidence_threshold: number; // Default: 0.5

  // Fuzzy matching parameters
  name_similarity_threshold: number; // Default: 0.8 (80% similar)
  use_fuzzy_matching: boolean; // Default: true

  // Time tolerance for game matching
  game_time_tolerance_minutes: number; // Default: 60 (1 hour)

  // Auto-create behavior
  auto_create_canonical_entities: boolean; // Default: true
  auto_create_confidence_threshold: number; // Default: 0.9

  // Conflict handling
  auto_resolve_conflicts: boolean; // Default: false
  prefer_source?: MappingSource; // Which source to prefer in conflicts
}

// =====================================================
// Mapping Statistics
// =====================================================

export interface MappingStatistics {
  source: MappingSource;
  total_mappings: number;
  successful_mappings: number;
  failed_mappings: number;
  conflict_mappings: number;
  avg_confidence_score: number;
  mapping_methods: Record<MappingMethod, number>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Batch Mapping Types
// =====================================================

export interface BatchMappingRequest {
  games?: ExternalGameData[];
  players?: ExternalPlayerData[];
  props?: ExternalPropData[];
}

export interface BatchMappingResult {
  games: GameMappingResult[];
  players: PlayerMappingResult[];
  props: PropMappingResult[];
  statistics: {
    total_processed: number;
    successful: number;
    failed: number;
    conflicts: number;
    duration_ms: number;
  };
}

// =====================================================
// Heuristic Matching Types
// =====================================================

export interface TeamNameMatch {
  canonical_name: string;
  variations: string[]; // Common abbreviations, full names, city names
  aliases: string[];
}

export interface NameSimilarityResult {
  name1: string;
  name2: string;
  similarity_score: number; // 0.0 to 1.0 (Levenshtein distance based)
  is_match: boolean;
  method: 'exact' | 'fuzzy' | 'soundex';
}

// =====================================================
// Operator Review Types
// =====================================================

export interface MappingConflictReview {
  id: string;
  type: 'game' | 'player' | 'prop';
  source: MappingSource;
  external_id: string;
  external_name?: string;
  possible_canonical_matches: Array<{
    id: string;
    name: string;
    confidence: number;
    metadata: Record<string, any>;
  }>;
  recommended_action: 'auto_resolve' | 'manual_review' | 'create_new';
  operator_notes?: string;
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
}

// =====================================================
// Export all types
// =====================================================

export type CanonicalEntityType = CanonicalGame | CanonicalPlayer;
export type MappingType = GameMapping | PlayerMapping | PropMapping;
export type MappingResultType = GameMappingResult | PlayerMappingResult | PropMappingResult;
