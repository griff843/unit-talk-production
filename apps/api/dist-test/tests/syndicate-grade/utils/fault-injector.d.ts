/**
 * Fault Injector for Advanced Chaos Engineering
 *
 * Implements precise fault injection mechanisms for testing system resilience:
 * - Network fault injection (latency, packet loss, partitions)
 * - Database fault injection (connection failures, timeouts, corruption)
 * - Memory fault injection (leaks, pressure, fragmentation)
 * - Process fault injection (crashes, hangs, resource exhaustion)
 * - Service fault injection (API failures, rate limiting, cascading failures)
 *
 * Advanced Features:
 * - Configurable fault patterns and timing
 * - Conditional fault injection based on system state
 * - Fault correlation and cascading effects
 * - Real-time fault monitoring and control
 * - Automatic fault recovery and cleanup
 */
import { EventEmitter } from 'events';
export interface FaultInjectorConfig {
    enableNetworkFaults?: boolean;
    enableDatabaseFaults?: boolean;
    enableMemoryFaults?: boolean;
    enableProcessFaults?: boolean;
    faultProbability?: number;
    faultDuration?: number;
    cascadingFaults?: boolean;
    monitoringEnabled?: boolean;
}
export interface FaultPattern {
    id: string;
    type: 'network' | 'database' | 'memory' | 'process' | 'service';
    subtype: string;
    probability: number;
    duration: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    conditions?: any;
    cascadeRules?: any[];
}
export interface ActiveFault {
    id: string;
    pattern: FaultPattern;
    startTime: number;
    endTime: number;
    status: 'active' | 'recovering' | 'completed' | 'failed';
    affectedComponents: string[];
    metrics: any;
}
export declare class FaultInjector extends EventEmitter {
    private config;
    private activeFaults;
    private faultHistory;
    private isRunning;
    private monitoringInterval?;
    private networkHooks;
    private databaseHooks;
    private memoryHooks;
    private processHooks;
    constructor(config?: FaultInjectorConfig);
    /**
     * Start fault injection system
     */
    start(): Promise<void>;
    /**
     * Stop fault injection and clean up
     */
    stop(): Promise<void>;
    /**
     * Inject network partition fault
     */
    injectNetworkPartition(config: any): Promise<string>;
    /**
     * Inject database connection failure
     */
    injectDatabaseConnectionFailure(config: any): Promise<string>;
    /**
     * Inject memory pressure fault
     */
    injectMemoryPressure(config: any): Promise<string>;
    /**
     * Inject CPU starvation fault
     */
    injectCPUStarvation(config: any): Promise<string>;
    /**
     * Inject API rate limiting fault
     */
    injectAPIRateLimiting(config: any): Promise<string>;
    /**
     * Inject service failures
     */
    injectServiceFailures(config: any): Promise<string>;
    /**
     * Inject progressive failures
     */
    injectProgressiveFailures(config: any): Promise<string[]>;
    /**
     * Stop service failures
     */
    stopServiceFailures(): Promise<void>;
    /**
     * Generic fault injection method
     */
    injectFault(pattern: FaultPattern): Promise<string>;
    /**
     * Stop a specific fault
     */
    stopFault(faultId: string): Promise<void>;
    /**
     * Get fault injection status
     */
    getFaultStatus(): any;
    private executeFaultInjection;
    private executeFaultRecovery;
    private executeNetworkFault;
    private executeDatabaseFault;
    private executeMemoryFault;
    private executeProcessFault;
    private executeServiceFault;
    private implementNetworkPartition;
    private implementNetworkLatency;
    private implementPacketLoss;
    private implementDatabaseConnectionFailure;
    private implementDatabaseTimeout;
    private implementDatabaseCorruption;
    private implementMemoryPressure;
    private implementMemoryLeak;
    private implementMemoryFragmentation;
    private implementCPUStarvation;
    private implementProcessHang;
    private implementProcessCrash;
    private implementServiceFailures;
    private implementRateLimiting;
    private implementServiceTimeout;
    private recoverNetworkFault;
    private recoverDatabaseFault;
    private recoverMemoryFault;
    private recoverProcessFault;
    private recoverServiceFault;
    private networkFaultStates;
    private databaseFaultStates;
    private processFaultStates;
    private serviceFaultStates;
    private setNetworkFaultState;
    private setDatabaseFaultState;
    private setProcessFaultState;
    private setServiceFaultState;
    private clearNetworkFaultState;
    private clearDatabaseFaultState;
    private clearProcessFaultState;
    private clearServiceFaultState;
    isNetworkFaultActive(type: string): boolean;
    isDatabaseFaultActive(type: string): boolean;
    isProcessFaultActive(type: string): boolean;
    isServiceFaultActive(type: string): boolean;
    getNetworkFaultState(type: string): any;
    getDatabaseFaultState(type: string): any;
    getProcessFaultState(type: string): any;
    getServiceFaultState(type: string): any;
    private setupFaultHooks;
    private startMonitoring;
    private stopMonitoring;
    private monitorActiveFaults;
}
export default FaultInjector;
//# sourceMappingURL=fault-injector.d.ts.map