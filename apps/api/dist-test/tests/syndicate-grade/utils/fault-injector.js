"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FaultInjector = void 0;
const events_1 = require("events");
class FaultInjector extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.activeFaults = new Map();
        this.faultHistory = [];
        this.isRunning = false;
        // Fault injection hooks
        this.networkHooks = new Map();
        this.databaseHooks = new Map();
        this.memoryHooks = new Map();
        this.processHooks = new Map();
        // Fault state management
        this.networkFaultStates = new Map();
        this.databaseFaultStates = new Map();
        this.processFaultStates = new Map();
        this.serviceFaultStates = new Map();
        this.config = {
            enableNetworkFaults: true,
            enableDatabaseFaults: true,
            enableMemoryFaults: true,
            enableProcessFaults: true,
            faultProbability: 0.1,
            faultDuration: 10000,
            cascadingFaults: false,
            monitoringEnabled: true,
            ...config
        };
        this.setupFaultHooks();
    }
    /**
     * Start fault injection system
     */
    async start() {
        if (this.isRunning) {
            throw new Error('Fault injector is already running');
        }
        console.log('💉 Starting fault injection system');
        this.isRunning = true;
        if (this.config.monitoringEnabled) {
            this.startMonitoring();
        }
        this.emit('fault_injector_started', {
            config: this.config,
            timestamp: Date.now()
        });
    }
    /**
     * Stop fault injection and clean up
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        console.log('🛑 Stopping fault injection system');
        this.isRunning = false;
        // Stop all active faults
        const stopPromises = Array.from(this.activeFaults.keys()).map(faultId => this.stopFault(faultId));
        await Promise.all(stopPromises);
        this.stopMonitoring();
        this.emit('fault_injector_stopped', {
            faultsExecuted: this.faultHistory.length,
            timestamp: Date.now()
        });
    }
    /**
     * Inject network partition fault
     */
    async injectNetworkPartition(config) {
        const pattern = {
            id: `network-partition-${Date.now()}`,
            type: 'network',
            subtype: 'partition',
            probability: 1.0,
            duration: config.duration || 30000,
            severity: 'high',
            conditions: {
                partitionType: config.partitionType || 'random',
                affectedPercentage: config.affectedPercentage || 0.4,
                latencyIncrease: config.latencyIncrease || 5000,
                packetLoss: config.packetLoss || 0.3
            }
        };
        return await this.injectFault(pattern);
    }
    /**
     * Inject database connection failure
     */
    async injectDatabaseConnectionFailure(config) {
        const pattern = {
            id: `db-failure-${Date.now()}`,
            type: 'database',
            subtype: 'connection_failure',
            probability: 1.0,
            duration: config.duration || 15000,
            severity: 'critical',
            conditions: {
                failureRate: config.failureRate || 0.8,
                affectedOperations: config.affectedOperations || ['read', 'write', 'transaction'],
                timeoutMultiplier: config.timeoutMultiplier || 3
            }
        };
        return await this.injectFault(pattern);
    }
    /**
     * Inject memory pressure fault
     */
    async injectMemoryPressure(config) {
        const pattern = {
            id: `memory-pressure-${Date.now()}`,
            type: 'memory',
            subtype: 'pressure',
            probability: 1.0,
            duration: config.duration || 20000,
            severity: 'medium',
            conditions: {
                targetMemoryMB: config.targetMemoryMB || 800,
                allocationRate: config.allocationRate || 50,
                fragmentationLevel: config.fragmentationLevel || 'high'
            }
        };
        return await this.injectFault(pattern);
    }
    /**
     * Inject CPU starvation fault
     */
    async injectCPUStarvation(config) {
        const pattern = {
            id: `cpu-starvation-${Date.now()}`,
            type: 'process',
            subtype: 'cpu_starvation',
            probability: 1.0,
            duration: config.duration || 20000,
            severity: 'high',
            conditions: {
                cpuIntensityPercent: config.cpuIntensityPercent || 80,
                blockingOperations: config.blockingOperations || true,
                affectEventLoop: config.affectEventLoop || true
            }
        };
        return await this.injectFault(pattern);
    }
    /**
     * Inject API rate limiting fault
     */
    async injectAPIRateLimiting(config) {
        const pattern = {
            id: `rate-limit-${Date.now()}`,
            type: 'service',
            subtype: 'rate_limiting',
            probability: 1.0,
            duration: config.duration || 20000,
            severity: 'medium',
            conditions: {
                rateLimitPerSecond: config.rateLimitPerSecond || 10,
                affectedAPIs: config.affectedAPIs || ['feature-store', 'alert-agent'],
                returnAfter: config.returnAfter || 1000
            }
        };
        return await this.injectFault(pattern);
    }
    /**
     * Inject service failures
     */
    async injectServiceFailures(config) {
        const pattern = {
            id: `service-failures-${Date.now()}`,
            type: 'service',
            subtype: 'failures',
            probability: 1.0,
            duration: config.duration || 15000,
            severity: 'high',
            conditions: {
                services: config.services || [],
                failureRate: config.failureRate || 0.5,
                responseDelay: config.responseDelay || 5000
            }
        };
        return await this.injectFault(pattern);
    }
    /**
     * Inject progressive failures
     */
    async injectProgressiveFailures(config) {
        const faultIds = [];
        // Phase 1
        if (config.phase1) {
            const phase1Id = await this.injectServiceFailures({
                services: config.phase1.affectedServices,
                failureRate: 0.3,
                duration: config.phase1.duration
            });
            faultIds.push(phase1Id);
            await new Promise(resolve => setTimeout(resolve, config.phase1.duration));
        }
        // Phase 2
        if (config.phase2) {
            const phase2Id = await this.injectServiceFailures({
                services: config.phase2.affectedServices,
                failureRate: 0.6,
                duration: config.phase2.duration
            });
            faultIds.push(phase2Id);
            await new Promise(resolve => setTimeout(resolve, config.phase2.duration));
        }
        // Phase 3
        if (config.phase3) {
            const phase3Id = await this.injectServiceFailures({
                services: config.phase3.affectedServices,
                failureRate: 0.9,
                duration: config.phase3.duration
            });
            faultIds.push(phase3Id);
            await new Promise(resolve => setTimeout(resolve, config.phase3.duration));
        }
        return faultIds;
    }
    /**
     * Stop service failures
     */
    async stopServiceFailures() {
        const serviceFaults = Array.from(this.activeFaults.values())
            .filter(fault => fault.pattern.type === 'service');
        for (const fault of serviceFaults) {
            await this.stopFault(fault.id);
        }
    }
    /**
     * Generic fault injection method
     */
    async injectFault(pattern) {
        if (!this.isRunning) {
            throw new Error('Fault injector is not running');
        }
        const activeFault = {
            id: pattern.id,
            pattern,
            startTime: Date.now(),
            endTime: Date.now() + pattern.duration,
            status: 'active',
            affectedComponents: [],
            metrics: {
                injectionTime: Date.now(),
                recoveryTime: null,
                impactMeasured: false
            }
        };
        this.activeFaults.set(pattern.id, activeFault);
        console.log(`💉 Injecting fault: ${pattern.type}/${pattern.subtype} (${pattern.id})`);
        try {
            await this.executeFaultInjection(activeFault);
            // Schedule automatic cleanup
            setTimeout(() => {
                this.stopFault(pattern.id);
            }, pattern.duration);
            this.emit('fault_injected', activeFault);
            return pattern.id;
        }
        catch (error) {
            activeFault.status = 'failed';
            this.activeFaults.delete(pattern.id);
            this.faultHistory.push(activeFault);
            throw error;
        }
    }
    /**
     * Stop a specific fault
     */
    async stopFault(faultId) {
        const fault = this.activeFaults.get(faultId);
        if (!fault) {
            return;
        }
        console.log(`🔧 Stopping fault: ${fault.pattern.type}/${fault.pattern.subtype} (${faultId})`);
        fault.status = 'recovering';
        try {
            await this.executeFaultRecovery(fault);
            fault.status = 'completed';
            fault.metrics.recoveryTime = Date.now();
            this.activeFaults.delete(faultId);
            this.faultHistory.push(fault);
            this.emit('fault_recovered', fault);
        }
        catch (error) {
            console.error(`Failed to recover from fault ${faultId}:`, error);
            fault.status = 'failed';
            this.activeFaults.delete(faultId);
            this.faultHistory.push(fault);
        }
    }
    /**
     * Get fault injection status
     */
    getFaultStatus() {
        return {
            isRunning: this.isRunning,
            activeFaults: this.activeFaults.size,
            totalFaultsExecuted: this.faultHistory.length,
            config: this.config,
            activeFaultList: Array.from(this.activeFaults.values()).map(fault => ({
                id: fault.id,
                type: fault.pattern.type,
                subtype: fault.pattern.subtype,
                severity: fault.pattern.severity,
                duration: Date.now() - fault.startTime,
                status: fault.status
            }))
        };
    }
    // Private implementation methods
    async executeFaultInjection(fault) {
        switch (fault.pattern.type) {
            case 'network':
                await this.executeNetworkFault(fault);
                break;
            case 'database':
                await this.executeDatabaseFault(fault);
                break;
            case 'memory':
                await this.executeMemoryFault(fault);
                break;
            case 'process':
                await this.executeProcessFault(fault);
                break;
            case 'service':
                await this.executeServiceFault(fault);
                break;
            default:
                throw new Error(`Unknown fault type: ${fault.pattern.type}`);
        }
    }
    async executeFaultRecovery(fault) {
        switch (fault.pattern.type) {
            case 'network':
                await this.recoverNetworkFault(fault);
                break;
            case 'database':
                await this.recoverDatabaseFault(fault);
                break;
            case 'memory':
                await this.recoverMemoryFault(fault);
                break;
            case 'process':
                await this.recoverProcessFault(fault);
                break;
            case 'service':
                await this.recoverServiceFault(fault);
                break;
        }
    }
    async executeNetworkFault(fault) {
        const conditions = fault.pattern.conditions;
        switch (fault.pattern.subtype) {
            case 'partition':
                await this.implementNetworkPartition(fault, conditions);
                break;
            case 'latency':
                await this.implementNetworkLatency(fault, conditions);
                break;
            case 'packet_loss':
                await this.implementPacketLoss(fault, conditions);
                break;
        }
    }
    async executeDatabaseFault(fault) {
        const conditions = fault.pattern.conditions;
        switch (fault.pattern.subtype) {
            case 'connection_failure':
                await this.implementDatabaseConnectionFailure(fault, conditions);
                break;
            case 'timeout':
                await this.implementDatabaseTimeout(fault, conditions);
                break;
            case 'corruption':
                await this.implementDatabaseCorruption(fault, conditions);
                break;
        }
    }
    async executeMemoryFault(fault) {
        const conditions = fault.pattern.conditions;
        switch (fault.pattern.subtype) {
            case 'pressure':
                await this.implementMemoryPressure(fault, conditions);
                break;
            case 'leak':
                await this.implementMemoryLeak(fault, conditions);
                break;
            case 'fragmentation':
                await this.implementMemoryFragmentation(fault, conditions);
                break;
        }
    }
    async executeProcessFault(fault) {
        const conditions = fault.pattern.conditions;
        switch (fault.pattern.subtype) {
            case 'cpu_starvation':
                await this.implementCPUStarvation(fault, conditions);
                break;
            case 'hang':
                await this.implementProcessHang(fault, conditions);
                break;
            case 'crash':
                await this.implementProcessCrash(fault, conditions);
                break;
        }
    }
    async executeServiceFault(fault) {
        const conditions = fault.pattern.conditions;
        switch (fault.pattern.subtype) {
            case 'failures':
                await this.implementServiceFailures(fault, conditions);
                break;
            case 'rate_limiting':
                await this.implementRateLimiting(fault, conditions);
                break;
            case 'timeout':
                await this.implementServiceTimeout(fault, conditions);
                break;
        }
    }
    // Network fault implementations
    async implementNetworkPartition(fault, conditions) {
        console.log(`🔌 Implementing network partition: ${conditions.partitionType}`);
        // Set network partition flags for application to check
        this.setNetworkFaultState('partition', {
            active: true,
            type: conditions.partitionType,
            affectedPercentage: conditions.affectedPercentage,
            latencyIncrease: conditions.latencyIncrease,
            packetLoss: conditions.packetLoss
        });
        fault.affectedComponents.push('network_layer');
    }
    async implementNetworkLatency(fault, conditions) {
        console.log(`🌐 Implementing network latency: ${conditions.latencyMs}ms`);
        this.setNetworkFaultState('latency', {
            active: true,
            latencyMs: conditions.latencyMs,
            jitter: conditions.jitter || 0
        });
        fault.affectedComponents.push('network_layer');
    }
    async implementPacketLoss(fault, conditions) {
        console.log(`📉 Implementing packet loss: ${conditions.lossRate * 100}%`);
        this.setNetworkFaultState('packet_loss', {
            active: true,
            lossRate: conditions.lossRate
        });
        fault.affectedComponents.push('network_layer');
    }
    // Database fault implementations
    async implementDatabaseConnectionFailure(fault, conditions) {
        console.log(`💥 Implementing database connection failures: ${conditions.failureRate * 100}%`);
        this.setDatabaseFaultState('connection_failure', {
            active: true,
            failureRate: conditions.failureRate,
            affectedOperations: conditions.affectedOperations,
            timeoutMultiplier: conditions.timeoutMultiplier
        });
        fault.affectedComponents.push('database_layer');
    }
    async implementDatabaseTimeout(fault, conditions) {
        console.log(`⏱️  Implementing database timeouts: ${conditions.timeoutMs}ms`);
        this.setDatabaseFaultState('timeout', {
            active: true,
            timeoutMs: conditions.timeoutMs,
            affectedOperations: conditions.affectedOperations
        });
        fault.affectedComponents.push('database_layer');
    }
    async implementDatabaseCorruption(fault, conditions) {
        console.log(`🗄️  Implementing database corruption: ${conditions.corruptionRate * 100}%`);
        this.setDatabaseFaultState('corruption', {
            active: true,
            corruptionRate: conditions.corruptionRate,
            affectedTables: conditions.affectedTables
        });
        fault.affectedComponents.push('database_layer');
    }
    // Memory fault implementations
    async implementMemoryPressure(fault, conditions) {
        console.log(`🧠 Implementing memory pressure: ${conditions.targetMemoryMB}MB`);
        // Allocate memory to create pressure
        const chunkSize = 10 * 1024 * 1024; // 10MB chunks
        const chunks = [];
        let allocatedMB = 0;
        const allocateMemory = () => {
            if (allocatedMB >= conditions.targetMemoryMB || fault.status !== 'active') {
                return;
            }
            try {
                const chunk = Buffer.alloc(chunkSize);
                chunks.push(chunk);
                allocatedMB += 10;
                setTimeout(allocateMemory, 1000 / (conditions.allocationRate / 10));
            }
            catch (error) {
                console.error('Memory allocation failed:', error.message);
            }
        };
        allocateMemory();
        // Store chunks for cleanup
        fault.memoryChunks = chunks;
        fault.affectedComponents.push('memory_system');
    }
    async implementMemoryLeak(fault, conditions) {
        console.log(`💧 Implementing memory leak: ${conditions.leakRateMB}MB/sec`);
        const leakChunks = [];
        const leakInterval = setInterval(() => {
            if (fault.status !== 'active') {
                clearInterval(leakInterval);
                return;
            }
            try {
                const leakChunk = Buffer.alloc(conditions.leakRateMB * 1024 * 1024);
                leakChunks.push(leakChunk);
            }
            catch (error) {
                clearInterval(leakInterval);
            }
        }, 1000);
        fault.leakChunks = leakChunks;
        fault.leakInterval = leakInterval;
        fault.affectedComponents.push('memory_system');
    }
    async implementMemoryFragmentation(fault, conditions) {
        console.log(`🧩 Implementing memory fragmentation: ${conditions.fragmentationLevel}`);
        // Create fragmented memory pattern
        const fragments = [];
        for (let i = 0; i < 1000; i++) {
            const size = Math.random() * 1024 * 1024; // Random sizes up to 1MB
            try {
                fragments.push(Buffer.alloc(size));
            }
            catch (error) {
                break;
            }
        }
        fault.fragmentChunks = fragments;
        fault.affectedComponents.push('memory_system');
    }
    // Process fault implementations
    async implementCPUStarvation(fault, conditions) {
        console.log(`🔥 Implementing CPU starvation: ${conditions.cpuIntensityPercent}%`);
        const cpuWorkers = [];
        const workerCount = Math.ceil(conditions.cpuIntensityPercent / 25); // One worker per 25% CPU
        for (let i = 0; i < workerCount; i++) {
            const worker = setInterval(() => {
                if (fault.status !== 'active') {
                    return;
                }
                const endTime = Date.now() + (conditions.cpuIntensityPercent / workerCount);
                while (Date.now() < endTime) {
                    // CPU intensive work
                    Math.sqrt(Math.random() * 1000000);
                }
            }, conditions.blockingOperations ? 0 : 10);
            cpuWorkers.push(worker);
        }
        fault.cpuWorkers = cpuWorkers;
        fault.affectedComponents.push('cpu_system');
    }
    async implementProcessHang(fault, conditions) {
        console.log(`⏸️  Implementing process hang: ${conditions.hangDurationMs}ms`);
        // Simulate process hang by blocking event loop
        const hangStart = Date.now();
        while (Date.now() - hangStart < conditions.hangDurationMs && fault.status === 'active') {
            // Intentional blocking loop
        }
        fault.affectedComponents.push('event_loop');
    }
    async implementProcessCrash(fault, conditions) {
        console.log(`💥 Implementing process crash simulation`);
        // Simulate crash by throwing unhandled exception (in test environment only)
        if (conditions.simulateOnly) {
            this.setProcessFaultState('crash', {
                active: true,
                crashType: conditions.crashType || 'unhandled_exception'
            });
        }
        else {
            // Actual crash (use with extreme caution)
            throw new Error('Simulated process crash');
        }
        fault.affectedComponents.push('process');
    }
    // Service fault implementations
    async implementServiceFailures(fault, conditions) {
        console.log(`💥 Implementing service failures: ${conditions.services.join(', ')}`);
        this.setServiceFaultState('failures', {
            active: true,
            services: conditions.services,
            failureRate: conditions.failureRate,
            responseDelay: conditions.responseDelay
        });
        fault.affectedComponents.push(...conditions.services);
    }
    async implementRateLimiting(fault, conditions) {
        console.log(`🚦 Implementing rate limiting: ${conditions.rateLimitPerSecond} req/sec`);
        this.setServiceFaultState('rate_limiting', {
            active: true,
            rateLimitPerSecond: conditions.rateLimitPerSecond,
            affectedAPIs: conditions.affectedAPIs,
            returnAfter: conditions.returnAfter
        });
        fault.affectedComponents.push(...conditions.affectedAPIs);
    }
    async implementServiceTimeout(fault, conditions) {
        console.log(`⏱️  Implementing service timeouts: ${conditions.timeoutMs}ms`);
        this.setServiceFaultState('timeout', {
            active: true,
            timeoutMs: conditions.timeoutMs,
            affectedServices: conditions.affectedServices
        });
        fault.affectedComponents.push(...conditions.affectedServices);
    }
    // Recovery implementations
    async recoverNetworkFault(fault) {
        console.log(`🔗 Recovering network fault: ${fault.pattern.subtype}`);
        this.clearNetworkFaultState(fault.pattern.subtype);
    }
    async recoverDatabaseFault(fault) {
        console.log(`🗄️  Recovering database fault: ${fault.pattern.subtype}`);
        this.clearDatabaseFaultState(fault.pattern.subtype);
    }
    async recoverMemoryFault(fault) {
        console.log(`🧠 Recovering memory fault: ${fault.pattern.subtype}`);
        // Clean up allocated memory
        if (fault.memoryChunks) {
            fault.memoryChunks.length = 0;
        }
        if (fault.leakChunks) {
            fault.leakChunks.length = 0;
        }
        if (fault.fragmentChunks) {
            fault.fragmentChunks.length = 0;
        }
        if (fault.leakInterval) {
            clearInterval(fault.leakInterval);
        }
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
    }
    async recoverProcessFault(fault) {
        console.log(`⚡ Recovering process fault: ${fault.pattern.subtype}`);
        // Stop CPU workers
        if (fault.cpuWorkers) {
            fault.cpuWorkers.forEach((worker) => {
                clearInterval(worker);
            });
        }
        this.clearProcessFaultState(fault.pattern.subtype);
    }
    async recoverServiceFault(fault) {
        console.log(`🔧 Recovering service fault: ${fault.pattern.subtype}`);
        this.clearServiceFaultState(fault.pattern.subtype);
    }
    setNetworkFaultState(type, state) {
        this.networkFaultStates.set(type, state);
    }
    setDatabaseFaultState(type, state) {
        this.databaseFaultStates.set(type, state);
    }
    setProcessFaultState(type, state) {
        this.processFaultStates.set(type, state);
    }
    setServiceFaultState(type, state) {
        this.serviceFaultStates.set(type, state);
    }
    clearNetworkFaultState(type) {
        this.networkFaultStates.delete(type);
    }
    clearDatabaseFaultState(type) {
        this.databaseFaultStates.delete(type);
    }
    clearProcessFaultState(type) {
        this.processFaultStates.delete(type);
    }
    clearServiceFaultState(type) {
        this.serviceFaultStates.delete(type);
    }
    // Public methods for checking fault states
    isNetworkFaultActive(type) {
        const state = this.networkFaultStates.get(type);
        return state && state.active;
    }
    isDatabaseFaultActive(type) {
        const state = this.databaseFaultStates.get(type);
        return state && state.active;
    }
    isProcessFaultActive(type) {
        const state = this.processFaultStates.get(type);
        return state && state.active;
    }
    isServiceFaultActive(type) {
        const state = this.serviceFaultStates.get(type);
        return state && state.active;
    }
    getNetworkFaultState(type) {
        return this.networkFaultStates.get(type);
    }
    getDatabaseFaultState(type) {
        return this.databaseFaultStates.get(type);
    }
    getProcessFaultState(type) {
        return this.processFaultStates.get(type);
    }
    getServiceFaultState(type) {
        return this.serviceFaultStates.get(type);
    }
    // Setup and monitoring
    setupFaultHooks() {
        // Setup hooks for different fault types
        // This would integrate with actual system components
    }
    startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.monitorActiveFaults();
        }, 1000);
    }
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
    }
    monitorActiveFaults() {
        const now = Date.now();
        for (const [faultId, fault] of this.activeFaults) {
            // Check if fault should auto-expire
            if (now >= fault.endTime && fault.status === 'active') {
                this.stopFault(faultId);
            }
            // Update fault metrics
            fault.metrics.duration = now - fault.startTime;
            // Emit monitoring events
            this.emit('fault_monitoring', {
                faultId,
                status: fault.status,
                duration: fault.metrics.duration,
                components: fault.affectedComponents
            });
        }
    }
}
exports.FaultInjector = FaultInjector;
exports.default = FaultInjector;
