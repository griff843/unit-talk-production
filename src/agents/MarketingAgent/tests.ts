import { describe, beforeEach, it, expect } from '@jest/globals';
import { MarketingAgent } from './index';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandling';
import { BaseAgentDependencies } from '../BaseAgent/types';

describe('MarketingAgent', () => {
  let marketingAgent: MarketingAgent;

  beforeEach(() => {
    // Initialize MarketingAgent for testing
    const mockLogger = new Logger('TestMarketingAgent');
    const mockErrorHandler = new ErrorHandler('TestMarketingAgent', {} as any);
    
    const mockDependencies: BaseAgentDependencies = {
      supabase: {} as any,
      logger: mockLogger,
      errorHandler: mockErrorHandler
    };

    marketingAgent = new MarketingAgent({
      name: 'TestMarketingAgent',
      version: '1.0.0',
      enabled: true,
      logLevel: 'info',
      metrics: {
        enabled: true,
        interval: 60000
      }
    }, mockDependencies);
  });

  it('should initialize correctly', () => {
    expect(marketingAgent).toBeDefined();
    expect(marketingAgent.getConfig().name).toBe('TestMarketingAgent');
  });
});