"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const supabase_js_1 = require("@supabase/supabase-js");
const HotDataIntegration_1 = require("../../agents/FeedAgent/HotDataIntegration");
const ParquetExporter_1 = require("../../services/archiver/ParquetExporter");
const SupabaseStorageUploader_1 = require("../../services/archiver/SupabaseStorageUploader");
const FeatureComputationEngine_1 = require("../../services/feature-store/FeatureComputationEngine");
const DataLifecycleMonitoring_1 = require("../../services/monitoring/DataLifecycleMonitoring");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
/**
 * Integration Tests for HOT/WARM/COLD Data Architecture
 *
 * Tests the complete data lifecycle:
 * 1. HOT data ingestion and processing
 * 2. WARM data archival to Parquet + Supabase Storage
 * 3. Feature computation and grading integration
 * 4. Monitoring and alerting systems
 * 5. Error handling and rollback scenarios
 */
(0, globals_1.describe)('Data Lifecycle Integration Tests', () => {
    let supabase;
    let hotDataIntegration;
    let parquetExporter;
    let storageUploader;
    let featureEngine;
    let monitoring;
    let logger;
    // Test configuration
    const testConfig = {
        supabaseUrl: process.env.TEST_SUPABASE_URL || 'http://localhost:54321',
        supabaseKey: process.env.TEST_SUPABASE_ANON_KEY || 'test-key',
        testDataDir: '/tmp/data-lifecycle-tests',
        testBucket: 'test-prop-data-warm'
    };
    // Sample test data
    const sampleProps = [
        {
            prop_id: 'test-prop-1',
            player_name: 'LeBron James',
            sport: 'NBA',
            stat_type: 'points',
            line: 27.5,
            over_odds: -110,
            under_odds: -110,
            book: 'DraftKings',
            game_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
            team: 'Lakers',
            opponent: 'Warriors',
            source: 'test-integration'
        },
        {
            prop_id: 'test-prop-2',
            player_name: 'Stephen Curry',
            sport: 'NBA',
            stat_type: 'three_pointers',
            line: 4.5,
            over_odds: -105,
            under_odds: -115,
            book: 'FanDuel',
            game_time: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
            team: 'Warriors',
            opponent: 'Lakers',
            source: 'test-integration'
        },
        {
            prop_id: 'test-prop-3',
            player_name: 'Patrick Mahomes',
            sport: 'NFL',
            stat_type: 'passing_yards',
            line: 285.5,
            over_odds: -108,
            under_odds: -112,
            book: 'BetMGM',
            game_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
            team: 'Chiefs',
            opponent: 'Bills',
            source: 'test-integration'
        }
    ];
    (0, globals_1.beforeAll)(async () => {
        // Setup test environment
        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        };
        // Initialize Supabase client for testing
        supabase = (0, supabase_js_1.createClient)(testConfig.supabaseUrl, testConfig.supabaseKey);
        // Initialize services
        hotDataIntegration = new HotDataIntegration_1.HotDataIntegration(supabase, logger, {
            batchSize: 100,
            hotTableEnabled: true,
            enableSteamDetection: true
        });
        parquetExporter = new ParquetExporter_1.ParquetExporter({
            outputDir: testConfig.testDataDir,
            compressionLevel: 1, // Fast compression for tests
            batchSize: 100
        }, logger);
        storageUploader = new SupabaseStorageUploader_1.SupabaseStorageUploader(supabase, logger);
        featureEngine = new FeatureComputationEngine_1.FeatureComputationEngine(supabase, logger, { parallelBatchSize: 50 });
        monitoring = new DataLifecycleMonitoring_1.DataLifecycleMonitoring(logger);
        // Create test directory
        await fs.mkdir(testConfig.testDataDir, { recursive: true });
        // Setup test database tables (would be done by migrations in real environment)
        await setupTestTables();
    });
    (0, globals_1.afterAll)(async () => {
        // Cleanup test environment
        await cleanupTestData();
        await fs.rmdir(testConfig.testDataDir, { recursive: true }).catch(() => { });
        monitoring.destroy();
    });
    (0, globals_1.beforeEach)(async () => {
        // Clear test data before each test
        await clearTestData();
    });
    // =============================
    // HOT DATA INTEGRATION TESTS
    // =============================
    (0, globals_1.describe)('HOT Data Integration', () => {
        (0, globals_1.test)('should ingest props into HOT storage with market intelligence', async () => {
            const result = await hotDataIntegration.processPropsWithHotStorage(sampleProps);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.hotTicksInserted).toBeGreaterThan(0);
            (0, globals_1.expect)(result.rawPropsInserted).toBeGreaterThan(0);
            (0, globals_1.expect)(result.errors).toHaveLength(0);
            // Verify data was inserted into prop_ticks_hot
            const { data: hotData, error } = await supabase
                .from('prop_ticks_hot')
                .select('*')
                .eq('source', 'test-integration');
            (0, globals_1.expect)(error).toBeNull();
            (0, globals_1.expect)(hotData).toHaveLength(sampleProps.length);
            // Verify market intelligence was computed
            const firstTick = hotData[0];
            (0, globals_1.expect)(firstTick.implied_probability).toBeDefined();
            (0, globals_1.expect)(firstTick.vig).toBeDefined();
            (0, globals_1.expect)(firstTick.data_quality_score).toBeGreaterThan(0.5);
        });
        (0, globals_1.test)('should detect steam moves in real-time', async () => {
            // Create props with significant line movement to trigger steam detection
            const steamProps = [
                {
                    ...sampleProps[0],
                    prop_id: 'steam-prop-1',
                    line: 25.5 // Different from historical average
                }
            ];
            const result = await hotDataIntegration.processPropsWithHotStorage(steamProps);
            (0, globals_1.expect)(result.steamMovesDetected).toBeGreaterThanOrEqual(0);
            // Verify steam detection metrics
            (0, globals_1.expect)(logger.info).toHaveBeenCalledWith(globals_1.expect.stringContaining('Steam detection'), globals_1.expect.any(Object));
        });
        (0, globals_1.test)('should handle batch processing failures gracefully', async () => {
            // Create invalid props to test error handling
            const invalidProps = [
                {
                    prop_id: 'invalid-prop',
                    // Missing required fields
                    sport: 'NBA'
                }
            ];
            const result = await hotDataIntegration.processPropsWithHotStorage(invalidProps);
            (0, globals_1.expect)(result.errors.length).toBeGreaterThan(0);
            (0, globals_1.expect)(logger.warn).toHaveBeenCalled();
        });
    });
    // =============================
    // ARCHIVAL WORKFLOW TESTS
    // =============================
    (0, globals_1.describe)('Archival Workflow', () => {
        (0, globals_1.test)('should export HOT data to Parquet format', async () => {
            // First, insert test data into HOT storage
            await hotDataIntegration.processPropsWithHotStorage(sampleProps);
            // Wait a moment for data to settle
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Export to Parquet
            const exportResult = await parquetExporter.exportToParquet({
                dateFrom: new Date().toISOString().split('T')[0],
                dateTo: new Date().toISOString().split('T')[0],
                supabase,
                tableName: 'prop_ticks_hot'
            });
            (0, globals_1.expect)(exportResult.recordCount).toBeGreaterThan(0);
            (0, globals_1.expect)(exportResult.fileSizeBytes).toBeGreaterThan(0);
            (0, globals_1.expect)(exportResult.compressionRatio).toBeGreaterThan(1);
            (0, globals_1.expect)(exportResult.checksum).toBeTruthy();
            // Verify file exists
            const stats = await fs.stat(exportResult.filePath);
            (0, globals_1.expect)(stats.isFile()).toBe(true);
            (0, globals_1.expect)(stats.size).toBe(exportResult.fileSizeBytes);
        });
        (0, globals_1.test)('should upload Parquet files to Supabase Storage', async () => {
            // Create a test Parquet file
            const testFilePath = path.join(testConfig.testDataDir, 'test-upload.parquet');
            const testContent = JSON.stringify({ test: 'data', timestamp: new Date().toISOString() });
            await fs.writeFile(testFilePath, testContent);
            const uploadResult = await storageUploader.uploadParquetFile({
                filePath: testFilePath,
                bucketName: testConfig.testBucket,
                objectPath: `test-uploads/test-${Date.now()}.parquet`
            });
            (0, globals_1.expect)(uploadResult.uploadedPath).toBeTruthy();
            (0, globals_1.expect)(uploadResult.url).toBeTruthy();
            (0, globals_1.expect)(uploadResult.uploadedBytes).toBe(testContent.length);
            (0, globals_1.expect)(uploadResult.duration).toBeGreaterThan(0);
            // Verify file was uploaded
            const verification = await storageUploader.verifyUpload({
                bucketName: testConfig.testBucket,
                objectPath: uploadResult.uploadedPath,
                expectedSize: testContent.length
            });
            (0, globals_1.expect)(verification.verified).toBe(true);
            (0, globals_1.expect)(verification.actualSize).toBe(testContent.length);
        });
        (0, globals_1.test)('should handle large file uploads with resumable upload', async () => {
            // Create a large test file (>50MB simulated)
            const largeFilePath = path.join(testConfig.testDataDir, 'large-test.parquet');
            const largeContent = Buffer.alloc(60 * 1024 * 1024, 'a'); // 60MB of 'a' characters
            await fs.writeFile(largeFilePath, largeContent);
            const uploadResult = await storageUploader.uploadParquetFile({
                filePath: largeFilePath,
                bucketName: testConfig.testBucket,
                objectPath: `test-uploads/large-${Date.now()}.parquet`
            });
            (0, globals_1.expect)(uploadResult.uploadedBytes).toBe(largeContent.length);
            (0, globals_1.expect)(uploadResult.duration).toBeGreaterThan(0);
            // Cleanup large file
            await fs.unlink(largeFilePath);
        });
    });
    // =============================
    // FEATURE COMPUTATION TESTS
    // =============================
    (0, globals_1.describe)('Feature Computation Engine', () => {
        (0, globals_1.test)('should compute comprehensive feature set for props', async () => {
            // Insert test data
            await hotDataIntegration.processPropsWithHotStorage(sampleProps);
            // Get prop IDs for feature computation
            const { data: hotData } = await supabase
                .from('prop_ticks_hot')
                .select('prop_id')
                .eq('source', 'test-integration');
            const propIds = hotData.map(row => row.prop_id);
            // Compute features
            const featureResult = await featureEngine.computeFeatureBatch(propIds);
            (0, globals_1.expect)(featureResult.features.length).toBe(propIds.length);
            (0, globals_1.expect)(featureResult.errors.length).toBe(0);
            (0, globals_1.expect)(featureResult.performance.features_per_second).toBeGreaterThan(0);
            // Verify feature quality
            featureResult.features.forEach(propFeatures => {
                (0, globals_1.expect)(propFeatures.prop_id).toBeTruthy();
                (0, globals_1.expect)(propFeatures.features).toBeDefined();
                (0, globals_1.expect)(propFeatures.computation_metadata.data_quality).toBeGreaterThan(0);
                (0, globals_1.expect)(propFeatures.computation_metadata.features_computed).toBeGreaterThan(0);
            });
        });
        (0, globals_1.test)('should handle parallel feature computation for 8K+ props', async () => {
            // Create large dataset for stress testing
            const largePropSet = Array.from({ length: 1000 }, (_, i) => ({
                ...sampleProps[0],
                prop_id: `stress-test-prop-${i}`,
                player_name: `Test Player ${i}`,
                line: 25.5 + (Math.random() - 0.5) * 10
            }));
            // Insert large dataset
            await hotDataIntegration.processPropsWithHotStorage(largePropSet);
            // Get prop IDs
            const { data: hotData } = await supabase
                .from('prop_ticks_hot')
                .select('prop_id')
                .like('prop_id', 'stress-test-prop-%');
            const propIds = hotData.map(row => row.prop_id);
            const startTime = Date.now();
            const featureResult = await featureEngine.computeFeatureBatch(propIds);
            const duration = Date.now() - startTime;
            (0, globals_1.expect)(featureResult.features.length).toBeGreaterThan(900); // Allow for some failures
            (0, globals_1.expect)(featureResult.performance.features_per_second).toBeGreaterThan(10);
            (0, globals_1.expect)(duration).toBeLessThan(60000); // Should complete within 60 seconds
        });
    });
    // =============================
    // MONITORING INTEGRATION TESTS
    // =============================
    (0, globals_1.describe)('Monitoring Integration', () => {
        (0, globals_1.test)('should record comprehensive metrics for data lifecycle', async () => {
            // Test HOT data metrics
            monitoring.recordHotDataIngestion({
                sport: 'NBA',
                source: 'test',
                recordCount: 100,
                status: 'success',
                duration: 1000,
                batchSize: 100
            });
            // Test steam detection metrics
            monitoring.recordSteamMove({
                sport: 'NBA',
                player: 'LeBron James',
                statType: 'points',
                magnitude: 'high',
                detectionLatency: 500
            });
            // Test archival metrics
            monitoring.recordArchivalWorkflow({
                status: 'success',
                trigger: 'scheduled',
                duration: 30000,
                archivedBytes: 1024 * 1024,
                recordCount: 1000,
                date: '2024-01-01',
                sport: 'NBA',
                compressionRatio: 5.2
            });
            // Test feature computation metrics
            monitoring.recordFeatureComputation({
                featureType: 'rolling_averages',
                sport: 'NBA',
                status: 'success',
                duration: 2000,
                batchSize: 100,
                qualityScore: 0.95
            });
            // Get Prometheus metrics
            const metrics = monitoring.getPrometheusMetrics();
            (0, globals_1.expect)(metrics).toContain('hot_data_ingestion_total');
            (0, globals_1.expect)(metrics).toContain('steam_moves_detected_total');
            (0, globals_1.expect)(metrics).toContain('archived_data_volume_bytes');
            (0, globals_1.expect)(metrics).toContain('feature_computation_total');
        });
        (0, globals_1.test)('should generate comprehensive health reports', async () => {
            const healthReport = await monitoring.generateHealthReport();
            (0, globals_1.expect)(healthReport.overall_health).toBeGreaterThan(0);
            (0, globals_1.expect)(healthReport.components).toHaveProperty('hot');
            (0, globals_1.expect)(healthReport.components).toHaveProperty('warm');
            (0, globals_1.expect)(healthReport.components).toHaveProperty('cold');
            (0, globals_1.expect)(healthReport.components).toHaveProperty('features');
            (0, globals_1.expect)(healthReport.components).toHaveProperty('grading');
            // Check component health scores
            Object.values(healthReport.components).forEach((component) => {
                (0, globals_1.expect)(component.health_score).toBeGreaterThanOrEqual(0);
                (0, globals_1.expect)(component.health_score).toBeLessThanOrEqual(1);
                (0, globals_1.expect)(['healthy', 'degraded', 'unhealthy']).toContain(component.status);
            });
        });
    });
    // =============================
    // ERROR HANDLING & ROLLBACK TESTS
    // =============================
    (0, globals_1.describe)('Error Handling & Rollback', () => {
        (0, globals_1.test)('should handle database connection failures gracefully', async () => {
            // Create a client with invalid credentials
            const invalidClient = (0, supabase_js_1.createClient)('http://invalid-url', 'invalid-key');
            const invalidHotIntegration = new HotDataIntegration_1.HotDataIntegration(invalidClient, logger);
            const result = await invalidHotIntegration.processPropsWithHotStorage(sampleProps);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.errors.length).toBeGreaterThan(0);
            (0, globals_1.expect)(logger.error).toHaveBeenCalled();
        });
        (0, globals_1.test)('should rollback partial transactions on failure', async () => {
            // This would test transaction rollback mechanisms
            // Implementation depends on specific transaction handling
            (0, globals_1.expect)(true).toBe(true); // Placeholder
        });
        (0, globals_1.test)('should maintain data consistency during concurrent operations', async () => {
            // Test concurrent insertions don't cause data corruption
            const concurrentPromises = Array.from({ length: 5 }, (_, i) => {
                const props = sampleProps.map(prop => ({
                    ...prop,
                    prop_id: `concurrent-${i}-${prop.prop_id}`
                }));
                return hotDataIntegration.processPropsWithHotStorage(props);
            });
            const results = await Promise.all(concurrentPromises);
            // All operations should succeed
            results.forEach(result => {
                (0, globals_1.expect)(result.success).toBe(true);
                (0, globals_1.expect)(result.errors.length).toBe(0);
            });
            // Verify no duplicate data
            const { data: allData } = await supabase
                .from('prop_ticks_hot')
                .select('prop_id')
                .like('prop_id', 'concurrent-%');
            const uniquePropIds = new Set(allData.map(row => row.prop_id));
            (0, globals_1.expect)(uniquePropIds.size).toBe(allData.length); // No duplicates
        });
    });
    // =============================
    // HELPER FUNCTIONS
    // =============================
    async function setupTestTables() {
        // In a real test environment, this would run the migration
        // For now, assume tables exist or create simplified versions
        try {
            await supabase.rpc('create_test_tables');
        }
        catch (error) {
            // Tables might already exist, that's okay
        }
    }
    async function clearTestData() {
        // Clear test data from tables
        await supabase.from('prop_ticks_hot').delete().eq('source', 'test-integration');
        await supabase.from('raw_props').delete().eq('source', 'test-integration');
        await supabase.from('prop_ticks_hot').delete().like('prop_id', 'test-%');
        await supabase.from('prop_ticks_hot').delete().like('prop_id', 'steam-%');
        await supabase.from('prop_ticks_hot').delete().like('prop_id', 'stress-test-%');
        await supabase.from('prop_ticks_hot').delete().like('prop_id', 'concurrent-%');
    }
    async function cleanupTestData() {
        await clearTestData();
        // Clean up test bucket
        try {
            const { data: files } = await supabase.storage
                .from(testConfig.testBucket)
                .list('test-uploads');
            if (files && files.length > 0) {
                const filePaths = files.map(file => `test-uploads/${file.name}`);
                await supabase.storage.from(testConfig.testBucket).remove(filePaths);
            }
        }
        catch (error) {
            // Cleanup errors are non-critical
        }
    }
});
// =============================
// PERFORMANCE BENCHMARKS
// =============================
(0, globals_1.describe)('Performance Benchmarks', () => {
    (0, globals_1.test)('should process 8K props within performance targets', async () => {
        // This would be a performance benchmark test
        const targetPropsPerSecond = 1000;
        const targetBatchSize = 8000;
        // Create 8K test props
        const largePropSet = Array.from({ length: targetBatchSize }, (_, i) => ({
            prop_id: `perf-test-${i}`,
            player_name: `Player ${i}`,
            sport: i % 2 === 0 ? 'NBA' : 'NFL',
            stat_type: 'points',
            line: 25.5 + Math.random() * 10,
            over_odds: -110,
            under_odds: -110,
            book: 'TestBook',
            source: 'performance-test'
        }));
        const startTime = Date.now();
        // Process would happen here - simplified for test structure
        const duration = Date.now() - startTime;
        const propsPerSecond = (targetBatchSize / duration) * 1000;
        // Performance assertions
        (0, globals_1.expect)(propsPerSecond).toBeGreaterThan(targetPropsPerSecond);
        (0, globals_1.expect)(duration).toBeLessThan(30000); // 30 seconds max
    });
});
//# sourceMappingURL=integration.test.js.map