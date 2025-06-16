import { AgentConfig } from '../../types/agentTypes';
import * as z from 'zod';

/** 
 * Zod schema for AuditAgent config.
 * Validates all required options at runtime.
 */
export const AuditConfigSchema = z.object({
  agentName: z.literal('AuditAgent'),
  enabled: z.boolean(),
  cron: z.string().optional(),
  auditConfig: z.object({
    dataRetentionDays: z.number().min(1),
    integrityCheckInterval: z.number().min(1),
    complianceRules: z.array(z.object({
      name: z.string(),
      table: z.string(),
      condition: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical'])
    }))
  }),
  alertConfig: z.object({
    criticalAlertThreshold: z.number(),
    highAlertThreshold: z.number(),
    alertRecipients: z.array(z.string().email())
  }),
  metricsConfig: z.object({
    interval: z.number(),
    prefix: z.string()
  })
});

/** Strongly-typed config for AuditAgent */
export type AuditAgentConfig = z.infer<typeof AuditConfigSchema>;

/** Standard severity for incidents, violations, alerts, etc. */
export type Severity = 'low' | 'medium' | 'high' | 'critical' | 'warning';

/** Audit record for change tracking */
export interface AuditRecord {
  id: string;
  tableName: string;
  recordId: string | number;
  operation: 'insert' | 'update' | 'delete';
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  userId: string;
  timestamp: string;
  meta?: Record<string, any>;
}

/** Compliance violation incident */
export interface ComplianceViolation {
  id: string;
  violationType: 'compliance_rule';
  ruleName: string;
  tableName: string;
  recordId: string | number;
  severity: Severity;
  description: string;
  detectedAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  meta?: Record<string, any>;
}

/** Data integrity issue detected in audit */
export interface DataIntegrityIssue {
  id: string;
  issueType: 'missing_reference' | 'duplicate' | 'invalid_value' | 'schema_mismatch' | string;
  tableName: string;
  description: string;
  affectedRecords: (string | number)[];
  detectedAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  meta?: Record<string, any>;
}

/** Aggregate audit run metrics */
export interface AuditMetrics {
  totalRecordsAudited: number;
  violationsFound: Record<Severity, number>;
  integrityIssues: number;
  resolutionRate: number;
  avgResolutionTimeMs: number;
  errorCount: number;
  lastRunStats: {
    startTime: string;
    endTime: string;
    recordsProcessed: number;
  };
  meta?: Record<string, any>;
}

/** Audit incident for tracking issues */
export interface AuditIncident {
  id: string;
  row_id: string | number;
  type: 'compliance' | 'integrity' | 'security' | 'performance' | 'stuck_pending' | 'duplicate_external_id' | 'stale_pick' | 'failed_agent_task';
  severity: Severity | 'warning';
  description: string;
  tableName: string;
  detectedAt: string;
  resolvedAt?: string;
  meta?: Record<string, any>;
}

/** Result of an audit check */
export interface AuditCheckResult {
  checkName: string;
  passed: boolean;
  severity: Severity;
  message: string;
  affectedRecords?: (string | number)[];
  meta?: Record<string, any>;
}
