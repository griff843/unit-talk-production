/**
 * @unit-talk/mcp-decision — schemas
 */

import { z } from 'zod';

// ─── Tool input schemas ───────────────────────────────────────────────────────

export const GetRoutingDecisionInput = z.object({
  sprint_id: z
    .string()
    .optional()
    .describe('Sprint ID (e.g. SPRINT-052-...). Omit to get the most recent routing decision.'),
});

export const GetSprintGateStatusInput = z.object({
  sprint_id: z
    .string()
    .optional()
    .describe('Sprint ID to validate. Omit to run general gate check.'),
});

export const GetFindingBacklogInput = z.object({
  severity: z
    .enum(['critical', 'high', 'medium', 'low'])
    .optional()
    .describe('Filter findings by severity level'),
  limit: z.number().min(1).max(50).optional().default(20),
});

export const GetLifecycleStatusInput = z.object({});

// ─── Output types ─────────────────────────────────────────────────────────────

export interface RoutingDecisionResult {
  sprint_id: string | null;
  file_path: string;
  content: string;
  found_at: string;
}

export interface SprintGateResult {
  passed: boolean;
  exit_code: number;
  output: string;
  checked_at: string;
}

export interface Finding {
  id: string;
  severity: string;
  category: string;
  title: string;
  file: string | null;
  created_at: string;
}

export interface FindingBacklogResult {
  findings: Finding[];
  total: number;
  critical_count: number;
  queried_at: string;
}

export interface LifecycleStatusResult {
  passed: boolean;
  violations: number;
  files_scanned: number;
  allowlisted: number;
  output: string;
  checked_at: string;
}

export type McpDecisionConfig = {
  repoRoot: string;
};
