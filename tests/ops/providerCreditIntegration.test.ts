import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('axios');
jest.mock('node:fs');
jest.mock('node:path');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('Provider Credit Integration', () => {
  let creditLogger: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock path/fs for credit logger
    const path = await import('node:path');
    const fs = await import('node:fs');
    (path as any).resolve = jest.fn().mockReturnValue('C:\\mock\\path');
    (path as any).join = jest.fn().mockReturnValue('C:\\mock\\path\\file.json');
    (fs as any).mkdirSync = jest.fn();
    (fs as any).writeFileSync = jest.fn();

    // Reset module cache
    delete require.cache[require.resolve('../../apps/api/src/services/creditLogger.ts')];

    // Import fresh credit logger
    const module = await import('../../apps/api/src/services/creditLogger.js');
    creditLogger = module.creditLogger;
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('Provider → Credit Logger → Database Flow', () => {
    it('should log single provider call to database via RPC', async () => {
      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ data: { success: true }, error: null }),
        from: jest.fn()
      };
      mockCreateClient.mockReturnValue(mockSupabase as any);

      // Mock successful API response
      mockAxios.get.mockResolvedValue({
        data: { success: true, data: [{ id: 1, odds: 110 }] },
        headers: {}
      });

      // Import provider client
      delete require.cache[require.resolve('../../apps/api/src/logic/providers/sgoFetcher.ts')];
      const sgoModule = await import('../../apps/api/src/logic/providers/sgoFetcher.js');

      // Make provider call - this should trigger credit logging
      const result = await sgoModule.fetchSGOEvents({
        apiKey: 'test-key',
        leagueID: 'nfl',
        limit: 1
      });

      // Flush credits
      await creditLogger.flush();

      // Verify API call was made
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('api.sportsgameodds.com'),
        expect.objectContaining({ params: expect.any(Object) })
      );

      // Verify credit was logged
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_credit_usage', {
        provider: 'sgo',
        credits: 1,
        calls: 1
      });

      // Verify data was returned
      expect(result).toEqual([{ id: 1, odds: 110 }]);
    });

    it('should aggregate multiple provider calls', async () => {
      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
        from: jest.fn()
      };
      mockCreateClient.mockReturnValue(mockSupabase as any);

      // Mock multiple API responses
      mockAxios.get
        .mockResolvedValueOnce({
          data: { success: true, data: [{ id: 1 }] },
          headers: {}
        })
        .mockResolvedValueOnce({
          data: { success: true, data: [{ id: 2 }] },
          headers: {}
        });

      // Import provider clients
      delete require.cache[require.resolve('../../apps/api/src/logic/providers/sgoFetcher.ts')];
      delete require.cache[require.resolve('../../apps/api/src/agents/FeedAgent/oddsApi.ts')];

      const sgoModule = await import('../../apps/api/src/logic/providers/sgoFetcher.js');

      // Make multiple provider calls
      await sgoModule.fetchSGOEvents({ apiKey: 'test-key', leagueID: 'nfl' });
      await sgoModule.fetchSGOEvents({ apiKey: 'test-key', leagueID: 'nba' });

      // Flush credits
      await creditLogger.flush();

      // Should aggregate calls to same provider
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_credit_usage', {
        provider: 'sgo',
        credits: 2,
        calls: 2
      });
    });

    it('should fallback to direct insert when RPC is not available', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST202', message: 'Function not found' }
        }),
        from: jest.fn().mockReturnValue({
          insert: mockInsert
        })
      };
      mockCreateClient.mockReturnValue(mockSupabase as any);

      // Mock API response
      mockAxios.get.mockResolvedValue({
        data: { success: true, data: [{ id: 1 }] },
        headers: {}
      });

      // Import provider client
      delete require.cache[require.resolve('../../apps/api/src/logic/providers/sgoFetcher.ts')];
      const sgoModule = await import('../../apps/api/src/logic/providers/sgoFetcher.js');

      // Make provider call
      await sgoModule.fetchSGOEvents({ apiKey: 'test-key', leagueID: 'nfl' });

      // Flush credits
      await creditLogger.flush();

      // Should try RPC first
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_credit_usage', {
        provider: 'sgo',
        credits: 1,
        calls: 1
      });

      // Should fallback to direct insert
      expect(mockInsert).toHaveBeenCalledWith({
        provider: 'sgo',
        credits: 1,
        calls: 1
      });
    });

    it('should handle provider errors without affecting credit logging', async () => {
      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
        from: jest.fn()
      };
      mockCreateClient.mockReturnValue(mockSupabase as any);

      // Mock API error
      mockAxios.get.mockRejectedValue(new Error('API Error'));

      // Import provider client
      delete require.cache[require.resolve('../../apps/api/src/logic/providers/sgoFetcher.ts')];
      const sgoModule = await import('../../apps/api/src/logic/providers/sgoFetcher.js');

      try {
        // Make provider call that will fail
        await sgoModule.fetchSGOEvents({ apiKey: 'test-key', leagueID: 'nfl' });
      } catch (error) {
        // Expected to fail
      }

      // Flush credits
      await creditLogger.flush();

      // Should still log the credit despite API error
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_credit_usage', {
        provider: 'sgo',
        credits: 1,
        calls: 1
      });
    });
  });

  describe('Provider Normalization', () => {
    it('should normalize different provider name formats', async () => {
      const mockSupabase = {
        rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
        from: jest.fn()
      };
      mockCreateClient.mockReturnValue(mockSupabase as any);

      // Test different provider name formats
      creditLogger.addCall('OddsAPI', 1, 1);
      creditLogger.addCall('odds_api', 1, 1);
      creditLogger.addCall('OPTIMAL', 1, 1);
      creditLogger.addCall('optimal_api', 1, 1);
      creditLogger.addCall('SGO', 1, 1);
      creditLogger.addCall('SportsGameOdds', 1, 1);

      await creditLogger.flush();

      // Should normalize to standard names
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_credit_usage', {
        provider: 'oddsapi',
        credits: 2,
        calls: 2
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_credit_usage', {
        provider: 'optimal',
        credits: 2,
        calls: 2
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_credit_usage', {
        provider: 'sgo',
        credits: 2,
        calls: 2
      });
    });
  });
});