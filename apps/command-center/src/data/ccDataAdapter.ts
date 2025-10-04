/**
 * Command Center Data Adapter
 *
 * Thin adapter layer for reading from v_daily_board and writing via RPCs.
 * Provides type-safe interface to the new read-model views and approval workflow.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Board pick from v_daily_board view
 */
export interface BoardPick {
  prop_id: string;
  sport: string;
  market: string;
  selection: string;
  line: number | null;
  odds: number;
  game_date: string;
  player_name: string | null;
  edge: number | null;
  prob_win: number | null;
  professional_score: number | null;
  tier: string | null;
  confidence: number | null;
  kelly_fraction: number | null;
  clv_pct: number | null;
  queue_status: string | null;
  publish_at: string | null;
  queue_id: string | null;
  approved_by: string | null;
  denied_by: string | null;
  reason: string | null;
}

/**
 * Fetch options for board query
 */
export interface FetchBoardOptions {
  status?: 'pending' | 'approved' | 'rejected' | null;
  limit?: number;
  sport?: string;
  tier?: string;
}

/**
 * Command Center Data Adapter
 */
export class CCDataAdapter {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || supabase;
  }

  /**
   * Fetch picks from v_daily_board
   * View already includes WHERE game_date >= current_date and proper ordering
   */
  async fetchBoard(options: FetchBoardOptions = {}): Promise<BoardPick[]> {
    let query = this.client
      .from('v_daily_board')
      .select('*');

    // Add optional filters
    if (options.status) {
      query = query.eq('queue_status', options.status);
    }

    if (options.sport) {
      query = query.eq('sport', options.sport);
    }

    if (options.tier) {
      query = query.eq('tier', options.tier);
    }

    // Apply limit
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[CCDataAdapter] fetchBoard error:', error);
      throw new Error(`Failed to fetch board: ${error.message}`);
    }

    return (data as BoardPick[]) || [];
  }

  /**
   * Submit a pick for approval via submit_pick RPC
   */
  async submit(
    unifiedPickId: string,
    reason?: string,
    orgId?: string
  ): Promise<string> {
    const { data, error } = await this.client.rpc('submit_pick', {
      p_unified_pick_id: unifiedPickId,
      p_reason: reason || 'Command Center submission',
      p_org_id: orgId || null,
    });

    if (error) {
      console.error('[CCDataAdapter] submit error:', error);
      throw new Error(`Failed to submit pick: ${error.message}`);
    }

    // Returns queue_id
    return data as string;
  }

  /**
   * Approve a queued pick via approve_pick RPC
   */
  async approve(
    queueId: string,
    actorId: string,
    reason?: string
  ): Promise<void> {
    const { error } = await this.client.rpc('approve_pick', {
      p_queue_id: queueId,
      p_approved_by: actorId,
      p_reason: reason || null,
    });

    if (error) {
      console.error('[CCDataAdapter] approve error:', error);
      throw new Error(`Failed to approve pick: ${error.message}`);
    }
  }

  /**
   * Deny a queued pick via deny_pick RPC
   */
  async deny(
    queueId: string,
    actorId: string,
    reason?: string
  ): Promise<void> {
    const { error } = await this.client.rpc('deny_pick', {
      p_queue_id: queueId,
      p_denied_by: actorId,
      p_reason: reason || null,
    });

    if (error) {
      console.error('[CCDataAdapter] deny error:', error);
      throw new Error(`Failed to deny pick: ${error.message}`);
    }
  }

  /**
   * Subscribe to real-time board changes
   */
  subscribeToBoard(
    callback: (payload: any) => void,
    filters?: { status?: string }
  ) {
    const channel = this.client
      .channel('board-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'promotion_queue',
          filter: filters?.status ? `status=eq.${filters.status}` : undefined,
        },
        callback
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }
}

/**
 * Default adapter instance
 */
export const ccAdapter = new CCDataAdapter();

/**
 * React hook for Command Center board
 */
export function useCommandCenterBoard(options: FetchBoardOptions = {}) {
  const [picks, setPicks] = React.useState<BoardPick[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ccAdapter.fetchBoard(options);
      setPicks(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [options]);

  React.useEffect(() => {
    refresh();

    // Subscribe to real-time updates
    const unsubscribe = ccAdapter.subscribeToBoard(() => {
      refresh();
    }, { status: options.status });

    return unsubscribe;
  }, [refresh]);

  return { picks, loading, error, refresh };
}

// React import for hook (will be tree-shaken out if not used)
import * as React from 'react';
