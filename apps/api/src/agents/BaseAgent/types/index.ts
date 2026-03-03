import { SupabaseClient } from '@supabase/supabase-js';

import { Logger } from '../../../utils/logger';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type AgentStatus = 'idle' | 'running' | 'error' | 'stopped';

export interface BaseAgentConfig {
  name: string;
  enabled: boolean;
  version: string;
  logLevel: LogLevel;
  metrics?: MetricsConfig;
  retry?: RetryConfig;
  health?: HealthConfig;
}

export interface MetricsConfig {
  enabled: boolean;
  interval: number; // in milliseconds
  labels?: Record<string, string>;
}

export interface RetryConfig {
  maxRetries: number;
  backoffMs: number;
  maxBackoffMs: number;
  enabled: boolean;
  maxAttempts: number;
  backoff: number;
  exponential: boolean;
  jitter: boolean;
  shouldRetry?: (_error: Error) => boolean;
}

export interface HealthConfig {
  enabled: boolean;
  interval: number; // in milliseconds
  timeout: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
  checks?: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  check: () => Promise<boolean>;
  timeout?: number;
}

export interface BaseMetrics {
  agentName: string;
  errorCount: number;
  successCount: number;
  warningCount: number;
  processingTimeMs: number;
  memoryUsageMb: number;
  lastError?: string;
  lastSuccess?: string;
  lastWarning?: string;
  status: AgentStatus;
  lastHealthCheck?: Date;
  customMetrics?: Record<string, number>;
}

export interface BaseAgentDependencies {
  logger: Logger;
  supabase: SupabaseClient;
  errorHandler?: ErrorHandler;
  metrics?: MetricsCollector;
}

export interface ErrorHandler {
  handleError: (_error: Error | BaseAgentError, context?: string) => Promise<void>;
  shouldRetry: (_error: Error | BaseAgentError) => boolean;
}

export interface MetricsCollector {
  increment: (metric: string, value?: number, labels?: Record<string, string>) => void;
  gauge: (metric: string, value: number, labels?: Record<string, string>) => void;
  histogram: (metric: string, value: number, labels?: Record<string, string>) => void;
}

export interface BaseAgentErrorData {
  agentName: string;
  operation: string;
  details: Record<string, unknown>;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryCount?: number;
  context?: string;
}

export interface BaseAgentError extends Error {
  data: BaseAgentErrorData;
  retryable: boolean;
  maxRetries?: number;
  currentRetry?: number;
  code?: string;
  originalError?: Error;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  details: {
    checks: Array<{
      name: string;
      status: 'passed' | 'failed';
      error?: string;
    }>;
    lastCheck: string;
    uptime: number;
  };
  metrics: Partial<BaseMetrics>;
}

// Canonical shared types for agent activities and execution
export interface BaseActivityParams {
  timestamp: string;
  _error: string;
  cycleCount: number;
  context: string;
}

export interface AgentExecutionPayload extends BaseActivityParams {
  capper?: string;
  pickId?: string;
  gameId?: string;
  statType?: string;
  [key: string]: any;
}

// Define missing types that are imported elsewhere
export interface Prop {
  id: string;
  gameId: string;
  statType: string;
  target: number;
  odds: number;
  player?: string;
  team?: string;
  timestamp: string;
}

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: string;
  agentName: string;
  context?: Record<string, unknown>;
}

export interface Report {
  id: string;
  agentName: string;
  type: 'daily' | 'weekly' | 'monthly' | 'adhoc';
  data: Record<string, unknown>;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
}
