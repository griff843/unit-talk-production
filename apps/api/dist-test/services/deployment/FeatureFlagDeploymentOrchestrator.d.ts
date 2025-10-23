/**
 * Feature Flag Deployment Orchestrator
 *
 * Comprehensive deployment orchestration system with:
 * - Zero-downtime rollouts (5% → 25% → 50% → 75% → 100%)
 * - Health checks and validation gates
 * - Automatic rollback triggers
 * - Real-time performance monitoring
 * - Safety mechanisms and circuit breakers
 */
import { SupabaseClient } from '@supabase/supabase-js';
export interface DeploymentConfig {
    flagName: string;
    targetEnvironment: string;
    rolloutSteps: number[];
    validationGates: ValidationGate[];
    healthChecks: HealthCheck[];
    rollbackThresholds: RollbackThreshold[];
    maxRolloutDuration: number;
    stabilizationPeriod: number;
}
export interface ValidationGate {
    name: string;
    metric: string;
    threshold: number;
    operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
    required: boolean;
    weight: number;
}
export interface HealthCheck {
    name: string;
    endpoint: string;
    expectedStatus: number;
    timeout: number;
    retries: number;
    critical: boolean;
}
export interface RollbackThreshold {
    metric: string;
    threshold: number;
    severity: 'warning' | 'critical';
    action: 'pause' | 'rollback' | 'notify';
}
export interface DeploymentStep {
    stepNumber: number;
    rolloutPercentage: number;
    startTime: string;
    endTime?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
    validationResults: ValidationResult[];
    healthCheckResults: HealthCheckResult[];
    metrics: StepMetrics;
    duration?: number;
}
export interface ValidationResult {
    gateName: string;
    metric: string;
    actualValue: number;
    threshold: number;
    passed: boolean;
    weight: number;
    timestamp: string;
}
export interface HealthCheckResult {
    checkName: string;
    endpoint: string;
    status: number;
    responseTime: number;
    passed: boolean;
    critical: boolean;
    error?: string;
    timestamp: string;
}
export interface StepMetrics {
    activeUsers: number;
    errorRate: number;
    latencyP95: number;
    latencyP99: number;
    throughput: number;
    cacheHitRate: number;
    memoryUsage: number;
    cpuUsage: number;
}
export interface DeploymentStatus {
    deploymentId: string;
    flagName: string;
    environment: string;
    currentStep: number;
    currentPercentage: number;
    status: 'planning' | 'in_progress' | 'completed' | 'failed' | 'rolled_back' | 'paused';
    startTime: string;
    endTime?: string;
    totalDuration?: number;
    steps: DeploymentStep[];
    rollbackReason?: string;
    metrics: DeploymentMetrics;
}
export interface DeploymentMetrics {
    totalUsersAffected: number;
    stepsCompleted: number;
    stepsTotal: number;
    validationGatesPassed: number;
    validationGatesFailed: number;
    healthChecksTotal: number;
    healthChecksPassed: number;
    averageStepDuration: number;
    totalErrors: number;
    rollbacksTriggered: number;
}
export declare class FeatureFlagDeploymentOrchestrator {
    private logger;
    private supabase;
    private featureFlagService;
    private abTestingEngine;
    private activeDeployments;
    private deploymentTimers;
    private readonly DEFAULT_ROLLOUT_STEPS;
    private readonly DEFAULT_STABILIZATION_PERIOD;
    private readonly DEFAULT_MAX_ROLLOUT_DURATION;
    constructor(supabase: SupabaseClient);
    /**
     * Start a new feature flag deployment
     */
    startDeployment(config: DeploymentConfig): Promise<string>;
    /**
     * Execute deployment steps
     */
    private executeDeployment;
    /**
     * Execute a single rollout step
     */
    private executeRolloutStep;
    /**
     * Collect metrics for a rollout step
     */
    private collectStepMetrics;
    /**
     * Run health checks
     */
    private runHealthChecks;
    /**
     * Perform individual health check
     */
    private performHealthCheck;
    /**
     * Run validation gates
     */
    private runValidationGates;
    /**
     * Evaluate validation gate condition
     */
    private evaluateGate;
    /**
     * Check rollback conditions
     */
    private checkRollbackConditions;
    /**
     * Validate step completion
     */
    private validateStepCompletion;
    /**
     * Trigger rollback
     */
    private triggerRollback;
    /**
     * Validate deployment configuration
     */
    private validateDeploymentConfig;
    /**
     * Wait for stabilization period
     */
    private waitForStabilization;
    /**
     * Store deployment status
     */
    private storeDeploymentStatus;
    /**
     * Emit deployment event
     */
    private emitDeploymentEvent;
    /**
     * Start deployment monitoring
     */
    private startDeploymentMonitoring;
    /**
     * Monitor active deployments
     */
    private monitorActiveDeployments;
    /**
     * Get deployment status
     */
    getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus | null>;
    /**
     * Cancel deployment
     */
    cancelDeployment(deploymentId: string, reason: string): Promise<void>;
    /**
     * Create syndicate-grade deployment configurations
     */
    createSyndicateGradeDeploymentConfigs(): Record<string, DeploymentConfig>;
}
//# sourceMappingURL=FeatureFlagDeploymentOrchestrator.d.ts.map