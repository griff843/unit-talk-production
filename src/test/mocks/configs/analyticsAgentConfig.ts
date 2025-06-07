import { BaseAgentConfig } from '@shared/types/baseAgent';

export const analyticsAgentConfig: BaseAgentConfig = {
  name: 'AnalyticsAgent',
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
    prefix: 'analytics'
  },
  analysis: {
    roiTimeframes: [7, 30, 90],
    streakThreshold: 3,
    trendWindowDays: 30
  },
  alerts: {
    streakAlertThreshold: 5,
    volatilityThreshold: 0.2
  },
  aggregationInterval: 3600,
  alertThresholds: {
    latencyMs: 5000
  }
}; 