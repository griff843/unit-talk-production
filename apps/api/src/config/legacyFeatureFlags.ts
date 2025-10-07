/**
 * Legacy Feature Flags
 *
 * Controls which legacy modules are enabled in the system.
 * All legacy features are DISABLED by default for production safety.
 *
 * @date 2025-09-30 - Migration to event-first Odds API → unified_picks pipeline
 */

export interface LegacyFeatureFlags {
  /**
   * GradingAgent - DEPRECATED
   * Replaced by: SettlementAgent for post-game win/loss determination
   * Note: ScoringAgent handles pre-game pick quality scoring (different purpose)
   * Status: LEGACY_DISABLED 2025-09-30
   */
  GRADING_AGENT_ENABLED: boolean;

  /**
   * raw_props table - DEPRECATED
   * Replaced by: unified_picks table with event-first architecture
   * Status: LEGACY_DISABLED 2025-09-30
   */
  RAW_PROPS_TABLE_ENABLED: boolean;

  /**
   * Direct raw_props writes - DEPRECATED
   * Replaced by: Event-first writes to unified_picks only
   * Status: LEGACY_DISABLED 2025-09-30
   */
  RAW_PROPS_INGESTION_ENABLED: boolean;

  /**
   * Unified picks only mode - PRODUCTION
   * Forces all data through unified_picks pipeline
   * Status: ENABLED - Production standard
   */
  UNIFIED_PICKS_ONLY: boolean;

  /**
   * Strict mode - PRODUCTION
   * API fails fast if any legacy module attempts to register
   * Status: ENABLED - Production safety
   */
  STRICT_MODE: boolean;
}

/**
 * Production-safe defaults
 * CORRECTED: raw_props IS THE ENTRY POINT (verified Oct 6, 2025)
 * Flow: raw_props → market_props → scored_props → promotion_queue → Discord
 */
export const LEGACY_FEATURE_FLAGS: LegacyFeatureFlags = {
  // ENABLED FOR PRODUCTION (verified working Oct 6, 2025)
  GRADING_AGENT_ENABLED: false,           // Still disabled (replaced by SettlementAgent)
  RAW_PROPS_TABLE_ENABLED: true,          // ✅ ENABLED - Entry point for all props
  RAW_PROPS_INGESTION_ENABLED: true,      // ✅ ENABLED - Required for data flow

  // Modern production features
  UNIFIED_PICKS_ONLY: false,              // ❌ DISABLED - Using raw_props → market_props flow
  STRICT_MODE: false,                     // ❌ DISABLED - Allow raw_props ingestion
};

/**
 * Get feature flag value with environment override support
 * Environment variables take precedence for emergency rollback scenarios
 */
export function getFeatureFlag(flag: keyof LegacyFeatureFlags): boolean {
  const envOverride = process.env[`FEATURE_${flag}`];
  if (envOverride !== undefined) {
    return envOverride.toLowerCase() === 'true';
  }
  return LEGACY_FEATURE_FLAGS[flag];
}

/**
 * Validate that no legacy features are enabled in production
 * Throws error if any legacy feature is enabled with STRICT_MODE on
 */
export function validateProductionFlags(): void {
  const strictMode = getFeatureFlag('STRICT_MODE');

  if (!strictMode) {
    return; // Validation disabled
  }

  const enabledLegacyFeatures: string[] = [];

  if (getFeatureFlag('GRADING_AGENT_ENABLED')) {
    enabledLegacyFeatures.push('GRADING_AGENT_ENABLED');
  }

  if (getFeatureFlag('RAW_PROPS_TABLE_ENABLED')) {
    enabledLegacyFeatures.push('RAW_PROPS_TABLE_ENABLED');
  }

  if (getFeatureFlag('RAW_PROPS_INGESTION_ENABLED')) {
    enabledLegacyFeatures.push('RAW_PROPS_INGESTION_ENABLED');
  }

  if (enabledLegacyFeatures.length > 0) {
    throw new Error(
      `❌ FATAL: Legacy features enabled in STRICT_MODE:\n` +
      enabledLegacyFeatures.map(f => `  - ${f}`).join('\n') +
      `\n\n` +
      `These features are DEPRECATED and must not be enabled in production.\n` +
      `Set these environment variables to false or remove them:\n` +
      enabledLegacyFeatures.map(f => `  FEATURE_${f}=false`).join('\n')
    );
  }
}

/**
 * Get all enabled agents for logging
 */
export function getEnabledAgents(): string[] {
  return [
    'FeedAgent',        // Odds API event-first ingestion
    'ScoringAgent',     // Enhanced45Factor 195-factor pre-game scoring
    'SettlementAgent',  // Post-game win/loss determination
    'AlertAgent',       // Discord notifications & alerts
    'RecapAgent',       // Post-game recaps
    'OperatorAgent',    // System operations
  ];
}

/**
 * Get all disabled/legacy agents for logging
 */
export function getDisabledAgents(): string[] {
  const disabled: string[] = [];

  if (!getFeatureFlag('GRADING_AGENT_ENABLED')) {
    disabled.push('GradingAgent (LEGACY_DISABLED 2025-09-30 - replaced by SettlementAgent)');
  }

  return disabled;
}

/**
 * Get all enabled features for logging
 */
export function getEnabledFeatures(): string[] {
  const features: string[] = [];

  if (getFeatureFlag('UNIFIED_PICKS_ONLY')) {
    features.push('Unified Picks Only Mode');
  }

  if (getFeatureFlag('STRICT_MODE')) {
    features.push('Strict Mode (Production Safety)');
  }

  features.push('Event-First Odds API Architecture');
  features.push('Enhanced45Factor Scoring (195 factors)');

  return features;
}

/**
 * Get all disabled features for logging
 */
export function getDisabledFeatures(): string[] {
  const features: string[] = [];

  if (!getFeatureFlag('RAW_PROPS_TABLE_ENABLED')) {
    features.push('raw_props table (LEGACY_DISABLED 2025-09-30)');
  }

  if (!getFeatureFlag('RAW_PROPS_INGESTION_ENABLED')) {
    features.push('raw_props ingestion (LEGACY_DISABLED 2025-09-30)');
  }

  return features;
}

/**
 * Log system configuration at startup
 */
export function logSystemConfiguration(): void {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 UNIT TALK PRODUCTION SYSTEM - CONFIGURATION');
  console.log('='.repeat(80));

  console.log('\n✅ ENABLED AGENTS:');
  getEnabledAgents().forEach(agent => {
    console.log(`   • ${agent}`);
  });

  const disabledAgents = getDisabledAgents();
  if (disabledAgents.length > 0) {
    console.log('\n❌ DISABLED AGENTS:');
    disabledAgents.forEach(agent => {
      console.log(`   • ${agent}`);
    });
  }

  console.log('\n✅ ENABLED FEATURES:');
  getEnabledFeatures().forEach(feature => {
    console.log(`   • ${feature}`);
  });

  const disabledFeatures = getDisabledFeatures();
  if (disabledFeatures.length > 0) {
    console.log('\n❌ DISABLED FEATURES:');
    disabledFeatures.forEach(feature => {
      console.log(`   • ${feature}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 PRODUCTION FLOW (VERIFIED OCT 6, 2025):');
  console.log('   PRE-GAME:');
  console.log('   1. FeedAgent (Odds API) → raw_props');
  console.log('   2. NormalizerAgent → market_props');
  console.log('   3. ScoringAgent (Enhanced45Factor) → scored_props');
  console.log('   4. PromotionAgent → promotion_queue');
  console.log('   5. AlertAgent → Discord publish');
  console.log('   POST-GAME:');
  console.log('   6. SettlementAgent → win/loss determination');
  console.log('   7. RecapAgent → performance recaps');
  console.log('='.repeat(80) + '\n');
}