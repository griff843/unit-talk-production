import { ActivityResult, HealthCheckResult } from '../shared/activity-results';

export interface BaseAgentActivities {
  healthCheck(params: {
    components: string[];
    timeout?: number;
  }): Promise<HealthCheckResult>;

  validateDependencies(): Promise<ActivityResult<{
    valid: boolean;
    details?: Record<string, unknown>;
  }>>;

  initialize(): Promise<ActivityResult<{
    initialized: boolean;
    details?: Record<string, unknown>;
  }>>;
} 