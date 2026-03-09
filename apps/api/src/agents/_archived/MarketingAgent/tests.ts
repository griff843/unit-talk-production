import { describe, beforeEach, it, expect } from '@jest/globals';

import { ErrorHandler } from '../../utils/errorHandling';
import { makeLogger } from '../../utils/logger';
import { BaseAgentDependencies } from '../BaseAgent/types';

import { MarketingAgent } from './index';

describe('MarketingAgent', () => {
  let marketingAgent: MarketingAgent;

  beforeEach(() => {
    // Initialize MarketingAgent for testing
    const mockLogger = makeLogger('TestMarketingAgent');
    const mockErrorHandler = new ErrorHandler('TestMarketingAgent', {} as any);

    const mockDependencies: BaseAgentDependencies = {
      supabase: {} as any,
      logger: mockLogger,
      errorHandler: mockErrorHandler,
    };

    marketingAgent = new MarketingAgent(
      {
        name: 'TestMarketingAgent',
        version: '1.0.0',
        enabled: true,
        logLevel: 'info',
        metrics: {
          enabled: true,
          interval: 60000,
        },
      },
      mockDependencies
    );
  });

  it('should initialize correctly', () => {
    expect(marketingAgent).toBeDefined();
    expect(marketingAgent.getConfig().name).toBe('TestMarketingAgent');
  });
});
