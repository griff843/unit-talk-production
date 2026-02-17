/**
 * CLV Canary Mode Service
 * CLV-CANARY-MODE-001
 *
 * Cost-controlled, CLV-only line capture for Games-mode picks.
 *
 * Features:
 * - Rate limiting via CLV_CANARY_MAX_CALLS_PER_MIN
 * - Feature flag via CLV_CANARY_ENABLED
 * - Market filtering via CLV_CANARY_MARKETS
 * - Fail-open: Never blocks pick submission
 *
 * Usage:
 *   const canary = new CLVCanaryService();
 *   const result = await canary.captureBetSnapshot(pick);
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface CLVCanaryConfig {
  enabled: boolean;
  maxCallsPerMin: number;
  markets: string[];
}

function getCanaryConfig(): CLVCanaryConfig {
  return {
    enabled: process.env.CLV_CANARY_ENABLED === 'true',
    maxCallsPerMin: parseInt(process.env.CLV_CANARY_MAX_CALLS_PER_MIN || '20', 10),
    markets: (process.env.CLV_CANARY_MARKETS || 'player_prop,spread,total,moneyline,team_total').split(','),
  };
}

// ═══════════════════════════════════════════════════════════════
// RATE LIMITER (Simple sliding window)
// ═══════════════════════════════════════════════════════════════

interface RateLimitState {
  calls: number[];
  windowMs: number;
}

const rateLimitState: RateLimitState = {
  calls: [],
  windowMs: 60 * 1000, // 1 minute
};

function checkRateLimit(maxCallsPerMin: number): { allowed: boolean; currentCount: number } {
  const now = Date.now();
  const windowStart = now - rateLimitState.windowMs;

  // Remove old calls outside window
  rateLimitState.calls = rateLimitState.calls.filter(ts => ts > windowStart);

  const currentCount = rateLimitState.calls.length;
  const allowed = currentCount < maxCallsPerMin;

  return { allowed, currentCount };
}

function recordCall(): void {
  rateLimitState.calls.push(Date.now());
}

// ═══════════════════════════════════════════════════════════════
// CANARY SERVICE
// ═══════════════════════════════════════════════════════════════

export interface CanaryBetCaptureParams {
  pickId: string;
  sport: string;
  statType: string;
  playerName?: string;
  teamName?: string;
  line: number;
  odds: number;
  selection: 'over' | 'under' | string;
  gameId: string;
  gameTime?: string;
  externalGameId?: string;
  sportsbook?: string;
}

export interface CanaryCaptureResult {
  success: boolean;
  snapshotId?: string;
  marketLine?: number;
  reason?: string;
  rateLimit?: { current: number; max: number };
  creditUsed?: boolean;
}

export interface CanaryClosingParams {
  pickId: string;
  propRef: string;
  sport: string;
  statType: string;
  playerName?: string;
  gameId: string;
  externalGameId?: string;
}

export class CLVCanaryService {
  private config: CLVCanaryConfig;
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.config = getCanaryConfig();
    this.supabase = supabase;
  }

  /**
   * Check if canary mode is enabled and pick is eligible
   */
  isEligible(params: { gameId?: string | null; statType?: string }): boolean {
    // Must be enabled
    if (!this.config.enabled) {
      return false;
    }

    // Must have game_id (Games mode)
    if (!params.gameId) {
      return false;
    }

    // Check if market type is supported (if statType provided)
    if (params.statType) {
      const normalizedType = params.statType.toLowerCase().replace(/\s+/g, '_');
      if (!this.config.markets.some(m => normalizedType.includes(m) || m.includes(normalizedType))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Capture bet-time snapshot for a pick.
   *
   * FAIL-OPEN: Returns success=false with reason if anything fails,
   * but NEVER throws or blocks the pick submission.
   */
  async captureBetSnapshot(params: CanaryBetCaptureParams): Promise<CanaryCaptureResult> {
    try {
      // Check eligibility
      if (!this.isEligible({ gameId: params.gameId, statType: params.statType })) {
        return {
          success: false,
          reason: 'Not eligible for canary capture (disabled or manual pick)',
        };
      }

      // Check rate limit
      const rateCheck = checkRateLimit(this.config.maxCallsPerMin);
      if (!rateCheck.allowed) {
        return {
          success: false,
          reason: 'Rate limit exceeded',
          rateLimit: { current: rateCheck.currentCount, max: this.config.maxCallsPerMin },
        };
      }

      // Generate prop reference
      const propRef = this.generatePropRef(params);

      // For bet snapshot, we use the SUBMITTED line (not market line)
      // This is the actual bet placed - market line fetch would require provider call
      const snapshotData = {
        prop_ref: propRef,
        pick_id: params.pickId,
        sport: params.sport,
        stat_type: params.statType,
        player_name: params.playerName || params.teamName || 'Unknown',
        sportsbook: params.sportsbook || 'submitted',
        line: params.line,
        over_odds: params.selection === 'over' ? params.odds : null,
        under_odds: params.selection === 'under' ? params.odds : null,
        game_time: params.gameTime || null,
        snapshot_type: 'bet',
      };

      // Insert bet snapshot
      const { data, error } = await this.supabase
        .from('line_snapshots')
        .insert(snapshotData)
        .select('id')
        .single();

      if (error) {
        // Duplicate key is OK (already captured)
        if (error.code === '23505') {
          return {
            success: true,
            reason: 'Bet snapshot already exists',
          };
        }

        console.warn('[CLV-CANARY] Bet snapshot insert failed:', error.message);
        return {
          success: false,
          reason: `Insert failed: ${error.message}`,
        };
      }

      // Record the call for rate limiting
      recordCall();

      // Log credit usage (for now just to console, could go to DB)
      await this.logCreditUsage('bet_snapshot', params.sport, params.statType);

      console.log('[CLV-CANARY] Bet snapshot captured:', {
        pickId: params.pickId,
        snapshotId: data.id,
        propRef,
        line: params.line,
      });

      return {
        success: true,
        snapshotId: data.id,
        marketLine: params.line, // For bet snapshot, this is the submitted line
        creditUsed: false, // No external API call for bet snapshot
      };

    } catch (err) {
      console.error('[CLV-CANARY] Unexpected error in captureBetSnapshot:', err);
      return {
        success: false,
        reason: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Queue a pick for closing line capture.
   *
   * This marks the pick as needing closing capture.
   * The actual capture happens in the closing workflow.
   */
  async queueForClosingCapture(params: {
    pickId: string;
    gameStartTime: string;
  }): Promise<{ success: boolean; reason?: string }> {
    try {
      // Simply ensure the pick has the right fields for closing workflow to find it
      // The workflow queries: game_start_time <= NOW AND closing_line IS NULL AND game_id IS NOT NULL

      // Verify the pick exists and has game_id
      const { data: pick, error } = await this.supabase
        .from('unified_picks')
        .select('id, game_id, game_start_time, closing_line')
        .eq('id', params.pickId)
        .single();

      if (error || !pick) {
        return {
          success: false,
          reason: 'Pick not found',
        };
      }

      if (!pick.game_id) {
        return {
          success: false,
          reason: 'Pick has no game_id - not eligible for closing capture',
        };
      }

      if (pick.closing_line !== null) {
        return {
          success: true,
          reason: 'Pick already has closing_line',
        };
      }

      console.log('[CLV-CANARY] Pick queued for closing capture:', {
        pickId: params.pickId,
        gameStartTime: params.gameStartTime,
      });

      return { success: true };

    } catch (err) {
      console.error('[CLV-CANARY] Error queuing for closing capture:', err);
      return {
        success: false,
        reason: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate a prop reference for CLV tracking
   */
  private generatePropRef(params: {
    sport: string;
    statType: string;
    playerName?: string;
    teamName?: string;
    line: number;
    gameId: string;
  }): string {
    const parts = [
      params.sport.toLowerCase(),
      params.statType.toLowerCase().replace(/\s+/g, '_'),
      (params.playerName || params.teamName || 'unknown').toLowerCase().replace(/\s+/g, '_'),
      params.line.toString(),
      params.gameId,
    ];
    return parts.join('|');
  }

  /**
   * Log credit usage for monitoring
   */
  private async logCreditUsage(
    operation: string,
    sport: string,
    statType: string,
    creditsUsed: number = 0
  ): Promise<void> {
    try {
      // Try to insert into canary_credit_log if table exists
      // Fail silently if table doesn't exist
      await this.supabase
        .from('canary_credit_log')
        .insert({
          operation,
          sport,
          stat_type: statType,
          credits_used: creditsUsed,
          timestamp: new Date().toISOString(),
        })
        .then(
          () => {},
          () => {
            // GAUNTLET-CLOSEOUT-028: Use .then(resolve, reject) pattern for PromiseLike
            // Table may not exist - that's OK
            console.log('[CLV-CANARY] Credit log: table not available, logging to console');
          }
        );

      console.log('[CLV-CANARY] Credit usage:', {
        operation,
        sport,
        statType,
        creditsUsed,
      });
    } catch {
      // Fail silently - credit logging is non-critical
    }
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { current: number; max: number; remaining: number } {
    const check = checkRateLimit(this.config.maxCallsPerMin);
    return {
      current: check.currentCount,
      max: this.config.maxCallsPerMin,
      remaining: Math.max(0, this.config.maxCallsPerMin - check.currentCount),
    };
  }

  /**
   * Get canary config for debugging
   */
  getConfig(): CLVCanaryConfig {
    return { ...this.config };
  }
}

/**
 * Factory function for creating canary service
 */
export function createCLVCanaryService(supabase: SupabaseClient): CLVCanaryService {
  return new CLVCanaryService(supabase);
}
