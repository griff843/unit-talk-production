import 'jest';
import { setupTestData, clearTestData } from './utils/testHelpers';

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

  // Initialize test database
  setupTestData();
});

afterEach(() => {
  // Clear test database
  clearTestData();
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

// Mock Discord.js - Inline mock to avoid circular dependency
jest.mock('discord.js', () => {
  // Create a simple Collection mock
  class MockCollection extends Map {
    constructor() {
      super();
    }
  }
  
  const createMockClient = () => ({
    guilds: {
      cache: new MockCollection(),
      fetch: jest.fn(),
      create: jest.fn()
    },
    channels: {
      cache: new MockCollection(),
      fetch: jest.fn(),
      create: jest.fn()
    },
    users: {
      cache: new MockCollection(),
      fetch: jest.fn(),
      create: jest.fn()
    },
    user: {
      id: 'test-client-id',
      username: 'test-client',
      discriminator: '0000',
      avatar: null,
      bot: true,
      system: false,
      flags: null,
      mfaEnabled: false,
      presence: null,
      verified: true,
      edit: jest.fn(),
      equals: jest.fn(),
      _equals: jest.fn(),
      toString: () => '<@test-client-id>'
    },
    login: jest.fn().mockResolvedValue('test-token'),
    destroy: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  });

  return {
    Client: jest.fn(() => createMockClient()),
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 2,
      MessageContent: 4,
      GuildMembers: 8,
      DirectMessages: 16,
      GuildMessageReactions: 32
    },
    EmbedBuilder: jest.fn(() => ({
      setTitle: jest.fn().mockReturnThis(),
      setDescription: jest.fn().mockReturnThis(),
      setColor: jest.fn().mockReturnThis(),
      addFields: jest.fn().mockReturnThis(),
      setFooter: jest.fn().mockReturnThis(),
      setTimestamp: jest.fn().mockReturnThis(),
      setURL: jest.fn().mockReturnThis(),
      setAuthor: jest.fn().mockReturnThis(),
      setThumbnail: jest.fn().mockReturnThis(),
      setImage: jest.fn().mockReturnThis()
    })),
    Collection: MockCollection,
    PermissionsBitField: class MockPermissionsBitField {
      constructor() {}
      has() { return true; }
      add() { return this; }
      remove() { return this; }
      toArray() { return []; }
    }
  };
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

// Mock Winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      child: jest.fn()
    }))
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    simple: jest.fn(),
    colorize: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Mock Pino logger
jest.mock('pino', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      child: jest.fn()
    }))
  }))
}));

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    hget: jest.fn().mockResolvedValue(null),
    hset: jest.fn().mockResolvedValue(1),
    hdel: jest.fn().mockResolvedValue(1),
    hgetall: jest.fn().mockResolvedValue({}),
    lpush: jest.fn().mockResolvedValue(1),
    rpop: jest.fn().mockResolvedValue(null),
    llen: jest.fn().mockResolvedValue(0),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn()
  }));
});

// Mock OpenAI
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Mock AI response',
              role: 'assistant'
            }
          }]
        })
      }
    }
  }))
}));

// Mock Anthropic
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Mock Anthropic response'
        }]
      })
    }
  }))
}));

// Mock Prometheus client
jest.mock('prom-client', () => ({
  register: {
    clear: jest.fn(),
    metrics: jest.fn().mockResolvedValue('# Mock metrics'),
    getSingleMetric: jest.fn(),
    removeSingleMetric: jest.fn(),
    setDefaultLabels: jest.fn()
  },
  Counter: jest.fn(() => ({
    inc: jest.fn(),
    labels: jest.fn(() => ({ inc: jest.fn() }))
  })),
  Gauge: jest.fn(() => ({
    set: jest.fn(),
    inc: jest.fn(),
    dec: jest.fn(),
    labels: jest.fn(() => ({ set: jest.fn(), inc: jest.fn(), dec: jest.fn() }))
  })),
  Histogram: jest.fn(() => ({
    observe: jest.fn(),
    labels: jest.fn(() => ({ observe: jest.fn() }))
  })),
  Summary: jest.fn(() => ({
    observe: jest.fn(),
    labels: jest.fn(() => ({ observe: jest.fn() }))
  })),
  collectDefaultMetrics: jest.fn()
})); 