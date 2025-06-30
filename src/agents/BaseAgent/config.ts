import { BaseAgentConfig } from './types';

/**
 * Factory function to create properly configured BaseAgent configurations
 * This ensures all required fields are present and properly typed
 */
export function createBaseAgentConfig(overrides: Partial<BaseAgentConfig> = {}): BaseAgentConfig {
  return {
    name: overrides.name || 'DefaultAgent',
    enabled: overrides.enabled ?? true,
    version: overrides.version || '1.0.0',
    logLevel: overrides.logLevel || 'info',
    schedule: overrides.schedule || 'enabled',
    metrics: {
      enabled: true,
      interval: 60,
      ...overrides.metrics
    },
    retry: {
      maxRetries: 3,
      backoffMs: 1000,
      maxBackoffMs: 30000,
      enabled: true,
      maxAttempts: 3,
      backoff: 1000,
      exponential: true,
      jitter: false,
      ...overrides.retry
    },
    health: {
      enabled: true,
      interval: 30,
      timeout: 5000,
      checkDb: true,
      checkExternal: false,
      ...overrides.health
    }
  };
}

/**
 * Validates a BaseAgent configuration
 */
export function validateBaseAgentConfig(config: any): BaseAgentConfig {
  // If config is missing required fields, create a proper config
  if (!config.name || config.enabled === undefined || !config.version || !config.metrics) {
    return createBaseAgentConfig(config);
  }
  
  return config as BaseAgentConfig;
}