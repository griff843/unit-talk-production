// src/agents/FeedAgent.ts

import { BaseAgent } from '../BaseAgent/index';
import { fetchSGOProps } from '../../logic/providers/sgoFetcher'; // Your new working SGO fetcher
import { scoreEdge, getTier } from '../../logic/edgeScoring';    // Your scoring logic
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from '../../utils/logger';
import type { BaseAgentConfig, BaseAgentDependencies, AgentStatus } from '../BaseAgent/types';

interface FeedAgentConfig extends BaseAgentConfig {
  sgoApiKey: string;
  leagueID: string;
  fetchWindowHours?: number; // How far ahead/behind to fetch
}

interface FeedAgentMetrics {
  fetched: number;
  scored: number;
  inserted: number;
  duplicates: number;
  errors: number;
}

export class FeedAgent extends BaseAgent {
  private config: FeedAgentConfig;
  private supabase: SupabaseClient;
  private logger: Logger;
  private metrics: FeedAgentMetrics;

  constructor(config: FeedAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    this.config = config;
    this.supabase = deps.supabase;
    this.logger = deps.logger;
    this.metrics = {
      fetched: 0,
      scored: 0,
      inserted: 0,
      duplicates: 0,
      errors: 0,
    };
  }

  /**
   * Main entry point for ingestion—call this on schedule or from Temporal.
   */
  public async ingest(): Promise<void> {
    this.metrics = { fetched: 0, scored: 0, inserted: 0, duplicates: 0, errors: 0 };
    const { sgoApiKey, leagueID, fetchWindowHours = 48 } = this.config;

    // 1. Fetch/normalize props using your new working SGO fetcher
    let props: any[];
    try {
      const now = new Date();
      const after = now.toISOString();
      const before = new Date(now.getTime() + fetchWindowHours * 60 * 60 * 1000).toISOString();
      props = await fetchSGOProps({
        apiKey: sgoApiKey,
        leagueID,
        startsAfter: after,
        startsBefore: before,
        includeAltLine: true,
        oddsAvailable: true,
        limit: 1000,
      });
      this.metrics.fetched = props.length;
      this.logger.info(`[FeedAgent] Fetched ${props.length} props from SGO`);
    } catch (err) {
      this.logger.error(`[FeedAgent] SGO fetch failed: ${(err as Error).message}`);
      return;
    }

    if (!props.length) {
      this.logger.warn('[FeedAgent] No props fetched. Exiting.');
      return;
    }

    // 2. Score and tier all props (plug in your own logic)
    const scoredProps = props.map((p) => ({
      ...p,
      edgeScore: scoreEdge(p),
      tier: getTier(scoreEdge(p)), // Optional, comment out if you tier elsewhere
    }));
    this.metrics.scored = scoredProps.length;

    // 3. Deduplicate and upsert into Supabase
    try {
      // Fetch all existing external_ids in this batch (idempotent insert)
      const externalIds = scoredProps.map((p) => p.marketKey || p.external_id);
      const { data: existing, error: fetchError } = await this.supabase
        .from('raw_props')
        .select('external_id')
        .in('external_id', externalIds);

      if (fetchError) throw fetchError;
      const existingIds = new Set(existing?.map((e: any) => e.external_id));

      // Insert new props only
      for (const prop of scoredProps) {
        const extId = prop.marketKey || prop.external_id;
        if (!extId || existingIds.has(extId)) {
          this.metrics.duplicates++;
          continue;
        }
        const insert = {
          ...prop,
          external_id: extId,
          inserted_at: new Date().toISOString(),
        };
        const { error } = await this.supabase.from('raw_props').insert(insert);
        if (error) {
          this.metrics.errors++;
          this.logger.error(`[FeedAgent] Insert failed: ${error.message} | prop: ${extId}`);
        } else {
          this.metrics.inserted++;
        }
      }
    } catch (err) {
      this.logger.error(`[FeedAgent] Insert/upsert error: ${(err as Error).message}`);
      this.metrics.errors++;
    }

    // 4. Log and report metrics
    this.logger.info('[FeedAgent] Ingestion run complete', { metrics: this.metrics });
  }

  // (Optional) Implement health check, metrics, and agent lifecycle hooks if desired
  protected async checkHealth(): Promise<AgentStatus> {
    // Customize health check as needed
    return 'healthy';
  }
}
