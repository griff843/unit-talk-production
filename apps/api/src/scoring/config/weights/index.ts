/**
 * Centralized weights configuration system
 * Maps sports to their specific scoring configurations
 * Eliminates magic numbers and provides type safety
 */

import { ScoringConfig, SportSpecificWeights, validateWeights, validateWeightsV2 } from './types';
import { NBA_CONFIG } from './nba';
import { MLB_CONFIG } from './mlb';
import { NFL_CONFIG } from './nfl';
import { NHL_CONFIG } from './nhl';
import * as fs from 'fs';
import * as path from 'path';

// Sport configuration registry
const SPORT_CONFIGS: Record<string, ScoringConfig> = {
  'NBA': NBA_CONFIG,
  'MLB': MLB_CONFIG,
  'NFL': NFL_CONFIG,
  'NHL': NHL_CONFIG,
  // Additional sports can be added here
  'NCAAF': NFL_CONFIG, // Use NFL config as base for college football
  'NCAAB': NBA_CONFIG, // Use NBA config as base for college basketball
  'WNBA': NBA_CONFIG,  // Use NBA config for WNBA
};

// Default configuration for unknown sports
const DEFAULT_CONFIG: ScoringConfig = NBA_CONFIG; // Use NBA as default

/**
 * Get scoring configuration for a specific sport
 */
export function getScoringConfig(sport: string): ScoringConfig {
  const normalizedSport = sport.toUpperCase();
  const config = SPORT_CONFIGS[normalizedSport];

  if (!config) {
    console.warn(`⚠️ No specific config for sport: ${sport}, using default (NBA)`);
    return DEFAULT_CONFIG;
  }

  // V2: use corrected validation with explicit key enumeration
  // computeScoreV2 normalizes by total weight, so sum != 1.0 is fine
  if (process.env.SCORING_ENGINE_V2 === 'true') {
    const result = validateWeightsV2(config.weights);
    if (!result.valid) {
      console.error(`❌ Invalid V2 weights for ${sport}:`, result.issues);
      return DEFAULT_CONFIG;
    }
    return config;
  }

  // Legacy: keep existing broken validation behavior (always fails → NBA fallback)
  if (!validateWeights(config.weights)) {
    console.error(`❌ Invalid weights for sport: ${sport}, weights don't sum to 1.0`);
    return DEFAULT_CONFIG;
  }

  return config;
}

/**
 * Get weights for a specific sport
 */
export function getSportWeights(sport: string): SportSpecificWeights {
  return getScoringConfig(sport).weights;
}

/**
 * Get all available sport configurations
 */
export function getAllSportConfigs(): Record<string, ScoringConfig> {
  return { ...SPORT_CONFIGS };
}

/**
 * Get list of supported sports
 */
export function getSupportedSports(): string[] {
  return Object.keys(SPORT_CONFIGS);
}

/**
 * Load custom weights from JSON file if SCORING_WEIGHTS_PATH is set
 */
export function loadCustomWeights(): Record<string, ScoringConfig> | null {
  const customPath = process.env.SCORING_WEIGHTS_PATH;
  
  if (!customPath) {
    return null;
  }
  
  try {
    if (!fs.existsSync(customPath)) {
      console.warn(`⚠️ Custom weights file not found: ${customPath}`);
      return null;
    }
    
    const customWeights = JSON.parse(fs.readFileSync(customPath, 'utf8'));
    console.log(`✅ Loaded custom weights from: ${customPath}`);
    
    // Validate custom weights
    for (const [sport, config] of Object.entries(customWeights as Record<string, any>)) {
      if (!validateWeights(config.weights)) {
        console.error(`❌ Invalid custom weights for sport: ${sport}`);
        delete customWeights[sport];
      }
    }
    
    return customWeights as Record<string, ScoringConfig>;
  } catch (error) {
    console.error(`❌ Failed to load custom weights: ${error}`);
    return null;
  }
}

/**
 * Initialize weights system with optional custom overrides
 */
export function initializeWeights(): Record<string, ScoringConfig> {
  const customWeights = loadCustomWeights();
  
  if (customWeights) {
    // Merge custom weights with defaults
    return { ...SPORT_CONFIGS, ...customWeights };
  }
  
  return SPORT_CONFIGS;
}

/**
 * Get feature weight by name for a specific sport
 * Returns 0 if feature not found (with warning)
 */
export function getFeatureWeight(sport: string, featureName: string): number {
  const config = getScoringConfig(sport);
  const weights = config.weights as any;
  
  if (!(featureName in weights)) {
    console.warn(`⚠️ Feature '${featureName}' not found in ${sport} weights, defaulting to 0`);
    return 0;
  }
  
  return weights[featureName];
}

/**
 * Validate all sport configurations at startup
 */
export function validateAllConfigurations(): boolean {
  const useV2 = process.env.SCORING_ENGINE_V2 === 'true';
  let allValid = true;

  for (const [sport, config] of Object.entries(SPORT_CONFIGS)) {
    if (useV2) {
      const result = validateWeightsV2(config.weights);
      if (!result.valid) {
        console.error(`❌ Invalid V2 configuration for ${sport}:`, result.issues);
        allValid = false;
      } else {
        console.log(`✅ Valid V2 configuration for ${sport} (total: ${result.total.toFixed(4)})`);
      }
    } else {
      if (!validateWeights(config.weights)) {
        console.error(`❌ Invalid configuration for ${sport}`);
        allValid = false;
      } else {
        console.log(`✅ Valid configuration for ${sport}`);
      }
    }
  }

  return allValid;
}

// Export individual configs for direct access
export { NBA_CONFIG, MLB_CONFIG, NFL_CONFIG, NHL_CONFIG };
export * from './types';

// Validate configurations on module load
if (process.env.NODE_ENV !== 'test') {
  validateAllConfigurations();
}