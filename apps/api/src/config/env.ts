import dotenv from 'dotenv';
import path from 'path';

// Only load .env file if not in test mode
if (process.env.NODE_ENV !== 'test') {
  // Load .env from project root (two levels up from apps/api/src/config)
  dotenv.config({ path: path.join(__dirname, '../../../../.env') });
}

// Required variables for production
const REQUIRED_PROD_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY'
];

// Required variables for test
const REQUIRED_TEST_VARS = [
  'NODE_ENV'
];

function validateEnv() {
  const isTestMode = process.env.NODE_ENV === 'test';
  
  // In test mode with mock services, skip validation
  if (isTestMode && process.env.MOCK_EXTERNAL_SERVICES === 'true') {
    console.info('✅ Test mode with mock services - skipping validation');
    return;
  }

  const isDevMode = !isTestMode && (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV);
  const requiredVars = isTestMode ? REQUIRED_TEST_VARS : REQUIRED_PROD_VARS;
  const missingVars = requiredVars.filter(key => !process.env[key]);

  if (missingVars.length > 0) {
    if (isDevMode || process.env.ALLOW_DEV_UNCONFIGURED === 'true') {
      console.warn('⚠️ Missing environment variables (allowed in development):');
      missingVars.forEach(key => console.warn(`  - ${key}: missing`));
    } else {
      console.error('❌ Invalid environment variables:');
      missingVars.forEach(key => console.error(`  - ${key}: Required`));
      throw new Error('Missing required environment variables');
    }
  }

  if (isTestMode) {
    console.info('✅ Test environment variables validated');
  } else if (isDevMode) {
    console.info('✅ Development environment variables validated (relaxed)');
  } else {
    console.info('✅ Production environment variables validated');
  }
}

// Validate environment variables
validateEnv();

// Export environment configuration
export const env = {
  isTest: process.env.NODE_ENV === 'test',
  NODE_ENV: process.env.NODE_ENV || 'development',
  TEMPORAL_TASK_QUEUE: process.env.TEMPORAL_TASK_QUEUE || 'unit-talk-queue',
  TEMPORAL_SERVER_URL: process.env.TEMPORAL_SERVER_URL || 'localhost:7233',
  SUPABASE_URL: process.env.SUPABASE_URL || 'http://mock-supabase-url',
  SUPABASE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'mock-anon-key',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  METRICS_ENABLED: process.env.METRICS_ENABLED === 'true',
  HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
  REDIS_URL: process.env.REDIS_URL || 'redis://unit-talk-redis:6379',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  // API Keys for data providers
  OPTIMAL_API_KEY: process.env.OPTIMAL_API_KEY || '',
  ODDS_API_KEY: process.env.ODDS_API_KEY || '',
  SGO_API_KEY: process.env.SGO_API_KEY || process.env.SPORTSGAMEODDS_KEY || '',
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER || '',
  MICRO_RECAP_COOLDOWN: parseInt(process.env.MICRO_RECAP_COOLDOWN || '300000'),
  supabase: {
    url: process.env.SUPABASE_URL || 'http://mock-supabase-url',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key',
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key', // Updated to use service role key
    anonKey: process.env.SUPABASE_ANON_KEY || 'mock-anon-key'
  },
  logging: {
    level: process.env.TEST_LOG_LEVEL || process.env.LOG_LEVEL || 'info',
    file: process.env.TEST_LOG_FILE || process.env.LOG_FILE || 'logs/app.log'
  },
  test: {
    enabled: process.env.ENABLE_TEST_MODE === 'true',
    skipRateLimits: process.env.SKIP_RATE_LIMITS === 'true',
    mockExternalServices: process.env.MOCK_EXTERNAL_SERVICES === 'true',
    timeouts: {
      test: parseInt(process.env.TEST_TIMEOUT_MS || '5000'),
      retryDelay: parseInt(process.env.TEST_RETRY_DELAY_MS || '100'),
      maxRetries: parseInt(process.env.TEST_MAX_RETRIES || '3')
    }
  },
  // Capper Discord thread mappings for smart form bridge
  capperThreads: {
    'Noahthegoon': process.env.CAPPER_THREAD_NOAHTHEGOON || '',
    'KingRo623': process.env.CAPPER_THREAD_KINGRO623 || '',
    'Griff843': process.env.CAPPER_THREAD_GRIFF843 || '',
    'Jaybird': process.env.CAPPER_THREAD_JAYBIRD || '',
    'dub': process.env.CAPPER_THREAD_DUB || '',
    'Vicgo': process.env.CAPPER_THREAD_VICGO || '',
    'Sauced': process.env.CAPPER_THREAD_SAUCED || '',
    'Ziplock': process.env.CAPPER_THREAD_ZIPLOCK || '',
    'Squirrel': process.env.CAPPER_THREAD_SQUIRREL || '',
    'Polo': process.env.CAPPER_THREAD_POLO || '',
    'MoneyReef': process.env.CAPPER_THREAD_MONEYREEF || '',
    'Talk2Me': process.env.CAPPER_THREAD_TALK2ME || ''
  },
  // System alerts thread for error notifications
  systemAlertsThreadId: process.env.SYSTEM_ALERTS_THREAD_ID || '',
  // Dedicated alerts channel for hedge/middle/injury/steam alerts
  alertsChannelId: process.env.ALERTS_CHANNEL_ID || ''
};