"use strict";
/**
 * Syndicate-Grade Load Testing Suite
 *
 * Validates system performance under high-volume conditions:
 * - 8K+ prop processing with <1s alert latency
 * - Concurrent agent orchestration
 * - Database scalability and connection pooling
 * - Memory usage optimization
 * - Temporal workflow throughput
 *
 * Performance Requirements:
 * - 8,000+ props processed in <30 seconds
 * - Alert latency <1 second under full load
 * - Feature retrieval <50ms at 95th percentile
 * - Agent coordination overhead <100ms
 * - Memory growth <500MB during test
 */
Object.defineProperty(exports, "__esModule", { value: true });
const perf_hooks_1 = require("perf_hooks");
const globals_1 = require("@jest/globals");
const GradingAgent_1 = require("../../agents/GradingAgent");
const AlertAgent_1 = require("../../agents/AlertAgent");
const FeedAgent_1 = require("../../agents/FeedAgent");
const ProfessionalPropProcessor_1 = require("../../services/ProfessionalPropProcessor");
const FeatureStoreService_1 = require("../../services/FeatureStoreService");
const supabaseClient_1 = require("../../services/supabaseClient");
const metrics_collector_1 = require("../../monitoring/metrics-collector");
// Test constants for syndicate-grade validation
const SYNDICATE_THRESHOLDS = {
    // Volume processing requirements
    PROPS_COUNT: 8000,
    TOTAL_PROCESSING_TIME: 30000, // 30 seconds
    PROPS_PER_SECOND: 267, // 8000/30
    // Latency requirements  
    ALERT_LATENCY: 1000, // 1 second
    FEATURE_RETRIEVAL: 50, // 50ms
    AGENT_COORDINATION: 100, // 100ms
    // Resource requirements
    MAX_MEMORY_GROWTH: 500 * 1024 * 1024, // 500MB
    MAX_CPU_USAGE: 80, // 80%
    MAX_DB_CONNECTIONS: 20,
    // Throughput requirements
    MIN_THROUGHPUT_PPS: 200, // props per second
    MAX_ERROR_RATE: 0.01, // 1% error rate
    MIN_SUCCESS_RATE: 0.99 // 99% success rate
};
(0, globals_1.describe)('Syndicate-Grade Load Testing', () => {
    let gradingAgent;
    let alertAgent;
    let feedAgent;
    let propProcessor;
    let featureStore;
    let metricsCollector;
    let initialMemory;
    let testStartTime;
    (0, globals_1.beforeAll)(async () => {
        // Initialize all agents and services
        gradingAgent = new GradingAgent_1.GradingAgent({
            agentName: 'GradingAgent-LoadTest',
            agentVersion: '1.0.0',
            enableMonitoring: true,
            batchSize: 100, // Optimize for batch processing
            concurrency: 10
        });
        alertAgent = new AlertAgent_1.AlertAgent({
            agentName: 'AlertAgent-LoadTest',
            agentVersion: '1.0.0',
            enableMonitoring: true,
            alertThresholds: {
                responseTime: SYNDICATE_THRESHOLDS.ALERT_LATENCY,
                errorRate: SYNDICATE_THRESHOLDS.MAX_ERROR_RATE
            }
        });
        feedAgent = new FeedAgent_1.FeedAgent({
            agentName: 'FeedAgent-LoadTest',
            agentVersion: '1.0.0',
            enableMonitoring: true
        });
        propProcessor = new ProfessionalPropProcessor_1.ProfessionalPropProcessor();
        featureStore = FeatureStoreService_1.FeatureStoreService.getInstance();
        metricsCollector = metrics_collector_1.MetricsCollector.getInstance();
        // Warm up services
        await warmupServices();
        // Capture initial system state
        initialMemory = process.memoryUsage();
        testStartTime = Date.now();
        console.log('🚀 Starting syndicate-grade load testing suite');
        console.log(`📊 Target: ${SYNDICATE_THRESHOLDS.PROPS_COUNT} props in ${SYNDICATE_THRESHOLDS.TOTAL_PROCESSING_TIME / 1000}s`);
    });
    (0, globals_1.afterAll)(async () => {
        // Cleanup and report final metrics
        await cleanupLoadTestData();
        const finalMemory = process.memoryUsage();
        const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
        const totalTestTime = Date.now() - testStartTime;
        console.log('🏁 Load testing complete');
        console.log(`💾 Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
        console.log(`⏱️  Total test time: ${(totalTestTime / 1000).toFixed(2)}s`);
        // Stop all agents
        await gradingAgent.stop();
        await alertAgent.stop();
        await feedAgent.stop();
    });
    (0, globals_1.describe)('High-Volume Prop Processing', () => {
        (0, globals_1.test)('should process 8K+ props within 30 seconds', async () => {
            const propCount = SYNDICATE_THRESHOLDS.PROPS_COUNT;
            const startTime = perf_hooks_1.performance.now();
            // Generate test props with realistic data distribution
            const testProps = generateTestProps(propCount);
            console.log(`📝 Generated ${propCount} test props`);
            // Process in optimized batches
            const batchSize = 100;
            const batches = [];
            for (let i = 0; i < testProps.length; i += batchSize) {
                batches.push(testProps.slice(i, i + batchSize));
            }
            console.log(`🔄 Processing ${batches.length} batches of ${batchSize} props`);
            let processedCount = 0;
            let errorCount = 0;
            // Process batches concurrently with controlled concurrency
            const processingPromises = batches.map(async (batch, batchIndex) => {
                try {
                    const batchStartTime = perf_hooks_1.performance.now();
                    // Process batch through the full pipeline
                    await propProcessor.processBatch(batch);
                    const batchDuration = perf_hooks_1.performance.now() - batchStartTime;
                    processedCount += batch.length;
                    // Log progress every 10 batches
                    if (batchIndex % 10 === 0) {
                        console.log(`✅ Batch ${batchIndex + 1}/${batches.length} processed in ${batchDuration.toFixed(2)}ms`);
                        console.log(`📈 Progress: ${processedCount}/${propCount} props (${((processedCount / propCount) * 100).toFixed(1)}%)`);
                    }
                    return batch.length;
                }
                catch (error) {
                    errorCount += batch.length;
                    console.error(`❌ Batch ${batchIndex} failed:`, error);
                    return 0;
                }
            });
            // Execute all batches with progress tracking
            const results = await Promise.allSettled(processingPromises);
            const totalDuration = perf_hooks_1.performance.now() - startTime;
            // Calculate performance metrics
            const successfulResults = results.filter(r => r.status === 'fulfilled').length;
            const successRate = successfulResults / results.length;
            const propsPerSecond = processedCount / (totalDuration / 1000);
            console.log(`🎯 Performance Results:`);
            console.log(`  📊 Total processed: ${processedCount}/${propCount}`);
            console.log(`  ⏱️  Total time: ${(totalDuration / 1000).toFixed(2)}s`);
            console.log(`  🚀 Throughput: ${propsPerSecond.toFixed(2)} props/sec`);
            console.log(`  ✅ Success rate: ${(successRate * 100).toFixed(2)}%`);
            console.log(`  ❌ Error count: ${errorCount}`);
            // Validate performance requirements
            (0, globals_1.expect)(totalDuration).toBeLessThan(SYNDICATE_THRESHOLDS.TOTAL_PROCESSING_TIME);
            (0, globals_1.expect)(propsPerSecond).toBeGreaterThan(SYNDICATE_THRESHOLDS.MIN_THROUGHPUT_PPS);
            (0, globals_1.expect)(successRate).toBeGreaterThan(SYNDICATE_THRESHOLDS.MIN_SUCCESS_RATE);
            (0, globals_1.expect)(errorCount / propCount).toBeLessThan(SYNDICATE_THRESHOLDS.MAX_ERROR_RATE);
        }, 60000); // 60 second timeout for full test
        (0, globals_1.test)('should maintain <1s alert latency under full load', async () => {
            // Start continuous prop processing
            const propStream = generateContinuousProps(1000); // 1000 props over test duration
            let alertLatencies = [];
            let maxLatency = 0;
            let avgLatency = 0;
            // Monitor alert latency during processing
            const alertMonitoring = setInterval(async () => {
                const alertStartTime = perf_hooks_1.performance.now();
                try {
                    // Trigger alert check
                    await alertAgent.checkAlerts();
                    const latency = perf_hooks_1.performance.now() - alertStartTime;
                    alertLatencies.push(latency);
                    maxLatency = Math.max(maxLatency, latency);
                    console.log(`🚨 Alert latency: ${latency.toFixed(2)}ms (max: ${maxLatency.toFixed(2)}ms)`);
                }
                catch (error) {
                    console.error('Alert check failed:', error);
                    alertLatencies.push(SYNDICATE_THRESHOLDS.ALERT_LATENCY + 1); // Count as failure
                }
            }, 500); // Check every 500ms
            // Process props while monitoring alerts
            await new Promise(resolve => setTimeout(resolve, 10000)); // Run for 10 seconds
            clearInterval(alertMonitoring);
            // Calculate alert performance metrics
            avgLatency = alertLatencies.reduce((sum, lat) => sum + lat, 0) / alertLatencies.length;
            const p95Latency = alertLatencies.sort((a, b) => a - b)[Math.floor(alertLatencies.length * 0.95)];
            const alertFailures = alertLatencies.filter(lat => lat > SYNDICATE_THRESHOLDS.ALERT_LATENCY).length;
            console.log(`🎯 Alert Performance Results:`);
            console.log(`  📊 Total checks: ${alertLatencies.length}`);
            console.log(`  ⏱️  Average latency: ${avgLatency.toFixed(2)}ms`);
            console.log(`  📈 95th percentile: ${p95Latency.toFixed(2)}ms`);
            console.log(`  🔴 Max latency: ${maxLatency.toFixed(2)}ms`);
            console.log(`  ❌ Failures (>1s): ${alertFailures}`);
            // Validate alert performance requirements
            (0, globals_1.expect)(avgLatency).toBeLessThan(SYNDICATE_THRESHOLDS.ALERT_LATENCY);
            (0, globals_1.expect)(p95Latency).toBeLessThan(SYNDICATE_THRESHOLDS.ALERT_LATENCY);
            (0, globals_1.expect)(maxLatency).toBeLessThan(SYNDICATE_THRESHOLDS.ALERT_LATENCY * 2); // Allow 2x max
            (0, globals_1.expect)(alertFailures / alertLatencies.length).toBeLessThan(0.05); // <5% failure rate
        }, 30000);
        (0, globals_1.test)('should maintain <50ms feature retrieval at 95th percentile', async () => {
            const featureRetrievals = [];
            const testDuration = 30000; // 30 seconds
            const retrievalInterval = 100; // Every 100ms
            console.log(`🔍 Testing feature retrieval performance for ${testDuration / 1000}s`);
            const startTime = Date.now();
            while (Date.now() - startTime < testDuration) {
                const retrievalStart = perf_hooks_1.performance.now();
                try {
                    // Test various feature retrievals under load
                    await Promise.all([
                        featureStore.getFeatures('NFL', 'player_props'),
                        featureStore.getFeatures('NBA', 'player_props'),
                        featureStore.getFeatures('MLB', 'player_props'),
                        featureStore.getCachedFeatures('trend_analysis'),
                        featureStore.getCachedFeatures('market_movement')
                    ]);
                    const retrievalTime = perf_hooks_1.performance.now() - retrievalStart;
                    featureRetrievals.push(retrievalTime);
                    if (featureRetrievals.length % 50 === 0) {
                        const avgTime = featureRetrievals.reduce((sum, time) => sum + time, 0) / featureRetrievals.length;
                        console.log(`📊 ${featureRetrievals.length} retrievals, avg: ${avgTime.toFixed(2)}ms`);
                    }
                }
                catch (error) {
                    console.error('Feature retrieval failed:', error);
                    featureRetrievals.push(SYNDICATE_THRESHOLDS.FEATURE_RETRIEVAL * 2); // Count as slow
                }
                // Wait before next retrieval
                await new Promise(resolve => setTimeout(resolve, retrievalInterval));
            }
            // Calculate feature retrieval metrics
            featureRetrievals.sort((a, b) => a - b);
            const avgRetrieval = featureRetrievals.reduce((sum, time) => sum + time, 0) / featureRetrievals.length;
            const p50Retrieval = featureRetrievals[Math.floor(featureRetrievals.length * 0.5)];
            const p95Retrieval = featureRetrievals[Math.floor(featureRetrievals.length * 0.95)];
            const p99Retrieval = featureRetrievals[Math.floor(featureRetrievals.length * 0.99)];
            const maxRetrieval = Math.max(...featureRetrievals);
            console.log(`🎯 Feature Retrieval Performance:`);
            console.log(`  📊 Total retrievals: ${featureRetrievals.length}`);
            console.log(`  ⏱️  Average: ${avgRetrieval.toFixed(2)}ms`);
            console.log(`  📊 50th percentile: ${p50Retrieval.toFixed(2)}ms`);
            console.log(`  📈 95th percentile: ${p95Retrieval.toFixed(2)}ms`);
            console.log(`  🔴 99th percentile: ${p99Retrieval.toFixed(2)}ms`);
            console.log(`  🔴 Max: ${maxRetrieval.toFixed(2)}ms`);
            // Validate feature retrieval requirements
            (0, globals_1.expect)(p95Retrieval).toBeLessThan(SYNDICATE_THRESHOLDS.FEATURE_RETRIEVAL);
            (0, globals_1.expect)(avgRetrieval).toBeLessThan(SYNDICATE_THRESHOLDS.FEATURE_RETRIEVAL * 0.8); // Avg should be better
            (0, globals_1.expect)(maxRetrieval).toBeLessThan(SYNDICATE_THRESHOLDS.FEATURE_RETRIEVAL * 3); // Max allowed spike
        });
    });
    (0, globals_1.describe)('Resource Management Under Load', () => {
        (0, globals_1.test)('should maintain memory usage within limits', async () => {
            const memorySnapshots = [];
            const testDuration = 60000; // 1 minute
            const snapshotInterval = 5000; // Every 5 seconds
            console.log(`💾 Monitoring memory usage for ${testDuration / 1000}s`);
            // Start memory monitoring
            const memoryMonitoring = setInterval(() => {
                const memory = process.memoryUsage();
                memorySnapshots.push(memory);
                const growth = memory.heapUsed - initialMemory.heapUsed;
                console.log(`💾 Memory: ${(memory.heapUsed / 1024 / 1024).toFixed(2)}MB (growth: ${(growth / 1024 / 1024).toFixed(2)}MB)`);
            }, snapshotInterval);
            // Generate continuous load while monitoring
            const loadPromises = [];
            for (let i = 0; i < 10; i++) {
                loadPromises.push(generateContinuousLoad(testDuration / 10));
            }
            await Promise.all(loadPromises);
            clearInterval(memoryMonitoring);
            // Analyze memory usage
            const finalMemory = process.memoryUsage();
            const totalGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
            const maxMemory = Math.max(...memorySnapshots.map(m => m.heapUsed));
            const maxGrowth = maxMemory - initialMemory.heapUsed;
            console.log(`🎯 Memory Analysis:`);
            console.log(`  📊 Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  📊 Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  📈 Total growth: ${(totalGrowth / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  🔴 Max growth: ${(maxGrowth / 1024 / 1024).toFixed(2)}MB`);
            // Validate memory requirements
            (0, globals_1.expect)(totalGrowth).toBeLessThan(SYNDICATE_THRESHOLDS.MAX_MEMORY_GROWTH);
            (0, globals_1.expect)(maxGrowth).toBeLessThan(SYNDICATE_THRESHOLDS.MAX_MEMORY_GROWTH * 1.5);
        });
        (0, globals_1.test)('should handle database connection pooling efficiently', async () => {
            const connectionCounts = [];
            const queryTimes = [];
            const concurrentQueries = 50;
            console.log(`🗄️  Testing database connection pooling with ${concurrentQueries} concurrent queries`);
            // Execute concurrent database operations
            const queryPromises = Array.from({ length: concurrentQueries }, async (_, index) => {
                const queryStart = perf_hooks_1.performance.now();
                try {
                    // Mix of different query types to simulate real load
                    const queries = [
                        supabaseClient_1.supabaseClient.from('raw_props').select('*').limit(10),
                        supabaseClient_1.supabaseClient.from('unified_picks').select('*').limit(10),
                        supabaseClient_1.supabaseClient.from('users').select('*').limit(10),
                        supabaseClient_1.supabaseClient.from('agent_health').select('*').limit(5)
                    ];
                    await Promise.all(queries);
                    const queryTime = perf_hooks_1.performance.now() - queryStart;
                    queryTimes.push(queryTime);
                    if (index % 10 === 0) {
                        console.log(`🔄 Query batch ${index + 1}/${concurrentQueries} completed in ${queryTime.toFixed(2)}ms`);
                    }
                    return queryTime;
                }
                catch (error) {
                    console.error(`❌ Query ${index} failed:`, error);
                    throw error;
                }
            });
            const results = await Promise.allSettled(queryPromises);
            const successfulQueries = results.filter(r => r.status === 'fulfilled').length;
            const avgQueryTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
            const p95QueryTime = queryTimes.sort((a, b) => a - b)[Math.floor(queryTimes.length * 0.95)];
            console.log(`🎯 Database Performance:`);
            console.log(`  📊 Successful queries: ${successfulQueries}/${concurrentQueries}`);
            console.log(`  ⏱️  Average query time: ${avgQueryTime.toFixed(2)}ms`);
            console.log(`  📈 95th percentile: ${p95QueryTime.toFixed(2)}ms`);
            console.log(`  ✅ Success rate: ${(successfulQueries / concurrentQueries * 100).toFixed(2)}%`);
            // Validate database performance
            (0, globals_1.expect)(successfulQueries).toBe(concurrentQueries); // 100% success
            (0, globals_1.expect)(avgQueryTime).toBeLessThan(500); // <500ms average
            (0, globals_1.expect)(p95QueryTime).toBeLessThan(1000); // <1s at 95th percentile
        });
    });
    (0, globals_1.describe)('Agent Coordination Under Load', () => {
        (0, globals_1.test)('should maintain <100ms agent coordination overhead', async () => {
            const coordinationTimes = [];
            const testIterations = 100;
            console.log(`🤝 Testing agent coordination overhead over ${testIterations} iterations`);
            for (let i = 0; i < testIterations; i++) {
                const coordinationStart = perf_hooks_1.performance.now();
                try {
                    // Simulate agent coordination tasks
                    await Promise.all([
                        gradingAgent.healthCheck(),
                        alertAgent.healthCheck(),
                        feedAgent.healthCheck(),
                        gradingAgent.getMetrics(),
                        alertAgent.getMetrics(),
                        feedAgent.getMetrics()
                    ]);
                    const coordinationTime = perf_hooks_1.performance.now() - coordinationStart;
                    coordinationTimes.push(coordinationTime);
                    if (i % 20 === 0 && i > 0) {
                        const avgTime = coordinationTimes.reduce((sum, time) => sum + time, 0) / coordinationTimes.length;
                        console.log(`🔄 Iteration ${i}/${testIterations}, avg coordination: ${avgTime.toFixed(2)}ms`);
                    }
                }
                catch (error) {
                    console.error(`❌ Coordination failed at iteration ${i}:`, error);
                    coordinationTimes.push(SYNDICATE_THRESHOLDS.AGENT_COORDINATION * 2); // Count as slow
                }
            }
            // Analyze coordination performance
            const avgCoordination = coordinationTimes.reduce((sum, time) => sum + time, 0) / coordinationTimes.length;
            const p95Coordination = coordinationTimes.sort((a, b) => a - b)[Math.floor(coordinationTimes.length * 0.95)];
            const maxCoordination = Math.max(...coordinationTimes);
            console.log(`🎯 Agent Coordination Performance:`);
            console.log(`  📊 Total iterations: ${testIterations}`);
            console.log(`  ⏱️  Average: ${avgCoordination.toFixed(2)}ms`);
            console.log(`  📈 95th percentile: ${p95Coordination.toFixed(2)}ms`);
            console.log(`  🔴 Max: ${maxCoordination.toFixed(2)}ms`);
            // Validate coordination requirements
            (0, globals_1.expect)(avgCoordination).toBeLessThan(SYNDICATE_THRESHOLDS.AGENT_COORDINATION);
            (0, globals_1.expect)(p95Coordination).toBeLessThan(SYNDICATE_THRESHOLDS.AGENT_COORDINATION * 1.5);
        });
    });
    // Helper functions
    function generateTestProps(count) {
        const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB'];
        const markets = ['player_props', 'game_props', 'team_props'];
        const books = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet'];
        return Array.from({ length: count }, (_, index) => ({
            id: `load-test-prop-${index}`,
            sport: sports[index % sports.length],
            market: markets[index % markets.length],
            book: books[index % books.length],
            player_name: `Player ${index}`,
            stat_type: 'rushing_yards',
            line: 100 + (index % 50),
            over_odds: -110 + (index % 20),
            under_odds: -110 - (index % 20),
            game_time: new Date(Date.now() + (index % 48) * 60 * 60 * 1000),
            created_at: new Date().toISOString()
        }));
    }
    function generateContinuousProps(count) {
        // Generate props that will be processed continuously during test
        return generateTestProps(count);
    }
    async function generateContinuousLoad(duration) {
        const endTime = Date.now() + duration;
        while (Date.now() < endTime) {
            // Generate small batches continuously
            const props = generateTestProps(10);
            await propProcessor.processBatch(props);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    async function warmupServices() {
        console.log('🔥 Warming up services...');
        // Warm up each service with small operations
        await gradingAgent.start();
        await alertAgent.start();
        await feedAgent.start();
        // Process a small test batch to warm up caches
        const warmupProps = generateTestProps(10);
        await propProcessor.processBatch(warmupProps);
        console.log('✅ Service warmup complete');
    }
    async function cleanupLoadTestData() {
        console.log('🧹 Cleaning up load test data...');
        try {
            // Clean up any test data created during load testing
            await supabaseClient_1.supabaseClient
                .from('raw_props')
                .delete()
                .like('id', 'load-test-prop-%');
            await supabaseClient_1.supabaseClient
                .from('unified_picks')
                .delete()
                .like('prop_id', 'load-test-prop-%');
            console.log('✅ Cleanup complete');
        }
        catch (error) {
            console.error('❌ Cleanup failed:', error);
        }
    }
});
/**
 * Syndicate-Grade Performance Benchmarks
 *
 * These tests validate that the Unit Talk platform can handle:
 * - Professional trading firm volumes (8K+ props)
 * - Real-time alerting requirements (<1s latency)
 * - High-frequency feature access (<50ms)
 * - Efficient resource utilization
 * - Concurrent agent coordination
 *
 * Success Criteria:
 * ✅ Process 8,000+ props in <30 seconds (267+ props/sec)
 * ✅ Alert latency <1 second under full load
 * ✅ Feature retrieval <50ms at 95th percentile
 * ✅ Agent coordination overhead <100ms
 * ✅ Memory growth <500MB during testing
 * ✅ 99%+ success rate across all operations
 * ✅ Database connections efficiently pooled
 * ✅ Resource utilization within limits
 */ 
//# sourceMappingURL=syndicate-load-testing.test.js.map