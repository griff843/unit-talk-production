import { proxyActivities } from '@temporalio/workflow';
import type {
  FeedAgentActivities,
  AlertAgentActivities,
  OperatorAgentActivities,
  NotificationAgentActivities
} from '../types/activities';

// Activity proxies for support workflows
const feedActivities = proxyActivities<FeedAgentActivities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '3 seconds',
    maximumInterval: '30 seconds'
  }
});

const alertActivities = proxyActivities<AlertAgentActivities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 2,
    initialInterval: '1 second',
    maximumInterval: '10 seconds'
  }
});

const operatorActivities = proxyActivities<OperatorAgentActivities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 2,
    initialInterval: '1 second',
    maximumInterval: '10 seconds'
  }
});

const notificationActivities = proxyActivities<NotificationAgentActivities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    maximumAttempts: 2,
    initialInterval: '1 second',
    maximumInterval: '5 seconds'
  }
});

/**
 * LIVE GAME DETECTOR WORKFLOW
 * Continuously monitors for live games and adjusts system mode
 */
export async function liveGameDetectorWorkflow(): Promise<void> {
  while (true) {
    try {
      // Get live games from all leagues
      const leagues = ['MLB', 'NBA', 'NFL', 'NHL', 'NCAAB', 'NCAAF'];
      const allLiveGames: any[] = [];
      
      for (const league of leagues) {
        try {
          const liveGames = await feedActivities.getLiveGames({ league });
          allLiveGames.push(...liveGames);
        } catch (error) {
          console.log(`Error getting live games for ${league}:`, error);
        }
      }
      
      // Update live game status
      // Update live game status
      await operatorActivities.updateLiveGameStatus({
        liveGames: allLiveGames,
        totalCount: allLiveGames.length,
        leaguesWithLiveGames: Array.from(new Set(allLiveGames.map(g => g.league))),
        timestamp: new Date()
      });

      // Determine system mode
      if (allLiveGames.length > 0) {
        await operatorActivities.ensureLiveMode({
          reason: `${allLiveGames.length} live games detected`,
          games: allLiveGames
        });
      } else {
        await operatorActivities.ensureOffPeakMode({
          reason: 'No live games detected'
        });
      }
      
      // Wait before next check (30 seconds)
      await new Promise(resolve => setTimeout(resolve, 30000));
      
    } catch (error) {
      console.error('Live game detector error:', error);
      await new Promise(resolve => setTimeout(resolve, 60000)); // Wait longer on error
    }
  }
}

/**
 * QUOTA MONITORING WORKFLOW
 * Monitors API quotas and activates fallback modes when needed
 */
export async function quotaMonitoringWorkflow(): Promise<void> {
  const providers = ['Optimal', 'SGO', 'Fallback'];
  
  while (true) {
    try {
      for (const provider of providers) {
        const quotaStatus = await operatorActivities.checkApiQuota({ provider });

        // Log quota status
        await operatorActivities.logQuotaStatus({
          providers: [quotaStatus],
          timestamp: new Date()
        });

        // Check for quota warnings
        const usagePercentage = quotaStatus.hourlyUsed / quotaStatus.hourlyLimit;

        if (usagePercentage >= 0.9) {
          await alertActivities.sendQuotaCritical({
            provider,
            usagePercent: usagePercentage,
            remainingCalls: quotaStatus.remainingCalls,
            resetTime: quotaStatus.resetTime
          });

          // Activate fallback if primary provider is over quota
          if (provider === 'Optimal') {
            await operatorActivities.activateFallbackMode({
              primary: provider,
              fallbacks: ['SGO', 'Fallback'],
              reason: 'Primary quota exceeded'
            });
          }
        } else if (usagePercentage >= 0.8) {
          await alertActivities.sendQuotaWarning({
            provider,
            usagePercent: usagePercentage,
            remainingCalls: quotaStatus.remainingCalls,
            resetTime: quotaStatus.resetTime
          });
        }
      }

      // Wait 5 minutes before next check
      await new Promise(resolve => setTimeout(resolve, 300000));

    } catch (error) {
      console.error('Quota monitoring error:', error);
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }
}

/**
 * HEALTH MONITORING WORKFLOW
 * Monitors system health and performance metrics
 */
export async function healthMonitoringWorkflow(): Promise<void> {
  while (true) {
    try {
      // Check database health
      const dbHealth = await operatorActivities.checkDatabaseHealth();
      
      // Check API endpoints
      const endpoints = ['optimal-api', 'sgo-api', 'supabase'];
      const apiHealth = await operatorActivities.checkApiEndpoints({ endpoints });

      // Get workflow metrics
      const workflowMetrics = await operatorActivities.getWorkflowMetrics({
        timeWindow: 3600000 // 1 hour in milliseconds
      });

      // Get system metrics
      const systemMetrics = await operatorActivities.getSystemMetrics();

      // Calculate overall health score
      const healthScore = calculateHealthScore({
        database: dbHealth,
        endpoints: apiHealth,
        workflows: workflowMetrics,
        system: systemMetrics
      });

      // Log health status
      await operatorActivities.logHealthStatus({
        healthScore,
        dbHealth,
        apiHealth,
        workflowMetrics,
        systemMetrics,
        timestamp: new Date()
      });

      // Send alerts if health is poor
      if (healthScore < 0.7) {
        await notificationActivities.sendNotification({
          type: 'health_alert',
          severity: 'warning',
          message: `System health score: ${(healthScore * 100).toFixed(1)}%`,
          data: { healthScore, timestamp: new Date() }
        });
      }
      
      // Wait 2 minutes before next check
      await new Promise(resolve => setTimeout(resolve, 120000));
      
    } catch (error) {
      console.error('Health monitoring error:', error);
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }
}

/**
 * LEAGUE SCHEDULE WORKFLOW
 * Manages league-specific scheduling and peak hours
 */
export async function leagueScheduleWorkflow(params: { league: string }): Promise<void> {
  const { league } = params;
  
  while (true) {
    try {
      const now = new Date();
      const hour = now.getHours();
      
      // Define peak hours for each league
      const peakHours = getPeakHours(league);
      const isPeakHour = hour >= peakHours.start && hour <= peakHours.end;
      
      if (isPeakHour) {
        await operatorActivities.ensureLiveMode({
          reason: `Peak hours for ${league}: ${peakHours.start}:00-${peakHours.end}:00`,
          games: [] // Empty array for peak hours mode
        });
      } else {
        await operatorActivities.ensureOffPeakMode({
          reason: `Off-peak hours for ${league}`
        });
      }

      // Wait 10 minutes before next check
      await new Promise(resolve => setTimeout(resolve, 600000));
      
    } catch (error) {
      console.error(`League schedule error for ${league}:`, error);
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }
}

// Helper functions
function calculateHealthScore(metrics: any): number {
  let score = 1.0;
  
  // Database health (25% weight)
  if (!metrics.database.connected) score -= 0.25;
  else if (metrics.database.responseTime > 1000) score -= 0.1;
  
  // Endpoint health (25% weight)
  const unhealthyEndpoints = metrics.endpoints.filter((e: any) => !e.healthy).length;
  score -= (unhealthyEndpoints / metrics.endpoints.length) * 0.25;
  
  // Workflow health (25% weight)
  if (metrics.workflows.failureRate > 0.1) score -= 0.25;
  else if (metrics.workflows.failureRate > 0.05) score -= 0.1;
  
  // System health (25% weight)
  if (metrics.system.memoryUsage > 0.9) score -= 0.15;
  if (metrics.system.cpuUsage > 0.9) score -= 0.1;
  
  return Math.max(0, score);
}

function getPeakHours(league: string): { start: number; end: number } {
  const peakHours: Record<string, { start: number; end: number }> = {
    'MLB': { start: 17, end: 23 }, // 5 PM - 11 PM
    'NBA': { start: 18, end: 23 }, // 6 PM - 11 PM
    'NFL': { start: 12, end: 23 }, // 12 PM - 11 PM (Sunday/Monday)
    'NHL': { start: 18, end: 23 }, // 6 PM - 11 PM
    'NCAAB': { start: 18, end: 23 }, // 6 PM - 11 PM
    'NCAAF': { start: 11, end: 23 }  // 11 AM - 11 PM (Saturday)
  };
  
  return peakHours[league] || { start: 18, end: 23 };
}