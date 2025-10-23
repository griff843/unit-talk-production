import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, HealthStatus, BaseMetrics } from '../BaseAgent/types';
import { AgentTask } from './types';
export declare class OperatorAgent extends BaseAgent {
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    protected initialize(): Promise<void>;
    private validateDependencies;
    protected process(): Promise<void>;
    protected cleanup(): Promise<void>;
    checkHealth(): Promise<HealthStatus>;
    protected collectMetrics(): Promise<BaseMetrics>;
    monitorAgents(): Promise<AgentTask[]>;
    private prioritizeTasks;
    private logEvent;
    private handleIncident;
    createTask(task: AgentTask): Promise<void>;
    controlAgent(agent: string, command: 'pause' | 'rerun' | 'reset'): Promise<void>;
    generateSummary(period: 'daily' | 'weekly' | 'monthly'): Promise<any>;
    learnAndEvolve(): Promise<any>;
    handleCommand(command: string, user?: string): Promise<string>;
    /**
     * Run HealthWorkflow - System health monitoring with incident detection
     *
     * Executes comprehensive health checks including:
     * - system_health_snapshot query across 8 sections
     * - Threshold-based incident creation
     * - Command Center integration
     * - Job run logging and tracking
     */
    runHealthWorkflow(): Promise<{
        success: boolean;
        healthSummary: {
            totalSections: number;
            healthySections: number;
            degradedSections: number;
            criticalSections: number;
            sectionsWithAlerts: string[];
        };
        incidents: number;
        executionTime: number;
    }>;
    /**
     * Get severity level for alert types based on business impact
     */
    private getSeverityForAlert;
    static getInstance(dependencies: BaseAgentDependencies): OperatorAgent;
}
export declare function initializeOperatorAgent(dependencies: BaseAgentDependencies): OperatorAgent;
//# sourceMappingURL=index.d.ts.map