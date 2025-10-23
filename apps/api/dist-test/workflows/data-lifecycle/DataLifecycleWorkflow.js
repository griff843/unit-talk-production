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
exports.DataLifecycleWorkflow = DataLifecycleWorkflow;
exports.ScheduledDataLifecycleWorkflow = ScheduledDataLifecycleWorkflow;
exports.EmergencyDataLifecycleWorkflow = EmergencyDataLifecycleWorkflow;
const workflow_1 = require("@temporalio/workflow");
const wf = __importStar(require("@temporalio/workflow"));
// Configure activities for data lifecycle management
const activities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '20 minutes', // Long-running archival operations
    heartbeatTimeout: '2 minutes', // Progress heartbeats
    scheduleToStartTimeout: '1 minute' // Quick startup
});
/**
 * DataLifecycleWorkflow - Enterprise Data Lifecycle Management
 *
 * Manages HOT → WARM → COLD data archival with enterprise features:
 * - Automated archiving with compression (5-20x reduction)
 * - Data integrity validation and corruption detection
 * - Storage optimization and cost management
 * - Compliance and retention policy enforcement
 * - Performance monitoring and alerting
 *
 * HOT Tier: 7-14 days (PostgreSQL partitioned, sub-second queries)
 * WARM Tier: 2-6 months (Parquet compressed, <5 second queries)
 * COLD Tier: 7+ years (S3 Glacier, compliance archive)
 */
async function DataLifecycleWorkflow(params) {
    const startTime = Date.now();
    const workflowId = wf.workflowInfo().workflowId;
    // Initialize result tracking
    let result = {
        success: false,
        operation: params.operation,
        results: {},
        alerts: [],
        duration: 0,
        errors: []
    };
    try {
        wf.log.info('🗄️ DataLifecycleWorkflow started', {
            workflowId,
            operation: params.operation,
            params,
            scheduledAt: new Date().toISOString()
        });
        // ================================
        // 1. PARAMETER SETUP
        // ================================
        const batchSize = params.batchSize || 10000;
        const compressionType = params.compressionType || 'parquet';
        const storageClass = params.storageClass || 'STANDARD_IA';
        const dryRun = params.dryRun || false;
        // Default retention policies
        const retentionPolicies = {
            hotRetentionDays: params.retentionPolicies?.hotRetentionDays || 14,
            warmRetentionDays: params.retentionPolicies?.warmRetentionDays || 180,
            coldRetentionYears: params.retentionPolicies?.coldRetentionYears || 7
        };
        const validationOptions = {
            checksumValidation: params.validationOptions?.checksumValidation || true,
            samplePercentage: params.validationOptions?.samplePercentage || 5.0
        };
        wf.log.info('📊 Lifecycle parameters validated', {
            operation: params.operation,
            batchSize,
            compressionType,
            storageClass,
            retentionPolicies,
            validationOptions,
            dryRun
        });
        // ================================
        // 2. EXECUTE LIFECYCLE OPERATION
        // ================================
        switch (params.operation) {
            case 'archive_hot_to_warm':
                await executeHotToWarmArchival();
                break;
            case 'archive_warm_to_cold':
                await executeWarmToColdArchival();
                break;
            case 'cleanup_expired':
                await executeExpiredCleanup();
                break;
            case 'validate_integrity':
                await executeIntegrityValidation();
                break;
            case 'optimize_storage':
                await executeStorageOptimization();
                break;
            case 'full_lifecycle':
                await executeFullLifecycle();
                break;
            default:
                throw new Error(`Unknown lifecycle operation: ${params.operation}`);
        }
        // ================================
        // OPERATION IMPLEMENTATIONS
        // ================================
        async function executeHotToWarmArchival() {
            wf.log.info('🔥➡️❄️ Executing HOT to WARM archival');
            const archiveResult = await activities.archiveHotToWarm({
                batchSize,
                compressionType,
                retentionDays: retentionPolicies.hotRetentionDays
            });
            result.results = {
                archivedRecords: archiveResult.archivedRecords,
                compressionRatio: archiveResult.compressionRatio,
                spaceSaved: archiveResult.archiveSize
            };
            // Generate alerts based on archival results
            if (archiveResult.compressionRatio > 10) {
                result.alerts.push({
                    type: 'excellent_compression',
                    message: `Excellent compression ratio: ${archiveResult.compressionRatio.toFixed(1)}x`,
                    severity: 'low'
                });
                await activities.sendLifecycleAlert({
                    alertType: 'archive_complete',
                    message: `HOT to WARM archival completed with ${archiveResult.compressionRatio.toFixed(1)}x compression`,
                    details: archiveResult,
                    priority: 'low'
                });
            }
            wf.log.info('✅ HOT to WARM archival completed', {
                archivedRecords: archiveResult.archivedRecords,
                compressionRatio: archiveResult.compressionRatio,
                duration: archiveResult.duration
            });
        }
        async function executeWarmToColdArchival() {
            wf.log.info('❄️➡️🧊 Executing WARM to COLD archival');
            const archiveResult = await activities.archiveWarmToCold({
                batchSize,
                storageClass,
                retentionYears: retentionPolicies.coldRetentionYears
            });
            result.results = {
                archivedRecords: archiveResult.archivedRecords,
                spaceSaved: archiveResult.coldStorageSize,
                estimatedSavings: archiveResult.estimatedMonthlyCost
            };
            // Alert on significant cost savings
            if (archiveResult.estimatedMonthlyCost < 50) {
                result.alerts.push({
                    type: 'cost_optimization',
                    message: `Low monthly storage cost: $${archiveResult.estimatedMonthlyCost.toFixed(2)}`,
                    severity: 'low'
                });
            }
            wf.log.info('✅ WARM to COLD archival completed', {
                archivedRecords: archiveResult.archivedRecords,
                estimatedMonthlyCost: archiveResult.estimatedMonthlyCost,
                duration: archiveResult.duration
            });
        }
        async function executeExpiredCleanup() {
            wf.log.info('🧹 Executing expired data cleanup');
            const cleanupResult = await activities.cleanupExpiredData({
                hotRetentionDays: retentionPolicies.hotRetentionDays,
                warmRetentionDays: retentionPolicies.warmRetentionDays,
                coldRetentionYears: retentionPolicies.coldRetentionYears,
                dryRun
            });
            result.results = {
                archivedRecords: cleanupResult.expiredHotRecords + cleanupResult.expiredWarmRecords + cleanupResult.expiredColdRecords,
                spaceSaved: cleanupResult.spaceSaved,
                estimatedSavings: cleanupResult.estimatedSavings
            };
            // Alert on significant cleanup
            if (cleanupResult.estimatedSavings > 100) {
                result.alerts.push({
                    type: 'significant_cleanup',
                    message: `Significant storage savings: $${cleanupResult.estimatedSavings.toFixed(2)}/month`,
                    severity: 'medium'
                });
                await activities.sendLifecycleAlert({
                    alertType: 'storage_optimization',
                    message: `Data cleanup completed with $${cleanupResult.estimatedSavings.toFixed(2)}/month savings`,
                    details: cleanupResult,
                    priority: 'medium'
                });
            }
            wf.log.info('✅ Expired data cleanup completed', cleanupResult);
        }
        async function executeIntegrityValidation() {
            wf.log.info('🔍 Executing data integrity validation');
            const validationResult = await activities.validateDataIntegrity({
                validateTiers: ['hot', 'warm', 'cold'],
                checksumValidation: validationOptions.checksumValidation,
                samplePercentage: validationOptions.samplePercentage
            });
            result.results = {
                integrityScore: validationResult.overallScore
            };
            // Alert on integrity issues
            if (validationResult.corruptedRecords.length > 0) {
                result.alerts.push({
                    type: 'integrity_issues',
                    message: `${validationResult.corruptedRecords.length} corrupted records detected`,
                    severity: 'high'
                });
                await activities.sendLifecycleAlert({
                    alertType: 'integrity_issue',
                    message: `Data integrity issues detected: ${validationResult.corruptedRecords.length} corrupted records`,
                    details: validationResult,
                    priority: 'high'
                });
            }
            else if (validationResult.overallScore > 0.99) {
                result.alerts.push({
                    type: 'excellent_integrity',
                    message: `Excellent data integrity: ${(validationResult.overallScore * 100).toFixed(2)}%`,
                    severity: 'low'
                });
            }
            wf.log.info('✅ Data integrity validation completed', {
                overallScore: validationResult.overallScore,
                corruptedRecords: validationResult.corruptedRecords.length
            });
        }
        async function executeStorageOptimization() {
            wf.log.info('⚡ Executing storage optimization');
            const optimizationResult = await activities.optimizeStorageLayout({
                targetTier: 'hot', // Focus on hot tier performance
                optimizationType: 'all'
            });
            result.results = {
                performanceImprovement: optimizationResult.performanceImprovement,
                spaceSaved: `${optimizationResult.storageReduction}%`,
                estimatedSavings: optimizationResult.estimatedSavings
            };
            // Alert on significant optimizations
            if (optimizationResult.performanceImprovement > 20) {
                result.alerts.push({
                    type: 'performance_boost',
                    message: `Significant performance improvement: ${optimizationResult.performanceImprovement.toFixed(1)}%`,
                    severity: 'medium'
                });
            }
            wf.log.info('✅ Storage optimization completed', optimizationResult);
        }
        async function executeFullLifecycle() {
            wf.log.info('🔄 Executing full lifecycle management');
            // Execute all operations in sequence
            await executeHotToWarmArchival();
            await executeWarmToColdArchival();
            await executeExpiredCleanup();
            await executeIntegrityValidation();
            await executeStorageOptimization();
            result.alerts.push({
                type: 'full_lifecycle_complete',
                message: 'Complete lifecycle management executed successfully',
                severity: 'low'
            });
        }
        // ================================
        // 3. GENERATE LIFECYCLE METRICS
        // ================================
        const metricsResult = await activities.generateLifecycleMetrics({
            timeRange: '24h',
            includeProjections: true
        });
        // Alert on capacity warnings
        const hotTierUsage = metricsResult.hotTierMetrics.totalRecords;
        if (hotTierUsage > 50000000) { // 50M records threshold
            result.alerts.push({
                type: 'capacity_warning',
                message: `HOT tier approaching capacity: ${(hotTierUsage / 1000000).toFixed(1)}M records`,
                severity: 'medium'
            });
            await activities.sendLifecycleAlert({
                alertType: 'capacity_warning',
                message: `HOT tier capacity warning: ${(hotTierUsage / 1000000).toFixed(1)}M records`,
                details: metricsResult.hotTierMetrics,
                priority: 'medium'
            });
        }
        // ================================
        // 4. SUCCESS COMPLETION
        // ================================
        result.success = result.errors.length === 0;
        result.duration = Date.now() - startTime;
        wf.log.info('🎉 DataLifecycleWorkflow completed', {
            workflowId,
            operation: params.operation,
            success: result.success,
            results: result.results,
            alerts: result.alerts.length,
            duration: result.duration,
            dryRun
        });
        return result;
    }
    catch (error) {
        // ================================
        // ERROR HANDLING
        // ================================
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(errorMessage);
        result.duration = Date.now() - startTime;
        wf.log.error('❌ DataLifecycleWorkflow failed', {
            workflowId,
            operation: params.operation,
            error: errorMessage,
            duration: result.duration,
            params
        });
        await activities.sendLifecycleAlert({
            alertType: 'integrity_issue',
            message: 'Data lifecycle workflow failed',
            details: {
                workflowId,
                operation: params.operation,
                error: errorMessage,
                duration: result.duration,
                params
            },
            priority: 'critical'
        });
        return result;
    }
}
/**
 * Scheduled DataLifecycleWorkflow - Runs daily at 2 AM for archival
 *
 * Optimized for enterprise data management:
 * - HOT to WARM archival (daily)
 * - WARM to COLD archival (weekly)
 * - Data integrity validation (daily)
 * - Storage optimization (weekly)
 */
async function ScheduledDataLifecycleWorkflow() {
    wf.log.info('⏰ Scheduled DataLifecycleWorkflow triggered at 2 AM');
    try {
        const today = new Date();
        const isWeekly = today.getDay() === 1; // Monday for weekly operations
        // Daily HOT to WARM archival
        const hotToWarmResult = await DataLifecycleWorkflow({
            operation: 'archive_hot_to_warm',
            batchSize: 10000,
            compressionType: 'parquet',
            dryRun: false
        });
        if (!hotToWarmResult.success) {
            throw new Error(`HOT to WARM archival failed: ${hotToWarmResult.errors.join(', ')}`);
        }
        // Weekly WARM to COLD archival
        if (isWeekly) {
            const warmToColdResult = await DataLifecycleWorkflow({
                operation: 'archive_warm_to_cold',
                batchSize: 5000,
                storageClass: 'STANDARD_IA',
                dryRun: false
            });
            if (!warmToColdResult.success) {
                wf.log.warn('⚠️ WARM to COLD archival failed', { errors: warmToColdResult.errors });
            }
            // Weekly storage optimization
            const optimizationResult = await DataLifecycleWorkflow({
                operation: 'optimize_storage',
                dryRun: false
            });
            if (!optimizationResult.success) {
                wf.log.warn('⚠️ Storage optimization failed', { errors: optimizationResult.errors });
            }
        }
        // Daily integrity validation
        const integrityResult = await DataLifecycleWorkflow({
            operation: 'validate_integrity',
            validationOptions: {
                checksumValidation: true,
                samplePercentage: 1.0 // 1% daily sample
            },
            dryRun: false
        });
        if (!integrityResult.success) {
            wf.log.warn('⚠️ Data integrity validation failed', { errors: integrityResult.errors });
        }
        wf.log.info('✅ Scheduled DataLifecycleWorkflow completed', {
            hotToWarmResult: hotToWarmResult.results,
            weeklyOperationsExecuted: isWeekly,
            integrityScore: integrityResult.results.integrityScore
        });
    }
    catch (error) {
        wf.log.error('❌ Scheduled DataLifecycleWorkflow failed', {
            error: error instanceof Error ? error.message : String(error)
        });
        throw error; // Trigger Temporal retry
    }
}
/**
 * Emergency DataLifecycleWorkflow - Triggered by capacity alerts
 *
 * Fast archival for emergency scenarios:
 * - Rapid HOT tier archival when capacity exceeded
 * - Aggressive compression and optimization
 * - Emergency cleanup of expired data
 */
async function EmergencyDataLifecycleWorkflow(params) {
    wf.log.info('🚨 Emergency DataLifecycleWorkflow triggered', {
        priority: params.priority,
        operation: params.operation
    });
    try {
        if (params.operation === 'emergency_archive') {
            // Aggressive archival with maximum compression
            const result = await DataLifecycleWorkflow({
                operation: 'archive_hot_to_warm',
                batchSize: 50000, // Larger batches for speed
                compressionType: 'parquet', // Best compression
                retentionPolicies: {
                    hotRetentionDays: 7 // Shorter retention for emergency
                },
                dryRun: false
            });
            if (!result.success && params.priority === 'critical') {
                throw new Error(`Emergency archival failed: ${result.errors.join(', ')}`);
            }
        }
        if (params.operation === 'emergency_cleanup') {
            // Aggressive cleanup of expired data
            const result = await DataLifecycleWorkflow({
                operation: 'cleanup_expired',
                retentionPolicies: {
                    hotRetentionDays: 7,
                    warmRetentionDays: 90,
                    coldRetentionYears: 5
                },
                dryRun: false
            });
            if (!result.success && params.priority === 'critical') {
                throw new Error(`Emergency cleanup failed: ${result.errors.join(', ')}`);
            }
        }
    }
    catch (error) {
        wf.log.error('❌ Emergency DataLifecycleWorkflow failed', {
            error: error instanceof Error ? error.message : String(error),
            priority: params.priority,
            operation: params.operation
        });
        if (params.priority === 'critical') {
            throw error;
        }
    }
}
//# sourceMappingURL=DataLifecycleWorkflow.js.map