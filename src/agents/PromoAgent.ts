import { BaseAgent } from '@/types/BaseAgent';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '@/utils/logger';
import { AgentConfig, AgentMetrics, HealthCheckResult } from '@/types/agent';
import { scorePropEdge } from '@/logic/scoring/edgeScoring';

interface PromoAgentDependencies {
  supabase: SupabaseClient;
  logger?: Logger;
  config: AgentConfig;
}

export class PromoAgent extends BaseAgent {
  constructor({ supabase, logger, config }: PromoAgentDependencies) {
    super({ supabase, logger, config });
  }

  protected async validateDependencies() {}

  protected async initializeResources() {}

  protected async process() {
    const { data: rawProps } = await this.supabase
      .from('raw_props')
      .select('*')
      .eq('is_promoted', false);

    // Add null coalescing in case rawProps is null
    for (const prop of rawProps ?? []) {
      const edgeScore = scorePropEdge(prop);

      if (edgeScore >= 18) {
        await this.supabase.from('daily_props').insert([{ ...prop, edge_score: edgeScore }]);
        await this.supabase.from('raw_props').update({ is_promoted: true }).eq('id', prop.id);
      }
    }

    this.logger.info('PromoAgent promotion cycle complete.');
  }

  protected async healthCheck(): Promise<HealthCheckResult> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {
        errors: [],
        warnings: [],
        info: { message: 'PromoAgent healthy' },
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

  protected async cleanup() {}
}
