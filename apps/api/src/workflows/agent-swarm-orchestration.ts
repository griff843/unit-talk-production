import { proxyActivities, sleep } from '@temporalio/workflow';
import type {
  PipelineOrchestratorActivities,
  ScoringCoordinatorActivities,
  PromotionAgentActivities,
  HealthMonitorActivities,
  WorkflowTriggerActivities
} from '../types/activities';

// Create proxies for agent swarm activities with optimized timeouts
const pipelineOrchestrator = proxyActivities<PipelineOrchestratorActivities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    initialInterval: '10 seconds',
    maximumInterval: '1 minute',
    backoffCoefficient: 2,
    maximumAttempts: 3
  }
});

const scoringCoordinator = proxyActivities<ScoringCoordinatorActivities>({
  startToCloseTimeout: '5 minutes', // Longer timeout for scoring operations
  retry: {
    initialInterval: '15 seconds',
    maximumInterval: '2 minutes',
    backoffCoefficient: 2,
    maximumAttempts: 3
  }
});

const promotionAgent = proxyActivities<PromotionAgentActivities>({
  startToCloseTimeout: '1 minute',
  retry: {
    initialInterval: '5 seconds',
    maximumInterval: '30 seconds',
    backoffCoefficient: 2,
    maximumAttempts: 3
  }
});

const healthMonitor = proxyActivities<HealthMonitorActivities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    initialInterval: '5 seconds',
    maximumInterval: '15 seconds',
    backoffCoefficient: 2,
    maximumAttempts: 2
  }
});

const workflowTrigger = proxyActivities<WorkflowTriggerActivities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    initialInterval: '5 seconds',
    maximumInterval: '15 seconds',
    backoffCoefficient: 2,
    maximumAttempts: 2
  }
});

export interface PipelineOrchestrationConfig {
  batchSize?: number;
  maxConcurrentBatches?: number;
  enableCircuitBreaker?: boolean;
  healthCheckInterval?: number;
  retryFailedProps?: boolean;
}

export interface ProcessingMetrics {
  propsProcessed: number;
  propsScored: number;
  propsPromoted: number;
  totalProcessingTimeMs: number;
  errorCount: number;
  circuitBreakerTrips: number;
}

/**
 * Main Pipeline Orchestration Workflow
 * 
 * Coordinates the entire agent swarm to process raw props through to unified picks
 * Handles the 742K props volume with proper orchestration and resilience
 */
export async function pipelineOrchestrationWorkflow(
  config: PipelineOrchestrationConfig = {}
): Promise<ProcessingMetrics> {
  const startTime = Date.now();
  const metrics: ProcessingMetrics = {
    propsProcessed: 0,
    propsScored: 0,
    propsPromoted: 0,
    totalProcessingTimeMs: 0,
    errorCount: 0,
    circuitBreakerTrips: 0
  };

  try {
    console.log('🚀 Starting Pipeline Orchestration Workflow', { config });

    // 1. Health Check - Verify all agents are healthy before processing
    const initialHealthCheck = await healthMonitor.performSystemHealthCheck();
    if (initialHealthCheck.status !== 'healthy') {
      console.warn('⚠️ System health degraded, proceeding with caution', initialHealthCheck);
    }

    // 2. Detect and batch new props for processing
    const detectionResult = await pipelineOrchestrator.detectNewProps({
      batchSize: config.batchSize || 50,
      enableValidation: true
    });

    if (detectionResult.totalProps === 0) {
      console.log('📭 No new props detected for processing');
      return metrics;
    }

    console.log(`📊 Detected ${detectionResult.totalProps} props in ${detectionResult.batches.length} batches`);
    metrics.propsProcessed = detectionResult.totalProps;

    // 3. Process batches with coordinated agent swarm
    for (let i = 0; i < detectionResult.batches.length; i++) {
      const batch = detectionResult.batches[i];
      const batchStartTime = Date.now();

      try {
        console.log(`🎯 Processing batch ${i + 1}/${detectionResult.batches.length} (${batch.props.length} props)`);

        // Check circuit breaker before processing
        if (config.enableCircuitBreaker) {
          const circuitBreakerStatus = await healthMonitor.checkCircuitBreakers();
          if (circuitBreakerStatus.openBreakers.length > 0) {
            console.warn('⚡ Circuit breakers open, applying backpressure', circuitBreakerStatus);
            await sleep('30 seconds'); // Wait for recovery
            metrics.circuitBreakerTrips++;
          }
        }

        // 3.1. Score props through Enhanced45FactorEngine
        const scoringResult = await scoringCoordinator.scoreBatch({
          batchId: batch.batchId,
          props: batch.props,
          useEnhanced45Factor: true,
          parallelProcessing: true
        });

        console.log(`✅ Batch ${i + 1} scoring completed`, {
          propsScored: scoringResult.results.length,
          averageScore: scoringResult.averageScore,
          tierDistribution: scoringResult.tierDistribution
        });

        metrics.propsScored += scoringResult.results.length;

        // 3.2. Evaluate and promote qualified props
        const promotionResult = await promotionAgent.evaluateAndPromote({
          scoringResults: scoringResult.results,
          applyDiversificationRules: true,
          checkDailyQuotas: true
        });

        console.log(`🚀 Batch ${i + 1} promotion completed`, {
          propsPromoted: promotionResult.promoted.length,
          propsRejected: promotionResult.rejected.length,
          promotionRate: promotionResult.metrics.promotionRate
        });

        metrics.propsPromoted += promotionResult.promoted.length;

        // 3.3. Update pipeline health metrics
        await healthMonitor.recordBatchProcessing({
          batchId: batch.batchId,
          processingTimeMs: Date.now() - batchStartTime,
          propsProcessed: batch.props.length,
          successfulProps: scoringResult.results.filter(r => r.processed).length,
          errors: scoringResult.results.filter(r => r.error).length
        });

        // Small delay between batches to prevent overwhelming the system
        if (i < detectionResult.batches.length - 1) {
          await sleep('2 seconds');
        }

      } catch (batchError) {
        metrics.errorCount++;
        console.error(`❌ Batch ${i + 1} processing failed`, batchError);

        // Handle batch failure - mark props for retry
        if (config.retryFailedProps) {
          await pipelineOrchestrator.schedulePropsForRetry({
            batchId: batch.batchId,
            props: batch.props,
            error: batchError instanceof Error ? batchError.message : 'Unknown error'
          });
        }

        // Continue with next batch unless it's a critical failure
        if (batchError instanceof Error && batchError.message.includes('CRITICAL')) {
          throw batchError;
        }
      }
    }

    // 4. Final health check and metrics update
    const finalHealthCheck = await healthMonitor.performSystemHealthCheck();
    console.log('🏥 Final system health check', finalHealthCheck);

    metrics.totalProcessingTimeMs = Date.now() - startTime;

    console.log('✅ Pipeline Orchestration Workflow completed successfully', metrics);

    return metrics;

  } catch (error) {
    metrics.errorCount++;
    metrics.totalProcessingTimeMs = Date.now() - startTime;
    
    console.error('❌ Pipeline Orchestration Workflow failed', error);
    
    // Send critical failure alert
    await healthMonitor.sendCriticalAlert({
      alertType: 'pipeline_orchestration_failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      metrics
    });

    throw error;
  }
}

/**
 * Continuous Pipeline Monitoring Workflow
 * 
 * Runs continuously to ensure the pipeline is always processing props
 * Implements the "always-on" nature required for 742K props volume
 */
export async function continuousPipelineMonitoringWorkflow(): Promise<void> {
  console.log('🔄 Starting Continuous Pipeline Monitoring Workflow');

  while (true) {
    try {
      // Check if pipeline orchestration is needed
      const pipelineStatus = await pipelineOrchestrator.getPipelineStatus();
      
      if (pipelineStatus.needsProcessing) {
        console.log('🚀 Triggering pipeline orchestration due to pending props');
        
        // Trigger the main pipeline workflow
        await workflowTrigger.triggerWorkflow({
          workflowId: 'pipeline-orchestration',
          data: {
            trigger: 'continuous_monitoring',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Check system health
      const healthStatus = await healthMonitor.performSystemHealthCheck();
      if (healthStatus.status === 'unhealthy') {
        console.warn('🚨 System health is unhealthy, triggering recovery workflow');
        
        await workflowTrigger.triggerWorkflow({
          workflowId: 'system-recovery',
          data: { healthStatus }
        });
      }

      // Wait before next check (30 seconds)
      await sleep('30 seconds');

    } catch (error) {
      console.error('❌ Continuous monitoring error', error);
      
      // Send alert and wait before retrying
      await healthMonitor.sendAlert({
        alertType: 'continuous_monitoring_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      await sleep('1 minute');
    }
  }
}

/**
 * System Recovery Workflow
 * 
 * Handles system recovery when health checks fail
 * Implements circuit breaker patterns and graceful degradation
 */
export async function systemRecoveryWorkflow(healthStatus: any): Promise<void> {
  console.log('🏥 Starting System Recovery Workflow', healthStatus);

  try {
    // 1. Identify failing components
    const failedServices = healthStatus.details?.checks
      ?.filter((check: any) => check.status === 'unhealthy')
      ?.map((check: any) => check.service) || [];

    console.log('🔍 Identified failed services', failedServices);

    // 2. Apply circuit breakers to failed services
    for (const service of failedServices) {
      await healthMonitor.openCircuitBreaker({
        serviceName: service,
        reason: 'system_recovery_workflow'
      });
    }

    // 3. Attempt graceful recovery
    for (const service of failedServices) {
      try {
        console.log(`🔧 Attempting recovery for ${service}`);
        
        await healthMonitor.attemptServiceRecovery({
          serviceName: service,
          recoveryStrategy: 'restart_connections'
        });

        // Wait for recovery
        await sleep('30 seconds');

        // Test service health
        const serviceHealth = await healthMonitor.checkServiceHealth({ serviceName: service });
        
        if (serviceHealth.status === 'healthy') {
          console.log(`✅ Service ${service} recovered successfully`);
          
          await healthMonitor.closeCircuitBreaker({
            serviceName: service,
            reason: 'successful_recovery'
          });
        } else {
          console.warn(`⚠️ Service ${service} recovery incomplete`);
        }

      } catch (recoveryError) {
        console.error(`❌ Recovery failed for ${service}`, recoveryError);
      }
    }

    // 4. Verify overall system health
    const postRecoveryHealth = await healthMonitor.performSystemHealthCheck();
    console.log('🏥 Post-recovery health check', postRecoveryHealth);

    if (postRecoveryHealth.status === 'healthy') {
      console.log('✅ System recovery completed successfully');
    } else {
      console.warn('⚠️ System recovery partially successful - some issues remain');
    }

  } catch (error) {
    console.error('❌ System Recovery Workflow failed', error);
    
    // Send critical alert for recovery failure
    await healthMonitor.sendCriticalAlert({
      alertType: 'system_recovery_failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      originalHealthStatus: healthStatus
    });

    throw error;
  }
}

/**
 * Performance Optimization Workflow
 * 
 * Analyzes and optimizes pipeline performance for better throughput
 * Essential for handling 742K props efficiently
 */
export async function performanceOptimizationWorkflow(): Promise<void> {
  console.log('⚡ Starting Performance Optimization Workflow');

  try {
    // 1. Collect performance metrics from all agents
    const pipelineMetrics = await pipelineOrchestrator.getPerformanceMetrics();
    const scoringMetrics = await scoringCoordinator.getPerformanceMetrics();
    const promotionMetrics = await promotionAgent.getPerformanceMetrics();

    console.log('📊 Collected performance metrics', {
      pipeline: pipelineMetrics.summary,
      scoring: scoringMetrics.summary,
      promotion: promotionMetrics.summary
    });

    // 2. Analyze bottlenecks
    const bottlenecks = [];

    if (pipelineMetrics.averageProcessingTimeMs > 60000) { // > 1 minute
      bottlenecks.push('pipeline_processing_slow');
    }

    if (scoringMetrics.averageProcessingTimeMs > 30000) { // > 30 seconds
      bottlenecks.push('scoring_processing_slow');
    }

    if (promotionMetrics.promotionRate < 0.05) { // < 5% promotion rate
      bottlenecks.push('promotion_rate_low');
    }

    // 3. Apply optimizations
    for (const bottleneck of bottlenecks) {
      console.log(`🔧 Addressing bottleneck: ${bottleneck}`);

      switch (bottleneck) {
        case 'pipeline_processing_slow':
          await pipelineOrchestrator.optimizeBatchSize({
            targetProcessingTime: 45000, // 45 seconds
            maxBatchSize: 100
          });
          break;

        case 'scoring_processing_slow':
          await scoringCoordinator.enableParallelProcessing({
            maxConcurrentBatches: 5,
            useEnhanced45Factor: true
          });
          break;

        case 'promotion_rate_low':
          await promotionAgent.adjustPromotionCriteria({
            minScore: Math.max(60, promotionMetrics.averageScore - 10),
            minConfidence: Math.max(75, promotionMetrics.averageConfidence - 5)
          });
          break;
      }
    }

    // 4. Measure optimization impact
    await sleep('2 minutes'); // Allow time for optimizations to take effect

    const postOptimizationMetrics = await pipelineOrchestrator.getPerformanceMetrics();
    console.log('📈 Post-optimization performance', postOptimizationMetrics.summary);

    console.log('✅ Performance Optimization Workflow completed');

  } catch (error) {
    console.error('❌ Performance Optimization Workflow failed', error);
    throw error;
  }
}

/**
 * Data Lifecycle Management Workflow
 * 
 * Manages data archiving and cleanup to maintain performance
 * Important for long-term operation with high prop volumes
 */
export async function dataLifecycleManagementWorkflow(): Promise<void> {
  console.log('📁 Starting Data Lifecycle Management Workflow');

  try {
    // 1. Analyze data volume and age
    const dataAnalysis = await pipelineOrchestrator.analyzeDataVolume();
    console.log('📊 Data volume analysis', dataAnalysis);

    // 2. Archive old processed props
    if (dataAnalysis.oldProcessedProps > 10000) {
      console.log('📦 Archiving old processed props');
      
      const archiveResult = await pipelineOrchestrator.archiveOldProps({
        olderThanDays: 7,
        batchSize: 1000
      });
      
      console.log('📦 Archive completed', archiveResult);
    }

    // 3. Clean up failed props with high retry counts
    const cleanupResult = await pipelineOrchestrator.cleanupFailedProps({
      maxRetryCount: 5,
      olderThanHours: 24
    });
    
    console.log('🧹 Cleanup completed', cleanupResult);

    // 4. Optimize database indexes
    await pipelineOrchestrator.optimizeDatabaseIndexes();
    console.log('⚡ Database optimization completed');

    console.log('✅ Data Lifecycle Management Workflow completed');

  } catch (error) {
    console.error('❌ Data Lifecycle Management Workflow failed', error);
    throw error;
  }
}

// Export all workflows
export {
  pipelineOrchestrationWorkflow as default,
  continuousPipelineMonitoringWorkflow,
  systemRecoveryWorkflow,
  performanceOptimizationWorkflow,
  dataLifecycleManagementWorkflow
};