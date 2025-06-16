import { IngestionAgent } from '../index';
import { IngestionAgentConfig, DataProvider } from '../types';
import { BaseAgentDependencies, Logger, ErrorHandler } from '../../BaseAgent/types';
import { isDuplicateRawProp } from '../isDuplicate';
import { validateRawProp } from '../validateRawProp';
import { normalizeRawProp } from '../normalize';

// Mock the fetchRawProps module at the top level
jest.mock('../fetchRawProps', () => ({
  fetchRawProps: jest.fn()
}));

// Import the mocked function
import { fetchRawProps } from '../fetchRawProps';
const mockFetchRawProps = fetchRawProps as jest.MockedFunction<typeof fetchRawProps>;

// Mock isDuplicateRawProp
jest.mock('../isDuplicate', () => ({
  isDuplicateRawProp: jest.fn()
}));
const mockIsDuplicateRawProp = isDuplicateRawProp as jest.MockedFunction<typeof isDuplicateRawProp>;

// Mock validateRawProp
jest.mock('../validateRawProp', () => ({
  validateRawProp: jest.fn(),
  validateRawPropDetailed: jest.fn(),
  validateRequiredFields: jest.fn(),
  validateBusinessRules: jest.fn()
}));
const mockValidateRawProp = validateRawProp as jest.MockedFunction<typeof validateRawProp>;

// Mock normalizeRawProp
jest.mock('../normalize', () => ({
  normalizeRawProp: jest.fn(),
  normalizeRawPropDetailed: jest.fn()
}));
const mockNormalizeRawProp = normalizeRawProp as jest.MockedFunction<typeof normalizeRawProp>;

// Helper function to create complete RawProp objects for testing
function createTestRawProp(overrides: Partial<any> = {}): any {
  return {
    scraped_at: new Date().toISOString(),
    edge_score: null,
    auto_approved: null,
    context_flag: null,
    created_at: new Date().toISOString(),
    promoted_to_picks: null,
    game_id: null,
    outcomes: null,
    player_id: null,
    promoted_at: null,
    unit_size: null,
    promoted: null,
    ev_percent: null,
    trend_score: null,
    matchup_score: null,
    line_score: null,
    role_score: null,
    is_promoted: null,
    updated_at: null,
    is_alt_line: null,
    is_primary: null,
    is_valid: null,
    over_odds: null,
    under_odds: null,
    game_time: null,
    id: 'test-prop-1',
    line: 25.5,
    odds: 110,
    game_date: '2024-01-01',
    trend_confidence: null,
    matchup_quality: null,
    line_value_score: null,
    role_stability: null,
    confidence_score: null,
    player_name: 'Test Player',
    sport: 'basketball',
    team: 'Test Team',
    stat_type: 'points',
    outcome: null,
    direction: 'over',
    player_slug: null,
    external_game_id: 'game-123',
    matchup: null,
    sport_key: null,
    fair_odds: null,
    source: null,
    provider: null,
    raw_data: null,
    ...overrides
  };
}

describe('IngestionAgent', () => {
  let agent: IngestionAgent;
  let testConfig: IngestionAgentConfig;
  let testDependencies: BaseAgentDependencies;
  let mockSupabase: any;
  let mockLogger: Logger;
  let mockErrorHandler: ErrorHandler;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };

    // Setup mock Logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn().mockReturnThis(),
    };

    // Setup mock ErrorHandler
    mockErrorHandler = {
      handleError: jest.fn(),
      withRetry: jest.fn().mockImplementation(async (fn) => await fn()),
    };

    // Setup default mock responses
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'raw_props') {
        return {
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null })
          }),
          insert: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue({ data: null, error: null })
          }),
          eq: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        };
      }
      return mockSupabase;
    });

    const testProvider: DataProvider = {
      name: 'test-provider',
      enabled: true,
      url: 'https://api.test-provider.com',
      apiKey: 'test-key',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
    };

    testConfig = {
      name: 'Test Ingestion Agent',
      enabled: true,
      version: '1.0.0',
      logLevel: 'info' as const,
      metrics: {
        enabled: true,
        interval: 60,
      },
      providers: [testProvider],
      batchSize: 100,
      processingTimeout: 300000,
      duplicateCheckEnabled: true,
      duplicateCheckWindow: 86400000,
      validationEnabled: true,
      normalizationEnabled: true,
    };

    testDependencies = {
      supabase: mockSupabase,
      logger: mockLogger,
      errorHandler: mockErrorHandler,
    };


    // Setup default mocks
    mockFetchRawProps.mockResolvedValue([]);
    mockIsDuplicateRawProp.mockResolvedValue(false);
    mockValidateRawProp.mockReturnValue(true);
    mockNormalizeRawProp.mockImplementation((prop) => ({ ...prop })); // Return the prop as-is for testing

    agent = new IngestionAgent(testConfig, testDependencies);
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid config', async () => {
      await expect(agent.initialize()).resolves.not.toThrow();
    });

    it('should allow empty providers array', () => {
      const configWithEmptyProviders = { ...testConfig, providers: [] };

      // The schema allows empty providers array, so this should not throw
      expect(() => {
        new IngestionAgent(configWithEmptyProviders, testDependencies);
      }).not.toThrow();
    });
  });

  describe('Processing', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should process props successfully', async () => {

      // Mock fetchRawProps to return test data
      mockFetchRawProps.mockResolvedValue([
        createTestRawProp({
          id: 'test-prop-1',
          player_name: 'Test Player',
          sport: 'basketball',
          team: 'Test Team',
          stat_type: 'points',
          line: 25.5,
          odds: 110,
          direction: 'over',
          game_date: '2024-01-01',
          external_game_id: 'game-123',
        })
      ]);

      // Mock isDuplicateRawProp to return false (not duplicate)
      mockIsDuplicateRawProp.mockResolvedValue(false);

      // Mock validateRawProp to return true (valid)
      mockValidateRawProp.mockReturnValue(true);

      const result = await agent.process();

      expect(result.totalFetched).toBe(1);
      expect(result.ingested).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('should skip duplicate props', async () => {
      // Mock fetchRawProps to return test data
      mockFetchRawProps.mockResolvedValue([
        createTestRawProp({
          id: 'test-prop-1',
          player_name: 'Test Player',
          sport: 'basketball',
          team: 'Test Team',
          stat_type: 'points',
          line: 25.5,
          odds: 110,
          direction: 'over',
          game_date: '2024-01-01',
          external_game_id: 'game-123',
        })
      ]);

      // Mock isDuplicateRawProp to return true (is duplicate)
      mockIsDuplicateRawProp.mockResolvedValue(true);

      // Mock validateRawProp to return true (valid)
      mockValidateRawProp.mockReturnValue(true);

      const result = await agent.process();

      expect(result.totalFetched).toBe(1);
      expect(result.ingested).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('should skip invalid props when validation is enabled', async () => {
      // Mock fetchRawProps to return test data
      mockFetchRawProps.mockResolvedValue([
        createTestRawProp({
          id: 'test-prop-1',
          player_name: 'Test Player',
          sport: 'basketball',
          team: 'Test Team',
          stat_type: 'points',
          line: 25.5,
          odds: 110,
          direction: 'over',
          game_date: '2024-01-01',
          external_game_id: 'game-123',
        })
      ]);

      // Mock isDuplicateRawProp to return false
      mockIsDuplicateRawProp.mockResolvedValue(false);

      // Mock validateRawProp to return false (invalid)
      mockValidateRawProp.mockReturnValue(false);

      const result = await agent.process();

      expect(result.totalFetched).toBe(1);
      expect(result.ingested).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('should handle database insertion errors', async () => {
      // Mock fetchRawProps to return test data
      mockFetchRawProps.mockResolvedValue([
        createTestRawProp({
          id: 'test-prop-1',
          player_name: 'Test Player',
          sport: 'basketball',
          team: 'Test Team',
          stat_type: 'points',
          line: 25.5,
          odds: 110,
          direction: 'over',
          game_date: '2024-01-01',
          external_game_id: 'game-123',
        })
      ]);

      // Mock isDuplicateRawProp to return false
      mockIsDuplicateRawProp.mockResolvedValue(false);

      // Mock validateRawProp to return true (valid)
      mockValidateRawProp.mockReturnValue(true);

      // Mock database insertion to return error
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'raw_props') {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: new Error('Database error') }),
            select: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null })
            })
          };
        }
        return mockSupabase;
      });

      const result = await agent.process();

      expect(result.totalFetched).toBe(1);
      expect(result.ingested).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(1);
    });

    it('should return empty results when no props are fetched', async () => {
      // Mock fetchRawProps to return empty array
      mockFetchRawProps.mockResolvedValue([]);

      const result = await agent.process();

      expect(result.totalFetched).toBe(0);
      expect(result.ingested).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('should handle fetchRawProps errors gracefully', async () => {
      // Mock fetchRawProps to throw error
      mockFetchRawProps.mockRejectedValue(new Error('Fetch error'));

      // The implementation catches fetch errors and continues processing
      // It doesn't throw the error, but returns a result with errors
      const result = await agent.process();

      expect(result.totalFetched).toBe(0);
      expect(result.ingested).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(1);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when Supabase is accessible', async () => {
      // Mock successful Supabase query
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      }));

      const result = await agent.checkHealth();
      expect(result.status).toBe('healthy');
    });

    it('should return healthy status when no ingestion has happened yet', async () => {
      // Mock successful Supabase query
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      }));

      const result = await agent.checkHealth();
      expect(result.status).toBe('healthy');
      expect(result.details.ingestion).toContain('No ingestion runs yet');
    });
  });

  describe('Configuration', () => {
    it('should use default values for optional config', () => {
      const minimalConfig = {
        name: 'Test Agent',
        enabled: true,
        version: '1.0.0',
        logLevel: 'info' as const,
        metrics: {
          enabled: true,
          interval: 60,
        },
        providers: [{
          name: 'test-provider',
          enabled: true,
          url: 'https://api.test.com',
          timeout: 30000,
          retryAttempts: 3,
          retryDelay: 1000,
        }],
        batchSize: 100,
        processingTimeout: 300000,
        duplicateCheckEnabled: true,
        duplicateCheckWindow: 86400000,
        validationEnabled: true,
        normalizationEnabled: true,
      };

      const agentWithDefaults = new IngestionAgent(minimalConfig, testDependencies);
      expect(agentWithDefaults).toBeDefined();
    });

    it('should validate batchSize range', () => {
      const invalidConfig = {
        ...testConfig,
        batchSize: 0 // Invalid: below minimum
      };

      expect(() => {
        new IngestionAgent(invalidConfig, testDependencies);
      }).toThrow();
    });
  });

  describe('Validation', () => {
    it('should normalize prop data correctly', () => {
      const rawProp = createTestRawProp({
        id: 'test-1',
        player_name: '  Test Player  ',
        sport: '  basketball  ',
        team: '  Test Team  ',
        stat_type: 'points',
        line: 25.5,
        odds: 110,
        direction: 'over',
        game_date: '2024-01-01',
      });

      const normalized = normalizeRawProp(rawProp);
      expect(normalized.player_name).toBe('Test Player');
      expect(normalized.sport).toBe('basketball');
      // The normalizeTeam function converts to uppercase
      expect(normalized.team).toBe('TEST TEAM');
    });

    it('should validate required fields', () => {
      const invalidProp = {
        id: 'test-1',
        // Missing required fields like player_name, stat_type, line, sport
        sport: 'basketball',
        created_at: new Date().toISOString(),
      };

      // Use the actual validateRawProp function, not the mock
      const { validateRawProp: actualValidateRawProp } = jest.requireActual('../validateRawProp');
      const isValid = actualValidateRawProp(invalidProp);
      expect(isValid).toBe(false);
    });
  });
});

describe('isDuplicateRawProp', () => {
  let mockSupabase: any;

  beforeEach(() => {
    // Reset the mock before each test
    jest.clearAllMocks();
    
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnThis(),
    };
  });

  it('should return true for duplicate prop', async () => {
    // Mock Supabase to return existing data (duplicate found)
    mockSupabase.from.mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ 
                  data: { id: 'existing-id' }, 
                  error: null 
                })
              })
            })
          })
        })
      })
    }));

    const testProp = {
      id: 'test-1',
      external_game_id: 'game-123',
      player_name: 'Test Player',
      sport: 'basketball',
      team: 'Test Team',
      stat_type: 'points',
      line: 25.5,
      odds: 110,
      direction: 'over',
      game_date: '2024-01-01',
      created_at: new Date().toISOString(),
    };

    // Use the actual function, not the mock
    const { isDuplicateRawProp: actualIsDuplicateRawProp } = jest.requireActual('../isDuplicate');
    const result = await actualIsDuplicateRawProp(testProp, mockSupabase);
    expect(result).toBe(true);
  });

  it('should return false for non-duplicate prop', async () => {
    // Mock Supabase to return empty data (no duplicate found)
    mockSupabase.from.mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ 
                  data: null, 
                  error: null 
                })
              })
            })
          })
        })
      })
    }));

    const testProp = {
      id: 'test-1',
      external_game_id: 'game-123',
      player_name: 'Test Player',
      sport: 'basketball',
      team: 'Test Team',
      stat_type: 'points',
      line: 25.5,
      odds: 110,
      direction: 'over',
      game_date: '2024-01-01',
      created_at: new Date().toISOString(),
    };

    // Use the actual function, not the mock
    const { isDuplicateRawProp: actualIsDuplicateRawProp } = jest.requireActual('../isDuplicate');
    const result = await actualIsDuplicateRawProp(testProp, mockSupabase);
    expect(result).toBe(false);
  });

  it('should return false on database error', async () => {
    // Mock Supabase to return error
    mockSupabase.from.mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ 
                  data: null, 
                  error: new Error('Database error') 
                })
              })
            })
          })
        })
      })
    }));

    const testProp = {
      id: 'test-1',
      external_game_id: 'game-123',
      player_name: 'Test Player',
      sport: 'basketball',
      team: 'Test Team',
      stat_type: 'points',
      line: 25.5,
      odds: 110,
      direction: 'over',
      game_date: '2024-01-01',
      created_at: new Date().toISOString(),
    };

    // Use the actual function, not the mock
    const { isDuplicateRawProp: actualIsDuplicateRawProp } = jest.requireActual('../isDuplicate');
    const result = await actualIsDuplicateRawProp(testProp, mockSupabase);
    expect(result).toBe(false);
  });
});