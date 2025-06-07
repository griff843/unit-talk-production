import { BaseAgentConfig } from '@shared/types/baseAgent';

export const marketingAgentConfig: BaseAgentConfig = {
  name: 'MarketingAgent',
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
    prefix: 'marketing'
  },
  scheduling: {
    minInterval: 3600000,
    maxRetries: 3
  },
  channels: {
    email: {
      maxPerDay: 3,
      minInterval: 86400000
    },
    push: {
      maxPerDay: 5,
      minInterval: 43200000
    },
    sms: {
      maxPerDay: 2,
      minInterval: 172800000
    }
  },
  targeting: {
    maxUsers: 1000,
    minEngagement: 0.1,
    maxFrequency: 3
  },
  content: {
    minLength: 50,
    requireImage: false,
    requireLink: true
  }
}; 