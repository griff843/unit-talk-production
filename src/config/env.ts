import { z } from 'zod';
import { logger } from '../utils/logger';

// Base environment schema
const envSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_KEY: z.string().min(1), // Alternative name for service role key

  // Temporal
  TEMPORAL_TASK_QUEUE: z.string().optional(),

  // General
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  METRICS_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000),

  // Discord
  DISCORD_ENABLED: z.coerce.boolean().default(false),
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
  DISCORD_ALERT_WEBHOOK: z.string().url().optional(),

  // Retool
  RETOOL_ALERT_WEBHOOK: z.string().url().optional(),

  // Notion
  NOTION_ENABLED: z.coerce.boolean().default(false),
  NOTION_API_KEY: z.string().optional(),
  NOTION_DATABASE_ID: z.string().optional(),

  // Email (SMTP)
  EMAIL_ENABLED: z.coerce.boolean().default(false),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.coerce.boolean().default(true),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // SMS (Twilio)
  SMS_ENABLED: z.coerce.boolean().default(false),
  SMS_PROVIDER: z.enum(['twilio']).optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_ACCOUNT_SID: z.string().optional(),
  SMS_FROM_NUMBER: z.string().optional(),

  // Slack
  SLACK_ENABLED: z.coerce.boolean().default(false),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  SLACK_DEFAULT_CHANNEL: z.string().optional(),

  // AI Services
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_DB: z.coerce.number().optional(),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),

  // Workflow specific
  MICRO_RECAP_COOLDOWN: z.coerce.number().optional(),

  // Agent-specific
  ONBOARDING_ENABLED: z.coerce.boolean().default(true),
  NOTIFICATION_ENABLED: z.coerce.boolean().default(true),
  FEED_ENABLED: z.coerce.boolean().default(true),
  OPERATOR_ENABLED: z.coerce.boolean().default(true),
});

  // Validate environment variables
  function validateEnv() {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      logger.error('❌ Invalid environment variables:');
      for (const error of result.error.errors) {
        logger.error(`  - ${error.path.join('.')}: ${error.message}`);
      }

      // Don't exit in test environment
      if (process.env['NODE_ENV'] !== 'test') {
        process.exit(1);
      } else {
        // In test environment, throw an error instead
        throw new Error('Environment validation failed in test environment');
      }
    }

    // Additional validation for enabled services
    if (result.data.DISCORD_ENABLED && !result.data.DISCORD_WEBHOOK_URL) {
      const error = new Error('DISCORD_WEBHOOK_URL is required when Discord is enabled');
      if (process.env['NODE_ENV'] !== 'test') {
        throw error;
      }
      logger.warn('Warning:', error.message);
    }

    if (result.data.NOTION_ENABLED && !result.data.NOTION_API_KEY) {
      const error = new Error('NOTION_API_KEY is required when Notion is enabled');
      if (process.env['NODE_ENV'] !== 'test') {
        throw error;
      }
      logger.warn('Warning:', error.message);
    }

    if (result.data.SLACK_ENABLED && !result.data.SLACK_WEBHOOK_URL) {
      const error = new Error('SLACK_WEBHOOK_URL is required when Slack is enabled');
      if (process.env['NODE_ENV'] !== 'test') {
        throw error;
      }
      logger.warn('Warning:', error.message);
    }

    return result.data;
  }

  // Export validated environment variables
  // In test environment, provide fallback values if validation fails
  let env: z.infer<typeof envSchema>;
  try {
    env = validateEnv();
  } catch (error) {
    if (process.env['NODE_ENV'] === 'test') {
      // Provide minimal test environment with all required fields
      env = {
        NODE_ENV: 'test',
        LOG_LEVEL: 'error',
        TEMPORAL_TASK_QUEUE: 'test-queue',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-key',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        SUPABASE_KEY: 'test-key',
        OPENAI_API_KEY: 'test-openai-key',
        DISCORD_ENABLED: false,
        NOTION_ENABLED: false,
        SLACK_ENABLED: false,
        TWILIO_ENABLED: false,
        EMAIL_ENABLED: false,
        SMS_ENABLED: false,
        ONBOARDING_ENABLED: false,
        METRICS_ENABLED: false,
        HEALTH_CHECK_INTERVAL: 30000,
        HEALTH_CHECK_TIMEOUT: 5000,
        SMTP_SECURE: false
      } as unknown as z.infer<typeof envSchema>;
    } else {
      throw error;
    }
  }

  export { env };
