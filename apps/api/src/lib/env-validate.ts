/**
 * Environment Validation Module
 *
 * Provides comprehensive environment variable validation with:
 * - Graceful degradation in development
 * - Masked logging for security
 * - Health status reporting
 * - Non-fatal warnings for missing optional keys
 */

import { logger } from '../shared/logger';

/**
 * Environment variable validation result
 */
export interface EnvValidationResult {
  status: 'healthy' | 'degraded' | 'critical';
  missing: string[];
  present: string[];
  issues: string[];
}

/**
 * Environment variable category
 */
interface EnvVarConfig {
  key: string;
  required: boolean;
  category: 'database' | 'discord' | 'system' | 'optional';
  maskValue?: boolean;
}

/**
 * Required and optional environment variables configuration
 */
const ENV_CONFIG: EnvVarConfig[] = [
  // Database (critical)
  { key: 'SUPABASE_URL', required: true, category: 'database', maskValue: false },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', required: true, category: 'database', maskValue: true },

  // Discord configuration (required for notifications)
  { key: 'DISCORD_BOT_TOKEN', required: true, category: 'discord', maskValue: true },
  { key: 'DISCORD_CLIENT_ID', required: true, category: 'discord', maskValue: false },

  // Discord webhooks/threads (at least one method required)
  { key: 'DISCORD_WEBHOOK_URL', required: false, category: 'discord', maskValue: true },
  { key: 'SYSTEM_ALERTS_THREAD_ID', required: false, category: 'discord', maskValue: false },
  { key: 'ALERTS_CHANNEL_ID', required: false, category: 'discord', maskValue: false },

  // Capper thread mappings (optional but recommended)
  { key: 'CAPPER_THREAD_GRIFF843', required: false, category: 'discord', maskValue: false },
  { key: 'CAPPER_THREAD_VICGO', required: false, category: 'discord', maskValue: false },
  { key: 'CAPPER_THREAD_SAUCED', required: false, category: 'discord', maskValue: false },
  { key: 'CAPPER_THREAD_MONEYREEF', required: false, category: 'discord', maskValue: false },
  { key: 'CAPPER_THREAD_SQUIRREL', required: false, category: 'discord', maskValue: false },

  // System configuration
  { key: 'DEFAULT_TENANT_ID', required: true, category: 'system', maskValue: false },
  { key: 'LOG_MODE', required: false, category: 'system', maskValue: false },
  { key: 'PICK_DRIVER', required: false, category: 'system', maskValue: false },
  { key: 'PUBLISH_MODE', required: false, category: 'system', maskValue: false },
  { key: 'NODE_ENV', required: false, category: 'system', maskValue: false },

  // Optional services
  { key: 'REDIS_URL', required: false, category: 'optional', maskValue: true },
  { key: 'TEMPORAL_SERVER_URL', required: false, category: 'optional', maskValue: false },
  { key: 'OPENAI_API_KEY', required: false, category: 'optional', maskValue: true },
  { key: 'ANTHROPIC_API_KEY', required: false, category: 'optional', maskValue: true },
];

/**
 * Mask sensitive values for logging
 */
function maskValue(value: string, showChars: number = 4): string {
  if (!value || value.length <= showChars) {
    return '***';
  }
  return value.slice(0, showChars) + '*'.repeat(Math.min(value.length - showChars, 20));
}

/**
 * Check if Discord notification is properly configured
 */
function checkDiscordNotificationConfig(): { configured: boolean; method?: string } {
  const hasWebhook = !!process.env.DISCORD_WEBHOOK_URL;
  const hasThreads = !!(
    process.env.SYSTEM_ALERTS_THREAD_ID ||
    process.env.ALERTS_CHANNEL_ID
  );

  if (hasWebhook) return { configured: true, method: 'webhook' };
  if (hasThreads) return { configured: true, method: 'threads' };

  return { configured: false };
}

/**
 * Validate environment variables and return status
 */
export function validateEnvironment(): EnvValidationResult {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const missing: string[] = [];
  const present: string[] = [];
  const issues: string[] = [];

  logger.info('Starting environment validation', {
    environment: process.env.NODE_ENV || 'development',
    mode: isDevelopment ? 'development' : 'production',
  });

  // Check each environment variable
  for (const config of ENV_CONFIG) {
    const value = process.env[config.key];
    const logValue = config.maskValue && value ? maskValue(value) : value || '<not set>';

    if (value) {
      present.push(config.key);
      logger.debug('Environment variable present', {
        key: config.key,
        value: logValue,
        category: config.category,
      });
    } else {
      if (config.required) {
        missing.push(config.key);
        logger.warn('Required environment variable missing', {
          key: config.key,
          category: config.category,
          required: true,
        });
      } else {
        logger.debug('Optional environment variable not set', {
          key: config.key,
          category: config.category,
          required: false,
        });
      }
    }
  }

  // Check Discord notification configuration
  const discordNotif = checkDiscordNotificationConfig();
  if (!discordNotif.configured) {
    issues.push('No Discord notification method configured (webhook or threads)');
    logger.warn('Discord notifications not configured', {
      hasWebhook: !!process.env.DISCORD_WEBHOOK_URL,
      hasThreads: !!(process.env.SYSTEM_ALERTS_THREAD_ID || process.env.ALERTS_CHANNEL_ID),
    });
  } else {
    logger.info('Discord notifications configured', {
      method: discordNotif.method,
    });
  }

  // Determine health status
  let status: 'healthy' | 'degraded' | 'critical';

  if (missing.length === 0 && issues.length === 0) {
    status = 'healthy';
  } else if (missing.length > 0 && !isDevelopment) {
    // In production, missing required vars are critical
    status = 'critical';
    issues.push(`Missing ${missing.length} required environment variables`);
  } else {
    // In development or with non-critical issues
    status = 'degraded';
    if (missing.length > 0) {
      issues.push(`Missing ${missing.length} required environment variables (dev mode)`);
    }
  }

  // Log final status
  const logLevel = status === 'critical' ? 'error' : status === 'degraded' ? 'warn' : 'info';
  logger[logLevel]('Environment validation complete', {
    status,
    missing: missing.length,
    present: present.length,
    issues: issues.length,
    isDevelopment,
  });

  // In production with critical status, log detailed missing vars
  if (status === 'critical') {
    logger.error('Critical environment validation failure', {
      missingRequired: missing,
      environment: process.env.NODE_ENV,
      message: 'Required environment variables are missing in production mode',
    });
  }

  // IMPORTANT: Do not call process.exit() - allow graceful degradation
  // System should continue with degraded functionality

  return {
    status,
    missing,
    present,
    issues,
  };
}

/**
 * Get environment validation status for health checks
 */
export function getEnvValidationStatus(): {
  supabase: 'ok' | 'error';
  discord: 'present' | 'missing';
  logMode: string;
  pickDriver: string;
  publishMode: string;
} {
  const discordNotif = checkDiscordNotificationConfig();

  return {
    supabase: process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'ok' : 'error',
    discord: discordNotif.configured ? 'present' : 'missing',
    logMode: process.env.LOG_MODE || 'default',
    pickDriver: process.env.PICK_DRIVER || 'unified',
    publishMode: process.env.PUBLISH_MODE || 'outbox',
  };
}

/**
 * Log masked environment summary (safe for production logs)
 */
export function logEnvironmentSummary(): void {
  logger.info('Environment configuration summary', {
    nodeEnv: process.env.NODE_ENV || 'development',
    supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    discordConfigured: checkDiscordNotificationConfig().configured,
    pickDriver: process.env.PICK_DRIVER || 'unified',
    publishMode: process.env.PUBLISH_MODE || 'outbox',
    logMode: process.env.LOG_MODE || 'default',
    defaultTenantId: process.env.DEFAULT_TENANT_ID || '<not set>',
  });
}
