import { Logger } from '../../shared/logger/types';
import { InterventionType, MessageAnalysis } from './types';
interface PendingIntervention {
    id: string;
    userId: string;
    type: InterventionType;
    scheduledTime: Date;
    priority: number;
    attempts: number;
    maxAttempts: number;
    context: any;
}
export declare class InterventionSystem {
    private readonly logger;
    private pendingInterventions;
    private interventionRules;
    private userInterventionHistory;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    assessIntervention(userId: string, behaviorData: MessageAnalysis): Promise<InterventionType | null>;
    scheduleIntervention(userId: string, intervention: InterventionType, delay?: number): Promise<string>;
    getPendingInterventions(): Promise<PendingIntervention[]>;
    markCompleted(interventionId: string, outcome?: 'successful' | 'failed' | 'ignored'): Promise<void>;
    private loadInterventionRules;
    private loadPendingInterventions;
    private startInterventionScheduler;
    private processDueInterventions;
    private evaluateRule;
    private evaluateConfusionRule;
    private evaluateEngagementRule;
    private evaluateConversionRule;
    private evaluateChurnRule;
    private evaluateLearningRule;
    private isInCooldown;
    private exceedsDailyLimit;
    private countRecentQuestions;
    private getInactivityHours;
    private getInactivityDays;
    private getPriorityScore;
    private getMaxAttempts;
    private gatherInterventionContext;
    private getUserActivitySummary;
    private getRecentInterventions;
    private cachePendingIntervention;
    private recordInterventionHistory;
    private scheduleFollowUp;
    isHealthy(): Promise<boolean>;
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=interventionSystem.d.ts.map