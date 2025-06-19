import { GradingAgentActivitiesImpl } from './activities.js';
import { BaseAgentConfig, BaseAgentDependencies } from '../../BaseAgent/types';

// Factory function to create activities implementation
function createActivitiesImpl(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  return new GradingAgentActivitiesImpl(config, deps);
}

// Export factory function for Temporal worker
export { createActivitiesImpl };

// Export individual activity functions for direct use
export function gradeSubmission(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.gradeSubmission.bind(impl);
}

export function updateGrades(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.updateGrades.bind(impl);
}

export function generateFeedback(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.generateFeedback.bind(impl);
}

export function initialize(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.initialize.bind(impl);
}

export function cleanup(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.cleanup.bind(impl);
}

export function checkHealth(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.checkHealth.bind(impl);
}

export function collectMetrics(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.collectMetrics.bind(impl);
}

export function handleCommand(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.handleCommand.bind(impl);
}