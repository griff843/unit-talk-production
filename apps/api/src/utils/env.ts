import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Supabase
  SUPABASE_URL: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  SUPABASE_ANON_KEY: z.string().optional(),

  // API Keys
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Integrations
  DISCORD_ALERT_WEBHOOK: z.string().optional(),
  RETOOL_ALERT_WEBHOOK: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),

  // Task Queue
  TEMPORAL_TASK_QUEUE: z.string(),

  // Monitoring
  PROMETHEUS_PORT: z.coerce.number().default(9090),
  HEALTH_CHECK_INTERVAL: z.coerce.number().default(60000),

  // SPRINT-PROMOTION-MODE-SPLIT: Controls auto-approval of system-generated picks.
  // 'manual' = production default (human approval required in Command Center).
  // 'auto'   = dev/canary only (system picks auto-transition to approved for E2E testing).
  // Fail-closed: any value other than 'auto' behaves as 'manual'.
  PROMOTION_MODE: z.enum(['manual', 'auto']).default('manual'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    '❌ Invalid environment variables:',
    JSON.stringify(parsed.error.format(), null, 2)
  );
  process.exit(1);
}

export const env = parsed.data;
