/**
 * Shadow Mode Test Setup
 * Common setup and utilities for shadow mode tests
 */

import { jest } from '@jest/globals';

// Global test setup for shadow mode tests
beforeAll(() => {
  // Ensure we start with a clean environment
  delete process.env.SHADOW_MODE;
  delete process.env.SHADOW_PRIVATE_CHANNEL_ID;
  delete process.env.SHADOW_MAX_DAYS;
  
  console.log('🧪 Shadow Mode Test Environment Initialized');
});

beforeEach(() => {
  // Reset environment before each test
  process.env.SHADOW_MODE = 'false';
  process.env.SHADOW_PRIVATE_CHANNEL_ID = '';
  process.env.SHADOW_MAX_DAYS = '7';
  
  // Clear all mocks
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up any test data
  jest.restoreAllMocks();
});

afterAll(() => {
  // Final cleanup
  console.log('🧹 Shadow Mode Test Environment Cleaned Up');
});

// Test utilities
export const TestUtils = {
  /**
   * Create a mock pick for testing
   */
  createMockPick: (overrides: Partial<any> = {}) => ({
    id: `test-pick-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    propId: `prop-${Date.now()}`,
    tier: 'S',
    confidence: 0.85,
    expectedValue: 0.12,
    playerName: 'Test Player',
    statType: 'points',
    line: 25.5,
    sport: 'NBA',
    professionalScore: 88,
    clvTracking: {
      initialOdds: -110,
      currentOdds: -108,
      clvBps: 15
    },
    steamData: {
      strength: 18,
      direction: 'for' as const,
      volume: 25000
    },
    gameTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    correlatedPicks: [],
    portfolioExposure: 0.15,
    ...overrides
  }),

  /**
   * Create a mock promotion decision
   */
  createMockPromotionDecision: (overrides: Partial<any> = {}) => ({
    approved: true,
    lane: 'instant' as const,
    reasons: ['High confidence S-tier pick'],
    pick: TestUtils.createMockPick(),
    gateResults: [],
    riskScore: 0.2,
    ...overrides
  }),

  /**
   * Create a mock Supabase client
   */
  createMockSupabase: () => ({
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    then: jest.fn().mockResolvedValue({ data: [], error: null }),
    catch: jest.fn().mockReturnThis()
  }),

  /**
   * Assert shadow mode behavior
   */
  assertShadowMode: {
    enabled: (shadowService: any) => {
      expect(shadowService.isShadowMode()).toBe(true);
    },
    disabled: (shadowService: any) => {
      expect(shadowService.isShadowMode()).toBe(false);
    },
    pickWritten: (mockSupabase: any, expectedPickId: string) => {
      expect(mockSupabase.from).toHaveBeenCalledWith('shadow_promoted_picks');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          pick_id: expectedPickId
        })
      );
    },
    metricsWritten: (mockSupabase: any, expectedWindow: string) => {
      expect(mockSupabase.from).toHaveBeenCalledWith('shadow_metrics_snapshots');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          window: expectedWindow
        })
      );
    },
    noPublicOutput: (publishResult: any) => {
      expect(publishResult.published).toBe(false);
      expect(publishResult.channelsNotified).toEqual([]);
    },
    shadowLogged: (publishResult: any) => {
      expect(publishResult.shadowLogged).toBe(true);
    }
  },

  /**
   * Wait for async operations to complete
   */
  waitForAsync: (ms: number = 100) => 
    new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate test data with realistic values
   */
  generateTestData: {
    sTierPick: () => TestUtils.createMockPick({
      tier: 'S',
      confidence: 0.88,
      expectedValue: 0.15,
      professionalScore: 92
    }),
    aTierPick: () => TestUtils.createMockPick({
      tier: 'A', 
      confidence: 0.72,
      expectedValue: 0.08,
      professionalScore: 78
    }),
    rejectedPick: () => TestUtils.createMockPick({
      tier: 'C',
      confidence: 0.45,
      expectedValue: 0.01,
      professionalScore: 58
    })
  }
};

// Custom Jest matchers for shadow mode
expect.extend({
  toHaveBeenCalledWithShadowPick(received: jest.MockedFunction<any>, pickId: string) {
    const calls = received.mock.calls;
    const shadowPickCall = calls.find(call => 
      call[0] && call[0].pick_id === pickId
    );

    if (shadowPickCall) {
      return {
        message: () => `Expected not to be called with shadow pick ${pickId}`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected to be called with shadow pick ${pickId}`,
        pass: false
      };
    }
  },

  toHaveCorrectShadowStructure(received: any) {
    const requiredFields = [
      'decided_action', 'pick_id', 'tier', 'confidence', 'expected_value',
      'player_name', 'stat_type', 'line', 'sport', 'created_at'
    ];

    const missingFields = requiredFields.filter(field => 
      !(field in received)
    );

    if (missingFields.length === 0) {
      return {
        message: () => 'Expected shadow structure to be invalid',
        pass: true
      };
    } else {
      return {
        message: () => `Expected shadow structure is missing fields: ${missingFields.join(', ')}`,
        pass: false
      };
    }
  }
});

// TypeScript declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledWithShadowPick(pickId: string): R;
      toHaveCorrectShadowStructure(): R;
    }
  }
}

export default TestUtils;