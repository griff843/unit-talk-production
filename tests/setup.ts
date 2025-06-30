/**
 * Test Setup Configuration
 * Global test environment setup for Unit Talk SaaS
 */

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = 'test-encryption-key';

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test utilities
global.testUtils = {
  createMockUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'user',
    status: 'active',
    display_name: 'Test User',
    ...overrides
  }),
  
  createMockGame: (overrides = {}) => ({
    game_id: 123,
    home_team: 'Team A',
    away_team: 'Team B',
    game_date: new Date().toISOString(),
    status: 'completed',
    ...overrides
  }),
  
  createMockPick: (overrides = {}) => ({
    game_id: 123,
    bet_type: 'spread',
    selection: 'Team A -3.5',
    confidence: 4,
    reasoning: 'Test reasoning',
    ...overrides
  })
};

// Setup and teardown
beforeAll(async () => {
  // Global setup
});

afterAll(async () => {
  // Global cleanup
});

export {};