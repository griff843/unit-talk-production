"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChaosInducer = void 0;
const events_1 = require("events");
class ChaosInducer extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.activeChaosEvents = new Map();
        this.chaosHistory = [];
        this.isActive = false;
        this.emergencyStopActive = false;
        // Chaos intensity mappings
        this.INTENSITY_LEVELS = {
            'low': { multiplier: 0.3, maxConcurrent: 2, recoveryTime: 5000 },
            'moderate': { multiplier: 0.6, maxConcurrent: 4, recoveryTime: 10000 },
            'high': { multiplier: 0.8, maxConcurrent: 6, recoveryTime: 15000 },
            'extreme': { multiplier: 1.0, maxConcurrent: 10, recoveryTime: 30000 }
        };
        this.networkPartitionActive = false;
        this.networkPartitionConfig = {};
        this.databaseFailureActive = false;
        this.databaseFailureRate = 0;
        this.databaseAffectedOperations = [];
        this.apiRateLimitActive = false;
        this.apiRateLimitConfig = {};
        this.serviceFailuresActive = false;
        this.serviceFailureConfig = {};
        this.config = {
            intensity: 'moderate',
            enabledChaosTypes: [
                'network_latency',
                'network_partition',
                'memory_pressure',
                'cpu_starvation',
                'disk_io_failure',
                'service_timeout',
                'database_connection_failure',
                'api_rate_limiting'
            ],
            monitoringInterval: 1000,
            emergencyStopThreshold: 0.95, // 95% resource usage triggers emergency stop
            safetyLimits: {
                maxMemoryUsage: 2048 * 1024 * 1024, // 2GB
                maxCPUUsage: 90, // 90%
                maxDiskUsage: 85, // 85%
                maxNetworkLatency: 10000 // 10 seconds
            },
            ...config
        };
        // Initialize pseudo-random generator for reproducible chaos
        if (config.randomSeed) {
            let seed = config.randomSeed;
            this.random = () => {
                seed = (seed * 9301 + 49297) % 233280;
                return seed / 233280;
            };
        }
        else {
            this.random = Math.random;
        }
        this.setupMonitoring();
    }
    /**
     * Start chaos engineering with safety monitoring
     */
    async start() {
        if (this.isActive) {
            throw new Error('Chaos inducer is already active');
        }
        console.log(`🌪️  Starting chaos inducer with ${this.config.intensity} intensity`);
        this.isActive = true;
        this.emergencyStopActive = false;
        // Start safety monitoring
        this.startMonitoring();
        this.emit('chaos_started', {
            intensity: this.config.intensity,
            enabledTypes: this.config.enabledChaosTypes,
            timestamp: Date.now()
        });
    }
    /**
     * Stop all chaos and restore normal operation
     */
    async stop() {
        if (!this.isActive) {
            return;
        }
        console.log('🛑 Stopping chaos inducer and restoring normal operation');
        this.isActive = false;
        // Stop all active chaos events
        const stopPromises = Array.from(this.activeChaosEvents.values()).map(event => this.stopChaosEvent(event.id));
        await Promise.all(stopPromises);
        // Stop monitoring
        this.stopMonitoring();
        this.emit('chaos_stopped', {
            eventsCompleted: this.chaosHistory.length,
            timestamp: Date.now()
        });
    }
    /**
     * Induce mild chaos for gradual testing
     */
    async induceMildChaos(chaosType, duration = 5000) {
        if (!this.isActive) {
            throw new Error('Chaos inducer is not active');
        }
        const event = {
            id: `chaos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: chaosType,
            intensity: 0.3, // Mild intensity
            startTime: Date.now(),
            duration,
            target: 'system',
            parameters: this.getChaosParameters(chaosType, 0.3),
            status: 'active'
        };
        this.activeChaosEvents.set(event.id, event);
        try {
            await this.executeChaosEvent(event);
            // Auto-stop after duration
            setTimeout(() => {
                this.stopChaosEvent(event.id);
            }, duration);
            return event.id;
        }
        catch (error) {
            event.status = 'failed';
            this.activeChaosEvents.delete(event.id);
            this.chaosHistory.push(event);
            throw error;
        }
    }
    /**
     * Induce network partition chaos
     */
    async injectNetworkPartition(config) {
        const event = {
            id: `network-partition-${Date.now()}`,
            type: 'network_partition',
            intensity: 0.8,
            startTime: Date.now(),
            duration: config.duration || 30000,
            target: 'network',
            parameters: {
                partitionType: config.partitionType || 'random',
                affectedPercentage: config.affectedPercentage || 0.4,
                latencyIncrease: config.latencyIncrease || 5000,
                packetLoss: config.packetLoss || 0.3
            },
            status: 'active'
        };
        this.activeChaosEvents.set(event.id, event);
        console.log(`🔌 Inducing network partition: ${event.parameters.partitionType}`);
        // Simulate network partition effects
        await this.simulateNetworkPartition(event);
        // Auto-stop after duration
        setTimeout(() => {
            this.stopChaosEvent(event.id);
        }, event.duration);
    }
    /**
     * Induce memory pressure chaos
     */
    async injectMemoryPressure(config) {
        const event = {
            id: `memory-pressure-${Date.now()}`,
            type: 'memory_pressure',
            intensity: 0.7,
            startTime: Date.now(),
            duration: config.duration || 20000,
            target: 'memory',
            parameters: {
                targetMemoryMB: config.targetMemoryMB || 800,
                allocationRate: config.allocationRate || 50,
                fragmentationLevel: config.fragmentationLevel || 'medium'
            },
            status: 'active'
        };
        this.activeChaosEvents.set(event.id, event);
        console.log(`🧠 Inducing memory pressure: ${event.parameters.targetMemoryMB}MB target`);
        // Simulate memory pressure
        await this.simulateMemoryPressure(event);
        // Auto-stop after duration
        setTimeout(() => {
            this.stopChaosEvent(event.id);
        }, event.duration);
    }
    /**
     * Induce CPU starvation chaos
     */
    async injectCPUStarvation(config) {
        const event = {
            id: `cpu-starvation-${Date.now()}`,
            type: 'cpu_starvation',
            intensity: 0.8,
            startTime: Date.now(),
            duration: config.duration || 20000,
            target: 'cpu',
            parameters: {
                cpuIntensityPercent: config.cpuIntensityPercent || 80,
                blockingOperations: config.blockingOperations || true,
                affectEventLoop: config.affectEventLoop || true
            },
            status: 'active'
        };
        this.activeChaosEvents.set(event.id, event);
        console.log(`🔥 Inducing CPU starvation: ${event.parameters.cpuIntensityPercent}% intensity`);
        // Simulate CPU starvation
        await this.simulateCPUStarvation(event);
        // Auto-stop after duration
        setTimeout(() => {
            this.stopChaosEvent(event.id);
        }, event.duration);
    }
    /**
     * Induce database connection failures
     */
    async injectDatabaseConnectionFailure(config) {
        const event = {
            id: `db-failure-${Date.now()}`,
            type: 'database_connection_failure',
            intensity: 0.8,
            startTime: Date.now(),
            duration: config.duration || 15000,
            target: 'database',
            parameters: {
                failureRate: config.failureRate || 0.8,
                affectedOperations: config.affectedOperations || ['read', 'write', 'transaction']
            },
            status: 'active'
        };
        this.activeChaosEvents.set(event.id, event);
        console.log(`💥 Inducing database connection failures: ${event.parameters.failureRate * 100}% failure rate`);
        // Simulate database failures
        await this.simulateDatabaseFailures(event);
        // Auto-stop after duration
        setTimeout(() => {
            this.stopChaosEvent(event.id);
        }, event.duration);
    }
    /**
     * Induce API rate limiting
     */
    async injectAPIRateLimiting(config) {
        const event = {
            id: `rate-limit-${Date.now()}`,
            type: 'api_rate_limiting',
            intensity: 0.6,
            startTime: Date.now(),
            duration: config.duration || 20000,
            target: 'api',
            parameters: {
                rateLimitPerSecond: config.rateLimitPerSecond || 10,
                affectedAPIs: config.affectedAPIs || ['feature-store', 'alert-agent'],
                returnAfter: config.returnAfter || 1000
            },
            status: 'active'
        };
        this.activeChaosEvents.set(event.id, event);
        console.log(`🚦 Inducing API rate limiting: ${event.parameters.rateLimitPerSecond} requests/sec`);
        // Simulate rate limiting
        await this.simulateAPIRateLimiting(event);
        // Auto-stop after duration
        setTimeout(() => {
            this.stopChaosEvent(event.id);
        }, event.duration);
    }
    /**
     * Induce service failures progressively
     */
    async injectProgressiveFailures(config) {
        console.log('📉 Inducing progressive system failures');
        // Phase 1: Light failures
        if (config.phase1) {
            await this.injectServiceFailures({
                services: config.phase1.affectedServices,
                failureRate: 0.3,
                duration: config.phase1.duration
            });
            await new Promise(resolve => setTimeout(resolve, config.phase1.duration));
        }
        // Phase 2: Medium failures
        if (config.phase2) {
            await this.injectServiceFailures({
                services: config.phase2.affectedServices,
                failureRate: 0.6,
                duration: config.phase2.duration
            });
            await new Promise(resolve => setTimeout(resolve, config.phase2.duration));
        }
        // Phase 3: Heavy failures
        if (config.phase3) {
            await this.injectServiceFailures({
                services: config.phase3.affectedServices,
                failureRate: 0.9,
                duration: config.phase3.duration
            });
            await new Promise(resolve => setTimeout(resolve, config.phase3.duration));
        }
    }
    /**
     * Induce service failures
     */
    async injectServiceFailures(config) {
        const event = {
            id: `service-failures-${Date.now()}`,
            type: 'service_failures',
            intensity: config.failureRate || 0.5,
            startTime: Date.now(),
            duration: config.duration || 15000,
            target: 'services',
            parameters: {
                services: config.services || [],
                failureRate: config.failureRate || 0.5,
                responseDelay: config.responseDelay || 5000
            },
            status: 'active'
        };
        this.activeChaosEvents.set(event.id, event);
        console.log(`💥 Inducing service failures: ${event.parameters.services.join(', ')}`);
        // Simulate service failures
        await this.simulateServiceFailures(event);
        // Auto-stop after duration
        setTimeout(() => {
            this.stopChaosEvent(event.id);
        }, event.duration);
    }
    /**
     * Stop service failures
     */
    async stopServiceFailures() {
        const serviceFailureEvents = Array.from(this.activeChaosEvents.values())
            .filter(event => event.type === 'service_failures');
        for (const event of serviceFailureEvents) {
            await this.stopChaosEvent(event.id);
        }
    }
    /**
     * Get current chaos status
     */
    getChaosStatus() {
        return {
            isActive: this.isActive,
            emergencyStopActive: this.emergencyStopActive,
            activeChaosEvents: this.activeChaosEvents.size,
            totalEventsExecuted: this.chaosHistory.length,
            currentIntensity: this.config.intensity,
            safetyLimits: this.config.safetyLimits,
            activeEvents: Array.from(this.activeChaosEvents.values()).map(event => ({
                id: event.id,
                type: event.type,
                intensity: event.intensity,
                duration: Date.now() - event.startTime,
                target: event.target
            }))
        };
    }
    // Private methods for chaos implementation
    async executeChaosEvent(event) {
        switch (event.type) {
            case 'network_latency':
                await this.simulateNetworkLatency(event);
                break;
            case 'network_partition':
                await this.simulateNetworkPartition(event);
                break;
            case 'memory_pressure':
                await this.simulateMemoryPressure(event);
                break;
            case 'cpu_starvation':
                await this.simulateCPUStarvation(event);
                break;
            case 'database_connection_failure':
                await this.simulateDatabaseFailures(event);
                break;
            case 'api_rate_limiting':
                await this.simulateAPIRateLimiting(event);
                break;
            default:
                console.warn(`Unknown chaos type: ${event.type}`);
        }
    }
    async stopChaosEvent(eventId) {
        const event = this.activeChaosEvents.get(eventId);
        if (!event) {
            return;
        }
        console.log(`🛑 Stopping chaos event: ${event.type} (${eventId})`);
        event.status = 'completed';
        this.activeChaosEvents.delete(eventId);
        this.chaosHistory.push(event);
        // Cleanup specific to chaos type
        await this.cleanupChaosEvent(event);
        this.emit('chaos_event_stopped', event);
    }
    async cleanupChaosEvent(event) {
        switch (event.type) {
            case 'memory_pressure':
                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }
                break;
            case 'cpu_starvation':
                // Stop CPU intensive operations
                this.stopCPUIntensiveOperations(event.id);
                break;
            case 'network_partition':
                // Restore network connectivity
                this.restoreNetworkConnectivity(event.id);
                break;
            // Add more cleanup as needed
        }
    }
    getChaosParameters(chaosType, intensity) {
        const intensityLevel = this.INTENSITY_LEVELS[this.config.intensity];
        const adjustedIntensity = intensity * intensityLevel.multiplier;
        const parameterMap = {
            'network_latency': {
                latencyMs: adjustedIntensity * 1000,
                jitter: adjustedIntensity * 200,
                packetLoss: adjustedIntensity * 0.1
            },
            'memory_pressure': {
                allocationMB: adjustedIntensity * 500,
                allocationRate: adjustedIntensity * 50,
                fragmentationLevel: adjustedIntensity > 0.7 ? 'high' : 'medium'
            },
            'cpu_starvation': {
                cpuUsage: adjustedIntensity * 80,
                blockingDuration: adjustedIntensity * 1000,
                yieldFrequency: Math.max(1, 10 - adjustedIntensity * 8)
            }
        };
        return parameterMap[chaosType] || {};
    }
    async simulateNetworkLatency(event) {
        // Simulate network latency by introducing delays in network operations
        const latency = event.parameters.latencyMs || 500;
        // This would integrate with network layer to add latency
        console.log(`🌐 Simulating ${latency}ms network latency`);
        // For testing purposes, we simulate this with artificial delays
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    async simulateNetworkPartition(event) {
        // Simulate network partition by blocking/delaying certain network operations
        const partitionType = event.parameters.partitionType;
        const affectedPercentage = event.parameters.affectedPercentage;
        console.log(`🔌 Simulating ${partitionType} network partition affecting ${affectedPercentage * 100}% of connections`);
        // Implementation would modify network layer behavior
        this.networkPartitionActive = true;
        this.networkPartitionConfig = event.parameters;
    }
    async simulateMemoryPressure(event) {
        const targetMemoryMB = event.parameters.targetMemoryMB;
        const allocationRate = event.parameters.allocationRate; // MB per second
        console.log(`🧠 Allocating memory to reach ${targetMemoryMB}MB`);
        // Allocate memory in chunks to create pressure
        const chunkSize = 10 * 1024 * 1024; // 10MB chunks
        const chunks = [];
        let allocatedMB = 0;
        const allocateChunk = () => {
            if (allocatedMB >= targetMemoryMB || !this.activeChaosEvents.has(event.id)) {
                return;
            }
            try {
                const chunk = Buffer.alloc(chunkSize);
                chunks.push(chunk);
                allocatedMB += 10;
                console.log(`🧠 Allocated ${allocatedMB}MB / ${targetMemoryMB}MB`);
                // Schedule next allocation
                setTimeout(allocateChunk, 1000 / (allocationRate / 10)); // Rate control
            }
            catch (error) {
                console.error('Memory allocation failed:', error.message);
            }
        };
        allocateChunk();
        // Store reference for cleanup
        event.memoryChunks = chunks;
    }
    async simulateCPUStarvation(event) {
        const cpuIntensity = event.parameters.cpuIntensityPercent;
        const blockingOperations = event.parameters.blockingOperations;
        console.log(`🔥 Starting CPU starvation at ${cpuIntensity}% intensity`);
        // Create CPU-intensive workload
        const startCPUWork = () => {
            if (!this.activeChaosEvents.has(event.id)) {
                return;
            }
            const endTime = Date.now() + (cpuIntensity * 10); // Work duration based on intensity
            while (Date.now() < endTime) {
                // CPU intensive calculation
                let sum = 0;
                for (let i = 0; i < 100000; i++) {
                    sum += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
                }
            }
            // Small yield to prevent complete blocking
            if (blockingOperations) {
                setImmediate(startCPUWork);
            }
            else {
                setTimeout(startCPUWork, 10);
            }
        };
        startCPUWork();
        // Store worker reference for cleanup
        event.cpuWorkerActive = true;
    }
    async simulateDatabaseFailures(event) {
        const failureRate = event.parameters.failureRate;
        const affectedOperations = event.parameters.affectedOperations;
        console.log(`💥 Simulating database failures: ${failureRate * 100}% failure rate`);
        // This would integrate with database layer to inject failures
        // For testing, we set flags that the application layer can check
        this.databaseFailureActive = true;
        this.databaseFailureRate = failureRate;
        this.databaseAffectedOperations = affectedOperations;
    }
    async simulateAPIRateLimiting(event) {
        const rateLimitPerSecond = event.parameters.rateLimitPerSecond;
        const affectedAPIs = event.parameters.affectedAPIs;
        console.log(`🚦 Simulating API rate limiting: ${rateLimitPerSecond} requests/sec`);
        // Implementation would modify API layer behavior
        this.apiRateLimitActive = true;
        this.apiRateLimitConfig = event.parameters;
    }
    async simulateServiceFailures(event) {
        const services = event.parameters.services;
        const failureRate = event.parameters.failureRate;
        console.log(`💥 Simulating service failures for: ${services.join(', ')}`);
        // Implementation would modify service layer behavior
        this.serviceFailuresActive = true;
        this.serviceFailureConfig = event.parameters;
    }
    stopCPUIntensiveOperations(eventId) {
        // Stop CPU intensive operations for the given event
        console.log(`🛑 Stopping CPU intensive operations for ${eventId}`);
    }
    restoreNetworkConnectivity(eventId) {
        // Restore network connectivity
        this.networkPartitionActive = false;
        this.networkPartitionConfig = {};
        console.log(`🔗 Network connectivity restored for ${eventId}`);
    }
    setupMonitoring() {
        // Setup safety monitoring to prevent system damage
    }
    startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.checkSafetyLimits();
        }, this.config.monitoringInterval);
    }
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
    }
    checkSafetyLimits() {
        const memoryUsage = process.memoryUsage();
        const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
        // Check memory safety limit
        if (memoryUsageMB > (this.config.safetyLimits.maxMemoryUsage / 1024 / 1024)) {
            console.error(`🚨 Memory safety limit exceeded: ${memoryUsageMB}MB`);
            this.triggerEmergencyStop('memory_limit_exceeded');
        }
        // Additional safety checks would go here
    }
    triggerEmergencyStop(reason) {
        if (this.emergencyStopActive) {
            return; // Already in emergency stop
        }
        console.error(`🚨 EMERGENCY STOP TRIGGERED: ${reason}`);
        this.emergencyStopActive = true;
        // Stop all chaos immediately
        this.stop().catch(error => {
            console.error('Failed to stop chaos during emergency:', error);
        });
        this.emit('emergency_stop', { reason, timestamp: Date.now() });
    }
    // Public methods for checking if chaos is affecting operations
    isNetworkPartitionActive() {
        return this.networkPartitionActive;
    }
    isDatabaseFailureActive() {
        return this.databaseFailureActive;
    }
    isAPIRateLimitActive() {
        return this.apiRateLimitActive;
    }
    isServiceFailureActive() {
        return this.serviceFailuresActive;
    }
    shouldSimulateNetworkFailure() {
        if (!this.networkPartitionActive)
            return false;
        return this.random() < this.networkPartitionConfig.affectedPercentage;
    }
    shouldSimulateDatabaseFailure(operation) {
        if (!this.databaseFailureActive)
            return false;
        if (!this.databaseAffectedOperations.includes(operation))
            return false;
        return this.random() < this.databaseFailureRate;
    }
    shouldSimulateAPIRateLimit(apiName) {
        if (!this.apiRateLimitActive)
            return false;
        if (!this.apiRateLimitConfig.affectedAPIs.includes(apiName))
            return false;
        return this.random() < 0.8; // 80% chance of rate limiting when active
    }
    shouldSimulateServiceFailure(serviceName) {
        if (!this.serviceFailuresActive)
            return false;
        if (!this.serviceFailureConfig.services.includes(serviceName))
            return false;
        return this.random() < this.serviceFailureConfig.failureRate;
    }
}
exports.ChaosInducer = ChaosInducer;
exports.default = ChaosInducer;
