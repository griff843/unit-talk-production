/**
 * Syndicate Operations Center
 * Phase 10: 24/7 Operational Excellence with Automated Procedures
 *
 * Provides Fortune 100-grade operational procedures for syndicate betting
 * Implements disaster recovery, business continuity, and automated runbooks
 * Maintains 99.9% uptime with automated incident response
 */
import { EventEmitter } from 'events';
interface OnCallSchedule {
    engineer: string;
    role: 'PRIMARY' | 'SECONDARY' | 'ESCALATION';
    startTime: Date;
    endTime: Date;
    contactMethods: {
        phone: string;
        email: string;
        slack: string;
    };
}
export declare class SyndicateOperationsCenter extends EventEmitter {
    private redis;
    private dbPool;
    private procedures;
    private onCallSchedule;
    private disasterRecoveryPlans;
    private operationalState;
    private automationEngine;
    constructor();
    private initializeOperationsCenter;
    /**
     * Load comprehensive operational procedures
     */
    private loadOperationalProcedures;
    /**
     * Load disaster recovery plans
     */
    private loadDisasterRecoveryPlans;
    /**
     * Initialize 24/7 on-call schedule
     */
    private initializeOnCallSchedule;
    private getDefaultOnCallSchedule;
    /**
     * Execute operational procedure with automation
     */
    executeProcedure(procedureId: string, parameters?: Record<string, any>, dryRun?: boolean): Promise<{
        success: boolean;
        executionId: string;
        steps: Array<{
            step: number;
            status: string;
            result?: string;
            error?: string;
        }>;
        duration: number;
    }>;
    /**
     * Activate disaster recovery plan
     */
    activateDisasterRecovery(scenarioId: string): Promise<void>;
    /**
     * Start automation engine for 24/7 operations
     */
    private startAutomationEngine;
    /**
     * Start comprehensive health monitoring
     */
    private startHealthMonitoring;
    private checkAutomatedTriggers;
    private performAutomatedHealthChecks;
    private updateOperationalState;
    private validateOnCallSchedule;
    private executeAutomationScript;
    private executeManualStep;
    private validateStepCompletion;
    private executeRollbackAction;
    private storeProcedureExecution;
    private executeCommunicationPlan;
    private startDisasterRecoveryMonitoring;
    private performComprehensiveHealthCheck;
    private handleHealthDegradation;
    private evaluateDisasterScenarios;
    private getAutomatedTriggers;
    private evaluateTriggerCondition;
    private executeHealthCheck;
    private alertOnCallDeficiency;
    private shouldActivateDisasterRecovery;
    /**
     * Get current operational status
     */
    getOperationalStatus(): {
        state: string;
        onCallEngineers: OnCallSchedule[];
        activeProcedures: string[];
        lastHealthCheck: Date;
    };
    /**
     * Graceful shutdown
     */
    shutdown(): Promise<void>;
}
export declare const syndicateOperations: SyndicateOperationsCenter;
export {};
//# sourceMappingURL=SyndicateOperationsCenter.d.ts.map