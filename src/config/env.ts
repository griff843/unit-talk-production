import { z } from 'zod';

// Base environment schema
const envSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // General
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  METRICS_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000),

  // Discord
  DISCORD_ENABLED: z.coerce.boolean().default(false),
  DISCORD_WEBHOOK_URL: z.string().url().optional(),

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
    console.error('❌ Invalid environment variables:');
    for (const error of result.error.errors) {
      console.error(`  - ${error.path.join('.')}: ${error.message}`);
    }
    process.exit(1);
  }

  // Additional validation for enabled services
  if (result.data.DISCORD_ENABLED && !result.data.DISCORD_WEBHOOK_URL) {
    throw new Error('DISCORD_WEBHOOK_URL is required when Discord is enabled');
  }

  if (result.data.NOTION_ENABLED && (!result.data.NOTION_API_KEY || !result.data.NOTION_DATABASE_ID)) {
    throw new Error('NOTION_API_KEY and NOTION_DATABASE_ID are required when Notion is enabled');
  }

  if (result.data.EMAIL_ENABLED) {
    const requiredEmailVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'] as const;
    const missingVars = requiredEmailVars.filter(v => !result.data[v as keyof typeof result.data]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required email configuration: ${missingVars.join(', ')}`);
    }
  }

  if (result.data.SMS_ENABLED) {
    const requiredSMSVars = ['SMS_PROVIDER', 'SMS_API_KEY', 'SMS_ACCOUNT_SID', 'SMS_FROM_NUMBER'] as const;
    const missingVars = requiredSMSVars.filter(v => !result.data[v as keyof typeof result.data]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required SMS configuration: ${missingVars.join(', ')}`);
    }
  }

  if (result.data.SLACK_ENABLED && !result.data.SLACK_WEBHOOK_URL) {
    throw new Error('SLACK_WEBHOOK_URL is required when Slack is enabled');
  }

  return result.data;
}

// Export validated environment variables
export const env = validateEnv();
