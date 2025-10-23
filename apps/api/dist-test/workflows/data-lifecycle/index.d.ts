export { FeatureBuilderWorkflow, ScheduledFeatureBuilderWorkflow, ExpressFeatureBuilderWorkflow } from './FeatureBuilderWorkflow';
export { ScoringWorkflow, ScheduledScoringWorkflow, ExpressScoringWorkflow } from './ScoringWorkflow';
export { PromotionWorkflow, ScheduledPromotionWorkflow, ExpressPromotionWorkflow } from './PromotionWorkflow';
export { DataLifecycleWorkflow, ScheduledDataLifecycleWorkflow, EmergencyDataLifecycleWorkflow } from './DataLifecycleWorkflow';
export interface WorkflowSchedule {
    FeatureBuilder: {
        scheduled: string;
        express: string;
    };
    Scoring: {
        scheduled: string;
        express: string;
    };
    Promotion: {
        scheduled: string;
        express: string;
    };
    DataLifecycle: {
        scheduled: string;
        emergency: string;
    };
}
export declare const DEFAULT_WORKFLOW_SCHEDULE: WorkflowSchedule;
export declare enum WorkflowPriority {
    LOW = "low",
    NORMAL = "normal",
    HIGH = "high",
    CRITICAL = "critical"
}
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
//# sourceMappingURL=index.d.ts.map