// Data Lifecycle Workflow Exports
// Temporal workflows for comprehensive data lifecycle management

export {
  FeatureBuilderWorkflow,
  ScheduledFeatureBuilderWorkflow,
  ExpressFeatureBuilderWorkflow
} from './FeatureBuilderWorkflow';

export {
  ScoringWorkflow,
  ScheduledScoringWorkflow,
  ExpressScoringWorkflow
} from './ScoringWorkflow';

export {
  PromotionWorkflow,
  ScheduledPromotionWorkflow,
  ExpressPromotionWorkflow
} from './PromotionWorkflow';

export {
  DataLifecycleWorkflow,
  ScheduledDataLifecycleWorkflow,
  EmergencyDataLifecycleWorkflow
} from './DataLifecycleWorkflow';

// Workflow orchestration types
export interface WorkflowSchedule {
  FeatureBuilder: {
    scheduled: string; // '0 * * * *' - Every hour
    express: string;   // Event-driven
  };
  Scoring: {
    scheduled: string; // '*/30 * * * *' - Every 30 minutes
    express: string;   // Event-driven
  };
  Promotion: {
    scheduled: string; // '*/15 * * * *' - Every 15 minutes
    express: string;   // Event-driven
  };
  DataLifecycle: {
    scheduled: string; // '0 2 * * *' - Daily at 2 AM
    emergency: string; // Event-driven
  };
}

// Default workflow schedule configuration
export const DEFAULT_WORKFLOW_SCHEDULE: WorkflowSchedule = {
  FeatureBuilder: {
    scheduled: '0 * * * *',    // Hourly feature computation
    express: 'event-driven'    // Triggered by material changes
  },
  Scoring: {
    scheduled: '*/30 * * * *',  // Every 30 minutes scoring
    express: 'event-driven'     // Triggered by feature completion
  },
  Promotion: {
    scheduled: '*/15 * * * *',  // Every 15 minutes promotion
    express: 'event-driven'     // Triggered by high-grade scoring
  },
  DataLifecycle: {
    scheduled: '0 2 * * *',     // Daily 2 AM archival
    emergency: 'event-driven'   // Triggered by capacity alerts
  }
};

// Workflow execution priorities
export enum WorkflowPriority {
  LOW = 'low',
  NORMAL = 'normal', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Workflow result types for monitoring
export interface WorkflowExecutionResult {
  workflowId: string;
  workflowType: string;
  success: boolean;
  duration: number;
  results: Record<string, any>;
  alerts: Array<{
    type: string;
    message: string;
    severity: string;
  }>;
  errors: string[];
  executionTime: string;
}