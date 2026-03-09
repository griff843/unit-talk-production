import { proxyActivities, defineSignal, setHandler, condition, sleep } from '@temporalio/workflow';

import type {
  FeedAgentActivities,
  GradingAgentActivities,
  NotificationAgentActivities,
  OperatorAgentActivities,
} from '../types/activities';

// SPRINT-035B TD-6: AlertAgentActivities proxy removed — USP detection quarantined

// Activity proxies with syndicate-optimized configurations
const feedActivities = proxyActivities<FeedAgentActivities>({
  startToCloseTimeout: '90 seconds',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    maximumInterval: '10 seconds',
  },
});

const gradingActivities = proxyActivities<GradingAgentActivities>({
  startToCloseTimeout: '60 seconds',
  retry: {
    maximumAttempts: 3,
    initialInterval: '2 seconds',
    maximumInterval: '10 seconds',
  },
});

const notificationActivities = proxyActivities<NotificationAgentActivities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    maximumAttempts: 2,
    initialInterval: '1 second',
    maximumInterval: '5 seconds',
  },
});

const operatorActivities = proxyActivities<OperatorAgentActivities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    maximumAttempts: 2,
    initialInterval: '1 second',
    maximumInterval: '5 seconds',
  },
});

// Workflow signals for emergency controls
export const pauseSignal = defineSignal<[string]>('pause');
export const resumeSignal = defineSignal<[string]>('resume');
export const emergencyStopSignal = defineSignal<[string]>('emergencyStop');

/**
 * MAIN SYNDICATE SCHEDULER WORKFLOW
 * Orchestrates all ingestion, processing, and alerting on 2-minute intervals
 */
export async function syndicateSchedulerWorkflow(): Promise<void> {
  let isPaused = false;
  let isEmergencyStopped = false;
  let cycleCount = 0;

  // Set up signal handlers
  setHandler(pauseSignal, (reason: string) => {
    isPaused = true;
    console.log(`Syndicate scheduler paused: ${reason}`);
  });

  setHandler(resumeSignal, (reason: string) => {
    isPaused = false;
    console.log(`Syndicate scheduler resumed: ${reason}`);
  });

  setHandler(emergencyStopSignal, (reason: string) => {
    isEmergencyStopped = true;
    console.log(`Syndicate scheduler emergency stopped: ${reason}`);
  });

  while (!isEmergencyStopped) {
    try {
      // Wait if paused
      await condition(() => !isPaused || isEmergencyStopped);

      if (isEmergencyStopped) {
        break;
      }

      cycleCount++;
      const cycleStartTime = Date.now();

      // 1. DETECT LIVE GAMES (determines interval mode)
      const liveGames = await operatorActivities.updateLiveGameStatus({
        liveGames: [],
        totalCount: 0,
        leaguesWithLiveGames: [],
        timestamp: new Date(),
      });

      const isLiveMode = Array.isArray(liveGames) && liveGames.length > 0;
      const intervalMs = isLiveMode ? 60000 : 300000; // 1 min vs 5 min - ELITE MODE

      // 2. PARALLEL LEAGUE INGESTION
      const leagues = ['MLB', 'NBA', 'NFL', 'NHL', 'NCAAB', 'NCAAF'];
      const ingestionPromises = leagues.map(league =>
        leagueIngestionWorkflow({ league, isLiveMode, cycleCount })
      );

      await Promise.allSettled(ingestionPromises);

      // 3. USP PROCESSING (parallel with ingestion)
      const uspPromise = uspProcessingWorkflow({
        leagues,
        isLiveMode,
        cycleCount,
      });

      // 4. GRADING AND SCORING
      const gradingPromise = gradingAndScoringWorkflow({
        leagues,
        isLiveMode,
        cycleCount,
      });

      // 5. DISCORD ALERTS
      const alertPromise = discordAlertWorkflow({
        cycleCount,
        isLiveMode,
      });

      // Wait for all processing to complete
      await Promise.allSettled([uspPromise, gradingPromise, alertPromise]);

      // 6. PERFORMANCE MONITORING
      const cycleTime = Date.now() - cycleStartTime;
      const maxCycleTime = isLiveMode ? 50000 : 240000; // 50s for 1-min live, 4min for off-peak

      if (cycleTime > maxCycleTime) {
        await operatorActivities.logError({
          workflow: 'syndicateSchedulerWorkflow',
          error: `Cycle ${cycleCount} exceeded target time: ${cycleTime}ms (max: ${maxCycleTime}ms)`,
          timestamp: new Date(),
        });
      }

      // 7. WAIT FOR NEXT CYCLE
      const remainingTime = Math.max(0, intervalMs - cycleTime);
      if (remainingTime > 0) {
        await sleep(remainingTime);
      }
    } catch (error) {
      await operatorActivities.logError({
        workflow: 'syndicateSchedulerWorkflow',
        error: String(error),
        timestamp: new Date(),
      });

      // Brief pause before retry
      await sleep(5000);
    }
  }
}

/**
 * LEAGUE-SPECIFIC INGESTION WORKFLOW
 * Handles ingestion for a single league via unified data source router.
 * SPRINT-035B TD-4: Fallback is handled internally by dataSourceRouter (primary → secondary).
 * Workflow-level fallback to SGO removed (aspirational, never implemented).
 */
export async function leagueIngestionWorkflow(params: {
  league: string;
  isLiveMode: boolean;
  cycleCount: number;
}): Promise<void> {
  const { league, isLiveMode, cycleCount } = params;

  try {
    // UNIFIED INGESTION (Dual-API Strategy)
    // dataSourceRouter handles: Optimal for player props, OddsAPI for NCAAF/WNBA/settlement
    // Failover from primary → secondary is handled inside the router, not here.
    const ingestionResult = await feedActivities.ingestUnifiedData({
      league,
      batchSize: isLiveMode ? 500 : 200,
      timeout: 30000,
    });

    if (!ingestionResult.success) {
      await operatorActivities.logError({
        workflow: 'leagueIngestionWorkflow',
        league,
        error: ingestionResult.error || 'Ingestion failed',
        timestamp: new Date(),
      });
    }

    // SPRINT-044F: Dedicated provider_offers ingestion workflow (parallel path)
    // Dual-write: raw_props (above) + provider_offers (below)
    // provider_offers is additive — failure does not block raw_props path
    await providerOffersIngestionWorkflow({ league, isLiveMode });
  } catch (error) {
    await operatorActivities.logError({
      workflow: 'leagueIngestionWorkflow',
      league,
      error: String(error),
      timestamp: new Date(),
    });
  }
}

/**
 * SPRINT-044F: PROVIDER OFFERS INGESTION WORKFLOW
 * Dedicated workflow for V3 provider_offers ingestion.
 * Called from leagueIngestionWorkflow — failure does not block raw_props path.
 */
export async function providerOffersIngestionWorkflow(params: {
  league: string;
  isLiveMode: boolean;
  markets?: string[];
}): Promise<void> {
  try {
    const result = await feedActivities.ingestV3ProviderOffers({
      league: params.league,
      markets: params.markets || ['h2h', 'spreads', 'totals'],
    });
    if (!result.success) {
      await operatorActivities.logError({
        workflow: 'providerOffersIngestionWorkflow',
        league: params.league,
        error: result.error || 'Provider offers ingestion failed',
        timestamp: new Date(),
      });
    }
  } catch (error) {
    await operatorActivities.logError({
      workflow: 'providerOffersIngestionWorkflow',
      league: params.league,
      error: `V3 provider_offers ingestion failed: ${String(error)}`,
      timestamp: new Date(),
    });
  }
}

/**
 * USP PROCESSING WORKFLOW
 * SPRINT-035B TD-6: USP detection activities are QUARANTINED.
 * Detector source files exist in AlertAgent but are not wired into activity barrels.
 * This workflow is a no-op until USP detection is properly implemented and registered.
 */
export async function uspProcessingWorkflow(_params: {
  leagues: string[];
  isLiveMode: boolean;
  cycleCount: number;
}): Promise<void> {
  // No-op: USP detection not yet implemented.
  // When implemented, detector activities must be exported from AlertAgent/activities/index.ts
  // and registered in worker.ts before this workflow can call them.
}

/**
 * GRADING AND SCORING WORKFLOW
 * Fast grading and scoring for syndicate speed
 */
export async function gradingAndScoringWorkflow(params: {
  leagues: string[];
  isLiveMode: boolean;
  cycleCount: number;
}): Promise<void> {
  const { leagues, isLiveMode, cycleCount } = params;

  try {
    // Parallel grading across all leagues
    const gradingPromises = leagues.map(league =>
      gradingActivities.gradeNewProps({
        league,
        isLiveMode,
        cycleCount,
      })
    );

    const gradingResults = await Promise.allSettled(gradingPromises);

    // Collect successful grading results
    const successfulGrading = gradingResults
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);

    if (successfulGrading.length > 0) {
      // Score top-tier picks
      const scoringPromises = successfulGrading.map(gradedResult =>
        gradingActivities.scoreTopTierPicks({
          gradedProps: gradedResult.topTierProps,
          league: gradedResult.league,
          cycleCount,
        })
      );

      const scoringResults = await Promise.allSettled(scoringPromises);

      // Update final picks table
      const successfulScoring = scoringResults
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value);

      if (successfulScoring.length > 0) {
        await gradingActivities.updateUnifiedPicks({
          scoringResults: successfulScoring,
          cycleCount,
          timestamp: new Date(),
        });
      }
    }

    // Log any grading errors
    const failedGrading = gradingResults
      .filter(result => result.status === 'rejected')
      .map(result => result.reason);

    if (failedGrading.length > 0) {
      await operatorActivities.logError({
        workflow: 'gradingAndScoringWorkflow',
        error: `Grading failures: ${failedGrading.join('; ')}`,
        timestamp: new Date(),
      });
    }

    // SPRINT-044D: Capture closing snapshots every 5th cycle for CLV analysis
    if (cycleCount % 5 === 0) {
      try {
        await gradingActivities.captureClosingSnapshots({
          lookbackHours: 6,
          closeWindowMinutes: 30,
          maxEvents: 50,
        });
      } catch (err) {
        await operatorActivities.logError({
          workflow: 'gradingAndScoringWorkflow',
          error: `Closing snapshot capture failed: ${String(err)}`,
          timestamp: new Date(),
        });
      }
    }
  } catch (error) {
    await operatorActivities.logError({
      workflow: 'gradingAndScoringWorkflow',
      error: String(error),
      timestamp: new Date(),
    });
  }
}

/**
 * DISCORD ALERT WORKFLOW
 * SPRINT-035B TD-5: Simplified to use existing NotificationAgent exports.
 * Canonical pick posting is handled by DiscordPromotionAgent (webhook-based).
 * This workflow sends notifications for new picks via the registered sendNotification activity.
 */
export async function discordAlertWorkflow(params: {
  cycleCount: number;
  isLiveMode: boolean;
}): Promise<void> {
  const { cycleCount } = params;

  try {
    // 1. GET NEW FINAL PICKS
    const newPicks = await gradingActivities.getNewUnifiedPicks({ cycleCount });

    if (newPicks.length === 0) {
      return; // No new picks to alert
    }

    // 2. SEND NOTIFICATION FOR NEW PICKS
    // Uses the registered sendNotification activity from NotificationAgent
    await notificationActivities.sendNotification({
      type: 'new_picks',
      channel: 'discord',
      data: {
        picks: newPicks,
        cycleCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    await operatorActivities.logError({
      workflow: 'discordAlertWorkflow',
      error: String(error),
      timestamp: new Date(),
    });
  }
}
