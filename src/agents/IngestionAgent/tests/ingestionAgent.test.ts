import { IngestionAgent } from '../index';
import { IngestionAgentConfig, DataProvider, RawProp, schemas } from '../types';
import { BaseAgentDependencies } from '../../BaseAgent/types';
import { fetchRawProps } from '../fetchRawProps';
import { validateRawProp, validateRawPropDetailed } from '../validateRawProp';
import { isDuplicateRawProp } from '../isDuplicate';
import { normalizeRawProp } from '../normalize';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../../../utils/logger';
import { ErrorHandler } from '../../../utils/errorHandling';

// Mock dependencies
const mockInsert = jest.fn(() => {
  console.log('Mock insert called, returning success');
  return Promise.resolve({ data: null, error: null });
});
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null }))
            }))
          }))
        }))
      }))
    })),
    insert: mockInsert
  }))
} as any;

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
} as any;

const mockErrorHandler = {
  handleError: jest.fn()
} as any;

const testDependencies: BaseAgentDependencies = {
  supabase: mockSupabase,
  logger: mockLogger,
  errorHandler: mockErrorHandler
};

const testProvider: DataProvider = {
  name: 'TestProvider',
  url: 'https://api.test.com',
  enabled: true,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
};

const testConfig: IngestionAgentConfig = {
  name: 'test-ingestion-agent',
  enabled: true,
  version: '1.0.0',
  logLevel: 'info',
  providers: [
    {
      name: 'test-provider',
      enabled: true,
      url: 'https://api.test.com',
      apiKey: 'test-key',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  ],
  batchSize: 10,
  processingTimeout: 300000,
  duplicateCheckEnabled: true,
  duplicateCheckWindow: 86400000,
  validationEnabled: true,
  normalizationEnabled: true,
  metrics: {
    enabled: true,
    interval: 60,
    port: 3001
  },
  health: {
    enabled: true,
    interval: 30,
    timeout: 5000,
    checkDb: true,
    checkExternal: false
  },
  retry: {
    enabled: true,
    maxRetries: 3,
    backoffMs: 1000,
    maxBackoffMs: 30000,
    maxAttempts: 3,
    backoff: 1000,
    exponential: true,
    jitter: false
  }
};

describe('IngestionAgent', () => {
  let agent: IngestionAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new IngestionAgent(testConfig, testDependencies);
  });

  afterEach(async () => {
    if (agent) {
      await agent.cleanup();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid config', async () => {
      await expect(agent.initialize()).resolves.not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith('🚀 IngestionAgent initializing');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ IngestionAgent initialized successfully');
    });

    it('should throw error with invalid batch size', async () => {
      const invalidConfig = { ...testConfig, batchSize: 0 };

      // The validation happens in constructor, not initialize()
      expect(() => {
        new IngestionAgent(invalidConfig, testDependencies);
      }).toThrow(); // Zod will throw validation error for batchSize < 1
    });

    it('should throw error with no providers', async () => {
      const invalidConfig = { ...testConfig, providers: [] };

      // The validation happens in constructor, not initialize()
      expect(() => {
        new IngestionAgent(invalidConfig, testDependencies);
      }).toThrow(); // Zod will throw validation error for empty providers array
    });
  });

  describe('Processing', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should process props successfully', async () => {
      const mockProps: RawProp[] = [
        {
          external_game_id: '12345',
          game_id: null,
          player_name: 'Test Player',
          team: 'TEST',
          stat_type: 'PTS',
          line: 25.5,
          over_odds: -110,
          under_odds: -110,
          provider: 'TestProvider',
          game_time: new Date().toISOString(),
          scraped_at: new Date().toISOString(),
          sport: 'NBA',
          sport_key: 'basketball_nba',
          matchup: 'TEST vs OPPONENT',

          // Set other fields to null
          source: null, direction: null, edge_score: null, auto_approved: null, context_flag: null, created_at: null,
          promoted_to_picks: null, outcomes: null, player_id: null, promoted_at: null, unit_size: null,
          promoted: null, ev_percent: null, trend_score: null, matchup_score: null, line_score: null, role_score: null,
          is_promoted: null, updated_at: null, is_alt_line: null, is_primary: null, is_valid: null,
          odds: null, game_date: null, trend_confidence: null, matchup_quality: null, line_value_score: null,
          role_stability: null, confidence_score: null, outcome: null, player_slug: null, fair_odds: null, raw_data: null
        }
      ];

      // Reset counters before test
      (agent as any).ingestedCount = 0;
      (agent as any).skippedCount = 0;
      (agent as any).errorCount = 0;

      // Mock the duplicate check to return false (not a duplicate)
      const isDuplicateSpy = jest.spyOn(require('../isDuplicate'), 'isDuplicateRawProp')
        .mockResolvedValue(false);

      console.log('isDuplicate mock setup:', isDuplicateSpy.getMockName());

      // Test normalization directly
      try {
        const normalized = require('../normalize').normalizeRawProp(mockProps[0]);
        console.log('Normalization successful');
      } catch (error) {
        console.log('Normalization error:', error);
      }

      // Add debug logging to processSingleProp
      const originalProcessSingleProp = (agent as any).processSingleProp;
      (agent as any).processSingleProp = async function(prop: any) {
        console.log('processSingleProp called');
        try {
          const result = await originalProcessSingleProp.call(this, prop);
          console.log('processSingleProp completed successfully');
          return result;
        } catch (error) {
          console.log('processSingleProp error:', error);
          throw error;
        }
      };

      const result = await agent.__test__process(mockProps);

      console.log('Final result:', result);
      console.log('isDuplicateRawProp called:', isDuplicateSpy.mock.calls.length);
      console.log('Supabase insert called:', mockInsert.mock.calls.length);

      expect(result.totalFetched).toBe(1);
      expect(result.ingested).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);

      isDuplicateSpy.mockRestore();
    });

    it('should skip invalid props', async () => {
      const invalidProps: any[] = [
        { invalid: 'prop' }
      ];

      const result = await agent.__test__process(invalidProps);

      expect(result.totalFetched).toBe(1);
      expect(result.ingested).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn(() => Promise.resolve({ 
          data: null, 
          error: new Error('Database error') 
        }))
      });

      const mockProps: RawProp[] = [
        {
          external_game_id: '12345',
          game_id: null,
          player_name: 'Test Player',
          team: 'TEST',
          stat_type: 'PTS',
          line: 25.5,
          over_odds: -110,
          under_odds: -110,
          provider: 'TestProvider',
          game_time: new Date().toISOString(),
          scraped_at: new Date().toISOString(),
          sport: 'NBA',
          sport_key: 'basketball_nba',
          matchup: 'TEST vs OPPONENT',
          
          source: null, direction: null, edge_score: null, auto_approved: null, context_flag: null, created_at: null,
          promoted_to_picks: null, outcomes: null, player_id: null, promoted_at: null, unit_size: null,
          promoted: null, ev_percent: null, trend_score: null, matchup_score: null, line_score: null, role_score: null,
          is_promoted: null, updated_at: null, is_alt_line: null, is_primary: null, is_valid: null,
          odds: null, game_date: null, trend_confidence: null, matchup_quality: null, line_value_score: null,
          role_stability: null, confidence_score: null, outcome: null, player_slug: null, fair_odds: null, raw_data: null
        }
      ];

      const result = await agent.__test__process(mockProps);

      expect(result.errors).toBe(1);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should return healthy status initially', async () => {
      const health = await agent.checkHealth();
      expect(health.status).toBe('healthy');
    });



    it('should detect degraded status with high skip rate', async () => {
      // Create mock props that will be skipped due to validation failure
      const mockProps = Array(10).fill(null).map(() => ({ invalid: 'prop' })) as any[];

      // Set lastIngestionTime so health check doesn't return early
      (agent as any).metrics.lastIngestionTime = new Date();

      await agent.__test__process(mockProps);

      const health = await agent.checkHealth();
      expect(health.status).toBe('degraded');
      expect(health.details.ingestion).toContain('High skip rate');
    });

    it('should detect degraded status with high error rate', async () => {
      // Set lastIngestionTime so health check doesn't return early
      (agent as any).metrics.lastIngestionTime = new Date();

      // Directly set high error count to simulate processing errors
      (agent as any).errorCount = 8; // 8 errors
      (agent as any).ingestedCount = 2; // 2 successful ingestions
      (agent as any).skippedCount = 0; // 0 skips
      // Total: 10, error rate = 8/10 = 80% > 10% threshold

      const health = await agent.checkHealth();
      expect(health.status).toBe('degraded');
      expect(health.details.ingestion).toContain('High error rate');
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should collect comprehensive metrics', async () => {
      const metrics = await agent.collectMetrics();

      expect(metrics).toHaveProperty('ingestedCount');
      expect(metrics).toHaveProperty('skippedCount');
      expect(metrics).toHaveProperty('errorCount');
      expect(metrics).toHaveProperty('lastIngestionTime');
      expect(metrics).toHaveProperty('providersConfigured');
      expect(metrics).toHaveProperty('batchSize');
      expect(metrics.providersConfigured).toBe(1);
      expect(metrics.batchSize).toBe(10);
    });
  });
});

describe('fetchRawProps', () => {
  it('should return valid RawProps', async () => {
    const props = await fetchRawProps(testProvider);
    expect(Array.isArray(props)).toBe(true);
    props.forEach((prop) => {
      expect(() => schemas.RawProp.parse(prop)).not.toThrow();
    });
  });

  it('should return empty array for disabled provider', async () => {
    const disabledProvider = { ...testProvider, enabled: false };
    const props = await fetchRawProps(disabledProvider);
    expect(props).toEqual([]);
  });
});

describe('validateRawProp', () => {
  const validProp: RawProp = {
    external_game_id: '12345',
    game_id: null,
    player_name: 'Test Player',
    team: 'TEST',
    stat_type: 'PTS',
    line: 25.5,
    over_odds: -110,
    under_odds: -110,
    provider: 'TestProvider',
    game_time: new Date().toISOString(),
    scraped_at: new Date().toISOString(),
    sport: 'NBA',
    sport_key: 'basketball_nba',
    matchup: 'TEST vs OPPONENT',
    
    source: null, direction: null, edge_score: null, auto_approved: null, context_flag: null, created_at: null,
    promoted_to_picks: null, outcomes: null, player_id: null, promoted_at: null, unit_size: null,
    promoted: null, ev_percent: null, trend_score: null, matchup_score: null, line_score: null, role_score: null,
    is_promoted: null, updated_at: null, is_alt_line: null, is_primary: null, is_valid: null,
    odds: null, game_date: null, trend_confidence: null, matchup_quality: null, line_value_score: null,
    role_stability: null, confidence_score: null, outcome: null, player_slug: null, fair_odds: null, raw_data: null
  };

  it('should validate correct prop structure', () => {
    expect(validateRawProp(validProp)).toBe(true);
  });

  it('should reject invalid prop structure', () => {
    expect(validateRawProp({ invalid: 'prop' })).toBe(false);
  });

  it('should provide detailed validation results', () => {
    const result = validateRawPropDetailed(validProp);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should provide detailed error information for invalid props', () => {
    const result = validateRawPropDetailed({ invalid: 'prop' });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('isDuplicateRawProp', () => {
  const testProp: RawProp = {
    external_game_id: '12345',
    game_id: null,
    player_name: 'Test Player',
    team: 'TEST',
    stat_type: 'PTS',
    line: 25.5,
    over_odds: -110,
    under_odds: -110,
    provider: 'TestProvider',
    game_time: new Date().toISOString(),
    scraped_at: new Date().toISOString(),
    sport: 'NBA',
    sport_key: 'basketball_nba',
    matchup: 'TEST vs OPPONENT',
    
    source: null, direction: null, edge_score: null, auto_approved: null, context_flag: null, created_at: null,
    promoted_to_picks: null, outcomes: null, player_id: null, promoted_at: null, unit_size: null,
    promoted: null, ev_percent: null, trend_score: null, matchup_score: null, line_score: null, role_score: null,
    is_promoted: null, updated_at: null, is_alt_line: null, is_primary: null, is_valid: null,
    odds: null, game_date: null, trend_confidence: null, matchup_quality: null, line_value_score: null,
    role_stability: null, confidence_score: null, outcome: null, player_slug: null, fair_odds: null, raw_data: null
  };

  it('should return false for non-duplicate prop', async () => {
    const result = await isDuplicateRawProp(testProp, mockSupabase);
    expect(result).toBe(false);
  });

  it('should return true for duplicate prop', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: { id: '123' }, error: null }))
              }))
            }))
          }))
        }))
      }))
    });

    const result = await isDuplicateRawProp(testProp, mockSupabase);
    expect(result).toBe(true);
  });
});

describe('normalizeRawProp', () => {
  it('should normalize prop data correctly', () => {
    const rawProp: RawProp = {
      external_game_id: '12345',
      game_id: null,
      player_name: '  LeBron James  ',
      team: 'lal',
      stat_type: 'points',
      line: 25.5,
      over_odds: -110,
      under_odds: -110,
      provider: 'TestProvider',
      game_time: new Date().toISOString(),
      scraped_at: new Date().toISOString(),
      sport: 'nba',
      sport_key: 'basketball_nba',
      matchup: 'lal vs bos',
      
      source: null, direction: null, edge_score: null, auto_approved: null, context_flag: null, created_at: null,
      promoted_to_picks: null, outcomes: null, player_id: null, promoted_at: null, unit_size: null,
      promoted: null, ev_percent: null, trend_score: null, matchup_score: null, line_score: null, role_score: null,
      is_promoted: null, updated_at: null, is_alt_line: null, is_primary: null, is_valid: null,
      odds: null, game_date: null, trend_confidence: null, matchup_quality: null, line_value_score: null,
      role_stability: null, confidence_score: null, outcome: null, player_slug: null, fair_odds: null, raw_data: null
    };

    const normalized = normalizeRawProp(rawProp);

    expect(normalized.player_name).toBe('LeBron James');
    expect(normalized.team).toBe('LAL');
    expect(normalized.stat_type).toBe('PTS');
    expect(normalized.sport).toBe('nba');
    expect(normalized.matchup).toBe('LAL VS BOS');
    expect(normalized.player_slug).toBe('lebron-james');
    expect(normalized.is_valid).toBe(true);
  });
});