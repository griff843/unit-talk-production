import { jest, beforeEach, afterEach } from '@jest/globals';

// Mock environment variables (Docker-first keys)
process.env.DISCORD_BOT_TOKEN = 'mock-discord-token';
process.env.DISCORD_CLIENT_ID = 'mock-client-id';
process.env.DISCORD_GUILD_ID = 'mock-guild-id';
process.env.SUPABASE_URL = 'https://mock-supabase-url.supabase.co';
process.env.SUPABASE_ANON_KEY = 'mock-supabase-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-supabase-service-role';
process.env.OPENAI_API_KEY = 'mock-openai-key';
process.env.NODE_ENV = 'test';

// Global test setup
beforeEach(() => {
  jest.clearAllMocks();
});

// Clean up after tests
afterEach(() => {
  jest.restoreAllMocks();
});
