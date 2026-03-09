/**
 * Vitest global setup file
 *
 * Sets environment variables before any modules are loaded.
 * This unblocks tests that initialize Supabase, Redis, Discord, etc.
 * at module import time (before test functions run).
 *
 * SPRINT-TEST-INFRA-RECOVERY: Fixes RemediationEngine and similar tests
 * that call getKnobResolver() / createClient() at construction time.
 */

// Core Supabase — must be set before any module that calls createClient() at import
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon-key';

// Runtime
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Temporal
process.env.TEMPORAL_SERVER_URL = process.env.TEMPORAL_SERVER_URL || 'localhost:7233';
process.env.TEMPORAL_TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || 'unit-talk-main';

// Discord
process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'test-discord-token';
process.env.DISCORD_WEBHOOK_URL =
  process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/test';

// AI
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-anthropic-key';

// Redis
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Feature flags (safe test defaults)
process.env.USE_PRO_SCORER = process.env.USE_PRO_SCORER || 'false';
process.env.PROMOTION_POLICY_V2 = process.env.PROMOTION_POLICY_V2 || 'false';
process.env.ENABLE_TEMPORAL_SCHEDULES = process.env.ENABLE_TEMPORAL_SCHEDULES || 'false';
process.env.DEMO_MODE = process.env.DEMO_MODE || 'false';
