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

    // Mock quota data - in production this would check actual API quotas
    const quotaData = {
      provider: params.provider,
      hourlyUsed: Math.floor(Math.random() * 100),
      hourlyLimit: 500,
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

export async function logError(params: { error: string; workflow?: string; timestamp?: Date; agentId?: string }): Promise<{ success: boolean; message: string }> {
  try {
    const timestamp = params.timestamp || new Date();
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