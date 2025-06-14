// src/agents/BaseAgent/loadConfig.ts

import { BaseAgentConfig } from './types';

export async function loadBaseAgentConfig(name: string): Promise<BaseAgentConfig> {
  return {
    name,
    version: '1.0.0',
    enabled: true,
    runIntervalSeconds: 60,
    metricsEnabled: true,
    metrics: {
      enabled: true,
      port: 9002
    },
    health: {
      enabled: true
    },
    retry: {
      maxAttempts: 3,
      backoffMs: 500
    }
  };
}
