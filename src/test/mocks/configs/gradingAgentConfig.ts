import { BaseAgentConfig } from '@shared/types/baseAgent';

export const gradingAgentConfig: BaseAgentConfig = {
  name: 'GradingAgent',
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
    prefix: 'grading'
  },
  grading: {
    gradingWindowHours: 24,
    autoPromoteThreshold: 0.7,
    thresholds: {
      A: 75,
      B: 65,
      C: 55,
      D: 0
    },
    weights: {
      roleStabilityWeight: 0.3,
      lineValueWeight: 0.3,
      matchupWeight: 0.2,
      trendWeight: 0.1,
      expectedValueWeight: 0.1
    }
  }
}; 