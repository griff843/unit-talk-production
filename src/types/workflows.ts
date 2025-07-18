import { Game, Player, Prop, Alert } from './shared/activity-types';

export interface WorkflowResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  timestamp?: string;
  duration?: number;
}

export interface AlertWorkflowParams {
  alertId: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  context?: Record<string, unknown>;
}

export interface OperatorHealthCheckParams {
  components: string[];
  timeout?: number;
}

export interface ApiQuotaMonitorParams {
  provider: string;
  thresholds: {
    warning: number;
    critical: number;
  };
}

export interface SystemHealthMonitorParams {
  services: string[];
  timeout?: number;
}

export interface LiveGameMonitorParams {
  leagues: string[];
  interval?: number;
}

export interface DataIngestionParams {
  source: string;
  batchSize?: number;
  filters?: Record<string, unknown>;
}

export interface DataProcessingParams {
  dataType: string;
  transformations: string[];
  options?: Record<string, unknown>;
}

export interface DataValidationParams {
  schema: string;
  rules: string[];
  options?: Record<string, unknown>;
}

export interface DataEnrichmentParams {
  dataType: string;
  enrichmentSources: string[];
  options?: Record<string, unknown>;
}

export interface DataExportParams {
  destination: string;
  format: string;
  filters?: Record<string, unknown>;
}

export interface MaintenanceParams {
  operation: string;
  target: string;
  options?: Record<string, unknown>;
} 