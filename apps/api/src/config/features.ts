/**
 * Feature Flags Configuration
 *
 * Centralized feature flag management for gradual rollouts and A/B testing
 */

// Environment-based feature flags
export const FEATURE_FLAGS = {
  /**
   * USE_VIEWS - Enable new database views for read models
   * Default: ON
   *
   * When enabled:
   * - Command Center reads from v_daily_board
   * - API feed reads from v_prop_read_model
   * - Approvals read from v_open_promotions
   * - Scoring writes to scored_props table
   * - Approval workflow uses RPCs (submit_pick, approve_pick, deny_pick)
   *
   * When disabled:
   * - Falls back to direct table queries with hand-rolled joins
   */
  USE_VIEWS: process.env.USE_VIEWS !== '0', // Default ON, set USE_VIEWS=0 to disable

  /**
   * USE_PRO_SCORER - Enable Enhanced45Factor scoring system
   */
  USE_PRO_SCORER: process.env.USE_PRO_SCORER === 'true',

  /**
   * USE_ENHANCED_45_FACTOR - Enable 45-factor professional scoring
   */
  USE_ENHANCED_45_FACTOR: process.env.USE_ENHANCED_45_FACTOR === 'true',

  /**
   * SHADOW_MODE - Run new system alongside old without switching over
   */
  SHADOW_MODE: process.env.SHADOW_MODE === 'true',

  /**
   * PUBLISH_TO_DISCORD - Enable Discord posting
   */
  PUBLISH_TO_DISCORD: process.env.PUBLISH_TO_DISCORD === 'true',
} as const;

/**
 * Runtime feature flag checker
 */
export function isFeatureEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag];
}

/**
 * Legacy compatibility - export individual flags
 */
export const USE_VIEWS = FEATURE_FLAGS.USE_VIEWS;
export const USE_PRO_SCORER = FEATURE_FLAGS.USE_PRO_SCORER;
export const USE_ENHANCED_45_FACTOR = FEATURE_FLAGS.USE_ENHANCED_45_FACTOR;
export const SHADOW_MODE = FEATURE_FLAGS.SHADOW_MODE;
export const PUBLISH_TO_DISCORD = FEATURE_FLAGS.PUBLISH_TO_DISCORD;
