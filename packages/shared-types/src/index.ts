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
export interface BaseAgentConfig {
  name: string;
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  healthCheckInterval: number;
  retryPolicy: RetryPolicy;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier: number;
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

export * from './agent';
export * from './api';
export * from './database';
