import { proxyActivities } from '@temporalio/workflow';
import * as wf from '@temporalio/workflow';

// Import activity types for health monitoring
interface HealthWorkflowActivities {
  executeHealthSnapshot(): Promise<{
    success: boolean;
    healthData: Array<{
      section: string;
      status: 'healthy' | 'warning' | 'degraded' | 'critical';
      count_recent: number;
      count_total: number;
      last_updated: string;
      details: Record<string, any>;
      thresholds: Record<string, number>;
      alerts: string[];
    }>;
    executionTime: number;
    queryTime: number;
  }>;

  logJobRun(params: {
    agent: string;
    workflow: string;
    jobName: string;
    status: 'running' | 'success' | 'failed' | 'timeout' | 'cancelled';
    metadata: Record<string, any>;
    errorMessage?: string;
  }): Promise<{
    jobId: string;
    logged: boolean;
  }>;

  completeJobRun(params: {
    jobId: string;
    status: 'success' | 'failed' | 'timeout' | 'cancelled';
    metadata: Record<string, any>;
    errorMessage?: string;
  }): Promise<{
    completed: boolean;
    duration: number;
  }>;

  createIncidents(params: {
    incidents: Array<{
      kind: string;
      severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
      details: Record<string, any>;
      section: string;
    }>;
  }): Promise<{
    incidentsCreated: string[];
    duplicatesSkipped: string[];
    totalProcessed: number;
  }>;

  pushToCommandCenter(params: {
    healthData: Array<{
      section: string;
      status: string;
      count_recent: number;
      count_total: number;
      last_updated: string;
      details: Record<string, any>;
      thresholds: Record<string, number>;
      alerts: string[];
    }>;
    timestamp: string;
    executionMetrics: {
      totalSections: number;
      healthySections: number;
      degradedSections: number;
      criticalSections: number;
      totalIncidents: number;
    };
  }): Promise<{
    pushed: boolean;
    endpoint: string;
    responseTime: number;
  }>;

  sendHealthAlert(params: {
    alertType: 'health_check_complete' | 'critical_incidents' | 'system_degraded' | 'health_check_failed';
    message: string;
    details: object;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void>;
}

// Configure activities for health monitoring
const activities = proxyActivities<HealthWorkflowActivities>({
  startToCloseTimeout: '5 minutes',
  heartbeatTimeout: '30 seconds',
  scheduleToStartTimeout: '10 seconds'
});

/**
 * HealthWorkflow - Comprehensive System Health Monitoring
 * 
 * Integrates system_health_snapshot view into daily operations by:
 * - Querying health status across 8 key system sections
 * - Creating incidents for threshold violations
 * - Logging all executions to agent_job_runs
 * - Pushing real-time health data to Command Center
 * - Providing resilient monitoring with retry logic
 * 
 * Health Sections Monitored:
 * - HOT_PROPS: Real-time prop ingestion status
 * - WARM_FEATURES: Feature computation pipeline
 * - AGENT_JOBS: Agent workflow execution health
 * - RECAP_RUNS: Daily recap generation status
 * - ALERTS: Alert latency and processing
 * - SYSTEM_PERFORMANCE: CPU, memory, disk metrics
 * - DATABASE_HEALTH: DB connections and performance
 * - API_ENDPOINTS: API response times and availability
 */
export async function HealthWorkflow(params: {
  maxRetries?: number;
  alertThresholds?: {
    criticalIncidentCount?: number;
    degradedSectionCount?: number;
    maxExecutionTime?: number;
  };
  dryRun?: boolean;
}): Promise<{
  success: boolean;
  executionId: string;
  healthSummary: {
    totalSections: number;
    healthySections: number;
    degradedSections: number;
    criticalSections: number;
    sectionsWithAlerts: string[];
  };
  incidents: {
    created: string[];
    skipped: string[];
    total: number;
  };
  performance: {
    executionTime: number;
    queryTime: number;
    commandCenterPush: boolean;
  };
  errors: string[];
}> {
  
  const startTime = Date.now();
  const workflowId = wf.workflowInfo().workflowId;
  const executionId = `health_${Date.now()}_${workflowId.slice(-8)}`;
  
  // Initialize result tracking
  let result = {
    success: false,
    executionId,
    healthSummary: {
      totalSections: 0,
      healthySections: 0,
      degradedSections: 0,
      criticalSections: 0,
      sectionsWithAlerts: [] as string[]
    },
    incidents: {
      created: [] as string[],
      skipped: [] as string[],
      total: 0
    },
    performance: {
      executionTime: 0,
      queryTime: 0,
      commandCenterPush: false
    },
    errors: [] as string[]
  };

  // Configuration
  const maxRetries = params.maxRetries || 3;
  const alertThresholds = {
    criticalIncidentCount: params.alertThresholds?.criticalIncidentCount || 3,
    degradedSectionCount: params.alertThresholds?.degradedSectionCount || 2,
    maxExecutionTime: params.alertThresholds?.maxExecutionTime || 30000, // 30 seconds
    ...params.alertThresholds
  };
  const dryRun = params.dryRun || false;

  let jobId: string | null = null;
  let retryCount = 0;

  try {
    wf.log.info('🏥 HealthWorkflow started', {
      workflowId,
      executionId,
      params,
      scheduledAt: new Date().toISOString()
    });

    // ================================
    // 1. START JOB LOGGING
    // ================================
    
    const jobStartResult = await activities.logJobRun({
      agent: 'OperatorAgent',
      workflow: 'HealthWorkflow',
      jobName: 'system_health_check',
      status: 'running',
      metadata: {
        executionId,
        startTime: new Date().toISOString(),
        parameters: params
      }
    });

    jobId = jobStartResult.jobId;

    wf.log.info('📝 Job run logged', {
      jobId,
      agent: 'OperatorAgent',
      workflow: 'HealthWorkflow'
    });

    // ================================
    // 2. EXECUTE HEALTH SNAPSHOT QUERY
    // ================================
    
    let healthData: any[] = [];
    let querySuccess = false;

    // Retry logic for health snapshot query
    while (retryCount <= maxRetries && !querySuccess) {
      try {
        wf.log.info(`🔍 Executing health snapshot query (attempt ${retryCount + 1}/${maxRetries + 1})`);
        
        const snapshotResult = await activities.executeHealthSnapshot();
        
        if (snapshotResult.success && snapshotResult.healthData) {
          healthData = snapshotResult.healthData;
          result.performance.queryTime = snapshotResult.queryTime;
          querySuccess = true;
          
          wf.log.info('✅ Health snapshot query successful', {
            sectionsRetrieved: healthData.length,
            queryTime: snapshotResult.queryTime,
            executionTime: snapshotResult.executionTime
          });
        } else {
          throw new Error('Health snapshot query returned no data');
        }
        
      } catch (error) {
        retryCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Query attempt ${retryCount} failed: ${errorMessage}`);
        
        wf.log.warn(`⚠️ Health snapshot query failed`, {
          attempt: retryCount,
          error: errorMessage,
          willRetry: retryCount <= maxRetries
        });

        if (retryCount <= maxRetries) {
          // Exponential backoff: 2^attempt seconds
          const delayMs = Math.min(2 ** retryCount * 1000, 10000);
          await wf.sleep(delayMs);
        }
      }
    }

    if (!querySuccess) {
      throw new Error(`Failed to execute health snapshot after ${maxRetries + 1} attempts`);
    }

    // ================================
    // 3. ANALYZE HEALTH DATA
    // ================================
    
    result.healthSummary.totalSections = healthData.length;
    const incidentsToCreate: Array<{
      kind: string;
      severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
      details: Record<string, any>;
      section: string;
    }> = [];

    for (const section of healthData) {
      // Count section status
      switch (section.status) {
        case 'healthy':
          result.healthSummary.healthySections++;
          break;
        case 'warning':
        case 'degraded':
          result.healthSummary.degradedSections++;
          break;
        case 'critical':
          result.healthSummary.criticalSections++;
          break;
      }

      // Collect sections with alerts
      if (section.alerts && section.alerts.length > 0) {
        result.healthSummary.sectionsWithAlerts.push(section.section);
        
        // Create incidents for each alert
        for (const alertType of section.alerts) {
          const severity = getSeverityForAlert(alertType, section);
          
          incidentsToCreate.push({
            kind: alertType,
            severity,
            details: {
              section: section.section,
              status: section.status,
              count_recent: section.count_recent,
              count_total: section.count_total,
              details: section.details,
              thresholds: section.thresholds,
              timestamp: new Date().toISOString(),
              executionId
            },
            section: section.section
          });
        }
      }

      wf.log.info(`📊 Section analyzed: ${section.section}`, {
        status: section.status,
        countRecent: section.count_recent,
        alerts: section.alerts.length,
        lastUpdated: section.last_updated
      });
    }

    // ================================
    // 4. CREATE INCIDENTS (THRESHOLD-BASED)
    // ================================
    
    if (!dryRun && incidentsToCreate.length > 0) {
      wf.log.info('🚨 Creating incidents for health violations');
      
      const incidentResult = await activities.createIncidents({
        incidents: incidentsToCreate
      });

      result.incidents = {
        created: incidentResult.incidentsCreated,
        skipped: incidentResult.duplicatesSkipped,
        total: incidentResult.totalProcessed
      };

      wf.log.info('✅ Incident creation completed', {
        created: incidentResult.incidentsCreated.length,
        skipped: incidentResult.duplicatesSkipped.length,
        total: incidentResult.totalProcessed
      });
    } else if (dryRun) {
      result.incidents.total = incidentsToCreate.length;
      wf.log.info('🔍 Dry run - incidents simulated', {
        wouldCreate: incidentsToCreate.length,
        incidents: incidentsToCreate.map(i => `${i.section}:${i.kind}`)
      });
    }

    // ================================
    // 5. PUSH TO COMMAND CENTER
    // ================================
    
    if (!dryRun) {
      try {
        wf.log.info('📡 Pushing health data to Command Center');
        
        const commandCenterResult = await activities.pushToCommandCenter({
          healthData,
          timestamp: new Date().toISOString(),
          executionMetrics: {
            totalSections: result.healthSummary.totalSections,
            healthySections: result.healthSummary.healthySections,
            degradedSections: result.healthSummary.degradedSections,
            criticalSections: result.healthSummary.criticalSections,
            totalIncidents: result.incidents.total
          }
        });

        result.performance.commandCenterPush = commandCenterResult.pushed;

        wf.log.info('✅ Command Center push completed', {
          pushed: commandCenterResult.pushed,
          endpoint: commandCenterResult.endpoint,
          responseTime: commandCenterResult.responseTime
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Command Center push failed: ${errorMessage}`);
        wf.log.warn('⚠️ Command Center push failed', { error: errorMessage });
      }
    }

    // ================================
    // 6. GENERATE ALERTS BASED ON THRESHOLDS
    // ================================
    
    // Critical incidents alert
    if (result.incidents.created.length >= alertThresholds.criticalIncidentCount) {
      await activities.sendHealthAlert({
        alertType: 'critical_incidents',
        message: `${result.incidents.created.length} critical health incidents detected`,
        details: {
          incidents: result.incidents.created,
          sections: result.healthSummary.sectionsWithAlerts,
          healthSummary: result.healthSummary
        },
        priority: 'critical'
      });
    }

    // System degraded alert
    if (result.healthSummary.degradedSections >= alertThresholds.degradedSectionCount) {
      await activities.sendHealthAlert({
        alertType: 'system_degraded',
        message: `${result.healthSummary.degradedSections} system sections in degraded state`,
        details: {
          degradedSections: result.healthSummary.degradedSections,
          criticalSections: result.healthSummary.criticalSections,
          sectionsWithAlerts: result.healthSummary.sectionsWithAlerts
        },
        priority: 'high'
      });
    }

    // ================================
    // 7. COMPLETE JOB LOGGING
    // ================================
    
    result.performance.executionTime = Date.now() - startTime;
    result.success = result.errors.length === 0;

    if (jobId) {
      await activities.completeJobRun({
        jobId,
        status: result.success ? 'success' : 'failed',
        metadata: {
          healthSummary: result.healthSummary,
          incidents: result.incidents,
          performance: result.performance,
          sectionsAnalyzed: healthData.map(s => s.section),
          executionTime: result.performance.executionTime,
          retryCount,
          completedAt: new Date().toISOString()
        },
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : undefined
      });
    }

    // Execution time alert
    if (result.performance.executionTime > alertThresholds.maxExecutionTime) {
      await activities.sendHealthAlert({
        alertType: 'health_check_complete',
        message: `Health check completed but took ${result.performance.executionTime}ms (threshold: ${alertThresholds.maxExecutionTime}ms)`,
        details: {
          executionTime: result.performance.executionTime,
          threshold: alertThresholds.maxExecutionTime,
          performance: result.performance
        },
        priority: 'medium'
      });
    } else {
      // Normal completion alert for successful runs
      await activities.sendHealthAlert({
        alertType: 'health_check_complete',
        message: `System health check completed successfully`,
        details: {
          healthSummary: result.healthSummary,
          performance: result.performance,
          incidents: result.incidents.total
        },
        priority: 'low'
      });
    }

    wf.log.info('🎉 HealthWorkflow completed successfully', {
      workflowId,
      executionId,
      success: result.success,
      healthSummary: result.healthSummary,
      incidents: result.incidents,
      performance: result.performance,
      retryCount
    });

    return result;

  } catch (error) {
    // ================================
    // ERROR HANDLING
    // ================================
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMessage);
    result.performance.executionTime = Date.now() - startTime;
    
    wf.log.error('❌ HealthWorkflow failed', {
      workflowId,
      executionId,
      error: errorMessage,
      retryCount,
      performance: result.performance,
      params
    });

    // Complete job run with failure status
    if (jobId) {
      try {
        await activities.completeJobRun({
          jobId,
          status: 'failed',
          metadata: {
            error: errorMessage,
            retryCount,
            executionTime: result.performance.executionTime,
            failedAt: new Date().toISOString()
          },
          errorMessage
        });
      } catch (completeError) {
        wf.log.error('Failed to complete job run logging', { completeError });
      }
    }

    // Send failure alert
    await activities.sendHealthAlert({
      alertType: 'health_check_failed',
      message: 'System health check failed',
      details: {
        workflowId,
        executionId,
        error: errorMessage,
        retryCount,
        performance: result.performance,
        params
      },
      priority: 'critical'
    });
    
    return result;
  }

  // Helper method to determine incident severity
  function getSeverityForAlert(
    alertType: string,
    section: any
  ): "critical" | "high" | "medium" | "low" | "info" {
    // Critical alerts
    if (alertType === 'IngestionHalted' || alertType === 'AgentFailure') {
      return 'critical';
    }
    
    // High severity alerts
    if (alertType === 'FeaturePipelineStalled' || alertType === 'AlertLatency') {
      return 'high';
    }
    
    // Medium severity alerts
    if (alertType === 'RecapError') {
      return 'medium';
    }
    
    // Default to medium for unknown alerts
    return 'medium';
  }
}

/**
 * Scheduled HealthWorkflow - Runs every 15 minutes for continuous monitoring
 * 
 * Optimized for regular system health checks with:
 * - Standard alert thresholds for production use
 * - Automatic incident creation and Command Center integration
 * - Comprehensive logging and performance monitoring
 */
export async function ScheduledHealthWorkflow(): Promise<void> {
  wf.log.info('⏰ Scheduled HealthWorkflow triggered');
  
  try {
    const result = await HealthWorkflow({
      maxRetries: 2,      // Reduced retries for regular runs
      alertThresholds: {
        criticalIncidentCount: 2,
        degradedSectionCount: 3,
        maxExecutionTime: 25000  // 25 seconds
      },
      dryRun: false
    });

    if (!result.success) {
      throw new Error(`Scheduled health check failed: ${result.errors.join(', ')}`);
    }

    wf.log.info('✅ Scheduled HealthWorkflow completed', {
      executionId: result.executionId,
      healthSummary: result.healthSummary,
      incidents: result.incidents.total,
      performance: result.performance
    });

  } catch (error) {
    wf.log.error('❌ Scheduled HealthWorkflow failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    throw error; // Trigger Temporal retry
  }
}

/**
 * Express HealthWorkflow - Triggered by system events for rapid health assessment
 * 
 * Fast health check for incident response:
 * - Reduced retry attempts for speed
 * - Lower alert thresholds for proactive detection
 * - Priority routing to Command Center
 */
export async function ExpressHealthWorkflow(params: {
  triggerEvent?: string;
  priority: 'normal' | 'high' | 'critical';
  focusSections?: string[];
}): Promise<void> {
  wf.log.info('⚡ Express HealthWorkflow triggered', {
    triggerEvent: params.triggerEvent,
    priority: params.priority,
    focusSections: params.focusSections
  });

  try {
    const result = await HealthWorkflow({
      maxRetries: 1,      // Fast failure for express runs
      alertThresholds: {
        criticalIncidentCount: 1,  // Lower threshold for proactive alerts
        degradedSectionCount: 2,
        maxExecutionTime: 15000    // 15 seconds
      },
      dryRun: false
    });

    // For critical priority, ensure we have actionable results
    if (params.priority === 'critical' && result.incidents.total === 0) {
      wf.log.warn('⚠️ Critical express health check found no incidents - system may be recovering');
    }

    if (!result.success && params.priority === 'critical') {
      throw new Error(`Critical express health check failed: ${result.errors.join(', ')}`);
    }

  } catch (error) {
    wf.log.error('❌ Express HealthWorkflow failed', {
      error: error instanceof Error ? error.message : String(error),
      priority: params.priority,
      triggerEvent: params.triggerEvent
    });
    
    if (params.priority === 'critical') {
      throw error;
    }
  }
}