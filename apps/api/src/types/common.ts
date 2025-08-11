
// Common type definitions for Unit Talk Production v3
export interface BaseConfig {
  name: string;
  enabled: boolean;
  version?: string;
}

export interface BaseAgent {
  name: string;
  status: 'active' | 'inactive' | 'error';
  lastRun?: Date;
  config: BaseConfig;
}

export interface BaseMetrics {
  timestamp: Date;
  agent: string;
  operation: string;
  duration: number;
  success: boolean;
  error?: string;
}

export interface DatabaseRecord {
  id: string;
  created_at: Date;
  updated_at: Date;
  [key: string]: string | Date | number | boolean | null | undefined;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type AgentStatus = 'healthy' | 'degraded' | 'unhealthy';
export type Environment = 'development' | 'staging' | 'production';
