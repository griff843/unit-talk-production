/**
 * @fileoverview Shared TypeScript types for Unit Talk Platform
 * All applications should import shared types from this package
 */

// Base types
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Agent types
export interface MetricsConfig {
  enabled: boolean;
  interval: number;
  labels?: Record<string, string>;
}

export interface RetryConfig {
  enabled: boolean;
  maxRetries: number;
  maxAttempts: number;
  backoffMs: number;
  backoff: number;
  maxBackoffMs: number;
  exponential: boolean;
  jitter: boolean;
  shouldRetry?: (error: Error) => boolean;
}

export interface HealthConfig {
  enabled: boolean;
  interval: number;
  timeout?: number;
  checkDb?: boolean;
  checkExternal?: boolean;
  endpoint?: string;
}

export interface BaseAgentConfig {
  name: string;
  enabled: boolean;
  version?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  metrics?: MetricsConfig;
  retry?: RetryConfig;
  health?: HealthConfig;
}

// API types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Health check types
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  checks: {
    [service: string]: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    };
  };
}

// Workspace types
export interface WorkspaceApp {
  name: string;
  path: string;
  port?: number;
  status: 'running' | 'stopped' | 'error';
}

export * from './agent.js';
export * from './api.js';
export * from './database.js';
