import { jest, beforeAll, afterAll } from '@jest/globals';

import { Logger } from '../src/shared/logger/types';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'test' | 'production';
      SUPABASE_URL: string;
      SUPABASE_SERVICE_ROLE_KEY: string;
      JWT_SECRET: string;
      ENCRYPTION_KEY: string;
      [key: string]: string | undefined;
    }
  }

  // eslint-disable-next-line no-var
  var testUtils: {
    mockLogger: Logger;
    mockSupabase: any;
    mockDeps: any;
  };
}

// Set up test environment
process.env['NODE_ENV'] = 'test';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-key';
process.env['JWT_SECRET'] = 'test-jwt-secret';
process.env['ENCRYPTION_KEY'] = 'test-encryption-key';

// Mock logger
const mockLogger: Logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
  setLevel: jest.fn(),
};

// Set up global test utilities
global.testUtils = {
  mockLogger,
  mockSupabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    notIn: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    containedBy: jest.fn().mockReturnThis(),
    overlaps: jest.fn().mockReturnThis(),
    textSearch: jest.fn().mockReturnThis(),
    match: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    abortSignal: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    then: jest.fn().mockReturnThis(),
  },
  mockDeps: {
    logger: mockLogger,
    supabase: null,
  },
};

beforeAll(async () => {
  // Set up test database
  global.testUtils.mockDeps.supabase = global.testUtils.mockSupabase;
});

afterAll(async () => {
  // Clean up test database
});
