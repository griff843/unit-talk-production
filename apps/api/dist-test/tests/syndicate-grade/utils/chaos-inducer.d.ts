/**
 * Chaos Inducer for Syndicate-Grade Fault Tolerance Testing
 *
 * Implements controlled chaos engineering principles to test system resilience:
 * - Network failures and latency injection
 * - Resource exhaustion simulation
 * - Service dependency failures
 * - Data corruption scenarios
 * - Cascading failure patterns
 *
 * Safety Features:
 * - Configurable intensity levels
 * - Safety limits and circuit breakers
 * - Automatic rollback mechanisms
 * - Monitoring and observability
 * - Emergency stop functionality
 */
import { EventEmitter } from 'events';
export interface ChaosInducerConfig {
    intensity?: 'low' | 'moderate' | 'high' | 'extreme';
    randomSeed?: number;
    safetyLimits?: {
        maxMemoryUsage?: number;
        maxCPUUsage?: number;
        maxDiskUsage?: number;
        maxNetworkLatency?: number;
    };
    enabledChaosTypes?: string[];
    monitoringInterval?: number;
    emergencyStopThreshold?: number;
}
export interface ChaosEvent {
    id: string;
    type: string;
    intensity: number;
    startTime: number;
    duration: number;
    target: string;
    parameters: any;
    status: 'active' | 'completed' | 'failed' | 'stopped';
}
export declare class ChaosInducer extends EventEmitter {
    private config;
    private activeChaosEvents;
    private chaosHistory;
    private monitoringInterval?;
    private isActive;
    private emergencyStopActive;
    private random;
    private readonly INTENSITY_LEVELS;
    constructor(config?: ChaosInducerConfig);
    /**
     * Start chaos engineering with safety monitoring
     */
    start(): Promise<void>;
    /**
     * Stop all chaos and restore normal operation
     */
    stop(): Promise<void>;
    /**
     * Induce mild chaos for gradual testing
     */
    induceMildChaos(chaosType: string, duration?: number): Promise<string>;
    /**
     * Induce network partition chaos
     */
    injectNetworkPartition(config: any): Promise<void>;
    /**
     * Induce memory pressure chaos
     */
    injectMemoryPressure(config: any): Promise<void>;
    /**
     * Induce CPU starvation chaos
     */
    injectCPUStarvation(config: any): Promise<void>;
    /**
     * Induce database connection failures
     */
    injectDatabaseConnectionFailure(config: any): Promise<void>;
    /**
     * Induce API rate limiting
     */
    injectAPIRateLimiting(config: any): Promise<void>;
    /**
     * Induce service failures progressively
     */
    injectProgressiveFailures(config: any): Promise<void>;
    /**
     * Induce service failures
     */
    injectServiceFailures(config: any): Promise<void>;
    /**
     * Stop service failures
     */
    stopServiceFailures(): Promise<void>;
    /**
     * Get current chaos status
     */
    getChaosStatus(): any;
    private executeChaosEvent;
    private stopChaosEvent;
    private cleanupChaosEvent;
    private getChaosParameters;
    private simulateNetworkLatency;
    private simulateNetworkPartition;
    private networkPartitionActive;
    private networkPartitionConfig;
    private simulateMemoryPressure;
    private simulateCPUStarvation;
    private simulateDatabaseFailures;
    private databaseFailureActive;
    private databaseFailureRate;
    private databaseAffectedOperations;
    private simulateAPIRateLimiting;
    private apiRateLimitActive;
    private apiRateLimitConfig;
    private simulateServiceFailures;
    private serviceFailuresActive;
    private serviceFailureConfig;
    private stopCPUIntensiveOperations;
    private restoreNetworkConnectivity;
    private setupMonitoring;
    private startMonitoring;
    private stopMonitoring;
    private checkSafetyLimits;
    private triggerEmergencyStop;
    isNetworkPartitionActive(): boolean;
    isDatabaseFailureActive(): boolean;
    isAPIRateLimitActive(): boolean;
    isServiceFailureActive(): boolean;
    shouldSimulateNetworkFailure(): boolean;
    shouldSimulateDatabaseFailure(operation: string): boolean;
    shouldSimulateAPIRateLimit(apiName: string): boolean;
    shouldSimulateServiceFailure(serviceName: string): boolean;
}
export default ChaosInducer;
//# sourceMappingURL=chaos-inducer.d.ts.map