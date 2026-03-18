/**
 * Workflow Registry Types
 *
 * SPRINT-052-LAYER3-PHASE11-OPERATOR-WORKFLOW-FOUNDATION
 */

export type WorkflowCategory = 'analysis' | 'backfill' | 'feed' | 'health' | 'settlement' | 'ops';

export type WorkflowRiskLevel = 'low' | 'medium' | 'high';

export interface WorkflowParameter {
  name: string;
  description: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean';
  example?: string;
}

export type WorkflowTrigger = 'manual' | 'scheduled' | 'event-driven';

export interface WorkflowEntry {
  /** Unique identifier (kebab-case) */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** What this workflow does */
  description: string;
  /** Category for grouping */
  category: WorkflowCategory;
  /** Relative path from apps/api/src/scripts/ */
  scriptPath: string;
  /** Risk level — affects whether confirmation is required */
  riskLevel: WorkflowRiskLevel;
  /** CLI invocation example */
  invocation: string;
  /** Optional parameter definitions */
  parameters?: WorkflowParameter[];
  /** Requires live Supabase connection */
  requiresDatabase?: boolean;
  /** How this workflow is triggered (default: manual) */
  trigger?: WorkflowTrigger;
  /** Temporal schedule ID if trigger is 'scheduled' */
  temporalScheduleId?: string;
  /** Schedule interval description (e.g., 'every 30m', 'daily at 4 AM') */
  scheduleDescription?: string;
}
