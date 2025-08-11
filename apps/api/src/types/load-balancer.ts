export type LoadBalancingStrategy = 'round-robin' | 'least-connections' | 'weighted' | 'response-time';

export interface ServerInstance {
  id: string;
  host: string;
  port: number;
  status: 'active' | 'inactive' | 'draining';
  health: {
    cpu: number;
    memory: number;
    latency: number;
    errorRate: number;
  };
  capacity: {
    maxRequests: number;
    currentRequests: number;
    maxConcurrent: number;
  };
  metadata: {
    region: string;
    zone: string;
    type: string;
    version: string;
  };
}

export interface LoadBalancerConfig {
  algorithm: 'round-robin' | 'least-connections' | 'weighted' | 'adaptive';
  healthCheck: {
    interval: number;
    timeout: number;
    unhealthyThreshold: number;
    healthyThreshold: number;
  };
  throttling: {
    enabled: boolean;
    rateLimit: number;
    burstLimit: number;
  };
  failover: {
    enabled: boolean;
    maxRetries: number;
    timeout: number;
  };
  scaling: {
    enabled: boolean;
    minInstances: number;
    maxInstances: number;
    targetCPU: number;
    targetMemory: number;
  };
  monitoring: {
    enabled: boolean;
    metrics: string[];
    alertThresholds: {
      [key: string]: number;
    };
  };
}

export interface RoutingDecision {
  instanceId: string;
  timestamp: string;
  metrics: {
    latency: number;
    success: boolean;
    errorCode?: string;
  };
  context: {
    requestType: string;
    priority: number;
    retryCount: number;
  };
}

export interface LoadBalancerMetrics {
  timestamp: string;
  requests: {
    total: number;
    success: number;
    failed: number;
    latency: {
      avg: number;
      p95: number;
      p99: number;
    };
  };
  instances: {
    [key: string]: {
      requests: number;
      errors: number;
      latency: number;
      capacity: number;
    };
  };
  decisions: {
    algorithm: string;
    distribution: Record<string, number>;
    failovers: number;
  };
}

export interface HealthCheckResult {
  instanceId: string;
  healthy: boolean;
  responseTime: number;
  error?: string;
}

export interface LoadBalancerStats {
  totalInstances: number;
  healthyInstances: number;
  unhealthyInstances: number;
  successRate: number;
  averageResponseTime: number;
  activeConnections: number;
}

export interface CircuitBreakerState {
  instanceId: string;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
} 