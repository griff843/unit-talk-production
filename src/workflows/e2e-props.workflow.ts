import { proxyActivities, log } from '@temporalio/workflow';
import type {
  IngestionActivities,
  ProcessingActivities,
  AlertActivities,
  OperatorActivities
} from '../activities';

// Create activity proxies with optimized timeouts for E2E testing
const ingestionActivities = proxyActivities<IngestionActivities>({
  startToCloseTimeout: '90 seconds' // Must complete within 2-min cycle
});

const processingActivities = proxyActivities<ProcessingActivities>({
  startToCloseTimeout: '60 seconds' // Fast processing for syndicate speed
});

const alertActivities = proxyActivities<AlertActivities>({
  startToCloseTimeout: '30 seconds' // Alerts must be instant
});

const operatorActivities = proxyActivities<OperatorActivities>({
  startToCloseTimeout: '30 seconds' // System monitoring must be fast
});

interface WorkflowSummary {
  cycleCount: number;
  leagues: string[];
  totalPropsIngested: number;
  totalPropsScored: number;
  totalPropsPromoted: number;
  uspResults: any[];
  errors: string[];
  duration: number;
}

/**
 * MAIN E2E PROP PROCESSING WORKFLOW
 * Handles the complete prop lifecycle from ingestion to alerts
 */
export async function e2ePropsWorkflow(params: {
  leagues: string[];
  cycleCount: number;
  isLiveMode: boolean;
}): Promise<{ success: boolean; summary: WorkflowSummary }> {
  const startTime = Date.now();
  const workflowName = 'e2ePropsWorkflow';
  
  log.info(`🚀 Starting E2E Props Workflow - Cycle ${params.cycleCount}`, {
    leagues: params.leagues,
    cycleCount: params.cycleCount,
    isLiveMode: params.isLiveMode
  });

  const summary: WorkflowSummary = {
    cycleCount: params.cycleCount,
    leagues: params.leagues,
    totalPropsIngested: 0,
    totalPropsScored: 0,
    totalPropsPromoted: 0,
    uspResults: [],
    errors: [],
    duration: 0
  };

  try {
    // Step 1: System Health Check
    const healthCheck = await operatorActivities.checkSystemHealth({
      cycleCount: params.cycleCount,
      components: ['database', 'temporal', 'discord', 'apis']
    });

    if (!healthCheck.success) {
      summary.errors.push(...healthCheck.issues);
      await alertActivities.sendOperatorAlert({
        type: 'system_error',
        message: `Health check failed: ${healthCheck.issues.join(', ')}`,
        severity: 'critical',
        metadata: { 
          cycleCount: params.cycleCount, 
          healthScore: healthCheck.healthScore 
        }
      });
    }

    // Step 2: Ingestion Phase
    log.info(`📥 Starting ingestion phase for ${params.leagues.length} leagues`);
    
    for (const league of params.leagues) {
      try {
        // Ingest from Optimal
        const optimalResult = await ingestionActivities.ingestOptimalProps({
          league,
          isLiveMode: params.isLiveMode,
          cycleCount: params.cycleCount
        });

        if (optimalResult.success) {
          summary.totalPropsIngested += optimalResult.propsIngested;
          log.info(`✅ Optimal ingestion complete for ${league}: ${optimalResult.propsIngested} props`);
        } else {
          summary.errors.push(...optimalResult.errors);
          await operatorActivities.logUSPError({
            uspType: 'ingestion_optimal',
            error: optimalResult.errors.join(', '),
            cycleCount: params.cycleCount
          });
        }

        // Ingest from SGO (fallback)
        const sgoResult = await ingestionActivities.ingestSGOProps({
          league,
          isLiveMode: params.isLiveMode,
          cycleCount: params.cycleCount
        });

        if (sgoResult.success) {
          summary.totalPropsIngested += sgoResult.propsIngested;
          log.info(`✅ SGO ingestion complete for ${league}: ${sgoResult.propsIngested} props`);
        } else {
          summary.errors.push(...sgoResult.errors);
          await operatorActivities.logUSPError({
            uspType: 'ingestion_sgo',
            error: sgoResult.errors.join(', '),
            cycleCount: params.cycleCount
          });
        }

        // Validate ingestion data
        const validationResult = await ingestionActivities.validateIngestionData({
          league,
          expectedMinProps: 10
        });

        if (!validationResult.isValid) {
          summary.errors.push(...validationResult.issues);
          await alertActivities.sendOperatorAlert({
            type: 'system_error',
            message: `Ingestion validation failed for ${league}: ${validationResult.issues.join(', ')}`,
            severity: 'high',
            metadata: { 
              league, 
              actualCount: validationResult.actualCount 
            }
          });
        }

      } catch (leagueError) {
        const errorMsg = `Ingestion failed for ${league}: ${leagueError}`;
        summary.errors.push(errorMsg);
        await operatorActivities.logUSPError({
          uspType: 'ingestion_league',
          error: errorMsg,
          cycleCount: params.cycleCount
        });
      }
    }

    // Step 3: Processing Phase
    log.info(`⚡ Starting processing phase`);

    // USP Detection
    const uspResult = await processingActivities.processUSPDetection({
      leagues: params.leagues,
      cycleCount: params.cycleCount
    });

    if (uspResult.success) {
      summary.uspResults = uspResult.uspResults;
      log.info(`✅ USP detection complete: ${uspResult.uspResults.length} types processed`);
    } else {
      summary.errors.push(...uspResult.errors);
      await operatorActivities.logUSPError({
        uspType: 'usp_detection',
        error: uspResult.errors.join(', '),
        cycleCount: params.cycleCount
      });
    }

    // Scoring and Grading
    const scoringResult = await processingActivities.scoreAndGradeProps({
      leagues: params.leagues,
      cycleCount: params.cycleCount
    });

    if (scoringResult.success) {
      summary.totalPropsScored = scoringResult.propsScored;
      summary.totalPropsPromoted = scoringResult.propsPromoted;
      log.info(`✅ Scoring complete: ${scoringResult.propsScored} scored, ${scoringResult.propsPromoted} promoted`);
    } else {
      summary.errors.push(...scoringResult.errors);
      await operatorActivities.logUSPError({
        uspType: 'scoring_grading',
        error: scoringResult.errors.join(', '),
        cycleCount: params.cycleCount
      });
    }

    // Step 4: Alert Phase
    if (summary.totalPropsPromoted > 0) {
      log.info(`📢 Sending approved picks alert`);
      
      // Mock picks data for alert
      const mockPicks = Array.from({ length: summary.totalPropsPromoted }, (_, i) => ({
        id: `pick-${i}`,
        player_name: `Player ${i + 1}`,
        team: `Team ${i % 4 + 1}`,
        stat_type: ['points', 'rebounds', 'assists'][i % 3],
        line: 20 + (i % 10),
        tier: i % 2 === 0 ? 'S' : 'A'
      }));

      const alertResult = await alertActivities.sendApprovedPicksAlert({
        picks: mockPicks,
        cycleCount: params.cycleCount,
        totalPicks: summary.totalPropsScored
      });

      if (!alertResult.success) {
        summary.errors.push(`Alert failed: ${alertResult.error || 'Unknown error'}`);
      }
    }

    // Step 5: Workflow Completion
    const duration = Date.now() - startTime;
    summary.duration = duration;

    await operatorActivities.logWorkflowMetrics({
      workflowName,
      duration,
      success: summary.errors.length === 0,
      cycleCount: params.cycleCount,
      metadata: {
        propsIngested: summary.totalPropsIngested,
        propsPromoted: summary.totalPropsPromoted,
        leagues: params.leagues.length
      }
    });

    log.info(`🏁 E2E Props Workflow Complete - Cycle ${params.cycleCount}`, {
      duration: Math.round(duration / 1000),
      success: summary.errors.length === 0,
      propsIngested: summary.totalPropsIngested,
      propsPromoted: summary.totalPropsPromoted,
      errors: summary.errors.length
    });

    return {
      success: summary.errors.length === 0,
      summary
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    summary.duration = duration;
    summary.errors.push(String(error));

    await alertActivities.sendWorkflowFailure({
      workflowName,
      error: String(error),
      cycleCount: params.cycleCount
    });

    await operatorActivities.logWorkflowMetrics({
      workflowName,
      duration,
      success: false,
      cycleCount: params.cycleCount,
      metadata: { error: String(error) as unknown as Record<string, unknown> }
    });

    log.error(`❌ E2E Props Workflow Failed - Cycle ${params.cycleCount}:`, { error: String(error) });

    return {
      success: false,
      summary
    };
  }
}

/**
 * LIVE GAME MONITORING WORKFLOW
 * Monitors for live games and triggers appropriate responses
 */
export async function liveGameMonitoringWorkflow(params: {
  leagues: string[];
  cycleCount: number;
}): Promise<{ success: boolean; liveGames: any[] }> {
  log.info(`🎮 Starting Live Game Monitoring - Cycle ${params.cycleCount}`, {
    leagues: params.leagues,
    cycleCount: params.cycleCount
  });

  try {
    const liveGameResult = await operatorActivities.detectLiveGames({
      leagues: params.leagues
    });

    if (liveGameResult.success && liveGameResult.liveGames.length > 0) {
      await alertActivities.sendOperatorAlert({
        type: 'system_error',
        message: `Live games detected: ${liveGameResult.liveGames.length} games in progress`,
        severity: 'normal',
        metadata: {
          liveGames: liveGameResult.liveGames.length,
          leagues: params.leagues,
          cycleCount: params.cycleCount
        }
      });
    }

    return {
      success: liveGameResult.success,
      liveGames: liveGameResult.liveGames
    };

  } catch (error) {
    log.error(`❌ Live Game Monitoring Failed:`, { error: String(error) });

    await alertActivities.sendOperatorAlert({
      type: 'workflow_failure',
      message: `Live game monitoring failed: ${error}`,
      severity: 'high',
      metadata: { cycleCount: params.cycleCount as number }
    });

    return {
      success: false,
      liveGames: []
    };
  }
}

/**
 * API QUOTA MONITORING WORKFLOW
 * Monitors API usage and triggers fallbacks when needed
 */
export async function apiQuotaMonitoringWorkflow(params: {
  providers: string[];
  cycleCount: number;
}): Promise<{ success: boolean; quotaStatus: any[] }> {
  log.info(`📊 Starting API Quota Monitoring - Cycle ${params.cycleCount}`, {
    providers: params.providers,
    cycleCount: params.cycleCount
  });

  const quotaStatus = [];

  try {
    for (const provider of params.providers) {
      // Mock quota check - replace with actual implementation
      const mockUsage = Math.floor(Math.random() * 1000);
      const mockLimit = 1000;

      const quotaResult = await operatorActivities.monitorAPIQuota({
        provider,
        currentUsage: mockUsage,
        limit: mockLimit
      });

      quotaStatus.push({
        provider,
        usage: mockUsage,
        limit: mockLimit,
        percentage: quotaResult.percentage,
        shouldFallback: quotaResult.shouldFallback
      });

      if (quotaResult.shouldFallback) {
        await alertActivities.sendFallbackTrigger({
          primaryProvider: provider,
          fallbackProvider: 'SGO',
          reason: `Quota exceeded: ${quotaResult.percentage}%`
        });
      }
    }

    return {
      success: true,
      quotaStatus
    };

  } catch (error) {
    log.error(`❌ API Quota Monitoring Failed:`, { error: String(error) });

    await alertActivities.sendOperatorAlert({
      type: 'workflow_failure',
      message: `API quota monitoring failed: ${error}`,
      severity: 'high',
      metadata: { cycleCount: params.cycleCount as number }
    });

    return {
      success: false,
      quotaStatus
    };
  }
}