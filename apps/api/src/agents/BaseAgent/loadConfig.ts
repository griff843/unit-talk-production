// src/agents/BaseAgent/loadConfig.ts

import { BaseAgentConfig } from './types';

export async function loadBaseAgentConfig(name: string): Promise<BaseAgentConfig> {
  return {
    name,
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: {
      enabled: true,
      interval: 60,
      port: 9002
    },
    health: {
      enabled: true,
      interval: 30,
      timeout: 5000,
      checkDb: true,
      checkExternal: false
    },
    retry: {
      enabled: true,
      maxRetries: 3,
      backoffMs: 500,
      maxBackoffMs: 30000,
      maxAttempts: 3,
      backoff: 500,
      exponential: true,
      jitter: false
    }
  };
}
