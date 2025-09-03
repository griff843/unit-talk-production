// Jest setup file for Unit Talk Platform tests
// This file is run before all tests to set up the testing environment

import 'jest';

// Mock environment variables for testing
process.env['NODE_ENV'] = 'test';
process.env['OPENAI_API_KEY'] = 'test-openai-key-for-testing';
process.env['ANTHROPIC_API_KEY'] = 'test-anthropic-key-for-testing';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_ANON_KEY'] = 'test-supabase-key';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-supabase-service-key';
process.env['TWILIO_ACCOUNT_SID'] = 'test-twilio-sid';
process.env['TWILIO_AUTH_TOKEN'] = 'test-twilio-token';
process.env['TWILIO_FROM_NUMBER'] = '+1234567890';
process.env['TEMPORAL_TASK_QUEUE'] = 'test-task-queue';
process.env['LOG_LEVEL'] = 'error';
process.env['METRICS_ENABLED'] = 'false';
process.env['HEALTH_CHECK_INTERVAL'] = '30000';

// Mock crypto.randomUUID for consistent testing
if (!global.crypto) {
  (global as any).crypto = {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 11)
  };
}

// Mock console methods to reduce test noise
const originalConsole = { ...console };
beforeAll(() => {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

// Store original process listeners to restore them after tests
const originalProcessListeners: { [event: string]: ((...args: any[]) => void)[] } = {};

beforeAll(() => {
  // Increase the max listeners limit to prevent warnings during tests
  process.setMaxListeners(50);
  
  // Store original process listeners
  const events = ['SIGINT', 'SIGTERM', 'uncaughtException', 'unhandledRejection', 'exit'];
  events.forEach(event => {
    originalProcessListeners[event] = process.listeners(event as any).slice() as ((...args: any[]) => void)[];
  });
});

// Clear process event listeners between tests to prevent memory leaks
beforeEach(() => {
  // Remove all listeners for common process events that might be added by tests
  const events = ['SIGINT', 'SIGTERM', 'uncaughtException', 'unhandledRejection', 'exit'];
  events.forEach(event => {
    process.removeAllListeners(event as any);
    // Restore original listeners
    if (originalProcessListeners[event]) {
      originalProcessListeners[event].forEach(listener => {
        process.on(event as any, listener);
      });
    }
  });
});

afterAll(() => {
  // Restore original process listeners
  const events = ['SIGINT', 'SIGTERM', 'uncaughtException', 'unhandledRejection', 'exit'];
  events.forEach(event => {
    process.removeAllListeners(event as any);
    if (originalProcessListeners[event]) {
      originalProcessListeners[event].forEach(listener => {
        process.on(event as any, listener);
      });
    }
  });
  
  // Reset max listeners to default
  process.setMaxListeners(10);
});

// Clear Prometheus registry between tests to avoid metric registration conflicts
beforeEach(() => {
  try {
    const promClient = require('prom-client');
    promClient.register.clear();
  } catch (error) {
    // Ignore if prom-client is not available
  }
});

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: jest.fn().mockResolvedValue({ data: [], error: null })
    })),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null })
    }
  }))
}));

// Mock Temporal activities
jest.mock('@temporalio/activity', () => ({
  Context: {
    current: () => ({
      info: {
        activityId: 'test-activity-id',
        workflowExecution: { workflowId: 'test-workflow-id' }
      }
    })
  }
}));

// Mock Discord.js
jest.mock('discord.js', () => ({
  Client: jest.fn(() => ({
    login: jest.fn().mockResolvedValue('token'),
    on: jest.fn(),
    user: { id: 'test-bot-id' }
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 4
  },
  EmbedBuilder: jest.fn(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis()
  }))
}));