import { BaseAgentConfig } from '@shared/types/baseAgent';

export const recapAgentConfig: BaseAgentConfig = {
  name: 'RecapAgent',
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
    prefix: 'recap'
  },
  recap: {
    recapWindowHours: 24,
    autoGenerateThreshold: 0.8,
    channels: ['discord', 'notion'],
    templates: {
      daily: 'Daily recap template',
      weekly: 'Weekly recap template',
      monthly: 'Monthly recap template'
    },
    thresholds: {
      minVolume: 10,
      minStreak: 3
    }
  }
}; 