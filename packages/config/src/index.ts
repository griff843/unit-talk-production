/**
 * @unit-talk/config
 * Shared configuration management for Unit Talk Platform
 *
 * Sprint: SPRINT-ENV-BUILD-TRUTH-LOCK
 * Sprint: SPRINT-SYNDICATE-FOUNDATION-REALIGN-114A
 * Sprint: SPRINT-B1-ENV-HARDENING-001B
 */

// Environment profiles
export {
  EnvProfileSchema,
  type EnvProfile,
  type ProcessEnvType,
  getEnvProfile,
  isRuntimeProfile,
} from './env-profiles';

// Schemas
export {
  // Base schemas
  CoreEnvSchema,
  DatabaseEnvSchema,
  NextPublicEnvSchema,
  TemporalEnvSchema,
  RedisEnvSchema,
  DiscordEnvSchema,
  ExternalApiEnvSchema,
  ScoringEnvSchema,
  PortfolioEnvSchema,
  SecurityEnvSchema,
  ShadowModeEnvSchema,
  DevEnvSchema,
  CiEnvSchema,
  // Runtime-required schemas
  RuntimeDatabaseEnvSchema,
  RuntimeDiscordEnvSchema,
  // Discord routing (SPRINT-B4-DISCORD-CANARY-ROUTING-004)
  DiscordModeSchema,
  DiscordRoutingEnvSchema,
  RuntimeDiscordRoutingEnvSchema,
  DISCORD_PRODUCTION_CHANNELS,
  type DiscordMode,
  type DiscordProductionChannel,
  type RuntimeDiscordRoutingEnv,
  // Combined schemas
  ApiEnvSchema,
  FrontendEnvSchema,
  DiscordBotEnvSchema,
  RuntimeApiEnvSchema,
  RuntimeDiscordBotEnvSchema,
  // Types
  type ApiEnv,
  type FrontendEnv,
  type DiscordBotEnv,
  type RuntimeApiEnv,
  type RuntimeDiscordBotEnv,
} from './schemas';

// Validators
export {
  // Core validators
  validateEnv,
  validateRuntimeEnv,
  checkEnv,
  // Profile-aware validators
  validateApiEnv,
  validateDiscordEnv,
  // App-specific validators
  validateApiServiceEnv,
  validateFrontendEnv,
  validateDiscordBotEnv,
  checkAppEnv,
  type EnvCheckResult,
} from './validators';

// Helpers
export {
  type PublicEnv,
  type ServerEnv,
  type ServiceEnv,
  getPublicEnv,
  getServerEnv,
  getServiceEnv,
} from './helpers';

// Supabase validation
export { CANONICAL_SUPABASE_HOST, validateSupabaseHost } from './supabase-host';

// Legacy export for compatibility
export const config = 'shared-config';
