// /types/shared.ts

export interface SystemEvent {
    event_id: string
    agent: string
    timestamp: string
    type: string
    payload: any
  }
  
  export interface TaskLog {
    task_id: string
    agent: string
    status: string
    message: string
    timestamp: string
  }
  
  export type HealthLevel = 'ok' | 'warn' | 'error'
  
  // Agent status types
  export type AgentStatus = 'idle' | 'ready' | 'running' | 'stopped' | 'error';
  
  // Health status types
  export type HealthStatusType = 'healthy' | 'unhealthy' | 'degraded';
  
  export interface HealthStatus {
    status: HealthStatusType;
    lastChecked: string;
    details?: Record<string, any>;
    error?: string;
  }
  
  // Agent task types
  export interface AgentTask {
    id: string;
    agent: string;
    type: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    data: Record<string, any>;
    result?: Record<string, any>;
    error?: string;
    created_at: string;
    updated_at: string;
  }
  
  // Agent log types
  export interface AgentLog {
    id: string;
    agent: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    details?: Record<string, any>;
    timestamp: string;
  }
  
  // Agent metric types
  export interface AgentMetric {
    id: string;
    agent: string;
    metric: string;
    value: number;
    tags?: Record<string, string>;
    timestamp: string;
  }
  
  // Agent health record
  export interface AgentHealthRecord {
    id: string;
    agent: string;
    status: HealthStatusType;
    details?: Record<string, any>;
    duration_ms?: number;
    error?: string;
    timestamp: string;
  }
  
  // Agent error record
  export interface AgentErrorRecord {
    id: string;
    agent: string;
    error_type: string;
    error_message: string;
    error_stack?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    context?: Record<string, any>;
    timestamp: string;
  }
  
  // Retry operation types
  export interface RetryOperation {
    id: string;
    agent: string;
    operation: string;
    attempts: number;
    max_attempts: number;
    last_error?: string;
    next_retry?: string;
    status: 'pending' | 'retrying' | 'succeeded' | 'failed';
    created_at: string;
    updated_at: string;
  }
  
  // Database table names
  export const DB_TABLES = {
    AGENT_TASKS: 'agent_tasks',
    AGENT_LOGS: 'agent_logs',
    AGENT_METRICS: 'agent_metrics',
    AGENT_HEALTH: 'agent_health',
    AGENT_ERRORS: 'agent_errors',
    RETRY_OPERATIONS: 'retry_operations'
  } as const;
  
  // Common utility types
  export type Timestamp = string; // ISO 8601 format
  export type UUID = string;
  
  export interface TimeRange {
    start: Date;
    end: Date;
  }
  