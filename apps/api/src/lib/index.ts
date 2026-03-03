/**
 * Library Index - Central export for all lib modules
 *
 * Phase 6.5: Autopilot Guard and Workflow Registry
 */

// Phase 6.5: Autopilot Guard - Unified side-effect control plane
export {
  AutopilotGuard,
  autopilotGuard,
  assertMayPerformSideEffect,
  type SideEffectAction,
  type SideEffectContext,
  type GuardResult,
  type AutopilotMode,
} from './AutopilotGuard';

// Phase 6.5: Workflow Registry - Runtime workflow tracking
export {
  WorkflowRegistry,
  workflowRegistry,
  type WorkflowStatus,
  type WorkflowRegistration,
  type RegisteredWorkflow,
  type WorkflowStats,
} from './WorkflowRegistry';

// Existing exports (if any)
export * from './AgentInstrumentation';
export * from './TemporalControlClient';
export * from './AgentControlService';
