import { BaseAgentConfig } from '../agents/BaseAgent/types';

export const alertAgentConfig: BaseAgentConfig = {
  name: 'AlertAgent',
  version: '1.0.0',
  enabled: true,
  schedule: 'manual', // or cron: '*/5 * * * *' if you want scheduled runs
  logLevel: 'info',
  metrics: {
    enabled: true,
    interval: 60,
    port: 9003,
  },
  health: {
    enabled: true,
    interval: 30,
    timeout: 5000,
    checkDb: true,
    checkExternal: false,
  },
  retry: {
    maxRetries: 3,
    backoffMs: 2000,
    maxBackoffMs: 5000,
  },
};

export const scoringAgentConfig: BaseAgentConfig = {
  name: 'ScoringAgent',
  version: '1.0.0',
  enabled: true,
  schedule: 'manual', // or cron: '*/10 * * * *' for every 10 minutes
  logLevel: 'info',
  metrics: {
    enabled: true,
    interval: 60,
    port: 9004,
  },
  health: {
    enabled: true,
    interval: 30,
    timeout: 5000,
    checkDb: true,
    checkExternal: false,
  },
  retry: {
    maxRetries: 3,
    backoffMs: 2000,
    maxBackoffMs: 5000,
  },
};

export const gradingAgentConfig: BaseAgentConfig = {
  name: 'GradingAgent',
  version: '1.0.0',
  enabled: true,
  schedule: 'manual', // or cron: '*/15 * * * *' for every 15 minutes
  logLevel: 'info',
  metrics: {
    enabled: true,
    interval: 60,
    port: 9005,
  },
  health: {
    enabled: true,
    interval: 30,
    timeout: 5000,
    checkDb: true,
    checkExternal: false,
  },
  retry: {
    maxRetries: 3,
    backoffMs: 2000,
    maxBackoffMs: 5000,
  },
};