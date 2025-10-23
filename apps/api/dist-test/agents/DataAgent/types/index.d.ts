import * as z from 'zod';
import { BaseMetrics } from '../../BaseAgent/types';
export declare const DataAgentConfigSchema: z.ZodObject<{
    agentName: z.ZodLiteral<"DataAgent">;
    etlConfig: z.ZodObject<{
        batchSize: z.ZodNumber;
        maxRetries: z.ZodNumber;
        timeoutMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        timeoutMs: number;
        maxRetries: number;
        batchSize: number;
    }, {
        timeoutMs: number;
        maxRetries: number;
        batchSize: number;
    }>;
    qualityConfig: z.ZodObject<{
        enabledChecks: z.ZodArray<z.ZodString, "many">;
        thresholds: z.ZodRecord<z.ZodString, z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        thresholds: Record<string, number>;
        enabledChecks: string[];
    }, {
        thresholds: Record<string, number>;
        enabledChecks: string[];
    }>;
    enrichmentConfig: z.ZodObject<{
        enabledPipelines: z.ZodArray<z.ZodString, "many">;
        maxConcurrency: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        enabledPipelines: string[];
        maxConcurrency: number;
    }, {
        enabledPipelines: string[];
        maxConcurrency: number;
    }>;
}, "strip", z.ZodTypeAny, {
    agentName: "DataAgent";
    etlConfig: {
        timeoutMs: number;
        maxRetries: number;
        batchSize: number;
    };
    qualityConfig: {
        thresholds: Record<string, number>;
        enabledChecks: string[];
    };
    enrichmentConfig: {
        enabledPipelines: string[];
        maxConcurrency: number;
    };
}, {
    agentName: "DataAgent";
    etlConfig: {
        timeoutMs: number;
        maxRetries: number;
        batchSize: number;
    };
    qualityConfig: {
        thresholds: Record<string, number>;
        enabledChecks: string[];
    };
    enrichmentConfig: {
        enabledPipelines: string[];
        maxConcurrency: number;
    };
}>;
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
export type DataAgentEventType = 'etl_started' | 'etl_completed' | 'etl_failed' | 'enrichment_started' | 'enrichment_completed' | 'enrichment_failed' | 'quality_check_started' | 'quality_check_completed' | 'quality_check_failed';
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
//# sourceMappingURL=index.d.ts.map