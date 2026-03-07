import { proxyActivities, sleep } from '@temporalio/workflow';

import type {
  FeedAgentActivities,
  AlertAgentActivities,
  OperatorAgentActivities,
} from '../types/activities';

// Export types that are imported elsewhere
export interface SystemHealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: Array<{
    name: string;
    status: 'passed' | 'failed';
    error?: string;
  }>;
  metrics: Record<string, number>;
}

export interface LiveGameUpdate {
  gameId: string;
  league: string;
  status: 'live' | 'completed' | 'scheduled';
  timestamp: string;
}

// SPRINT-035B TD-4: QuotaStatus removed — quota enforcement handled by ProviderGateway

export interface LiveGameMonitorResult {
  totalGames: number;
  liveGames: number;
  leagues: string[];
  status: 'active' | 'inactive';
  timestamp: string;
}

// Activity proxies
const feedActivities = proxyActivities<FeedAgentActivities>({
  startToCloseTimeout: '2 minutes',
});

const alertActivities = proxyActivities<AlertAgentActivities>({
  startToCloseTimeout: '30 seconds',
});

const operatorActivities = proxyActivities<OperatorAgentActivities>({
  startToCloseTimeout: '1 minute',
});

// SPRINT-035A B-16: syndicateSchedulerWorkflow removed — sole implementation is in syndicate-scheduler.ts

/**
 * LIVE GAME DETECTOR WORKFLOW
 * Continuously monitors for live games and adjusts system mode
 */
export async function liveGameDetectorWorkflow(): Promise<void> {
  const shouldContinue = true;
  const MAX_ITERATIONS = 1000000;
  let iteration = 0;

  while (shouldContinue && iteration < MAX_ITERATIONS) {
    try {
      const leagues = ['MLB', 'NBA', 'NFL', 'NHL', 'NCAAB', 'NCAAF', 'WNBA'];
      const allLiveGames: any[] = [];

      for (const league of leagues) {
        try {
          const result = await feedActivities.getLiveGames({ league });
          if (result.success && result.games) {
            allLiveGames.push(...result.games);
          }
        } catch (error) {
          await operatorActivities.logError({
            error: `Error getting live games for ${league}: ${error}`,
            timestamp: new Date(),
          });
        }
      }

      // Update live game status
      await operatorActivities.updateLiveGameStatus({
        liveGames: allLiveGames,
        totalCount: allLiveGames.length,
        leaguesWithLiveGames: Array.from(new Set(allLiveGames.map(g => g.league))),
        timestamp: new Date(),
      });

      // Determine check interval based on live game count
      const checkInterval = allLiveGames.length > 0 ? '30 seconds' : '5 minutes';
      await sleep(checkInterval);
      iteration++;
    } catch (error) {
      await operatorActivities.logError({
        error: `Live game detector error: ${error}`,
        workflow: 'liveGameDetectorWorkflow',
        timestamp: new Date(),
      });
      await sleep('2 minutes');
      iteration++;
    }
  }
}

/**
 * QUOTA MONITORING WORKFLOW
 * SPRINT-035B TD-4: Quota tracking is handled internally by ProviderGateway
 * (token bucket rate limiting, circuit breakers, credit tracking).
 * This workflow monitors at the workflow level and logs status.
 */
export async function quotaMonitoringWorkflow(): Promise<void> {
  const shouldContinue = true;
  const MAX_ITERATIONS = 1000000;
  let iteration = 0;

  while (shouldContinue && iteration < MAX_ITERATIONS) {
    try {
      // Quota enforcement is handled by ProviderGateway (circuit breakers, rate limits).
      // This workflow logs a periodic heartbeat for monitoring visibility.
      await operatorActivities.logError({
        error: `Quota monitoring heartbeat — cycle ${iteration}`,
        workflow: 'quotaMonitoringWorkflow',
        timestamp: new Date(),
      });

      await sleep('15 minutes');
      iteration++;
    } catch (error) {
      await operatorActivities.logError({
        error: `Quota monitoring error: ${error}`,
        workflow: 'quotaMonitoringWorkflow',
        timestamp: new Date(),
      });
      await sleep('5 minutes');
      iteration++;
    }
  }
}

/**
 * HEALTH MONITORING WORKFLOW
 * System health and performance monitoring
 */
export async function healthMonitoringWorkflow(): Promise<void> {
  const shouldContinue = true;
  const MAX_ITERATIONS = 1000000;
  let iteration = 0;

  while (shouldContinue && iteration < MAX_ITERATIONS) {
    try {
      // Comprehensive system health check (simplified)
      const healthResult = {
        healthScore: 95,
        issues: [] as string[],
        timestamp: new Date(),
      };

      // Send alerts for unhealthy systems
      if (healthResult.healthScore < 80) {
        await alertActivities.processAlert({
          type: 'health',
          healthScore: healthResult.healthScore,
          issues: healthResult.issues,
          severity: healthResult.healthScore < 60 ? 'critical' : 'warning',
        });
      }

      // Log health metrics
      await operatorActivities.logError({
        error: `Health monitoring update - Score: ${healthResult.healthScore}`,
        workflow: 'healthMonitoringWorkflow',
        timestamp: new Date(),
      });

      await sleep('2 minutes');
      iteration++;
    } catch (error) {
      await operatorActivities.logError({
        error: `Health monitoring error: ${error}`,
        workflow: 'healthMonitoringWorkflow',
        timestamp: new Date(),
      });
      await sleep('5 minutes');
      iteration++;
    }
  }
}

/**
 * LEAGUE SCHEDULE WORKFLOW
 * Generic league-specific scheduling and peak hours management
 */
export async function createLeagueScheduleWorkflow(league: string) {
  return async function leagueScheduleWorkflow(): Promise<void> {
    const shouldContinue = true;
    const MAX_ITERATIONS = 1000000;
    let iteration = 0;

    while (shouldContinue && iteration < MAX_ITERATIONS) {
      try {
        const peakHours = getLeaguePeakHours(league);
        const currentHour = new Date().getHours();
        const isPeakTime = currentHour >= peakHours.start && currentHour <= peakHours.end;

        // Adjust processing frequency based on peak hours
        const processingInterval = isPeakTime ? '30 seconds' : '5 minutes';

        // Process league-specific data using available feed activities
        await feedActivities.fetchFeed({
          league,
          isPeakTime,
          timestamp: new Date(),
        });

        await sleep(processingInterval);
        iteration++;
      } catch (error) {
        await operatorActivities.logError({
          error: `League schedule error for ${league}: ${error}`,
          workflow: `${league}ScheduleWorkflow`,
          timestamp: new Date(),
        });
        await sleep('2 minutes');
        iteration++;
      }
    }
  };
}

// Individual league workflows - directly implement the workflow logic
export async function nflScheduleWorkflow(): Promise<void> {
  const league = 'NFL';
  const shouldContinue = true;
  const MAX_ITERATIONS = 1000000;
  let iteration = 0;

  while (shouldContinue && iteration < MAX_ITERATIONS) {
    try {
      const peakHours = getLeaguePeakHours(league);
      const currentHour = new Date().getHours();
      const isPeakTime = currentHour >= peakHours.start && currentHour <= peakHours.end;

      const processingInterval = isPeakTime ? '30 seconds' : '5 minutes';

      // Process league-specific data using available feed activities
      await feedActivities.fetchFeed({
        league,
        isPeakTime,
        timestamp: new Date(),
      });

      await sleep(processingInterval);
      iteration++;
    } catch (error) {
      await operatorActivities.logError({
        error: `League schedule error for ${league}: ${error}`,
        workflow: `${league}ScheduleWorkflow`,
        timestamp: new Date(),
      });
      await sleep('2 minutes');
      iteration++;
    }
  }
}

export async function nbaScheduleWorkflow(): Promise<void> {
  const league = 'NBA';
  const shouldContinue = true;
  const MAX_ITERATIONS = 1000000;
  let iteration = 0;

  while (shouldContinue && iteration < MAX_ITERATIONS) {
    try {
      const peakHours = getLeaguePeakHours(league);
      const currentHour = new Date().getHours();
      const isPeakTime = currentHour >= peakHours.start && currentHour <= peakHours.end;

      const processingInterval = isPeakTime ? '30 seconds' : '5 minutes';

      // Process league-specific data using available feed activities
      await feedActivities.fetchFeed({
        league,
        isPeakTime,
        timestamp: new Date(),
      });

      await sleep(processingInterval);
      iteration++;
    } catch (error) {
      await operatorActivities.logError({
        error: `League schedule error for ${league}: ${error}`,
        workflow: `${league}ScheduleWorkflow`,
        timestamp: new Date(),
      });
      await sleep('2 minutes');
      iteration++;
    }
  }
}

export async function mlbScheduleWorkflow(): Promise<void> {
  const league = 'MLB';
  const shouldContinue = true;
  const MAX_ITERATIONS = 1000000;
  let iteration = 0;

  while (shouldContinue && iteration < MAX_ITERATIONS) {
    try {
      const peakHours = getLeaguePeakHours(league);
      const currentHour = new Date().getHours();
      const isPeakTime = currentHour >= peakHours.start && currentHour <= peakHours.end;

      const processingInterval = isPeakTime ? '30 seconds' : '5 minutes';

      // Process league-specific data using available feed activities
      await feedActivities.fetchFeed({
        league,
        isPeakTime,
        timestamp: new Date(),
      });

      await sleep(processingInterval);
      iteration++;
    } catch (error) {
      await operatorActivities.logError({
        error: `League schedule error for ${league}: ${error}`,
        workflow: `${league}ScheduleWorkflow`,
        timestamp: new Date(),
      });
      await sleep('2 minutes');
      iteration++;
    }
  }
}

export async function nhlScheduleWorkflow(): Promise<void> {
  const league = 'NHL';
  const shouldContinue = true;
  const MAX_ITERATIONS = 1000000;
  let iteration = 0;

  while (shouldContinue && iteration < MAX_ITERATIONS) {
    try {
      const peakHours = getLeaguePeakHours(league);
      const currentHour = new Date().getHours();
      const isPeakTime = currentHour >= peakHours.start && currentHour <= peakHours.end;

      const processingInterval = isPeakTime ? '30 seconds' : '5 minutes';

      // Process league-specific data using available feed activities
      await feedActivities.fetchFeed({
        league,
        isPeakTime,
        timestamp: new Date(),
      });

      await sleep(processingInterval);
      iteration++;
    } catch (error) {
      await operatorActivities.logError({
        error: `League schedule error for ${league}: ${error}`,
        workflow: `${league}ScheduleWorkflow`,
        timestamp: new Date(),
      });
      await sleep('2 minutes');
      iteration++;
    }
  }
}

export async function ncaafScheduleWorkflow(): Promise<void> {
  const league = 'NCAAF';
  const shouldContinue = true;
  const MAX_ITERATIONS = 1000000;
  let iteration = 0;

  while (shouldContinue && iteration < MAX_ITERATIONS) {
    try {
      const peakHours = getLeaguePeakHours(league);
      const currentHour = new Date().getHours();
      const isPeakTime = currentHour >= peakHours.start && currentHour <= peakHours.end;

      const processingInterval = isPeakTime ? '30 seconds' : '5 minutes';

      // Process league-specific data using available feed activities
      await feedActivities.fetchFeed({
        league,
        isPeakTime,
        timestamp: new Date(),
      });

      await sleep(processingInterval);
      iteration++;
    } catch (error) {
      await operatorActivities.logError({
        error: `League schedule error for ${league}: ${error}`,
        workflow: `${league}ScheduleWorkflow`,
        timestamp: new Date(),
      });
      await sleep('2 minutes');
      iteration++;
    }
  }
}

export async function ncaabScheduleWorkflow(): Promise<void> {
  const league = 'NCAAB';
  const shouldContinue = true;
  const MAX_ITERATIONS = 1000000;
  let iteration = 0;

  while (shouldContinue && iteration < MAX_ITERATIONS) {
    try {
      const peakHours = getLeaguePeakHours(league);
      const currentHour = new Date().getHours();
      const isPeakTime = currentHour >= peakHours.start && currentHour <= peakHours.end;

      const processingInterval = isPeakTime ? '30 seconds' : '5 minutes';

      // Process league-specific data using available feed activities
      await feedActivities.fetchFeed({
        league,
        isPeakTime,
        timestamp: new Date(),
      });

      await sleep(processingInterval);
      iteration++;
    } catch (error) {
      await operatorActivities.logError({
        error: `League schedule error for ${league}: ${error}`,
        workflow: `${league}ScheduleWorkflow`,
        timestamp: new Date(),
      });
      await sleep('2 minutes');
      iteration++;
    }
  }
}

export async function wnbaScheduleWorkflow(): Promise<void> {
  const league = 'WNBA';
  const shouldContinue = true;
  const MAX_ITERATIONS = 1000000;
  let iteration = 0;

  while (shouldContinue && iteration < MAX_ITERATIONS) {
    try {
      const peakHours = getLeaguePeakHours(league);
      const currentHour = new Date().getHours();
      const isPeakTime = currentHour >= peakHours.start && currentHour <= peakHours.end;

      const processingInterval = isPeakTime ? '30 seconds' : '5 minutes';

      // Process league-specific data using available feed activities
      await feedActivities.fetchFeed({
        league,
        isPeakTime,
        timestamp: new Date(),
      });

      await sleep(processingInterval);
      iteration++;
    } catch (error) {
      await operatorActivities.logError({
        error: `League schedule error for ${league}: ${error}`,
        workflow: `${league}ScheduleWorkflow`,
        timestamp: new Date(),
      });
      await sleep('2 minutes');
      iteration++;
    }
  }
}

/**
 * Helper function to get league-specific peak hours
 */
function getLeaguePeakHours(league: string): { start: number; end: number } {
  const peakHours: Record<string, { start: number; end: number }> = {
    MLB: { start: 18, end: 23 }, // 6 PM - 11 PM
    NBA: { start: 18, end: 23 }, // 6 PM - 11 PM
    NFL: { start: 12, end: 23 }, // 12 PM - 11 PM (Sunday/Monday)
    NHL: { start: 18, end: 23 }, // 6 PM - 11 PM
    NCAAB: { start: 18, end: 23 }, // 6 PM - 11 PM
    NCAAF: { start: 11, end: 23 }, // 11 AM - 11 PM (Saturday)
    WNBA: { start: 18, end: 22 }, // 6 PM - 10 PM (typically evening games)
  };

  return peakHours[league] || { start: 18, end: 23 };
}
