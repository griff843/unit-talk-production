import { BaseAgentConfig, BaseAgentDependencies } from '../../BaseAgent/types';
import { AuditAgent } from '..';
import { createLogger } from '../../../utils/logger';

/**
 * Audit parameters interface
 */
export interface AuditParams {
  auditType: 'compliance' | 'security' | 'performance' | 'data';
  scope: string[];
  startDate?: Date;
  endDate?: Date;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Temporal activity for performing audits
 */
export async function performAudit(_params: AuditParams): Promise<void> {
  const config: BaseAgentConfig = {
    name: 'AuditAgent',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
    health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
    retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
  };

  const deps: BaseAgentDependencies = {
    logger: createLogger('AuditAgent'),
    supabase: null as any,
    errorHandler: null as any
  };

  const agent = new AuditAgent(config, deps);
  await agent.start();
}

/**
 * Temporal activity for generating audit reports
 */
export async function generateReport(_params: AuditParams): Promise<void> {
  const config: BaseAgentConfig = {
    name: 'AuditAgent',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
    health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
    retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
  };

  const deps: BaseAgentDependencies = {
    logger: createLogger('AuditAgent'),
    supabase: null as any,
    errorHandler: null as any
  };

  const agent = new AuditAgent(config, deps);
  await agent.start();
}

/**
 * Temporal activity for compliance checks
 */
export async function checkCompliance(_params: AuditParams): Promise<void> {
  const config: BaseAgentConfig = {
    name: 'AuditAgent',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
    health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
    retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
  };

  const deps: BaseAgentDependencies = {
    logger: createLogger('AuditAgent'),
    supabase: null as any,
    errorHandler: null as any
  };

  const agent = new AuditAgent(config, deps);
  await agent.start();
}

/**
 * Temporal activity for security audits
 */
export async function performSecurityAudit(_params: AuditParams): Promise<void> {
  const config: BaseAgentConfig = {
    name: 'AuditAgent',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
    health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
    retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
  };

  const deps: BaseAgentDependencies = {
    logger: createLogger('AuditAgent'),
    supabase: null as any,
    errorHandler: null as any
  };

  const agent = new AuditAgent(config, deps);
  await agent.start();
}