import { BaseAgentConfig } from '@shared/types/baseAgent';

export const feedAgentConfig: BaseAgentConfig = {
  name: 'FeedAgent',
  version: '1.0.0',
  enabled: true,
  logLevel: 'info',
  metrics: {
    enabled: true,
    interval: 60
  },
  health: {
    enabled: true,
    interval: 30
  },
  retry: {
    maxRetries: 3,
    backoffMs: 1000,
    maxBackoffMs: 5000
  },
  logging: {
    prefix: 'feed'
  },
  feeds: {
    sportsGameOdds: {
      baseUrl: 'https://api.sportsgameodds.com',
      apiKey: 'test-key',
      rateLimit: 60,
      retryConfig: {
        maxRetries: 3,
        backoffMs: 1000
      }
    },
    oddsApi: {
      baseUrl: 'https://api.oddsapi.com',
      apiKey: 'test-key',
      rateLimit: 60,
      retryConfig: {
        maxRetries: 3,
        backoffMs: 1000
      }
    }
  },
  caching: {
    ttlHours: 24
  }
}; 