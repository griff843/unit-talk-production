/**
 * Workflow Registry — Public API
 *
 * SPRINT-052-LAYER3-PHASE11-OPERATOR-WORKFLOW-FOUNDATION
 */

export type {
  WorkflowCategory,
  WorkflowEntry,
  WorkflowParameter,
  WorkflowRiskLevel,
} from './types';
export { WORKFLOW_REGISTRY } from './registry';

import { WORKFLOW_REGISTRY } from './registry';

import type { WorkflowCategory, WorkflowEntry } from './types';

/** Return all registered workflows */
export function getAllWorkflows(): WorkflowEntry[] {
  return WORKFLOW_REGISTRY;
}

/** Return workflows filtered by category */
export function getWorkflowsByCategory(category: WorkflowCategory): WorkflowEntry[] {
  return WORKFLOW_REGISTRY.filter(w => w.category === category);
}

/** Look up a single workflow by name */
export function findWorkflow(name: string): WorkflowEntry | undefined {
  return WORKFLOW_REGISTRY.find(w => w.name === name);
}

/** Return unique categories present in the registry */
export function getCategories(): WorkflowCategory[] {
  return [...new Set(WORKFLOW_REGISTRY.map(w => w.category))].sort() as WorkflowCategory[];
}

/** Return count of workflows per category */
export function getCategoryCounts(): Record<WorkflowCategory, number> {
  const counts: Partial<Record<WorkflowCategory, number>> = {};
  for (const w of WORKFLOW_REGISTRY) {
    counts[w.category] = (counts[w.category] ?? 0) + 1;
  }
  return counts as Record<WorkflowCategory, number>;
}
