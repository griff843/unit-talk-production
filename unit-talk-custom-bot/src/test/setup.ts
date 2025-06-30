import { jest, beforeEach, afterEach } from '@jest/globals';

// Mock environment variables
process.env.DISCORD_TOKEN = 'mock-discord-token';
process.env.SUPABASE_URL = 'https://mock-supabase-url.supabase.co';
process.env.SUPABASE_ANON_KEY = 'mock-supabase-key';
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