// Jest setup file for Unit Talk Platform tests
// This file is run before all tests to set up the testing environment

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-openai-key-for-testing';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key-for-testing';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-supabase-key';
process.env.TWILIO_ACCOUNT_SID = 'test-twilio-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-twilio-token';
process.env.TWILIO_FROM_NUMBER = '+1234567890';

// Mock crypto.randomUUID for consistent testing
if (!global.crypto) {
  (global as any).crypto = {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 11)
  };
}

// Mock console methods to reduce test noise
const originalConsole = { ...console };
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Restore console for debugging when needed
(global as any).restoreConsole = () => {
  global.console = originalConsole;
};

// Mock timers for consistent testing
jest.useFakeTimers();

// Set up global test timeout
jest.setTimeout(10000);

// Mock fetch for API calls
(global as any).fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: [] }),
    text: () => Promise.resolve(''),
  })
) as jest.Mock;

// Mock WebSocket for real-time features
(global as any).WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
})) as any;

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Clean up after all tests
afterAll(() => {
  jest.useRealTimers();
});

export {};