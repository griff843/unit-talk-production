/**
 * @unit-talk/mcp-ops — schemas
 *
 * Input schemas (Zod) and output types (TypeScript) for all mcp-ops tools.
 * Shapes are derived directly from apps/api/src/routes/health.ts,
 * apps/api/src/routes/slo.ts, and apps/api/src/lib/workflow-registry/types.ts.
 */

import { z } from 'zod';

// ─── Tool input schemas ───────────────────────────────────────────────────────

export const GetAgentHealthInput = z.object({
  stale_threshold_minutes: z
    .number()
    .optional()
    .default(5)
    .describe('Minutes before a heartbeat is considered stale (default: 5)'),
});

export const GetOutboxDepthInput = z.object({});

export const GetPlatformHealthSummaryInput = z.object({});

export const GetOperatorWorkflowsInput = z.object({
  category: z
    .enum(['analysis', 'backfill', 'feed', 'health', 'settlement', 'ops'])
    .optional()
    .describe('Filter by workflow category'),
  risk_level: z.enum(['low', 'medium', 'high']).optional().describe('Filter by risk level'),
});

export const GetPipelineStatusInput = z.object({});

export const GetSloStatusInput = z.object({});

// ─── Output types (mirror API response shapes exactly) ───────────────────────

export interface AgentHealthRow {
  id: string;
  agent_name: string;
  status: string;
  last_heartbeat_at: string | null;
  metrics_json: Record<string, unknown> | null;
  error_message: string | null;
  age_minutes: number | null;
  heartbeat_status: 'healthy' | 'stale' | 'missing';
}

export interface AgentHealthResult {
  agents: AgentHealthRow[];
  total: number;
  healthy: number;
  stale: number;
  missing: number;
  queried_at: string;
}

export interface OutboxDepthResult {
  bridge_outbox: {
    pending: number;
    failed: number;
    oldest_pending_minutes: number | null;
    stale_alert: boolean;
  };
  queried_at: string;
}

/** Matches HealthSummaryResponse from apps/api/src/routes/health.ts */
export interface PlatformHealthSummary {
  platform_status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  computed_at: string;
  subsystems: Array<{
    name: string;
    status: 'UP' | 'DEGRADED' | 'DOWN';
    notes?: string;
  }>;
  slo_breaches: number;
  slo_warns: number;
  alert_count: number;
  high_alert_count: number;
  autopilot_mode: string;
}

/** Matches WorkflowEntry from apps/api/src/lib/workflow-registry/types.ts */
export interface WorkflowEntry {
  name: string;
  displayName: string;
  description: string;
  category: string;
  scriptPath: string;
  riskLevel: 'low' | 'medium' | 'high';
  invocation: string;
  requiresDatabase?: boolean;
  parameters?: Array<{
    name: string;
    description: string;
    required: boolean;
    type: 'string' | 'number' | 'boolean';
    example?: string;
  }>;
}

export interface OperatorWorkflowsResult {
  workflows: WorkflowEntry[];
  total: number;
  categories: Record<string, number>;
  filtered_by?: string;
}

/** Matches SloEntry from apps/api/src/routes/slo.ts */
export interface SloEntry {
  id: string;
  name: string;
  target: number;
  attainment: number;
  status: 'OK' | 'WARN' | 'BREACH';
  numerator?: number;
  denominator?: number;
  unit: string;
}

export interface SloStatusResult {
  window_days: number;
  computed_at: string;
  slos: SloEntry[];
  breach_count: number;
  warn_count: number;
}

export type McpOpsConfig = {
  supabaseUrl: string;
  supabaseKey: string;
  apiBaseUrl: string;
  operatorToken?: string;
};
