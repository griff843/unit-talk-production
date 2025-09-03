// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_LOG_LEVEL = 'debug';
process.env.ENABLE_TEST_MODE = 'true';
process.env.MOCK_EXTERNAL_SERVICES = 'true';
process.env.SUPABASE_URL = 'http://mock-supabase-url';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
process.env.SUPABASE_KEY = 'mock-key';
process.env.SUPABASE_ANON_KEY = 'mock-anon-key';
process.env.TEST_LOG_FILE = 'logs/test.log';

// Initialize logger
import { logger } from '../../src/utils/logger';

logger.info('Test environment initialized', {
  env: process.env.NODE_ENV,
  logLevel: process.env.TEST_LOG_LEVEL,
  testMode: process.env.ENABLE_TEST_MODE,
  mockServices: process.env.MOCK_EXTERNAL_SERVICES
});

// Mock services
export const mockSupabaseService = {
  client: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: null })
        })
      })
    })
  }
};

export const mockPermissionsService = {
  getUserTier: (member: any) => member.tier
};

export const mockDiscordClient = {
  user: { id: 'test_bot_id', username: 'test_bot' },
  guilds: new Map(),
  users: new Map()
} as any; 