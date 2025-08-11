import { makeLogger } from '../utils/logger';

const logger = makeLogger('OperatorActivities');

/**
 * OPERATOR ACTIVITIES
 * Activities for system monitoring, health checks, and operator notifications
 */

export async function logUSPError(params: {
  uspType: string;
  error: string;
  cycleCount: number;
}): Promise<{ success: boolean }> {
  try {
    logger.error(`USP Error - ${params.uspType}:`, {
      uspType: params.uspType,
      error: params.error,
      cycleCount: params.cycleCount,
      timestamp: new Date().toISOString()
    });

    // Send operator alert for critical USP errors
    const { sendOperatorAlert } = await import('./alerts');
    await sendOperatorAlert({
      type: 'system_error',
      message: `USP Detection Error (${params.uspType}): ${params.error}`,
      severity: 'high',
      metadata: {
        uspType: params.uspType,
        cycleCount: params.cycleCount
      }
    });

    return { success: true };
  } catch (error) {
    const errorContext = error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) };
    logger.error('Failed to log USP err:', errorContext);
    return { success: false };
  }
}

export async function monitorAPIQuota(params: {
  provider: string;
  currentUsage: number;
  limit: number;
}): Promise<{ success: boolean; shouldFallback: boolean; percentage: number }> {
  try {
    const percentage = (params.currentUsage / params.limit) * 100;
    
    logger.info(`API Quota Check - ${params.provider}:`, {
      provider: params.provider,
      currentUsage: params.currentUsage,
      limit: params.limit,
      percentage: percentage.toFixed(2)
    });

    // Send warning if quota is high
    if (percentage >= 90) {
      const { sendQuotaWarning } = await import('./alerts');
      await sendQuotaWarning({
        provider: params.provider,
        currentUsage: params.currentUsage,
        limit: params.limit,
        percentage
      });
    }

    return {
      success: true,
      shouldFallback: percentage >= 95,
      percentage
    };

  } catch (error) {
    const errorContext = error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) };
    logger.error(`API quota monitoring failed for ${params.provider}:`, errorContext);
    return {
      success: false,
      shouldFallback: true,
      percentage: 100
    };
  }
}

export async function checkSystemHealth(params: {
  cycleCount: number;
  components: string[];
}): Promise<{ success: boolean; healthScore: number; issues: string[] }> {
  try {
    logger.info(`System health check - Cycle ${params.cycleCount}`, {
      cycleCount: params.cycleCount,
      components: params.components
    });

    const issues: string[] = [];
    let healthScore = 100;

    // Check each component
    for (const component of params.components) {
      try {
        const componentHealth = await checkComponentHealth(component);
        if (!componentHealth.healthy) {
          issues.push(`${component}: ${componentHealth.issue}`);
          healthScore -= 20;
        }
      } catch (componentError) {
        issues.push(`${component}: Health check failed - ${componentError}`);
        healthScore -= 25;
      }
    }

    // Send alert if health is poor
    if (healthScore < 70) {
      const { sendOperatorAlert } = await import('./alerts');
      await sendOperatorAlert({
        type: 'system_error',
        message: `System Health Alert: Score ${healthScore}/100`,
        severity: healthScore < 50 ? 'critical' : 'high',
        metadata: {
          healthScore,
          issues,
          cycleCount: params.cycleCount
        }
      });
    }

    return {
      success: issues.length === 0,
      healthScore: Math.max(0, healthScore),
      issues
    };

  } catch (error) {
    const errorContext = error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) };
    logger.error('System health check failed:', errorContext);
    return {
      success: false,
      healthScore: 0,
      issues: [String(error)]
    };
  }
}

export async function detectLiveGames(params: {
  leagues: string[];
}): Promise<{ success: boolean; liveGames: any[]; errors: string[] }> {
  try {
    logger.info(`Detecting live games for leagues: ${params.leagues.join(', ')}`);

    const liveGames: any[] = [];
    const errors: string[] = [];

    // Mock live game detection - replace with actual implementation
    for (const league of params.leagues) {
      try {
        // Simulate live game detection
        const games = await mockLiveGameDetection(league);
        liveGames.push(...games);
      } catch (gameError) {
        errors.push(`Live game detection failed for ${league}: ${gameError}`);
      }
    }

    logger.info(`Live games detected:`, {
      leagues: params.leagues,
      liveGamesCount: liveGames.length,
      errors: errors.length
    });

    return {
      success: errors.length === 0,
      liveGames,
      errors
    };

  } catch (error) {
    const errorContext = error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) };
    logger.error('Live game detection failed:', errorContext);
    return {
      success: false,
      liveGames: [],
      errors: [String(error)]
    };
  }
}

export async function logWorkflowMetrics(params: {
  workflowName: string;
  duration: number;
  success: boolean;
  cycleCount: number;
  metadata?: any;
}): Promise<{ success: boolean }> {
  try {
    logger.info(`Workflow metrics - ${params.workflowName}:`, {
      workflowName: params.workflowName,
      duration: params.duration,
      success: params.success,
      cycleCount: params.cycleCount,
      ...params.metadata
    });

    // Send alert for slow workflows
    if (params.duration > 90000) { // 90 seconds
      const { sendOperatorAlert } = await import('./alerts');
      await sendOperatorAlert({
        type: 'system_error',
        message: `Slow Workflow: ${params.workflowName} took ${Math.round(params.duration / 1000)}s`,
        severity: 'high',
        metadata: {
          workflowName: params.workflowName,
          duration: params.duration,
          cycleCount: params.cycleCount
        }
      });
    }

    return { success: true };
  } catch (error) {
    const errorContext = error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) };
    logger.error('Failed to log workflow metrics:', errorContext);
    return { success: false };
  }
}

// Helper functions
async function checkComponentHealth(component: string): Promise<{ healthy: boolean; issue?: string }> {
  // Mock component health check - replace with actual implementation
  switch (component) {
    case 'database':
      return { healthy: true };
    case 'temporal':
      return { healthy: true };
    case 'discord':
      return { healthy: true };
    case 'apis':
      return { healthy: true };
    default:
      return { healthy: false, issue: 'Unknown component' };
  }
}

async function mockLiveGameDetection(league: string): Promise<any[]> {
  // Mock implementation - replace with actual live game detection
  return [
    {
      id: `${league}-game-${Date.now()}`,
      league,
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      status: 'live',
      startTime: new Date().toISOString()
    }
  ];
}