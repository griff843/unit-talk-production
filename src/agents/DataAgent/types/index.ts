import { BaseMetrics } from '../../BaseAgent/types';
import * as z from 'zod';

export const DataAgentConfigSchema = z.object({
  agentName: z.literal('DataAgent'),
  etlConfig: z.object({
    batchSize: z.number().min(1),
    maxRetries: z.number().min(0),
    timeoutMs: z.number().min(1000)
  }),
  qualityConfig: z.object({
    enabledChecks: z.array(z.string()),
    thresholds: z.record(z.number())
  }),
  enrichmentConfig: z.object({
    enabledPipelines: z.array(z.string()),
    maxConcurrency: z.number().min(1)
  })
});

export type DataAgentConfig = z.infer<typeof DataAgentConfigSchema>;

export interface DataQualityCheck {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  threshold: number;
  execute: (data: any[]) => Promise<DataQualityResult>;
}

export interface DataQualityResult {
  passed: boolean;
  score: number;
  issues: DataQualityIssue[];
  metadata: Record<string, any>;
}

export interface DataQualityIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  field?: string;
  recordId?: string;
  metadata?: Record<string, any>;
}

export interface ETLWorkflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  schedule?: string;
  extract: (config: any) => Promise<any[]>;
  transform: (data: any[]) => Promise<any[]>;
  load: (data: any[], target: string) => Promise<void>;
}

export interface EnrichmentPipeline {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  enrich: (data: any[]) => Promise<any[]>;
}

export type DataAgentEventType = 
  | 'etl_started'
  | 'etl_completed'
  | 'etl_failed'
  | 'enrichment_started'
  | 'enrichment_completed'
  | 'enrichment_failed'
  | 'quality_check_started'
  | 'quality_check_completed'
  | 'quality_check_failed';

export interface DataAgentEvent {
  type: DataAgentEventType;
  timestamp: string;
  workflowId?: string;
  pipelineId?: string;
  checkId?: string;
  data?: any;
  error?: string;
}

export interface DataAgentMetrics extends BaseMetrics {
  etlJobs: {
    total: number;
    successful: number;
    failed: number;
    avgDurationMs: number;
  };
  enrichmentJobs: {
    total: number;
    successful: number;
    failed: number;
    avgDurationMs: number;
  };
  qualityChecks: {
    total: number;
    passed: number;
    failed: number;
    avgScore: number;
  };
  dataVolume: {
    recordsProcessed: number;
    recordsEnriched: number;
    recordsRejected: number;
  };
}