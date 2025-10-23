/**
 * Centralized weights configuration system
 * Maps sports to their specific scoring configurations
 * Eliminates magic numbers and provides type safety
 */
import { ScoringConfig, SportSpecificWeights } from './types';
import { NBA_CONFIG } from './nba';
import { MLB_CONFIG } from './mlb';
import { NFL_CONFIG } from './nfl';
import { NHL_CONFIG } from './nhl';
/**
 * Get scoring configuration for a specific sport
 */
export declare function getScoringConfig(sport: string): ScoringConfig;
/**
 * Get weights for a specific sport
 */
export declare function getSportWeights(sport: string): SportSpecificWeights;
/**
 * Get all available sport configurations
 */
export declare function getAllSportConfigs(): Record<string, ScoringConfig>;
/**
 * Get list of supported sports
 */
export declare function getSupportedSports(): string[];
/**
 * Load custom weights from JSON file if SCORING_WEIGHTS_PATH is set
 */
export declare function loadCustomWeights(): Record<string, ScoringConfig> | null;
/**
 * Initialize weights system with optional custom overrides
 */
export declare function initializeWeights(): Record<string, ScoringConfig>;
/**
 * Get feature weight by name for a specific sport
 * Returns 0 if feature not found (with warning)
 */
export declare function getFeatureWeight(sport: string, featureName: string): number;
/**
 * Validate all sport configurations at startup
 */
export declare function validateAllConfigurations(): boolean;
export { NBA_CONFIG, MLB_CONFIG, NFL_CONFIG, NHL_CONFIG };
export * from './types';
//# sourceMappingURL=index.d.ts.map