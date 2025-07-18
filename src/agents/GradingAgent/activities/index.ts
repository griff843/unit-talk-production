import { GradingAgentActivitiesImpl } from './activities';
import { BaseAgentConfig, BaseAgentDependencies } from '../../BaseAgent/types';

function createActivitiesImpl(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  return new GradingAgentActivitiesImpl(config, deps);
}

// Export individual activity functions
export function gradeProp(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.gradeProp.bind(impl);
}

export function validateGrade(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.validateGrade.bind(impl);
}

export function monitorGrading(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.monitorGrading.bind(impl);
}

// Export base agent activities
export function initialize(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.initialize.bind(impl);
}

export function healthCheck(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.healthCheck.bind(impl);
}

export function validateDependencies(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return impl.validateDependencies.bind(impl);
}

// Export all activities as a single object
export function createActivities(config: BaseAgentConfig, deps: BaseAgentDependencies) {
  const impl = createActivitiesImpl(config, deps);
  return {
    gradeProp: impl.gradeProp.bind(impl),
    validateGrade: impl.validateGrade.bind(impl),
    monitorGrading: impl.monitorGrading.bind(impl),
    initialize: impl.initialize.bind(impl),
    healthCheck: impl.healthCheck.bind(impl),
    validateDependencies: impl.validateDependencies.bind(impl)
  };
}