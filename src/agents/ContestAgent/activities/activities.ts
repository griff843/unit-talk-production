import { BaseAgentActivitiesImpl } from '../../BaseAgent/activities';
import { ActivityParams, ActivityResult, ContestAgentActivities } from '../../../types/activities';
import { BaseAgentConfig, BaseAgentDependencies } from '../../BaseAgent/types';

export class ContestAgentActivitiesImpl extends BaseAgentActivitiesImpl implements ContestAgentActivities {
  private agent: any; // Using any to avoid circular dependency
  private config: BaseAgentConfig;
  private deps: BaseAgentDependencies;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super('ContestAgent', deps.supabase!);
    // Ensure logger is defined
    if (!deps.logger) {
      throw new Error('Logger is required for ContestAgent activities');
    }
    this.config = config;
    this.deps = deps;
  }

  private async getAgent() {
    if (!this.agent) {
      // Lazy import to avoid circular dependency
      const { ContestAgent } = await import('../index');
      this.agent = new ContestAgent(this.config, {
        ...this.deps,
        logger: this.deps.logger!
      });
    }
    return this.agent;
  }

  async createContest(params: ActivityParams): Promise<ActivityResult> {
    try {
      const agent = await this.getAgent();
      await agent.handleCommand({
        type: 'CREATE_CONTEST',
        payload: params,
        timestamp: new Date().toISOString(),
        source: 'temporal-activity'
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  async processEntries(params: ActivityParams): Promise<ActivityResult> {
    try {
      const agent = await this.getAgent();
      await agent.handleCommand({
        type: 'PROCESS_ENTRIES',
        payload: params,
        timestamp: new Date().toISOString(),
        source: 'temporal-activity'
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  async determineWinners(params: ActivityParams): Promise<ActivityResult> {
    try {
      const agent = await this.getAgent();
      await agent.handleCommand({
        type: 'DETERMINE_WINNERS',
        payload: params,
        timestamp: new Date().toISOString(),
        source: 'temporal-activity'
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  protected async validateDependencies(): Promise<void> {
    // Validate that required dependencies are available
    if (!this.supabase) {
      throw new Error('Supabase client is required');
    }
  }

  protected async initializeResources(): Promise<void> {
    // Initialize the agent using the public start method
    await this.agent.start();
  }
}

