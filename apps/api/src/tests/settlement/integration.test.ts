import request from 'supertest';
import { SettlementAgent } from '../../workflows/agents/SettlementAgent';
import { normalizeMarket } from '../../workflows/settlement/normalizers';
import { supabaseClient } from '../../utils/supabaseUtils';

// Mock external dependencies for testing
jest.mock('../../services/supabaseClient');

describe('Settlement System Integration', () => {
  let agent: SettlementAgent;

  beforeAll(async () => {
    agent = new SettlementAgent();
    // Don't initialize adapters in test environment
  });

  describe('Market Normalization', () => {
    it('should normalize MLB total bases correctly', () => {
      const stats = { TB: 5, H: 3, HR: 1 };
      const result = normalizeMarket('MLB', 'total_bases', stats);
      expect(result).toBe(5);
    });

    it('should normalize NFL passing yards', () => {
      const stats = { PASS_YDS: 287 };
      const result = normalizeMarket('NFL', 'passing_yards', stats);
      expect(result).toBe(287);
    });

    it('should normalize NBA points + rebounds + assists', () => {
      const stats = { 'PTS+REB+AST': 45, PTS: 20, REB: 12, AST: 13 };
      const result = normalizeMarket('NBA', 'PRA', stats);
      expect(result).toBe(45);
    });

    it('should handle unknown markets gracefully', () => {
      const stats = { UNKNOWN_STAT: 10 };
      const result = normalizeMarket('MLB', 'unknown_market', stats);
      expect(result).toBeNull();
    });
  });

  describe('Settlement Agent', () => {
    it('should be instantiated correctly', () => {
      expect(agent).toBeInstanceOf(SettlementAgent);
    });

    it('should handle job status tracking', () => {
      const nonExistentJob = agent.getJobStatus('non-existent-job');
      expect(nonExistentJob).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid sport gracefully', () => {
      const result = normalizeMarket('INVALID_SPORT', 'points', { PTS: 20 });
      expect(result).toBeNull();
    });

    it('should handle empty stats object', () => {
      const result = normalizeMarket('MLB', 'hits', {});
      expect(result).toBeNull();
    });
  });

  // Integration test would go here if we had API server running
  describe.skip('API Integration', () => {
    it('should return settlement stats', async () => {
      // This would test the actual API endpoints
      // Skipped because it requires full environment setup
    });

    it('should handle authentication for settlement endpoints', async () => {
      // This would test that settlement endpoints require auth
      // Skipped because it requires full environment setup
    });
  });
});

describe('Settlement Performance', () => {
  it('should normalize stats quickly', () => {
    const stats = { PTS: 25, REB: 10, AST: 8 };
    const iterations = 1000;
    
    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
      normalizeMarket('NBA', 'points', stats);
      normalizeMarket('NBA', 'rebounds', stats);
      normalizeMarket('NBA', 'assists', stats);
    }
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(100); // Should complete 3000 normalizations in <100ms
  });
});

describe('Settlement Edge Cases', () => {
  it('should handle negative stats', () => {
    const stats = { RUSH_YDS: -5 };
    const result = normalizeMarket('NFL', 'rushing_yards', stats);
    expect(result).toBe(-5);
  });

  it('should handle zero stats', () => {
    const stats = { INT: 0 };
    const result = normalizeMarket('NFL', 'interceptions', stats);
    expect(result).toBe(0);
  });

  it('should handle decimal stats', () => {
    const stats = { SACKS: 1.5 };
    const result = normalizeMarket('NFL', 'sacks', stats);
    expect(result).toBe(1.5);
  });
});