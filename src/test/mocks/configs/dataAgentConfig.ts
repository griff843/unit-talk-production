import { BaseAgentConfig } from '@shared/types/baseAgent';

export const dataAgentConfig: BaseAgentConfig = {
  name: 'DataAgent',
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
    prefix: 'data'
  },
  validation: {
    maxMissingFields: 0.1,
    requiredFields: ['id', 'timestamp', 'value'],
    validationRules: {
      id: {
        required: true
      },
      value: {
        min: 0,
        max: 100
      }
    }
  },
  processing: {
    maxConcurrent: 5,
    timeout: 300000,
    retryOnFailure: true
  },
  caching: {
    timeout: 60000,
    cacheEnabled: true,
    cacheTTL: 3600
  }
}; 