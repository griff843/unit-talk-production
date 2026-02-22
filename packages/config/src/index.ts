/**
 * @unit-talk/config
 * Shared configuration management for Unit Talk Platform
 *
 * Sprint: SPRINT-ENV-BUILD-TRUTH-LOCK
 * Sprint: SPRINT-SYNDICATE-FOUNDATION-REALIGN-114A
 */

// Environment schema and validation
export * from './env-schema';

// Re-export commonly used items explicitly for better discoverability
export {
  // Schemas
  ApiEnvSchema,
  FrontendEnvSchema,
  DiscordBotEnvSchema,
  // Validation functions
  validateEnv,
  checkEnv,
  getEnvProfile,
  validateSupabaseHost,
  // App validators
  validateApiServiceEnv,
  validateFrontendEnv,
  validateDiscordBotEnv,
  checkAppEnv,
  // Env getters (safe vs secrets)
  getPublicEnv,
  getServerEnv,
  getServiceEnv,
  // Constants
  CANONICAL_SUPABASE_HOST,
  // Types
  type EnvProfile,
  type ApiEnv,
  type FrontendEnv,
  type DiscordBotEnv,
  type PublicEnv,
  type ServerEnv,
  type ServiceEnv,
  type EnvCheckResult,
} from './env-schema';

// Legacy export for compatibility
export const config = 'shared-config';
