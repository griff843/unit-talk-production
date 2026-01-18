import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';

/**
 * Recent pick view data
 */
export interface RecentPickView {
  id: string;
  tenantId: string;
  userId: string;
  username?: string;
  playerName?: string;
  sport?: string;
  marketType?: string;
  line?: number;
  side?: string;
  odds?: number;
  stake?: number;
  confidence?: number;
  status?: string;
  workflowStage?: string;
  createdAt: string;
  publishedAt?: string;
}

/**
 * PicksReaderService - Views-based reads with fallback
 *
 * Attempts to read from optimized vw_recent_picks view first,
 * falls back to direct table joins if view is not available.
 */
export class PicksReaderService {
  private supabase: SupabaseClient;
  private viewAvailable: boolean | null = null;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient(env.supabase.url, env.supabase.serviceRoleKey);
  }

  /**
   * Get recent picks for Command Center
   *
   * @param tenantId - Tenant ID for filtering
   * @param limit - Maximum number of picks to return
   */
  async getRecentPicks(tenantId: string, limit = 50): Promise<RecentPickView[]> {
    // Check if view is available (cache the result)
    if (this.viewAvailable === null) {
      this.viewAvailable = await this.checkViewExists();
    }

    if (this.viewAvailable) {
      return await this.getRecentPicksFromView(tenantId, limit);
    } else {
      logger.info('vw_recent_picks not available, using fallback query', { tenantId });
      return await this.getRecentPicksFromTables(tenantId, limit);
    }
  }

  /**
   * Get recent picks from vw_recent_picks view (optimized)
   */
  private async getRecentPicksFromView(tenantId: string, limit: number): Promise<RecentPickView[]> {
    try {
      const { data, error } = await this.supabase
        .from('vw_recent_picks')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error reading from vw_recent_picks', {
          error: error.message,
          tenantId,
        });
        // Fallback to direct query
        return await this.getRecentPicksFromTables(tenantId, limit);
      }

      return this.transformViewData(data || []);
    } catch (error) {
      logger.error('Exception reading from vw_recent_picks', {
        error: error instanceof Error ? error.message : String(error),
        tenantId,
      });
      return await this.getRecentPicksFromTables(tenantId, limit);
    }
  }

  /**
   * Get recent picks from direct table joins (fallback)
   */
  private async getRecentPicksFromTables(tenantId: string, limit: number): Promise<RecentPickView[]> {
    try {
      // Try canonical picks table first
      const { data: canonicalData, error: canonicalError } = await this.supabase
        .from('picks')
        .select(
          `
          id,
          tenant_id,
          user_id,
          selection,
          odds,
          stake,
          confidence,
          status,
          workflow_stage,
          created_at,
          published_at,
          metadata,
          users!picks_user_id_fkey (
            username
          )
        `
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!canonicalError && canonicalData) {
        logger.info('Reading recent picks from canonical picks table', {
          tenantId,
          count: canonicalData.length,
        });
        return this.transformCanonicalData(canonicalData);
      }

      // Fallback to unified_picks
      const { data: unifiedData, error: unifiedError } = await this.supabase
        .from('unified_picks')
        .select('*')
        .eq('metadata->>tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (unifiedError) {
        logger.error('Error reading from both picks and unified_picks', {
          canonicalError: canonicalError?.message,
          unifiedError: unifiedError.message,
          tenantId,
        });
        return [];
      }

      logger.info('Reading recent picks from unified_picks (fallback)', {
        tenantId,
        count: unifiedData?.length || 0,
      });

      return this.transformUnifiedData(unifiedData || [], tenantId);
    } catch (error) {
      logger.error('Exception reading recent picks from tables', {
        error: error instanceof Error ? error.message : String(error),
        tenantId,
      });
      return [];
    }
  }

  /**
   * Check if vw_recent_picks view exists
   */
  private async checkViewExists(): Promise<boolean> {
    try {
      const { error } = await this.supabase.from('vw_recent_picks').select('id').limit(1);

      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Transform view data to RecentPickView
   */
  private transformViewData(data: any[]): RecentPickView[] {
    return data.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      username: row.username,
      playerName: row.player_name,
      sport: row.sport,
      marketType: row.market_type,
      line: row.line,
      side: row.side,
      odds: row.odds,
      stake: row.stake,
      confidence: row.confidence,
      status: row.status,
      workflowStage: row.workflow_stage,
      createdAt: row.created_at,
      publishedAt: row.published_at,
    }));
  }

  /**
   * Transform canonical picks data
   */
  private transformCanonicalData(data: any[]): RecentPickView[] {
    return data.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      username: row.users?.username,
      playerName: row.metadata?.player_name,
      sport: row.metadata?.league,
      marketType: row.metadata?.market_type,
      line: row.metadata?.line,
      side: row.selection,
      odds: row.odds,
      stake: row.stake,
      confidence: row.confidence,
      status: row.status,
      workflowStage: row.workflow_stage,
      createdAt: row.created_at,
      publishedAt: row.published_at,
    }));
  }

  /**
   * Transform unified_picks data
   */
  private transformUnifiedData(data: any[], tenantId: string): RecentPickView[] {
    return data.map((row) => ({
      id: row.id,
      tenantId,
      userId: row.capper || row.metadata?.user_id || 'unknown',
      username: row.capper,
      playerName: row.player_name,
      sport: row.sport,
      marketType: row.stat_type,
      line: row.line,
      side: row.direction,
      odds: row.odds,
      stake: row.unit_size,
      confidence: row.confidence_score ? Math.round(row.confidence_score / 10) : undefined,
      status: row.play_status,
      createdAt: row.created_at,
      publishedAt: row.posted_to_discord ? row.created_at : undefined,
    }));
  }

  /**
   * Reset view availability cache (for testing)
   */
  resetViewCache(): void {
    this.viewAvailable = null;
  }
}

// Export singleton instance
export const picksReaderService = new PicksReaderService();
