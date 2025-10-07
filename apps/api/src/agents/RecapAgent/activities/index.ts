import { RecapAgent } from '../index';
import { BaseAgentDependencies } from '../../BaseAgent/types';
import { RecapService } from '../recapService';
import { RecapFormatter } from '../recapFormatter';
import { requireSupabase } from '../../../utils/supabaseUtils';

// Create RecapAgent instance for activities
function getRecapAgentInstance(): RecapAgent {
  const dependencies: BaseAgentDependencies = {
    supabase: requireSupabase(),
    logger: console as any,
    errorHandler: null as any
  };

  const recapService = new RecapService(requireSupabase()!);
  const recapFormatter = new RecapFormatter();

  // Create minimal state manager
  const stateManager = {
    async loadState() {
      return {
        manualTriggers: { daily: 0, weekly: 0, monthly: 0 }
      };
    },
    async saveState(state: any) {
      // Store state in database if needed
    },
    async updateState(updates: any) {
      return true;
    }
  };

  return new RecapAgent(
    { agentId: 'recap-agent', agentType: 'recap' },
    dependencies,
    recapService,
    recapFormatter,
    stateManager
  );
}

export async function triggerDailyRecap(date?: string): Promise<void> {
  try {
    console.log(`[RecapAgent] Triggering daily recap for ${date || 'today'}`);
    const agent = getRecapAgentInstance();
    await agent.triggerDailyRecap(date);
    console.log(`[RecapAgent] Daily recap completed successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[RecapAgent] Daily recap failed:`, errorMessage);
    throw error;
  }
}

export async function triggerWeeklyRecap(): Promise<void> {
  try {
    console.log(`[RecapAgent] Triggering weekly recap`);
    const agent = getRecapAgentInstance();
    await agent.triggerWeeklyRecap();
    console.log(`[RecapAgent] Weekly recap completed successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[RecapAgent] Weekly recap failed:`, errorMessage);
    throw error;
  }
}

export async function triggerMonthlyRecap(): Promise<void> {
  try {
    console.log(`[RecapAgent] Triggering monthly recap`);
    const agent = getRecapAgentInstance();
    await agent.triggerMonthlyRecap();
    console.log(`[RecapAgent] Monthly recap completed successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[RecapAgent] Monthly recap failed:`, errorMessage);
    throw error;
  }
}

export async function checkMicroRecapTriggers(): Promise<void> {
  try {
    console.log(`[RecapAgent] Checking micro recap triggers`);
    // Micro recaps are triggered by specific events (hedge opportunities, steam moves, etc.)
    // This is a polling check for any pending micro recap triggers
    const agent = getRecapAgentInstance();

    // Check if there are any high-priority picks that need immediate recap
    // For now, this is a no-op placeholder
    console.log(`[RecapAgent] Micro recap check completed`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[RecapAgent] Micro recap check failed:`, errorMessage);
    throw error;
  }
}
