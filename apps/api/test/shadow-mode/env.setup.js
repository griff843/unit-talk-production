/**
 * Environment Setup for Shadow Mode Tests
 * Sets up test environment variables before tests run
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SHADOW_MODE = 'false';
process.env.SHADOW_PRIVATE_CHANNEL_ID = '';
process.env.SHADOW_MAX_DAYS = '7';

// Mock Discord webhook URL for tests
process.env.DISCORD_ALERT_WEBHOOK = 'https://discord.com/api/webhooks/test/mock';

// Mock other required environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';

// Disable external API calls in tests
process.env.DISABLE_EXTERNAL_APIS = 'true';

console.log('🔧 Shadow Mode test environment configured');