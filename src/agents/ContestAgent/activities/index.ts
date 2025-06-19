import { ContestAgentActivitiesImpl } from './activities.js';
import { BaseAgentConfig, BaseAgentDependencies } from '../../BaseAgent/types';

// Factory function to create activities implementation
function createActivitiesImpl(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  return new ContestAgentActivitiesImpl(config, deps);
}

// Export factory function for Temporal worker
export { createActivitiesImpl };

// Export individual activity functions for direct use
export function createContest(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.createContest.bind(impl);
}

export function processEntries(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.processEntries.bind(impl);
}

export function determineWinners(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.determineWinners.bind(impl);
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