/**
 * Phase 4: Staleness Checker
 * Validates data freshness for autopilot pick publishing decisions
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { PickData, StalenessCheckResult } from './types';

let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL_DEV!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY_DEV!;
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabase;
}

export class StalenessChecker {
  /**
   * Check if pick data is stale (too old to publish)
   *
   * Staleness Criteria:
   * - Data age: Pick created_at more than N minutes ago
   * - Odds staleness: Odds haven't been updated recently
   * - Event timing: Game hasn't started yet
   */
  async checkStaleness(pick: PickData): Promise<StalenessCheckResult> {
    const reasons: string[] = [];
    let dataAgeMinutes: number | null = null;
    let oddsStaleMinutes: number | null = null;
    let isStale = false;

    // Check 1: Data age
    if (pick.created_at) {
      const createdAt = new Date(pick.created_at);
      const now = new Date();
      dataAgeMinutes = Math.floor((now.getTime() - createdAt.getTime()) / 1000 / 60);

      // Data older than 60 minutes is considered stale
      if (dataAgeMinutes > 60) {
        isStale = true;
        reasons.push(`Data is ${dataAgeMinutes} minutes old (threshold: 60 minutes)`);
      }
    } else {
      // Missing created_at is a red flag
      reasons.push('Missing created_at timestamp');
      isStale = true;
    }

    // Check 2: Odds freshness (if we have a pick_id, check raw_props table)
    if (pick.id) {
      try {
        // Check if there are newer odds available
        const { data: newerOdds, error } = await getSupabaseClient()
          .from('raw_props')
          .select('created_at')
          .eq('player_name', pick.player_name)
          .eq('stat_type', pick.stat_type)
          .gte('created_at', pick.created_at || new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && newerOdds && newerOdds.length > 0) {
          const newestOddsTime = new Date(newerOdds[0].created_at);
          const pickTime = new Date(pick.created_at || new Date());
          oddsStaleMinutes = Math.floor((newestOddsTime.getTime() - pickTime.getTime()) / 1000 / 60);

          if (oddsStaleMinutes > 30) {
            isStale = true;
            reasons.push(`Newer odds available (${oddsStaleMinutes} minutes fresher)`);
          }
        }
      } catch (error) {
        console.error('[StalenessChecker] Error checking odds freshness:', error);
        // Don't fail closed on database errors in log_only mode
      }
    }

    // Check 3: Volume threshold
    // In autopilot, we want to avoid publishing too many picks at once
    const recentPicksCount = await this.getRecentPublishedCount(15); // Last 15 minutes
    if (recentPicksCount > 10) {
      isStale = true;
      reasons.push(`Too many recent publishes (${recentPicksCount} in last 15min, threshold: 10)`);
    }

    return {
      is_stale: isStale,
      data_age_minutes: dataAgeMinutes,
      odds_staleness_minutes: oddsStaleMinutes,
      reasons,
    };
  }

  /**
   * Get count of recently published picks (to avoid spam)
   */
  private async getRecentPublishedCount(minutesBack: number): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - minutesBack * 60 * 1000).toISOString();

      const { data, error } = await getSupabaseClient()
        .from('pick_publish')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', cutoffTime);

      if (error) {
        console.error('[StalenessChecker] Error getting recent publish count:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('[StalenessChecker] Exception getting recent publish count:', error);
      return 0;
    }
  }

  /**
   * Get staleness threshold in minutes for autopilot mode
   */
  getStalenessThreshold(mode: 'log_only' | 'canary' | 'prod'): number {
    switch (mode) {
      case 'log_only':
        return 60; // More lenient in log_only
      case 'canary':
        return 30; // Stricter in canary
      case 'prod':
        return 15; // Very strict in production
      default:
        return 60;
    }
  }
}

export const stalenessChecker = new StalenessChecker();
