import { HealthCheckResult } from '../../types/agent';
import { BaseAgentConfig } from '../BaseAgent/types';

export interface DataAgentConfig extends BaseAgentConfig {
  etl: {
    enabled: boolean;
    maxConcurrentWorkflows: number;
    retryAttempts: number;
    checkpointInterval: number;
  };
  enrichment: {
    enabled: boolean;
    maxConcurrentPipelines: number;
    cacheTimeout: number;
  };
  quality: {
    enabled: boolean;
    checkInterval: number;
    thresholds: {
      completeness: number;
      accuracy: number;
      consistency: number;
    };
  };
}

export interface ETLWorkflow {
  id: string;
  name: string;
  source: {
    type: string;
    config: Record<string, any>;
  };
  transform: {
    steps: TransformStep[];
    validation: ValidationRule[];
  };
  destination: {
    type: string;
    config: Record<string, any>;
  };
  schedule?: string;
  status: 'idle' | 'running' | 'error' | 'completed';
  metadata?: Record<string, any>;
}

export interface TransformStep {
  type: string;
  config: Record<string, any>;
  dependencies?: string[];
}

export interface ValidationRule {
  field: string;
  type: string;
  params: Record<string, any>;
}

export interface EnrichmentPipeline {
  id: string;
  name: string;
  enrichers: Enricher[];
  dataSource: string;
  schedule?: string;
  status: 'idle' | 'running' | 'error' | 'completed';
  metadata?: Record<string, any>;
}

export interface Enricher {
  type: string;
  config: Record<string, any>;
  priority: number;
}

export interface DataQualityCheck {
  id: string;
  type: string;
  target: string;
  rules: ValidationRule[];
  schedule?: string;
  lastRun?: string;
  score?: number;
  metadata?: Record<string, any>;
}

export interface DataQualityIssue {
  type: 'schema' | 'data' | 'integrity' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedRows?: number;
  recommendation?: string;
}

export interface ETLWorkflowConfig {
  id: string;
  name: string;
  source: DataSource;
  destination: DataDestination;
  transformations: Transformation[];
  schedule?: string; // cron expression
  timeout: number;
  retryConfig: RetryConfig;
}

export interface DataSource {
  type: 'supabase' | 'api' | 'file';
  config: Record<string, any>;
  validationRules: ValidationRule[];
}

export interface DataDestination {
  type: 'supabase' | 'api' | 'file';
  config: Record<string, any>;
  errorHandling: ErrorHandlingConfig;
}

export interface Transformation {
  type: string;
  config: Record<string, any>;
  validation?: ValidationRule[];
}

export interface RetryConfig {
  maxAttempts: number;
  backoffMs: number;
  maxBackoffMs: number;
}

export interface ErrorHandlingConfig {
  onError: 'skip' | 'retry' | 'fail';
  maxRetries: number;
  logLevel: 'info' | 'warn' | 'error';
}

export interface EnrichmentPipelineConfig {
  id: string;
  name: string;
  sources: DataSource[];
  enrichments: EnrichmentStep[];
  validation: ValidationRule[];
  errorHandling: ErrorHandlingConfig;
}

export interface EnrichmentStep {
  type: string;
  config: Record<string, any>;
  dependencies?: string[];
  validation?: ValidationRule[];
}

export interface DataAgentMetrics {
  etlMetrics: {
    totalJobs: number;
    successRate: number;
    averageDuration: number;
    failureRate: number;
    lastRun: Date;
  };
  enrichmentMetrics: {
    totalPipelines: number;
    successRate: number;
    averageDuration: number;
    failureRate: number;
    lastRun: Date;
  };
  qualityMetrics: {
    tablesMonitored: number;
    issuesDetected: number;
    averageQualityScore: number;
    criticalIssues: number;
  };
  healthStatus: HealthCheckResult;
}

// Event types for logging and monitoring
export type DataAgentEventType = 
  | 'etl_started' 
  | 'etl_completed'
  | 'etl_failed'
  | 'enrichment_started'
  | 'enrichment_completed'
  | 'enrichment_failed'
  | 'quality_check_started'
  | 'quality_check_completed'
  | 'quality_issue_detected'
  | 'system_error';

export interface DataAgentEvent {
  type: DataAgentEventType;
  timestamp: Date;
  details: Record<string, any>;
  severity: 'info' | 'warn' | 'error';
  correlationId: string;
} 