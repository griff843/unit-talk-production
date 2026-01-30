/**
 * Centralized weights configuration system
 * Maps sports to their specific scoring configurations
 * Eliminates magic numbers and provides type safety
 */

import * as fs from 'fs';

import { MLB_CONFIG } from './mlb';
import { NBA_CONFIG } from './nba';
import { NFL_CONFIG } from './nfl';
import { NHL_CONFIG } from './nhl';
import { ScoringConfig, SportSpecificWeights, validateWeightsV2 } from './types';

// Sport configuration registry
const SPORT_CONFIGS: Record<string, ScoringConfig> = {
  NBA: NBA_CONFIG,
  MLB: MLB_CONFIG,
  NFL: NFL_CONFIG,
  NHL: NHL_CONFIG,
  // Additional sports can be added here
  NCAAF: NFL_CONFIG, // Use NFL config as base for college football
  NCAAB: NBA_CONFIG, // Use NBA config as base for college basketball
  WNBA: NBA_CONFIG, // Use NBA config for WNBA
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

  // Always use V2 validation — the legacy validateWeights() has a double-counting
  // bug (types.ts:142-155) that causes ALL sport configs to fail, silently falling
  // back to NBA weights. Fixed in Tranche 6: validateWeightsV2 uses explicit key
  // lists and does not require sum=1.0 (computeScoreV2 normalizes by total weight).
  const result = validateWeightsV2(config.weights);
  if (!result.valid) {
    console.error(`❌ Invalid weights for ${sport}:`, result.issues);
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

    // Validate custom weights (using V2 validator — legacy has double-counting bug)
    for (const [sport, config] of Object.entries(customWeights as Record<string, any>)) {
      const result = validateWeightsV2(config.weights);
      if (!result.valid) {
        console.error(`❌ Invalid custom weights for sport: ${sport}`, result.issues);
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
  let allValid = true;

  for (const [sport, config] of Object.entries(SPORT_CONFIGS)) {
    // Always use V2 validation — legacy validateWeights() has double-counting bug.
    // See getScoringConfig() comment for details.
    const result = validateWeightsV2(config.weights);
    if (!result.valid) {
      console.error(`❌ Invalid configuration for ${sport}:`, result.issues);
      allValid = false;
    } else {
      console.log(`✅ Valid configuration for ${sport} (total: ${result.total.toFixed(4)})`);
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
