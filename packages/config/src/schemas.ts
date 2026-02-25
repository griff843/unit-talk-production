/**
 * Environment Variable Schemas
 * Sprint: SPRINT-B1-ENV-HARDENING-001B
 *
 * All Zod schemas for environment variables.
 */

import { z } from 'zod';

// =============================================================================
// BASE SCHEMAS
// =============================================================================

/**
 * Core application environment variables.
 * Required in ALL profiles.
 */
export const CoreEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  PORT: z.coerce.number().optional(),
});

/**
 * Database environment variables.
 * Required in cloud mode runtime.
 */
export const DatabaseEnvSchema = z.object({
  DB_MODE: z.enum(['cloud', 'local']).default('cloud'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().url().optional(),
});

/**
 * Next.js public environment variables.
 * Required at BUILD TIME for frontend apps.
 */
export const NextPublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_ENV: z.string().optional(),
});

/**
 * Temporal workflow environment variables.
 */
export const TemporalEnvSchema = z.object({
  TEMPORAL_ADDRESS: z.string().default('localhost:7233'),
  TEMPORAL_NAMESPACE: z.string().default('default'),
  TEMPORAL_TASK_QUEUE: z.string().default('unit-talk-main'),
  TEMPORAL_SERVER_URL: z.string().optional(),
  TEMPORAL_UI_URL: z.string().optional(),
});

/**
 * Redis environment variables.
 */
export const RedisEnvSchema = z.object({
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().optional(),
});

/**
 * Discord environment variables (optional schema for CI builds).
 */
export const DiscordEnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1).optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
  DISCORD_OPERATOR_WEBHOOK_URL: z.string().url().optional(),
  DEFAULT_DISCORD_TICKET_CHANNEL_ID: z.string().optional(),
  ENABLE_DISCORD_TICKET_WORKER: z.coerce.boolean().default(false),
  TICKET_DISCORD_POLL_INTERVAL: z.coerce.number().default(10000),
  TICKET_DISCORD_BATCH_SIZE: z.coerce.number().default(10),
});

/**
 * External API keys.
 */
export const ExternalApiEnvSchema = z.object({
  ODDS_API_KEY: z.string().optional(),
  OPTIMAL_API_KEY: z.string().optional(),
  SGO_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

/**
 * Professional scoring configuration.
 */
export const ScoringEnvSchema = z.object({
  USE_PRO_SCORER: z.coerce.boolean().default(false),
  SCORING_DEBUG: z.coerce.boolean().default(false),
  SCORING_WEIGHTS_PATH: z.string().optional(),
  INSTANT_S_TIER_MIN_EV: z.coerce.number().default(0.05),
  INSTANT_S_TIER_MIN_CONFIDENCE: z.coerce.number().default(0.75),
  INSTANT_S_TIER_MIN_PROFESSIONAL_SCORE: z.coerce.number().default(85),
  SCHEDULED_10AM_MIN_EV: z.coerce.number().default(0.03),
  SCHEDULED_10AM_MIN_CONFIDENCE: z.coerce.number().default(0.65),
  S_TIER_MIN_CLV_BPS: z.coerce.number().default(15),
  S_TIER_MAX_NEGATIVE_CLV_BPS: z.coerce.number().default(-3),
  S_TIER_MIN_STEAM_STRENGTH: z.coerce.number().default(20),
  S_TIER_REQUIRE_POSITIVE_STEAM: z.coerce.boolean().default(true),
});

/**
 * Portfolio risk management.
 */
export const PortfolioEnvSchema = z.object({
  MAX_SINGLE_POSITION_SIZE: z.coerce.number().default(0.25),
  MAX_DAILY_PORTFOLIO_RISK: z.coerce.number().default(1.0),
  MAX_GAME_EXPOSURE: z.coerce.number().default(0.4),
  MAX_PLAYER_EXPOSURE: z.coerce.number().default(0.3),
  MAX_CORRELATION_THRESHOLD: z.coerce.number().default(0.7),
  MAX_CORRELATED_POSITIONS: z.coerce.number().default(3),
  MAX_SPORT_CONCENTRATION: z.coerce.number().default(0.6),
  MAX_TIER_CONCENTRATION: z.coerce.number().default(0.8),
  DAILY_VAR_LIMIT: z.coerce.number().default(0.15),
  WEEKLY_DRAWDOWN_LIMIT: z.coerce.number().default(0.25),
});

/**
 * Security configuration.
 */
export const SecurityEnvSchema = z.object({
  JWT_SECRET: z.string().min(32).optional(),
  ENCRYPTION_KEY: z.string().length(32).optional(),
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  SECURITY_HEADERS_ENABLED: z.coerce.boolean().default(true),
});

/**
 * Shadow mode configuration.
 */
export const ShadowModeEnvSchema = z.object({
  SHADOW_MODE: z.coerce.boolean().default(false),
  SHADOW_PRIVATE_CHANNEL_ID: z.string().optional(),
  SHADOW_MAX_DAYS: z.coerce.number().default(7),
});

/**
 * Development/Debug configuration.
 */
export const DevEnvSchema = z.object({
  DEBUG_MODE: z.coerce.boolean().default(false),
  HOT_RELOAD: z.coerce.boolean().default(true),
  METRICS_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000),
});

/**
 * CI/CD configuration.
 */
export const CiEnvSchema = z.object({
  CI: z.coerce.boolean().default(false),
  GIT_COMMIT: z.string().optional(),
  GIT_COMMIT_SHORT: z.string().optional(),
  GIT_BRANCH: z.string().optional(),
});

// =============================================================================
// RUNTIME-REQUIRED SCHEMAS (SPRINT-B1-ENV-HARDENING-001)
// =============================================================================

/**
 * Runtime database environment variables.
 * REQUIRED for runtime operation (not CI builds).
 * FAIL-CLOSED: Missing vars cause boot failure.
 */
export const RuntimeDatabaseEnvSchema = z.object({
  DB_MODE: z.enum(['cloud', 'local']).default('cloud'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().url().optional(),
});

/**
 * Runtime Discord environment variables.
 * REQUIRED for discord-bot and posting agents (not CI/development).
 * FAIL-CLOSED: Missing vars cause boot failure.
 */
export const RuntimeDiscordEnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_WEBHOOK_URL: z.string().url(),
  DISCORD_OPERATOR_WEBHOOK_URL: z.string().url().optional(),
  DEFAULT_DISCORD_TICKET_CHANNEL_ID: z.string().optional(),
  ENABLE_DISCORD_TICKET_WORKER: z.coerce.boolean().default(false),
  TICKET_DISCORD_POLL_INTERVAL: z.coerce.number().default(10000),
  TICKET_DISCORD_BATCH_SIZE: z.coerce.number().default(10),
});

// =============================================================================
// COMBINED SCHEMAS
// =============================================================================

/**
 * Complete environment schema for API service.
 */
export const ApiEnvSchema = CoreEnvSchema.merge(DatabaseEnvSchema)
  .merge(TemporalEnvSchema)
  .merge(RedisEnvSchema)
  .merge(DiscordEnvSchema)
  .merge(ExternalApiEnvSchema)
  .merge(ScoringEnvSchema)
  .merge(PortfolioEnvSchema)
  .merge(SecurityEnvSchema)
  .merge(ShadowModeEnvSchema)
  .merge(DevEnvSchema)
  .merge(CiEnvSchema);

export type ApiEnv = z.infer<typeof ApiEnvSchema>;

/**
 * Complete environment schema for Next.js frontend apps.
 */
export const FrontendEnvSchema = CoreEnvSchema.merge(DatabaseEnvSchema)
  .merge(NextPublicEnvSchema)
  .merge(DevEnvSchema)
  .merge(CiEnvSchema);

export type FrontendEnv = z.infer<typeof FrontendEnvSchema>;

/**
 * Complete environment schema for Discord bot.
 */
export const DiscordBotEnvSchema = CoreEnvSchema.merge(DatabaseEnvSchema)
  .merge(RedisEnvSchema)
  .merge(DiscordEnvSchema)
  .merge(DevEnvSchema)
  .merge(CiEnvSchema);

export type DiscordBotEnv = z.infer<typeof DiscordBotEnvSchema>;

// =============================================================================
// RUNTIME-REQUIRED COMBINED SCHEMAS (SPRINT-B1-ENV-HARDENING-001)
// =============================================================================

/**
 * Runtime API environment schema.
 * Uses REQUIRED database vars. FAIL-CLOSED on missing critical vars.
 */
export const RuntimeApiEnvSchema = CoreEnvSchema.merge(RuntimeDatabaseEnvSchema)
  .merge(TemporalEnvSchema)
  .merge(RedisEnvSchema)
  .merge(DiscordEnvSchema)
  .merge(ExternalApiEnvSchema)
  .merge(ScoringEnvSchema)
  .merge(PortfolioEnvSchema)
  .merge(SecurityEnvSchema)
  .merge(ShadowModeEnvSchema)
  .merge(DevEnvSchema)
  .merge(CiEnvSchema);

export type RuntimeApiEnv = z.infer<typeof RuntimeApiEnvSchema>;

/**
 * Runtime Discord bot environment schema.
 * Uses REQUIRED database and Discord vars. FAIL-CLOSED on missing critical vars.
 */
export const RuntimeDiscordBotEnvSchema = CoreEnvSchema.merge(RuntimeDatabaseEnvSchema)
  .merge(RedisEnvSchema)
  .merge(RuntimeDiscordEnvSchema)
  .merge(DevEnvSchema)
  .merge(CiEnvSchema);

export type RuntimeDiscordBotEnv = z.infer<typeof RuntimeDiscordBotEnvSchema>;
