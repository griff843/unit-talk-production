import { BaseAgent } from '@/types/BaseAgent';
import { FeedAgent } from './FeedAgent';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '@/utils/logger';
import { AgentConfig, AgentMetrics, AgentStatus, HealthCheckResult } from '@/types/agent';

// Interfaces for your dependencies
interface IngestionAgentDependencies {
  supabase: SupabaseClient;
  logger?: Logger;
  config: AgentConfig;
  feedAgent: FeedAgent;
}

export class IngestionAgent extends BaseAgent {
  private readonly feedAgent: FeedAgent;

  constructor({ supabase, logger, config, feedAgent }: IngestionAgentDependencies) {
    super({ supabase, logger, config });
    this.feedAgent = feedAgent;
  }

  protected async validateDependencies() {
    if (!this.feedAgent) throw new Error('FeedAgent not initialized.');
  }

  protected async initializeResources() {
    this.logger.info('IngestionAgent resources initialized.');
  }

  protected async process() {
    this.logger.info('IngestionAgent starting ingestion pipeline...');

    await this.feedAgent.fetchAndInsertProps();

    this.logger.info('IngestionAgent ingestion pipeline completed.');
  }

  protected async healthCheck(): Promise<HealthCheckResult> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {
        errors: [],
        warnings: [],
        info: { message: 'IngestionAgent healthy' },
      },
    };
  }

  protected async collectMetrics(): Promise<AgentMetrics> {
    return {
      agentName: this.config.name,
      status: 'healthy',
      successCount: 1,
      warningCount: 0,
      errorCount: 0,
      timestamp: new Date().toISOString(),
    };
  }

  protected async cleanup() {
    this.logger.info('IngestionAgent cleanup completed.');
  }
}
