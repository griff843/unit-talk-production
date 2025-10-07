import { OperatorAgent } from '..';
import { BaseAgentDependencies } from '../../BaseAgent/types';

// Mock dependencies for activities
const getDependencies = (): BaseAgentDependencies => {
  // This would be properly injected in production
  return {
    supabase: null as any,
    logger: console as any,
    errorHandler: null as any
  };
};

export async function monitorSystem(): Promise<void> {
  const agent = OperatorAgent.getInstance(getDependencies());
  await agent.monitorAgents();
}

export async function handleAlert(alert: any): Promise<void> {
  const agent = OperatorAgent.getInstance(getDependencies());
  await agent.handleCommand(`handle alert: ${JSON.stringify(alert)}`);
}

export async function performMaintenance(): Promise<void> {
  const agent = OperatorAgent.getInstance(getDependencies());
  await agent.generateSummary('daily');
  await agent.learnAndEvolve();
}

export async function handleCriticalError(params: { errorMessage: string; agentId: string; timestamp?: string }): Promise<{ success: boolean; message: string }> {
  const agent = OperatorAgent.getInstance(getDependencies());
  
  try {
    console.log(`[OperatorAgent] Handling critical error from ${params.agentId}: ${params.errorMessage}`);
    
    // Handle the critical error - could involve alerts, notifications, etc.
    await agent.handleCommand(`critical error: ${params.errorMessage}`);
    
    return {
      success: true,
      message: `Critical error handled successfully for agent ${params.agentId}`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[OperatorAgent] Failed to handle critical error:`, errorMessage);
    
    return {
      success: false,
      message: `Failed to handle critical error: ${errorMessage}`
    };
  }
}

export async function updateLiveGameStatus(params: { liveGames: any[]; totalCount: number; leaguesWithLiveGames: string[]; timestamp?: string; agentId?: string }): Promise<{ success: boolean; message: string; data?: any }> {
  const agent = OperatorAgent.getInstance(getDependencies());
  
  try {
    console.log(`[OperatorAgent] Updating live game status: ${params.totalCount} live games across leagues: ${params.leaguesWithLiveGames.join(', ')}`);
    
    // Process live game status updates
    await agent.handleCommand(`update live games: ${JSON.stringify(params)}`);
    
    return {
      success: true,
      message: `Live game status updated for ${params.totalCount} games`,
      data: {
        liveGames: params.liveGames,
        totalCount: params.totalCount,
        leagues: params.leaguesWithLiveGames,
        timestamp: params.timestamp || new Date().toISOString()
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[OperatorAgent] Failed to update live game status:`, errorMessage);
    
    return {
      success: false,
      message: `Failed to update live game status: ${errorMessage}`
    };
  }
}

export async function logUSPError(params: { uspType: string; error: string; cycleCount?: number; timestamp?: string; agentId?: string }): Promise<{ success: boolean; message: string }> {
  const agent = OperatorAgent.getInstance(getDependencies());

  try {
    console.log(`[OperatorAgent] Logging USP error (${params.uspType}): ${params.error} - Cycle: ${params.cycleCount || 'unknown'}`);

    // Log USP (United Syndicate Protocol) error for monitoring
    await agent.handleCommand(`USP error logged: type=${params.uspType}, error=${params.error}, cycle=${params.cycleCount}`);

    return {
      success: true,
      message: `USP error logged successfully (type: ${params.uspType})`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[OperatorAgent] Failed to log USP error:`, errorMessage);

    return {
      success: false,
      message: `Failed to log USP error: ${errorMessage}`
    };
  }
}

// Add missing activities for Temporal workflows
export async function checkApiQuota(params: { provider: string }): Promise<{ provider: string; hourlyUsed: number; hourlyLimit: number; resetTime: Date }> {
  try {
    console.log(`[OperatorAgent] Checking API quota for provider: ${params.provider}`);

    // TODO: Implement real API quota checking via provider-specific endpoints
    // For now, return conservative estimates based on known limits
    const quotaLimits: Record<string, { hourly: number; daily: number }> = {
      'odds-api': { hourly: 500, daily: 10000 },
      'sgo-api': { hourly: 300, daily: 5000 },
      'optimal-api': { hourly: 200, daily: 3000 }
    };

    const limits = quotaLimits[params.provider.toLowerCase()] || { hourly: 100, daily: 1000 };

    const quotaData = {
      provider: params.provider,
      hourlyUsed: 0, // Would query from tracking system
      hourlyLimit: limits.hourly,
      resetTime: new Date(Date.now() + 3600000) // 1 hour from now
    };

    console.log(`[OperatorAgent] Quota check result: ${quotaData.hourlyUsed}/${quotaData.hourlyLimit} for ${params.provider}`);

    return quotaData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[OperatorAgent] Failed to check API quota:`, errorMessage);

    // Return safe defaults on error
    return {
      provider: params.provider,
      hourlyUsed: 0,
      hourlyLimit: 500,
      resetTime: new Date(Date.now() + 3600000)
    };
  }
}

export async function logError(params: { error: string; workflow?: string; league?: string; timestamp?: Date; agentId?: string }): Promise<{ success: boolean; message: string }> {
  try {
    const timestamp = params.timestamp instanceof Date ? params.timestamp : new Date();
    const workflow = params.workflow || 'unknown';

    console.log(`[OperatorAgent] ${timestamp.toISOString()} - Workflow: ${workflow} - Error: ${params.error}`);

    return {
      success: true,
      message: `Error logged successfully for workflow: ${workflow}`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[OperatorAgent] Failed to log error:`, errorMessage);

    return {
      success: false,
      message: `Failed to log error: ${errorMessage}`
    };
  }
}

export async function logFallbackActivation(params: { league: string; primaryError: string; cycleCount: number }): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`[OperatorAgent] Fallback activated for ${params.league} - Cycle: ${params.cycleCount}`);
    console.log(`[OperatorAgent] Primary error: ${params.primaryError}`);

    return {
      success: true,
      message: `Fallback activation logged for ${params.league}`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[OperatorAgent] Failed to log fallback activation:`, errorMessage);

    return {
      success: false,
      message: `Failed to log fallback activation: ${errorMessage}`
    };
  }
}

export async function logPerformanceWarning(params: { cycleTime: number; maxCycleTime: number; cycleCount: number; message: string }): Promise<{ success: boolean; message: string }> {
  try {
    console.warn(`[OperatorAgent] Performance Warning - Cycle ${params.cycleCount}: ${params.message}`);
    console.warn(`[OperatorAgent] Cycle time: ${params.cycleTime}ms exceeded max: ${params.maxCycleTime}ms`);

    return {
      success: true,
      message: `Performance warning logged for cycle ${params.cycleCount}`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[OperatorAgent] Failed to log performance warning:`, errorMessage);

    return {
      success: false,
      message: `Failed to log performance warning: ${errorMessage}`
    };
  }
}

export async function updateProcessingMetrics(params: { league: string; batchId: string; propCount: number; cycleCount: number; processingTime: number }): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`[OperatorAgent] Processing metrics - League: ${params.league}, Props: ${params.propCount}, Cycle: ${params.cycleCount}`);
    console.log(`[OperatorAgent] Batch ID: ${params.batchId}, Processing time: ${params.processingTime}ms`);

    return {
      success: true,
      message: `Processing metrics updated for ${params.league}`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[OperatorAgent] Failed to update processing metrics:`, errorMessage);

    return {
      success: false,
      message: `Failed to update processing metrics: ${errorMessage}`
    };
  }
} 