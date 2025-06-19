import { BaseAgentActivitiesImpl } from '../../BaseAgent/activities';
import { ActivityParams, ActivityResult, GradingAgentActivities } from '../../../types/activities';
import { BaseAgentConfig, BaseAgentDependencies } from '../../BaseAgent/types';

export class GradingAgentActivitiesImpl extends BaseAgentActivitiesImpl implements GradingAgentActivities {
  private agent: any; // Using any to avoid circular dependency
  private config: BaseAgentConfig;
  private deps: BaseAgentDependencies;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super('GradingAgent', deps.supabase!);
    // Ensure logger is defined
    if (!deps.logger) {
      throw new Error('Logger is required for GradingAgent activities');
    }
    this.config = config;
    this.deps = deps;
  }

  private async getAgent() {
    if (!this.agent) {
      // Lazy import to avoid circular dependency
      const { GradingAgent } = await import('../index');
      this.agent = new GradingAgent(this.config, {
        ...this.deps,
        logger: this.deps.logger!
      });
    }
    return this.agent;
  }

  async gradeSubmission(params: ActivityParams): Promise<ActivityResult> {
    try {
      const agent = await this.getAgent();
      await agent.handleCommand({
        type: 'GRADE_SUBMISSION',
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

  async updateGrades(params: ActivityParams): Promise<ActivityResult> {
    try {
      const agent = await this.getAgent();
      await agent.handleCommand({
        type: 'UPDATE_GRADES',
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

  async generateFeedback(params: ActivityParams): Promise<ActivityResult> {
    try {
      const agent = await this.getAgent();
      await agent.handleCommand({
        type: 'GENERATE_FEEDBACK',
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
    const agent = await this.getAgent();
    await agent.start();
  }
}