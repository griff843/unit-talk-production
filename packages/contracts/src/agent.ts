// Agent-specific types
export interface AgentHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: Date;
  errors: string[];
}

export interface AgentMetrics {
  operationsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: number;
}

export interface AgentDependencies {
  logger: any;
  database: any;
  cache?: any;
  metrics?: any;
}
