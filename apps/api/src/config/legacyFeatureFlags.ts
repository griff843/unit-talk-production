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
   * Replaced by: ScoringAgent with Enhanced45Factor engine
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
 * All legacy features OFF, modern features ON
 */
export const LEGACY_FEATURE_FLAGS: LegacyFeatureFlags = {
  // Legacy features - ALL DISABLED
  GRADING_AGENT_ENABLED: false,           // LEGACY_DISABLED 2025-09-30
  RAW_PROPS_TABLE_ENABLED: false,         // LEGACY_DISABLED 2025-09-30
  RAW_PROPS_INGESTION_ENABLED: false,     // LEGACY_DISABLED 2025-09-30

  // Modern production features - ALL ENABLED
  UNIFIED_PICKS_ONLY: true,               // PRODUCTION STANDARD
  STRICT_MODE: true,                      // PRODUCTION SAFETY
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
    'FeedAgent',      // Odds API event-first ingestion
    'ScoringAgent',   // Enhanced45Factor 195-factor scoring
    'AlertAgent',     // Discord notifications & alerts
    'RecapAgent',     // Post-game recaps
    'OperatorAgent',  // System operations
  ];
}

/**
 * Get all disabled/legacy agents for logging
 */
export function getDisabledAgents(): string[] {
  const disabled: string[] = [];

  if (!getFeatureFlag('GRADING_AGENT_ENABLED')) {
    disabled.push('GradingAgent (LEGACY_DISABLED 2025-09-30)');
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
  console.log('📊 PRODUCTION FLOW:');
  console.log('   1. FeedAgent (Odds API event-first) → unified_picks');
  console.log('   2. ScoringAgent (195-factor) → professional scores');
  console.log('   3. Approval flow → Command Center');
  console.log('   4. AlertAgent → Discord publish');
  console.log('='.repeat(80) + '\n');
}