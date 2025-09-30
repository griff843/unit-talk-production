import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('node:fs');
jest.mock('node:path');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('CreditLogger', () => {
  let creditLogger: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset the module cache to get a fresh instance
    delete require.cache[require.resolve('../../apps/api/src/services/creditLogger.ts')];

    // Mock path operations
    mockPath.resolve.mockReturnValue('C:\\mock\\path');
    mockPath.join.mockReturnValue('C:\\mock\\path\\file.json');

    // Mock fs operations
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);

    // Import fresh module
    const module = await import('../../apps/api/src/services/creditLogger.js');
    creditLogger = module.creditLogger;
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('deduplication', () => {
    it('should deduplicate calls with same key', async () => {
      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
        from: jest.fn()
      };
      mockCreateClient.mockReturnValue(mockSupabase as any);

      // Begin run
      creditLogger.beginRun('oddsapi');

      // Add same call twice with dedup key
      creditLogger.addCall('oddsapi', 1, 1, 'test-key-1');
      creditLogger.addCall('oddsapi', 1, 1, 'test-key-1'); // Should be deduplicated

      // Add different call
      creditLogger.addCall('oddsapi', 1, 1, 'test-key-2');

      await creditLogger.flush();

      // Should call RPC once with aggregated data (2 credits, 2 calls - one deduped)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_credit_usage', {
        provider: 'oddsapi',
        credits: 2, // 1 + 1 (second call deduped)
        calls: 2
      });
    });
  });

  describe('batch flush', () => {
    it('should aggregate credits and calls per provider', async () => {
      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
        from: jest.fn()
      };
      mockCreateClient.mockReturnValue(mockSupabase as any);

      // Multiple calls to same provider
      creditLogger.addCall('oddsapi', 2, 1);
      creditLogger.addCall('oddsapi', 3, 1);
      creditLogger.addCall('sgo', 1, 1);

      await creditLogger.flush();

      // Should make separate calls for each provider
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_credit_usage', {
        provider: 'oddsapi',
        credits: 5,
        calls: 2
      });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_credit_usage', {
        provider: 'sgo',
        credits: 1,
        calls: 1
      });
    });
  });

  describe('error resilience', () => {
    it('should fallback to direct insert when RPC fails', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: null, error: null })
      });
      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST202', message: 'RPC not found' }
        }),
        from: jest.fn().mockReturnValue({
          insert: mockInsert
        })
      };
      mockCreateClient.mockReturnValue(mockSupabase as any);

      creditLogger.addCall('oddsapi', 1, 1);
      await creditLogger.flush();

      // Should fallback to insert
      expect(mockInsert).toHaveBeenCalledWith({
        provider: 'oddsapi',
        credits: 1,
        calls: 1
      });
    });

    it('should handle network errors gracefully', async () => {
      const mockSupabase = {
        rpc: jest.fn().mockRejectedValue(new Error('Network error')),
        from: jest.fn()
      };
      mockCreateClient.mockReturnValue(mockSupabase as any);

      creditLogger.addCall('oddsapi', 1, 1);

      // Should not throw
      await expect(creditLogger.flush()).resolves.not.toThrow();

      // Should write error report
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        expect.stringContaining('Network error')
      );
    });
  });

  describe('provider normalization', () => {
    it('should normalize provider names', async () => {
      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
        from: jest.fn()
      };
      mockCreateClient.mockReturnValue(mockSupabase as any);

      // Test various provider name formats
      creditLogger.addCall('OddsAPI', 1, 1);
      creditLogger.addCall('odds_api', 1, 1);
      creditLogger.addCall('ODDS-API', 1, 1);

      await creditLogger.flush();

      // All should be normalized to 'oddsapi'
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_credit_usage', {
        provider: 'oddsapi',
        credits: 3,
        calls: 3
      });
    });
  });

  describe('feature flag', () => {
    it('should respect CREDIT_LOGGING_ENABLED flag', async () => {
      const originalEnv = process.env.CREDIT_LOGGING_ENABLED;
      process.env.CREDIT_LOGGING_ENABLED = 'false';

      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
        from: jest.fn()
      };
      mockCreateClient.mockReturnValue(mockSupabase as any);

      creditLogger.addCall('oddsapi', 1, 1);
      await creditLogger.flush();

      // Should not call RPC when disabled
      expect(mockSupabase.rpc).not.toHaveBeenCalled();

      // Restore environment
      if (originalEnv !== undefined) {
        process.env.CREDIT_LOGGING_ENABLED = originalEnv;
      } else {
        delete process.env.CREDIT_LOGGING_ENABLED;
      }
    });
  });
});