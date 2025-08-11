import { jest } from '@jest/globals';

import { TestDependencies, TestConfig, AIAnalysisResponse, EVReport, TrendAnalysis } from '../types/test-types';

export function createTestDependencies(): TestDependencies {
  return {
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    },
    errorHandler: {
      handleError: jest.fn()
    },
    supabase: {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(null)
    },
    aiService: {
      generateAnalysis: jest.fn().mockResolvedValue({
        analysis: 'Test analysis',
        confidence: 85,
        riskAssessment: { level: 'low', score: 2 },
        keyInsights: ['Test insight'],
        recommendations: ['Test recommendation']
      })
    },
    evService: {
      calculateDailyEV: jest.fn().mockResolvedValue({
        totalEV: 150.5,
        picks: [
          {
            id: 'pick-1',
            ev: 75.25,
            confidence: 0.85,
            details: 'Test pick'
          }
        ]
      })
    },
    trendService: {
      analyzeTrends: jest.fn().mockResolvedValue({
        trendBreaks: [
          {
            id: 'trend-1',
            player: 'Test Player',
            stat: 'points',
            line: 25.5,
            confidence: 0.85,
            historicalData: {
              totalGames: 50,
              hitRate: 0.75
            }
          }
        ]
      })
    }
  };
}

export function createTestConfig(): TestConfig {
  return {
    roles: {
      vip: 'vip-role'
    }
  };
}

export function mockAsyncIterator<T>(items: T[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) {
        yield item;
      }
    }
  };
}

export function createMockClient() {
  return {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(null)
  };
}

// Helper to set up test data in Supabase mock
export function setupTestData(supabase: any, table: string, data: any[]) {
  supabase.setMockData(table, data);
}

// Helper to clear test data
export function clearTestData(supabase: any) {
  supabase.clearMockData();
}

// Helper to verify Supabase operations
export function verifySupabaseOperation(supabase: any, table: string) {
  return {
    getData: () => supabase.getMockData(table),
    verifyInsert: (data: any) => {
      const tableData = supabase.getMockData(table);
      expect(tableData).toContainEqual(expect.objectContaining(data));
    },
    verifyUpdate: (matcher: any) => {
      const tableData = supabase.getMockData(table);
      expect(tableData).toContainEqual(expect.objectContaining(matcher));
    }
  };
} 