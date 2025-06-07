// Agent task input type
export interface AgentTaskInput {
  task_id: string;
  agent: string;
  data: any;
}

// Agent task result type
export interface AgentTaskResult {
  success: boolean;
  data?: any;
  error?: Error;
}

// Agent status enum
export enum AgentStatus {
  OK = 'ok',
  WARN = 'warn',
  ERROR = 'error'
}

// Health check result type
export interface HealthCheckResult {
  status: AgentStatus;
  details?: {
    errors?: string[];
    warnings?: string[];
    info?: string[];
  };
}

// Agent command type
export interface AgentCommand {
  type: string;
  payload?: any;
}

// Agent configuration type
export interface AgentConfig {
  name: string;
  enabled: boolean;
  healthCheckIntervalMs?: number;
  metricsIntervalMs?: number;
  [key: string]: any;
} 