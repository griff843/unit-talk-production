import { BaseAgentConfig, BaseAgentDependencies } from '../../BaseAgent/types';
import { AlertAgent } from '..';
import { createLogger } from '../../../utils/logger';

/**
 * Temporal activity for processing alerts
 */
export async function processAlert(): Promise<void> {
  // Create minimal config for activity execution
  const config: BaseAgentConfig = {
    name: 'AlertAgent',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
    health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
    retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
  };

  const deps: BaseAgentDependencies = {
    logger: createLogger('AlertAgent'),
    supabase: undefined as any // Will be injected by the agent
  };

  const agent = new AlertAgent(config, deps);
  await agent.start();
}

/**
 * Temporal activity for evaluating alert conditions
 */
export async function evaluateConditions(): Promise<void> {
  const config: BaseAgentConfig = {
    name: 'AlertAgent',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
    health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
    retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
  };

  const deps: BaseAgentDependencies = {
    logger: createLogger('AlertAgent'),
    supabase: null as any
  };

  const agent = new AlertAgent(config, deps);
  await agent.start();
}

/**
 * Temporal activity for sending notifications
 */
export async function sendNotification(): Promise<void> {
  const config: BaseAgentConfig = {
    name: 'AlertAgent',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
    health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
    retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
  };

  const deps: BaseAgentDependencies = {
    logger: createLogger('AlertAgent'),
    supabase: null as any
  };

  const agent = new AlertAgent(config, deps);
  await agent.start();
}

/**
 * Temporal activity for escalating alerts
 */
export async function escalateAlert(): Promise<void> {
  const config: BaseAgentConfig = {
    name: 'AlertAgent',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
    health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
    retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
  };

  const deps: BaseAgentDependencies = {
    logger: createLogger('AlertAgent'),
    supabase: null as any
  };

  const agent = new AlertAgent(config, deps);
  await agent.start();
}