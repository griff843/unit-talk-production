import { BaseAgentDependencies, BaseAgentConfig } from '../../src/agents/BaseAgent/types';
import { Logger } from '../../src/shared/logger/types';
import { setupTestDatabase } from '../config/supabase.test';

// Mock data
export const mockUsers = [
  { id: 'user1', name: 'Test User 1', tier: 'basic' },
  { id: 'user2', name: 'Test User 2', tier: 'vip' }
];

export const mockCappers = [
  { id: 'capper1', name: 'Test Capper 1', rating: 4.5 },
  { id: 'capper2', name: 'Test Capper 2', rating: 4.8 }
];

export const mockPicks = [
  {
    id: 'pick1',
    user_id: 'user1',
    capper_id: 'capper1',
    sport: 'NBA',
    market_type: 'Player Props',
    line: 25.5,
    odds: -110,
    status: 'pending'
  },
  {
    id: 'pick2',
    user_id: 'user2',
    capper_id: 'capper2',
    sport: 'MLB',
    market_type: 'Game Lines',
    line: 8.5,
    odds: -105,
    status: 'completed'
  }
];

// Mock logger
const createMockLogger = (): Logger => {
  const logger: Logger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    setLevel: jest.fn(),
    child: jest.fn().mockImplementation(() => createMockLogger())
  };
  return logger;
};

const mockLogger = createMockLogger();

// Mock error handler
const mockErrorHandler = {
  handleError: jest.fn(),
  withRetry: jest.fn((fn: any) => fn())
};

export function createTestDependencies(): BaseAgentDependencies {
  const { client: mockSupabase } = setupTestDatabase();

  return {
    supabase: mockSupabase,
    logger: mockLogger,
    errorHandler: mockErrorHandler
  };
}

export function createTestConfig(overrides: Partial<BaseAgentConfig> = {}): BaseAgentConfig {
  return {
    name: 'TestAgent',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: {
      enabled: true,
      interval: 60000
    },
    ...overrides
  };
}

export function setupTestData() {
  const { client: mockSupabase, store } = setupTestDatabase();
  
  // Populate test data
  store.insert('users', mockUsers);
  store.insert('cappers', mockCappers);
  store.insert('daily_picks', mockPicks);

  return mockSupabase;
}

export function clearTestData() {
  const { store } = setupTestDatabase();
  store.reset();
}

// Helper function to wait for promises to resolve
export function flushPromises() {
  return new Promise(resolve => setImmediate(resolve));
}

// Helper function to create a mock Discord interaction
export function createMockInteraction(data: any = {}) {
  return {
    reply: jest.fn(),
    followUp: jest.fn(),
    editReply: jest.fn(),
    deferReply: jest.fn(),
    options: {
      get: jest.fn(),
      getString: jest.fn(),
      getNumber: jest.fn(),
      getBoolean: jest.fn()
    },
    member: {
      roles: {
        cache: new Map()
      }
    },
    guild: {
      roles: {
        cache: new Map()
      }
    },
    ...data
  };
}

// Helper function to create a mock Discord client
export function createMockDiscordClient(data: any = {}) {
  return {
    guilds: {
      cache: new Map(),
      fetch: jest.fn()
    },
    channels: {
      cache: new Map(),
      fetch: jest.fn()
    },
    users: {
      cache: new Map(),
      fetch: jest.fn()
    },
    ...data
  };
}

// Helper function to create a mock Discord message
export function createMockMessage(data: any = {}) {
  return {
    content: '',
    author: {
      id: 'test-user-id',
      bot: false
    },
    channel: {
      send: jest.fn(),
      id: 'test-channel-id'
    },
    guild: {
      id: 'test-guild-id'
    },
    reply: jest.fn(),
    delete: jest.fn(),
    ...data
  };
}

// Helper function to create a mock Discord webhook
export function createMockWebhook(data: any = {}) {
  return {
    send: jest.fn(),
    edit: jest.fn(),
    delete: jest.fn(),
    ...data
  };
}

// Helper function to create a mock Discord role
export function createMockRole(data: any = {}) {
  return {
    id: 'test-role-id',
    name: 'Test Role',
    permissions: BigInt(0),
    ...data
  };
}

// Helper function to create a mock Discord channel
export function createMockChannel(data: any = {}) {
  return {
    id: 'test-channel-id',
    name: 'test-channel',
    type: 0, // Text channel
    send: jest.fn(),
    messages: {
      fetch: jest.fn()
    },
    ...data
  };
}

// Helper function to create a mock Discord guild
export function createMockGuild(data: any = {}) {
  return {
    id: 'test-guild-id',
    name: 'Test Guild',
    roles: {
      cache: new Map(),
      create: jest.fn(),
      fetch: jest.fn()
    },
    channels: {
      cache: new Map(),
      create: jest.fn(),
      fetch: jest.fn()
    },
    members: {
      cache: new Map(),
      fetch: jest.fn()
    },
    ...data
  };
}

// Helper function to create a mock Discord button interaction
export function createMockButtonInteraction(data: any = {}) {
  return {
    ...createMockInteraction(),
    customId: 'test-button-id',
    component: {
      type: 2, // Button
      customId: 'test-button-id',
      label: 'Test Button'
    },
    ...data
  };
}

// Helper function to create a mock Discord select menu interaction
export function createMockSelectMenuInteraction(data: any = {}) {
  return {
    ...createMockInteraction(),
    customId: 'test-select-id',
    values: ['test-value'],
    component: {
      type: 3, // Select Menu
      customId: 'test-select-id',
      options: [{ label: 'Test Option', value: 'test-value' }]
    },
    ...data
  };
}

// Helper function to create a mock Discord modal interaction
export function createMockModalInteraction(data: any = {}) {
  return {
    ...createMockInteraction(),
    customId: 'test-modal-id',
    fields: {
      getTextInputValue: jest.fn()
    },
    ...data
  };
}

// Helper function to create a mock Discord command interaction
export function createMockCommandInteraction(data: any = {}) {
  return {
    ...createMockInteraction(),
    commandName: 'test-command',
    options: {
      ...createMockInteraction().options,
      _hoistedOptions: []
    },
    ...data
  };
}

// Helper function to create a mock Discord context menu interaction
export function createMockContextMenuInteraction(data: any = {}) {
  return {
    ...createMockInteraction(),
    commandName: 'test-context-menu',
    targetId: 'test-target-id',
    targetType: 3, // Message
    ...data
  };
}

// Helper function to create a mock Discord autocomplete interaction
export function createMockAutocompleteInteraction(data: any = {}) {
  return {
    ...createMockInteraction(),
    commandName: 'test-command',
    options: {
      ...createMockInteraction().options,
      getFocused: jest.fn()
    },
    respond: jest.fn(),
    ...data
  };
} 