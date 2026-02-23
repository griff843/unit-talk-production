/* eslint-disable max-lines -- Type definition file, inherently long */
/**
 * Enhanced Supabase Types with Complete Schema Alignment
 * Updated to match Fortune 100-grade database structure
 * Includes all enhanced scoring metrics and professional capper features
 *
 * SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Canonical types imported from shared-types
 * @lint-cleanup SPRINT-LINT-CLEANUP-TBD: Consider splitting into domain-specific type modules
 */

import { z } from 'zod';

// Import canonical types from shared-types
import type { GamesRow, TeamsRow, PlayersRow, AgentHealthRow } from '@unit-talk/shared-types';

// Re-export canonical types
export type Game = GamesRow;
export type Team = TeamsRow;
export type Player = PlayersRow;
export type AgentHealth = AgentHealthRow;

// =============================================================================
// ENHANCED RAW PROP INTERFACE - Aligned with Migration Schema
// =============================================================================

export interface EnhancedRawProp {
  // Core identification
  id: string;
  game_id: string;
  player_id: string;
  player_name: string;
  team: string;
  opponent: string;

  // Market details
  market: string;
  market_type: string;
  line: number;
  over: number;
  under: number;
  over_odds: number;
  under_odds: number;

  // Grading system fields (CRITICAL - fixes agent failures)
  outcome?: 'win' | 'loss' | 'push' | null;
  promoted_to_picks: boolean;
  promoted_at?: string;

  // Enhanced scoring metrics (fixes NULL scoring issue)
  trend_confidence?: number;
  edge_score?: number;
  matchup_quality?: number;
  expected_value?: number;
  sharp_money?: number;
  line_movement?: number;
  player_form?: number;
  injury_impact?: number;
  weather_impact?: number;
  market_intelligence?: number;
  volume_profile?: number;
  closing_line_value?: number;

  // Professional capper features (from capper insights analysis)
  steam_detected: boolean;
  predicted_closing_line?: number;
  optimal_betting_time?: string;
  best_available_line?: number;
  best_book?: string;
  public_betting_percentage?: number;
  sharp_betting_percentage?: number;
  contrarian_opportunity: boolean;
  injury_timing_advantage?: number;
  cross_market_arbitrage?: number;

  // Additional scoring factors for risk management
  player_fatigue?: number;
  venue_advantage?: number;
  referee_impact?: number;
  pace_impact?: number;
  motivational_factors?: number;
  correlation_risk?: number;
  volatility?: number;
  portfolio_impact?: number;
  bid_ask_spread?: number;

  // Data quality tracking
  data_completeness?: number;
  outlier_score?: number;
  consistency_score?: number;
  data_validation_score?: number;

  // Standard fields
  source: string;
  league: string;
  game_date?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export const EnhancedRawPropSchema = z.object({
  id: z.string().uuid(),
  game_id: z.string().uuid(),
  player_id: z.string().uuid(),
  player_name: z.string(),
  team: z.string(),
  opponent: z.string(),
  market: z.string(),
  market_type: z.string(),
  line: z.number(),
  over: z.number(),
  under: z.number(),
  over_odds: z.number(),
  under_odds: z.number(),

  // Grading system
  outcome: z.enum(['win', 'loss', 'push']).nullable().optional(),
  promoted_to_picks: z.boolean().default(false),
  promoted_at: z.string().datetime().optional(),

  // Enhanced scoring metrics
  trend_confidence: z.number().optional(),
  edge_score: z.number().optional(),
  matchup_quality: z.number().optional(),
  expected_value: z.number().optional(),
  sharp_money: z.number().optional(),
  line_movement: z.number().optional(),
  player_form: z.number().optional(),
  injury_impact: z.number().optional(),
  weather_impact: z.number().optional(),
  market_intelligence: z.number().optional(),
  volume_profile: z.number().optional(),
  closing_line_value: z.number().optional(),

  // Professional capper features
  steam_detected: z.boolean().default(false),
  predicted_closing_line: z.number().optional(),
  optimal_betting_time: z.string().optional(),
  best_available_line: z.number().optional(),
  best_book: z.string().optional(),
  public_betting_percentage: z.number().optional(),
  sharp_betting_percentage: z.number().optional(),
  contrarian_opportunity: z.boolean().default(false),
  injury_timing_advantage: z.number().optional(),
  cross_market_arbitrage: z.number().optional(),

  // Risk management factors
  player_fatigue: z.number().optional(),
  venue_advantage: z.number().optional(),
  referee_impact: z.number().optional(),
  pace_impact: z.number().optional(),
  motivational_factors: z.number().optional(),
  correlation_risk: z.number().optional(),
  volatility: z.number().default(5),
  portfolio_impact: z.number().optional(),
  bid_ask_spread: z.number().default(0.02),

  // Data quality
  data_completeness: z.number().default(0.95),
  outlier_score: z.number().default(0.95),
  consistency_score: z.number().default(0.95),
  data_validation_score: z.number().default(0.95),

  // Standard
  source: z.string().default('optimal'),
  league: z.string(),
  game_date: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// GRADING RESULTS TABLE
// =============================================================================

export interface GradingResult {
  id: string;
  prop_id: string;
  final_score: number;
  confidence: number;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  edge_score?: number;
  kelly_fraction?: number;
  position_size?: number;
  risk_score?: number;

  // Feature attribution (JSONB for flexibility)
  feature_contributions?: Record<string, unknown>;
  model_contributions?: Record<string, unknown>;
  scenario_analysis?: Record<string, unknown>;
  professional_insights?: Record<string, unknown>;
  enhanced_capper_analysis?: Record<string, unknown>;

  // Quality metrics
  data_quality?: number;
  model_agreement?: number;
  historical_accuracy?: number;

  // Metadata
  model_version?: string;
  config_used?: string;
  created_at: string;
  updated_at: string;
}

export const GradingResultSchema = z.object({
  id: z.string().uuid(),
  prop_id: z.string().uuid(),
  final_score: z.number(),
  confidence: z.number(),
  tier: z.enum(['S', 'A', 'B', 'C', 'D']),
  edge_score: z.number().optional(),
  kelly_fraction: z.number().optional(),
  position_size: z.number().optional(),
  risk_score: z.number().optional(),
  feature_contributions: z.record(z.unknown()).optional(),
  model_contributions: z.record(z.unknown()).optional(),
  scenario_analysis: z.record(z.unknown()).optional(),
  professional_insights: z.record(z.unknown()).optional(),
  enhanced_capper_analysis: z.record(z.unknown()).optional(),
  data_quality: z.number().default(0.95),
  model_agreement: z.number().optional(),
  historical_accuracy: z.number().optional(),
  model_version: z.string().optional(),
  config_used: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// =============================================================================
// ENHANCED FINAL PICKS TABLE
// =============================================================================

export interface EnhancedUnifiedPick {
  id: string;
  raw_prop_id: string;
  grading_result_id?: string;

  // Pick details
  player_name: string;
  market_type: string;
  line: number;
  odds: number;

  // Grading results
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  confidence: number;
  score: number;
  edge_score?: number;
  position_size?: number;
  kelly_fraction?: number;
  risk_score?: number;

  // Status tracking
  play_status: 'pending' | 'approved' | 'rejected' | 'settled';
  result: 'win' | 'loss' | 'push' | 'pending';

  // Settlement
  actual_result?: number;
  profit_loss?: number;
  settled_at?: string;

  created_at: string;
  updated_at: string;
}

export const EnhancedUnifiedPickSchema = z.object({
  id: z.string().uuid(),
  raw_prop_id: z.string().uuid(),
  grading_result_id: z.string().uuid().optional(),
  player_name: z.string(),
  market_type: z.string(),
  line: z.number(),
  odds: z.number(),
  tier: z.enum(['S', 'A', 'B', 'C', 'D']),
  confidence: z.number(),
  score: z.number(),
  edge_score: z.number().optional(),
  position_size: z.number().optional(),
  kelly_fraction: z.number().optional(),
  risk_score: z.number().optional(),
  play_status: z.enum(['pending', 'approved', 'rejected', 'settled']).default('pending'),
  result: z.enum(['win', 'loss', 'push', 'pending']).default('pending'),
  actual_result: z.number().optional(),
  profit_loss: z.number().optional(),
  settled_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// =============================================================================
// CAPPER PROFILES TABLE (Fixed naming)
// =============================================================================

export interface CapperProfile {
  id: string;
  discord_id: string;
  username: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'vip' | 'vip_plus';
  total_picks: number;
  wins: number;
  losses: number;
  pushes: number;
  win_rate: number; // Generated column
  roi: number;
  units_won: number;
  streak_current: number;
  streak_type: 'win' | 'loss' | 'none';
  created_at: string;
  updated_at: string;
}

export const CapperProfileSchema = z.object({
  id: z.string().uuid(),
  discord_id: z.string(),
  username: z.string(),
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum', 'vip', 'vip_plus']).default('bronze'),
  total_picks: z.number().default(0),
  wins: z.number().default(0),
  losses: z.number().default(0),
  pushes: z.number().default(0),
  win_rate: z.number(), // This is a generated column
  roi: z.number().default(0),
  units_won: z.number().default(0),
  streak_current: z.number().default(0),
  streak_type: z.enum(['win', 'loss', 'none']).default('none'),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// =============================================================================
// ML FEATURES TABLE
// =============================================================================

export interface MLFeatures {
  id: string;
  prop_id: string;

  // Core ML features
  neural_network_score?: number;
  gradient_boosting_score?: number;
  random_forest_score?: number;
  ensemble_score?: number;
  model_agreement?: number;

  // Feature importance weights
  feature_weights?: Record<string, unknown>;

  // Historical performance context
  similar_props_performance?: Record<string, unknown>;
  player_historical_performance?: Record<string, unknown>;

  model_version?: string;
  created_at: string;
}

export const MLFeaturesSchema = z.object({
  id: z.string().uuid(),
  prop_id: z.string().uuid(),
  neural_network_score: z.number().optional(),
  gradient_boosting_score: z.number().optional(),
  random_forest_score: z.number().optional(),
  ensemble_score: z.number().optional(),
  model_agreement: z.number().optional(),
  feature_weights: z.record(z.unknown()).optional(),
  similar_props_performance: z.record(z.unknown()).optional(),
  player_historical_performance: z.record(z.unknown()).optional(),
  model_version: z.string().optional(),
  created_at: z.string().datetime(),
});

// =============================================================================
// SETTLEMENT TRACKING TABLE
// =============================================================================

export interface SettlementTracking {
  id: string;
  pick_id: string;
  game_id?: string;

  // Settlement details
  settlement_source: string; // 'odds_api', 'manual', 'espn'
  original_line: number;
  actual_result?: number;
  settlement_status: 'pending' | 'settled' | 'void' | 'disputed';

  // Timing
  game_completed_at?: string;
  settlement_attempted_at?: string;
  settled_at?: string;

  // Error tracking
  settlement_errors?: Record<string, unknown>;
  retry_count: number;

  created_at: string;
  updated_at: string;
}

export const SettlementTrackingSchema = z.object({
  id: z.string().uuid(),
  pick_id: z.string().uuid(),
  game_id: z.string().uuid().optional(),
  settlement_source: z.string(),
  original_line: z.number(),
  actual_result: z.number().optional(),
  settlement_status: z.enum(['pending', 'settled', 'void', 'disputed']).default('pending'),
  game_completed_at: z.string().datetime().optional(),
  settlement_attempted_at: z.string().datetime().optional(),
  settled_at: z.string().datetime().optional(),
  settlement_errors: z.record(z.unknown()).optional(),
  retry_count: z.number().default(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// =============================================================================
// EXISTING TABLES (Updated for consistency)
// Game, Team, Player, AgentHealth now imported from shared-types (see top of file)
// =============================================================================

export interface AgentLog {
  id: string;
  agent: string;
  level: string;
  message: string;
  context?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentMetrics {
  id: string;
  agent: string;
  metrics: Record<string, number>;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// COMPLETE DATABASE TABLES TYPE
// =============================================================================

export interface EnhancedTables {
  raw_props: {
    Row: EnhancedRawProp;
    Insert: Omit<EnhancedRawProp, 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<Omit<EnhancedRawProp, 'id' | 'created_at'>>;
  };
  grading_results: {
    Row: GradingResult;
    Insert: Omit<GradingResult, 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<Omit<GradingResult, 'id' | 'created_at'>>;
  };
  unified_picks: {
    Row: EnhancedUnifiedPick;
    Insert: Omit<EnhancedUnifiedPick, 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<Omit<EnhancedUnifiedPick, 'id' | 'created_at'>>;
  };
  capper_profiles: {
    Row: CapperProfile;
    Insert: Omit<CapperProfile, 'id' | 'created_at' | 'updated_at' | 'win_rate'>;
    Update: Partial<Omit<CapperProfile, 'id' | 'created_at' | 'win_rate'>>;
  };
  ml_features: {
    Row: MLFeatures;
    Insert: Omit<MLFeatures, 'id' | 'created_at'>;
    Update: Partial<Omit<MLFeatures, 'id' | 'created_at'>>;
  };
  settlement_tracking: {
    Row: SettlementTracking;
    Insert: Omit<SettlementTracking, 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<Omit<SettlementTracking, 'id' | 'created_at'>>;
  };
  games: {
    Row: Game;
    Insert: Omit<Game, 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<Omit<Game, 'id' | 'created_at'>>;
  };
  teams: {
    Row: Team;
    Insert: Omit<Team, 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<Omit<Team, 'id' | 'created_at'>>;
  };
  players: {
    Row: Player;
    Insert: Omit<Player, 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<Omit<Player, 'id' | 'created_at'>>;
  };
  agent_logs: {
    Row: AgentLog;
    Insert: Omit<AgentLog, 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<Omit<AgentLog, 'id' | 'created_at'>>;
  };
  agent_health: {
    Row: AgentHealth;
    Insert: Omit<AgentHealth, 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<Omit<AgentHealth, 'id' | 'created_at'>>;
  };
  agent_metrics: {
    Row: AgentMetrics;
    Insert: Omit<AgentMetrics, 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<Omit<AgentMetrics, 'id' | 'created_at'>>;
  };
}

// Enhanced Database interface
export interface EnhancedDatabase {
  public: {
    Tables: EnhancedTables;
  };
}

// Type helpers for easy access
export type TableRow<T extends keyof EnhancedTables> = EnhancedTables[T]['Row'];
export type TableInsert<T extends keyof EnhancedTables> = EnhancedTables[T]['Insert'];
export type TableUpdate<T extends keyof EnhancedTables> = EnhancedTables[T]['Update'];

// Backward compatibility alias
export type RawProp = EnhancedRawProp;
export type UnifiedPick = EnhancedUnifiedPick;

// Export schemas for validation
export const VALIDATION_SCHEMAS = {
  raw_props: EnhancedRawPropSchema,
  grading_results: GradingResultSchema,
  unified_picks: EnhancedUnifiedPickSchema,
  capper_profiles: CapperProfileSchema,
  ml_features: MLFeaturesSchema,
  settlement_tracking: SettlementTrackingSchema,
} as const;
