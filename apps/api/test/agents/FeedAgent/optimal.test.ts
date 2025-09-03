// src/agents/FeedAgent/optimal.test.ts

import { fetchOptimalProps, getRateLimitStatus, clearRateLimitCache, clearPropTypeCache } from '../../../src/agents/FeedAgent/optimal';

// Mock environment variables for testing
process.env.OPTIMAL_API_KEY = 'test-api-key';
process.env.OPTIMAL_API_BASE_URL = 'https://api.optimal.com';

// Mock fetch globally
global.fetch = jest.fn();

describe('Optimal API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearRateLimitCache();
    clearPropTypeCache();
  });

  describe('fetchOptimalProps', () => {
    it('should fetch and normalize props successfully', async () => {
      // Mock prop types response
      const mockPropTypesResponse = {
        prop_types: [
          { api_key: 'points', display_name: 'Points', abbreviation: 'PTS' },
          { api_key: 'assists', display_name: 'Assists', abbreviation: 'AST' },
          { api_key: 'rebounds', display_name: 'Rebounds', abbreviation: 'REB' }
        ]
      };

      // Mock props response
      const mockPropsResponse = {
        props: [
          {
            id: 'prop-1',
            api_key: 'points',
            player_name: 'LeBron James',
            team: 'LAL',
            opponent: 'GSW',
            line: 25.5,
            over_odds: -110,
            under_odds: -110,
            game_time: '2024-01-15T20:00:00Z',
            bookmaker: 'DraftKings',
            league: 'NBA'
          },
          {
            id: 'prop-2',
            api_key: 'assists',
            player_name: 'LeBron James',
            team: 'LAL',
            opponent: 'GSW',
            line: 7.5,
            over_odds: -105,
            under_odds: -115,
            game_time: '2024-01-15T20:00:00Z',
            bookmaker: 'FanDuel',
            league: 'NBA'
          }
        ],
        total: 2,
        page: 1,
        per_page: 100
      };

      // Setup fetch mock to return different responses for different URLs
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPropTypesResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPropsResponse
        });

      const result = await fetchOptimalProps('NBA', '2024-01-15');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        player_name: 'LeBron James',
        stat_type: 'points',
        line: 25.5,
        over_odds: -110,
        under_odds: -110,
        provider: 'Optimal',
        label: 'Points',
        abbr: 'PTS'
      });
      expect(result[1]).toMatchObject({
        player_name: 'LeBron James',
        stat_type: 'assists',
        line: 7.5,
        over_odds: -105,
        under_odds: -115,
        provider: 'Optimal',
        label: 'Assists',
        abbr: 'AST'
      });
    });

    it('should handle empty props response', async () => {
      const mockPropTypesResponse = { prop_types: [] };
      const mockPropsResponse = { props: [], total: 0, page: 1, per_page: 100 };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPropTypesResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPropsResponse
        });

      const result = await fetchOptimalProps('NBA', '2024-01-15');

      expect(result).toHaveLength(0);
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(fetchOptimalProps('NBA', '2024-01-15')).rejects.toThrow('HTTP error 401: Unauthorized');
    });

    it('should handle missing API key', async () => {
      delete process.env.OPTIMAL_API_KEY;

      await expect(fetchOptimalProps('NBA', '2024-01-15')).rejects.toThrow('OPTIMAL_API_KEY environment variable is required');

      // Restore for other tests
      process.env.OPTIMAL_API_KEY = 'test-api-key';
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limit status', () => {
      const status = getRateLimitStatus();
      
      expect(status).toMatchObject({
        requestsInWindow: 0,
        maxRequests: 900,
        windowMs: 3600000, // 1 hour
        canMakeRequest: true
      });
    });

    it('should prevent requests when rate limit is exceeded', async () => {
      // Simulate 900 requests in the current window
      const now = Date.now();
      for (let i = 0; i < 900; i++) {
        (getRateLimitStatus() as any).requestQueue?.push(now);
      }

      await expect(fetchOptimalProps('NBA', '2024-01-15')).rejects.toThrow(/Rate limit exceeded/);
    });
  });

  describe('Deduplication', () => {
    it('should remove duplicate props', async () => {
      const mockPropTypesResponse = {
        prop_types: [
          { api_key: 'points', display_name: 'Points', abbreviation: 'PTS' }
        ]
      };

      // Mock props response with duplicates
      const mockPropsResponse = {
        props: [
          {
            id: 'prop-1',
            api_key: 'points',
            player_name: 'LeBron James',
            team: 'LAL',
            opponent: 'GSW',
            line: 25.5,
            over_odds: -110,
            under_odds: -110,
            game_time: '2024-01-15T20:00:00Z',
            bookmaker: 'DraftKings',
            league: 'NBA'
          },
          {
            id: 'prop-2', // Different ID but same prop
            api_key: 'points',
            player_name: 'LeBron James',
            team: 'LAL',
            opponent: 'GSW',
            line: 25.5,
            over_odds: -110,
            under_odds: -110,
            game_time: '2024-01-15T20:00:00Z',
            bookmaker: 'DraftKings',
            league: 'NBA'
          }
        ],
        total: 2,
        page: 1,
        per_page: 100
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPropTypesResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPropsResponse
        });

      const result = await fetchOptimalProps('NBA', '2024-01-15');

      // Should only return 1 prop after deduplication
      expect(result).toHaveLength(1);
    });
  });
});