import { jest } from '@jest/globals';

import { BaseAgentDependencies, BaseAgentConfig, ErrorHandler } from '../../src/agents/BaseAgent/types';
import { Logger } from '../../src/shared/logger/types';

export interface AIAnalysisRequest {
  question: string;
  userContext?: {
    tier: string;
    history?: Array<{
      date: string;
      type: string;
      outcome: string;
    }>;
  };
}

export interface AIAnalysisResponse {
  analysis: string;
  confidence: number;
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    score: number;
  };
  keyInsights: string[];
  recommendations: string[];
}

export interface AIService {
  generateAnalysis: jest.Mock<(req: AIAnalysisRequest) => Promise<AIAnalysisResponse>>;
}

export interface EVReport {
  totalEV: number;
  picks: Array<{
    id: string;
    ev: number;
    confidence: number;
    details: string;
  }>;
}

export interface EVService {
  calculateDailyEV: jest.Mock<(date?: Date) => Promise<EVReport>>;
}

export interface TrendAnalysis {
  trendBreaks: Array<{
    id: string;
    player: string;
    stat: string;
    line: number;
    confidence: number;
    historicalData: {
      totalGames: number;
      hitRate: number;
    };
  }>;
}

export interface TrendService {
  analyzeTrends: jest.Mock<(params?: any) => Promise<TrendAnalysis>>;
}

/**
 * TestDependencies extends BaseAgentDependencies with additional test-specific services
 * This ensures compatibility with BaseAgent while providing test utilities
 */
export interface TestDependencies extends BaseAgentDependencies {
  // Override logger with jest mocks
  logger: Logger & {
    info: jest.Mock;
    error: jest.Mock;
    warn: jest.Mock;
    debug: jest.Mock;
    child: jest.Mock<() => Logger>;
  };
  // Override errorHandler with jest mock
  errorHandler: ErrorHandler & {
    handleError: jest.Mock;
  };
  // Additional test-specific services
  aiService?: AIService;
  evService?: EVService;
  trendService?: TrendService;
  cache?: any;
  metrics?: any;
}

/**
 * TestConfig extends BaseAgentConfig with test-specific configuration
 * This ensures compatibility with BaseAgent while providing test configuration
 */
export interface TestConfig extends BaseAgentConfig {
  // Additional test-specific config
  roles?: {
    vip: string;
  };
  channels?: any;
  healthCheckInterval?: number;
  metricsConfig?: {
    interval: number;
    prefix: string;
  };
}