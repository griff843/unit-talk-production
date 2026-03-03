import { proxyActivities, log } from '@temporalio/workflow';

import type {
  IngestionActivities,
  ProcessingActivities,
  AlertActivities,
  OperatorActivities,
} from '../activities';

// Create activity proxies with optimized timeouts for E2E testing
const ingestionActivities = proxyActivities<IngestionActivities>({
  startToCloseTimeout: '90 seconds', // Must complete within 2-min cycle
});

const processingActivities = proxyActivities<ProcessingActivities>({
  startToCloseTimeout: '60 seconds', // Fast processing for syndicate speed
});

const alertActivities = proxyActivities<AlertActivities>({
  startToCloseTimeout: '30 seconds', // Alerts must be is_instant
});

const operatorActivities = proxyActivities<OperatorActivities>({
  startToCloseTimeout: '30 seconds', // System monitoring must be fast
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
    isLiveMode: params.isLiveMode,
  });

  const summary: WorkflowSummary = {
    cycleCount: params.cycleCount,
    leagues: params.leagues,
    totalPropsIngested: 0,
    totalPropsScored: 0,
    totalPropsPromoted: 0,
    uspResults: [],
    errors: [],
    duration: 0,
  };

  try {
    // Step 1: System Health Check
    const healthCheck = await operatorActivities.checkSystemHealth({
      timestamp: new Date().toISOString(),
      components: ['database', 'temporal', 'discord', 'apis'],
    } as any);

    if (!(healthCheck as any).success) {
      summary.errors.push(...((healthCheck as any).issues || []));
      await alertActivities.sendOperatorAlert({
        timestamp: new Date().toISOString(),
        type: 'error',
        message: `Health check failed: ${((healthCheck as any).issues || []).join(', ')}`,
        metadata: {
          cycleCount: params.cycleCount,
          healthScore: (healthCheck as any).healthScore || 0,
        },
      } as any);
    }

    // Step 2: Games Ingestion Phase
    log.info(`🎮 Starting games ingestion phase for ${params.leagues.length} leagues`);

    try {
      const gamesResult = await ingestionActivities.ingestOptimalGames({
        timestamp: new Date().toISOString(),
        leagues: params.leagues,
        isLiveMode: params.isLiveMode,
        cycleCount: params.cycleCount,
      } as any);

      if (gamesResult.success) {
        log.info(`✅ Games ingestion successful: ${gamesResult.gamesIngested} games processed`);
      } else {
        log.warn(`⚠️ Games ingestion had errors: ${gamesResult.errors.join(', ')}`);
        summary.errors.push(...gamesResult.errors);
      }
    } catch (gamesError) {
      const errorMessage = `Games ingestion failed: ${gamesError}`;
      log.error(errorMessage);
      summary.errors.push(errorMessage);
    }

    // Step 3: Props Ingestion Phase
    log.info(`📥 Starting props ingestion phase for ${params.leagues.length} leagues`);

    for (const league of params.leagues) {
      try {
        // Ingest from Optimal
        const optimalResult = await ingestionActivities.ingestOptimalProps({
          timestamp: new Date().toISOString(),
          league,
          isLiveMode: params.isLiveMode,
          cycleCount: params.cycleCount,
        } as any);

        if (optimalResult.success) {
          summary.totalPropsIngested += (optimalResult as any).propsIngested || 0;
          log.info(
            `✅ Optimal ingestion complete for ${league}: ${(optimalResult as any).propsIngested || 0} props`
          );
        } else {
          summary.errors.push(...((optimalResult as any).errors || []));
          await operatorActivities.logUSPError({
            timestamp: new Date().toISOString(),
            uspType: 'ingestion_optimal',
            errorMessage: ((optimalResult as any).errors || []).join(', '),
            cycleCount: params.cycleCount,
          } as any);
        }

        // Ingest from SGO (fallback)
        const sgoResult = await ingestionActivities.ingestSGOProps({
          timestamp: new Date().toISOString(),
          league,
          isLiveMode: params.isLiveMode,
          cycleCount: params.cycleCount,
        } as any);

        if (sgoResult.success) {
          summary.totalPropsIngested += (sgoResult as any).propsIngested || 0;
          log.info(
            `✅ SGO ingestion complete for ${league}: ${(sgoResult as any).propsIngested || 0} props`
          );
        } else {
          const sgoError = sgoResult.error || 'Unknown error';
          summary.errors.push(typeof sgoError === 'string' ? sgoError : String(sgoError));
          await operatorActivities.logUSPError({
            timestamp: new Date().toISOString(),
            uspType: 'ingestion_sgo',
            errorMessage: sgoResult.error || 'Unknown error',
            cycleCount: params.cycleCount,
          } as any);
        }

        // Validate ingestion data
        const validationResult = await ingestionActivities.validateIngestionData({
          timestamp: new Date().toISOString(),
          league,
          expectedMinProps: 10,
        } as any);

        if (!(validationResult as any).isValid) {
          summary.errors.push(...((validationResult as any).issues || []));
          await alertActivities.sendOperatorAlert({
            timestamp: new Date().toISOString(),
            type: 'error',
            message: `Ingestion validation failed for ${league}: ${((validationResult as any).issues || []).join(', ')}`,
            metadata: {
              league,
              actualCount: (validationResult as any).actualCount || 0,
            },
          } as any);
        }
      } catch (leagueError) {
        const errorMsg = `Ingestion failed for ${league}: ${leagueError}`;
        summary.errors.push(errorMsg);
        await operatorActivities.logUSPError({
          timestamp: new Date().toISOString(),
          uspType: 'ingestion_league',
          errorMessage: errorMsg,
          cycleCount: params.cycleCount,
        } as any);
      }
    }

    // Step 3: Processing Phase
    log.info(`⚡ Starting processing phase`);

    // USP Detection
    const uspResult = await processingActivities.processUSPDetection({
      timestamp: new Date().toISOString(),
      leagues: params.leagues,
      cycleCount: params.cycleCount,
    } as any);

    if (uspResult.success) {
      summary.uspResults = (uspResult as any).uspResults || [];
      log.info(
        `✅ USP detection complete: ${(uspResult as any).uspResults?.length || 0} types processed`
      );
    } else {
      const uspError = uspResult.error || 'USP detection failed';
      summary.errors.push(typeof uspError === 'string' ? uspError : String(uspError));
      await operatorActivities.logUSPError({
        timestamp: new Date().toISOString(),
        uspType: 'usp_detection',
        errorMessage: uspResult.error || 'USP detection failed',
        cycleCount: params.cycleCount,
      } as any);
    }

    // Scoring and Grading
    const scoringResult = await processingActivities.scoreAndGradeProps({
      timestamp: new Date().toISOString(),
      leagues: params.leagues,
      cycleCount: params.cycleCount,
    } as any);

    if (scoringResult.success) {
      summary.totalPropsScored = scoringResult.propsScored;
      summary.totalPropsPromoted = scoringResult.propsPromoted;
      log.info(
        `✅ Scoring complete: ${scoringResult.propsScored} scored, ${scoringResult.propsPromoted} promoted`
      );
    } else {
      summary.errors.push(scoringResult.error || 'Scoring and grading failed');
      await operatorActivities.logUSPError({
        timestamp: new Date().toISOString(),
        uspType: 'scoring_grading',
        errorMessage: scoringResult.error || 'Scoring and grading failed',
        cycleCount: params.cycleCount,
      } as any);
    }

    // Step 4: Alert Phase
    if (summary.totalPropsPromoted > 0) {
      log.info(`📢 Sending approved picks alert`);

      // Mock picks data for alert
      const mockPicks = Array.from({ length: summary.totalPropsPromoted }, (_, i) => ({
        id: `pick-${i}`,
        player_name: `Player ${i + 1}`,
        team: `Team ${(i % 4) + 1}`,
        stat_type: ['points', 'rebounds', 'assists'][i % 3],
        line: 20 + (i % 10),
        tier: i % 2 === 0 ? 'S' : 'A',
      })) as any[];

      const alertResult = await alertActivities.sendApprovedPicksAlert({
        timestamp: new Date().toISOString(),
        picks: mockPicks,
        cycleCount: params.cycleCount,
        totalPicks: summary.totalPropsScored,
      } as any);

      if (!alertResult.success) {
        summary.errors.push(`Alert failed: ${alertResult.error || 'Unknown error'}`);
      }
    }

    // Step 5: Workflow Completion
    const duration = Date.now() - startTime;
    summary.duration = duration;

    await operatorActivities.logWorkflowMetrics({
      timestamp: new Date().toISOString(),
      workflowName,
      duration,
      success: summary.errors.length === 0,
      cycleCount: params.cycleCount,
      metadata: {
        propsIngested: summary.totalPropsIngested,
        propsPromoted: summary.totalPropsPromoted,
        leagues: params.leagues.length,
      },
    } as any);

    log.info(`🏁 E2E Props Workflow Complete - Cycle ${params.cycleCount}`, {
      duration: Math.round(duration / 1000),
      success: summary.errors.length === 0,
      propsIngested: summary.totalPropsIngested,
      propsPromoted: summary.totalPropsPromoted,
      errors: summary.errors.length,
    });

    return {
      success: summary.errors.length === 0,
      summary,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    summary.duration = duration;
    summary.errors.push(String(error));

    await alertActivities.sendWorkflowFailure({
      timestamp: new Date().toISOString(),
      workflowName,
      errorMessage: String(error),
      cycleCount: params.cycleCount,
    } as any);

    await operatorActivities.logWorkflowMetrics({
      timestamp: new Date().toISOString(),
      workflowName,
      duration,
      success: false,
      cycleCount: params.cycleCount,
      metadata: { error: String(error) as unknown as Record<string, unknown> },
    } as any);

    log.error(`❌ E2E Props Workflow Failed - Cycle ${params.cycleCount}:`, {
      error: String(error),
    });

    return {
      success: false,
      summary,
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
    cycleCount: params.cycleCount,
  });

  try {
    const liveGameResult = await operatorActivities.detectLiveGames({
      timestamp: new Date().toISOString(),
      leagues: params.leagues,
    } as any);

    if ((liveGameResult as any).success && (liveGameResult as any).liveGames?.length > 0) {
      await alertActivities.sendOperatorAlert({
        timestamp: new Date().toISOString(),
        type: 'info',
        message: `Live games detected: ${(liveGameResult as any).liveGames?.length || 0} games in progress`,
        metadata: {
          liveGames: (liveGameResult as any).liveGames?.length || 0,
          leagues: params.leagues,
          cycleCount: params.cycleCount,
        },
      } as any);
    }

    return {
      success: (liveGameResult as any).success || false,
      liveGames: (liveGameResult as any).liveGames || [],
    };
  } catch (error) {
    log.error(`❌ Live Game Monitoring Failed:`, { err: String(error) });

    await alertActivities.sendOperatorAlert({
      timestamp: new Date().toISOString(),
      type: 'error',
      message: `Live game monitoring failed: ${error}`,
      metadata: { cycleCount: params.cycleCount as number },
    } as any);

    return {
      success: false,
      liveGames: [],
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
    cycleCount: params.cycleCount,
  });

  const quotaStatus = [];

  try {
    for (const provider of params.providers) {
      // Mock quota check - replace with actual implementation
      const mockUsage = Math.floor(Math.random() * 1000);
      const mockLimit = 1000;

      const quotaResult = await operatorActivities.monitorAPIQuota({
        timestamp: new Date().toISOString(),
        provider,
        currentUsage: mockUsage,
        limit: mockLimit,
      } as any);

      quotaStatus.push({
        provider,
        usage: mockUsage,
        limit: mockLimit,
        percentage: (quotaResult as any).percentage || 0,
        shouldFallback: (quotaResult as any).shouldFallback || false,
      });

      if ((quotaResult as any).shouldFallback) {
        await alertActivities.sendFallbackTrigger({
          timestamp: new Date().toISOString(),
          primaryProvider: provider,
          fallbackProvider: 'SGO',
          reason: `Quota exceeded: ${(quotaResult as any).percentage || 0}%`,
        } as any);
      }
    }

    return {
      success: true,
      quotaStatus,
    };
  } catch (error) {
    log.error(`❌ API Quota Monitoring Failed:`, { err: String(error) });

    await alertActivities.sendOperatorAlert({
      timestamp: new Date().toISOString(),
      type: 'error',
      message: `API quota monitoring failed: ${error}`,
      metadata: { cycleCount: params.cycleCount as number },
    } as any);

    return {
      success: false,
      quotaStatus,
    };
  }
}
