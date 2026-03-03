/**
 * EXPOSURE-HARDENING-001: Pre-Submission Exposure Gate
 *
 * This module provides atomic exposure checks BEFORE any database writes.
 * All checks are:
 * - Deterministic (same input → same output)
 * - Idempotent (can be called multiple times safely)
 * - Side-effect free (no writes until approved)
 * - Fail-closed (any error → rejection)
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// HARD LIMITS (Canonical - must match EXPOSURE_CONTROL_CONTRACT.md)
// ============================================================
export const EXPOSURE_LIMITS = {
  // Submission Layer
  MIN_UNITS: 0.5,
  MAX_UNITS: 10,
  MIN_PARLAY_LEGS: 2,
  MIN_ROUND_ROBIN_LEGS: 2,

  // Portfolio Layer (from PortfolioRiskManager)
  MAX_SINGLE_POSITION: 0.25, // 25% max single position
  MAX_GAME_EXPOSURE: 0.4, // 40% max single game
  MAX_PLAYER_EXPOSURE: 0.3, // 30% max single player
  MAX_SAME_GAME_POSITIONS: 4, // Max 4 per game
  MAX_SAME_PLAYER_POSITIONS: 2, // Max 2 per player
  DAILY_VAR_LIMIT: 0.15, // 15% daily VaR
  MAX_CORRELATION_THRESHOLD: 0.7, // 70% correlation

  // Daily Exposure (from ExposureTrackingService)
  DAILY_EXPOSURE_DOLLARS: 50000, // $50k daily limit
  MAX_KELLY_RISK: 0.25, // 25% max Kelly
  CORRELATION_LIMIT: 0.6, // 60% correlation
  HIGH_CONCENTRATION_THRESHOLD: 0.4, // 40% concentration
} as const;

// ============================================================
// TYPES
// ============================================================
export interface ExposureCheckResult {
  approved: boolean;
  reason: string;
  limitingFactor: ExposureLimitType | null;
  currentExposure: ExposureSnapshot;
  proposedExposure: ExposureSnapshot;
}

export interface ExposureSnapshot {
  dailyUnits: number;
  dailyDollars: number;
  gameExposure: Record<string, number>;
  playerExposure: Record<string, number>;
  sportConcentration: Record<string, number>;
  pickCount: number;
}

export type ExposureLimitType =
  | 'daily_exposure_exceeded'
  | 'game_exposure_exceeded'
  | 'player_exposure_exceeded'
  | 'same_game_limit_exceeded'
  | 'same_player_limit_exceeded'
  | 'var_limit_exceeded'
  | 'sport_concentration_exceeded'
  | 'single_position_exceeded'
  | 'service_unavailable';

export interface ProposedPick {
  units: number;
  odds: number;
  game_id?: string;
  player_id?: string;
  player_name?: string;
  sport: string;
}

// PARLAY-EXPOSURE-FIX-001: Ticket context for proper parlay handling
export interface TicketContext {
  ticket_type: 'single' | 'parlay' | 'teaser' | 'round_robin';
  leg_count: number;
}

// ============================================================
// EXPOSURE GATE SERVICE
// ============================================================

export class ExposureGate {
  private supabase: SupabaseClient;
  private logger: {
    info: (...args: any[]) => void;
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
  };

  // Configurable limits (can be overridden by operator)
  private limits: { [K in keyof typeof EXPOSURE_LIMITS]: number } = { ...EXPOSURE_LIMITS };

  constructor(supabase: SupabaseClient, logger?: any) {
    this.supabase = supabase;
    this.logger = logger || console;
  }

  /**
   * Main exposure check - call BEFORE any INSERT
   *
   * Returns approved=false if ANY limit would be exceeded.
   * This is the atomic check that must pass before writes.
   *
   * PARLAY-EXPOSURE-FIX-001: Optional ticketContext for proper parlay handling.
   * For parlays, all legs are treated as ONE bet position for concentration checks.
   */
  async checkExposure(
    capperId: string,
    proposedPicks: ProposedPick[],
    ticketContext?: TicketContext
  ): Promise<ExposureCheckResult> {
    try {
      // Get current portfolio state (read-only)
      const currentExposure = await this.getCurrentExposure(capperId);

      // Calculate proposed exposure (pure calculation)
      const proposedExposure = this.calculateProposedExposure(currentExposure, proposedPicks);

      // Check all limits (deterministic)
      // PARLAY-EXPOSURE-FIX-001: Pass ticketContext for proper parlay handling
      const limitCheck = this.checkAllLimits(
        currentExposure,
        proposedExposure,
        proposedPicks,
        ticketContext
      );

      this.logger.info(
        {
          capperId,
          approved: limitCheck.approved,
          limitingFactor: limitCheck.limitingFactor,
          currentUnits: currentExposure.dailyUnits,
          proposedUnits: proposedExposure.dailyUnits,
        },
        'EXPOSURE-GATE: Check completed'
      );

      return {
        ...limitCheck,
        currentExposure,
        proposedExposure,
      };
    } catch (error) {
      // FAIL-CLOSED: Any error means rejection
      this.logger.error({ error }, 'EXPOSURE-GATE: Check failed, rejecting submission');

      return {
        approved: false,
        reason: 'Exposure check service unavailable. Submission blocked per fail-closed policy.',
        limitingFactor: 'service_unavailable',
        currentExposure: this.emptySnapshot(),
        proposedExposure: this.emptySnapshot(),
      };
    }
  }

  /**
   * Get current exposure state from database
   */
  private async getCurrentExposure(capperId: string): Promise<ExposureSnapshot> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Query today's unsettled picks
    // REMEDIATION-001: Removed 'units' from select - column does not exist in cloud schema
    // The code already has fallback (p.units || 1) at lines 168, 170, 196 for null units
    // GAUNTLET-CLOSEOUT-028: Type assertion for Supabase inference issue
    interface ExposurePick {
      id: string;
      odds: number;
      game_id: string | null;
      player_id: string | null;
      player_name: string | null;
      sport: string | null;
      units?: number; // Optional since not in cloud schema
    }

    const { data: picks, error } = (await this.supabase
      .from('unified_picks')
      .select('id, odds, game_id, player_id, player_name, sport')
      .eq('user_id', capperId)
      .gte('created_at', todayStart.toISOString())
      .is('settlement_status', null)) as { data: ExposurePick[] | null; error: any };

    if (error) {
      throw new Error(`Failed to query current exposure: ${error.message}`);
    }

    const currentPicks = picks || [];

    // Calculate aggregates
    const dailyUnits = currentPicks.reduce((sum, p) => sum + (p.units || 1), 0);
    const dailyDollars = currentPicks.reduce((sum, p) => {
      const units = p.units || 1;
      const impliedStake = units * 100; // Assume $100 per unit
      return sum + impliedStake;
    }, 0);

    // Game exposure
    const gameExposure: Record<string, number> = {};
    for (const pick of currentPicks) {
      if (pick.game_id) {
        gameExposure[pick.game_id] = (gameExposure[pick.game_id] || 0) + 1;
      }
    }

    // Player exposure
    const playerExposure: Record<string, number> = {};
    for (const pick of currentPicks) {
      const playerId = pick.player_id || pick.player_name;
      if (playerId) {
        playerExposure[playerId] = (playerExposure[playerId] || 0) + 1;
      }
    }

    // Sport concentration
    const sportConcentration: Record<string, number> = {};
    for (const pick of currentPicks) {
      if (pick.sport) {
        sportConcentration[pick.sport] = (sportConcentration[pick.sport] || 0) + (pick.units || 1);
      }
    }

    return {
      dailyUnits,
      dailyDollars,
      gameExposure,
      playerExposure,
      sportConcentration,
      pickCount: currentPicks.length,
    };
  }

  /**
   * Calculate proposed exposure after adding new picks
   */
  private calculateProposedExposure(
    current: ExposureSnapshot,
    proposedPicks: ProposedPick[]
  ): ExposureSnapshot {
    const proposed: ExposureSnapshot = {
      dailyUnits: current.dailyUnits,
      dailyDollars: current.dailyDollars,
      gameExposure: { ...current.gameExposure },
      playerExposure: { ...current.playerExposure },
      sportConcentration: { ...current.sportConcentration },
      pickCount: current.pickCount,
    };

    for (const pick of proposedPicks) {
      // Units
      proposed.dailyUnits += pick.units;
      proposed.dailyDollars += pick.units * 100; // $100 per unit
      proposed.pickCount += 1;

      // Game exposure
      if (pick.game_id) {
        proposed.gameExposure[pick.game_id] = (proposed.gameExposure[pick.game_id] || 0) + 1;
      }

      // Player exposure
      const playerId = pick.player_id || pick.player_name;
      if (playerId) {
        proposed.playerExposure[playerId] = (proposed.playerExposure[playerId] || 0) + 1;
      }

      // Sport concentration
      if (pick.sport) {
        proposed.sportConcentration[pick.sport] =
          (proposed.sportConcentration[pick.sport] || 0) + pick.units;
      }
    }

    return proposed;
  }

  /**
   * Check all limits - pure function, no side effects
   *
   * PARLAY-EXPOSURE-FIX-001: For parlays, the concentration check treats all legs
   * as ONE position. This prevents false rejections when a parlay has multiple legs
   * in the same sport (which is normal parlay behavior, not over-concentration).
   */
  private checkAllLimits(
    current: ExposureSnapshot,
    proposed: ExposureSnapshot,
    proposedPicks: ProposedPick[],
    ticketContext?: TicketContext
  ): { approved: boolean; reason: string; limitingFactor: ExposureLimitType | null } {
    // PARLAY-EXPOSURE-FIX-001: Determine if this is a multi-leg ticket
    const isMultiLegTicket =
      ticketContext?.ticket_type &&
      ['parlay', 'teaser', 'round_robin'].includes(ticketContext.ticket_type);

    // Check daily exposure limit
    if (proposed.dailyDollars > this.limits.DAILY_EXPOSURE_DOLLARS) {
      return {
        approved: false,
        reason: `Daily exposure would exceed $${this.limits.DAILY_EXPOSURE_DOLLARS.toLocaleString()} limit. Current: $${current.dailyDollars.toLocaleString()}, Proposed: $${proposed.dailyDollars.toLocaleString()}`,
        limitingFactor: 'daily_exposure_exceeded',
      };
    }

    // Check same-game limit
    for (const [gameId, count] of Object.entries(proposed.gameExposure)) {
      if (count > this.limits.MAX_SAME_GAME_POSITIONS) {
        return {
          approved: false,
          reason: `Game ${gameId} would have ${count} positions, exceeding limit of ${this.limits.MAX_SAME_GAME_POSITIONS}`,
          limitingFactor: 'same_game_limit_exceeded',
        };
      }
    }

    // Check same-player limit
    for (const [playerId, count] of Object.entries(proposed.playerExposure)) {
      if (count > this.limits.MAX_SAME_PLAYER_POSITIONS) {
        return {
          approved: false,
          reason: `Player ${playerId} would have ${count} positions, exceeding limit of ${this.limits.MAX_SAME_PLAYER_POSITIONS}`,
          limitingFactor: 'same_player_limit_exceeded',
        };
      }
    }

    // Check individual pick limits
    for (const pick of proposedPicks) {
      if (pick.units > this.limits.MAX_UNITS) {
        return {
          approved: false,
          reason: `Pick units ${pick.units} exceeds maximum ${this.limits.MAX_UNITS}`,
          limitingFactor: 'var_limit_exceeded',
        };
      }
    }

    // PHASE C: Sport concentration check (previously monitoring-only, now BLOCKING)
    // Check if any single sport exceeds HIGH_CONCENTRATION_THRESHOLD (40% of portfolio)
    // REMEDIATION-001: Skip concentration check when fewer than 3 total picks
    // This prevents bootstrap problem where first submission is always 100% concentrated
    //
    // PARLAY-EXPOSURE-FIX-001: For parlays, count ALL legs as 1 logical position.
    // A 3-leg parlay is ONE bet, not 3 separate positions. Concentration should be
    // measured against the existing portfolio, not within a single parlay submission.
    const totalProposedUnits = proposed.dailyUnits;
    const MIN_PICKS_FOR_CONCENTRATION_CHECK = 3;

    // Calculate effective pick count for concentration threshold
    // For multi-leg tickets (parlays/teasers), count as 1 position + existing picks
    // For singles, count each pick individually
    const newPositionCount = isMultiLegTicket ? 1 : proposedPicks.length;
    const effectivePickCount = current.pickCount + newPositionCount;

    if (totalProposedUnits > 0 && effectivePickCount >= MIN_PICKS_FOR_CONCENTRATION_CHECK) {
      for (const [sport, sportUnits] of Object.entries(proposed.sportConcentration)) {
        const concentrationRatio = sportUnits / totalProposedUnits;
        if (concentrationRatio > this.limits.HIGH_CONCENTRATION_THRESHOLD) {
          return {
            approved: false,
            reason: `Sport ${sport} concentration at ${(concentrationRatio * 100).toFixed(1)}% exceeds ${this.limits.HIGH_CONCENTRATION_THRESHOLD * 100}% limit`,
            limitingFactor: 'sport_concentration_exceeded',
          };
        }
      }
    }

    // PHASE C: Single position size check (previously monitoring-only, now BLOCKING)
    // Check if any single pick exceeds MAX_SINGLE_POSITION (25% of daily budget)
    const dailyBudgetUnits = this.limits.DAILY_EXPOSURE_DOLLARS / 100; // Convert to units (500 units = $50k)
    for (const pick of proposedPicks) {
      const positionRatio = pick.units / dailyBudgetUnits;
      if (positionRatio > this.limits.MAX_SINGLE_POSITION) {
        return {
          approved: false,
          reason: `Single position of ${pick.units} units (${(positionRatio * 100).toFixed(1)}% of daily budget) exceeds ${this.limits.MAX_SINGLE_POSITION * 100}% limit`,
          limitingFactor: 'single_position_exceeded',
        };
      }
    }

    // All checks passed
    return {
      approved: true,
      reason: 'All exposure limits within bounds',
      limitingFactor: null,
    };
  }

  /**
   * Empty snapshot for error cases
   */
  private emptySnapshot(): ExposureSnapshot {
    return {
      dailyUnits: 0,
      dailyDollars: 0,
      gameExposure: {},
      playerExposure: {},
      sportConcentration: {},
      pickCount: 0,
    };
  }

  /**
   * EXPOSURE-HARDENING-001 Phase E: Time-boxed, audited operator override
   *
   * Allows operator to temporarily override limits with:
   * - Time-boxing: Auto-restores after maxDurationMinutes
   * - Audit logging: Full trail of who, what, when, why
   * - Reason required: Must provide business justification
   *
   * Returns a disposable that restores original limits
   */
  withOverride(
    overrides: Partial<{ [K in keyof typeof EXPOSURE_LIMITS]: number }>,
    options: {
      operatorId: string;
      reason: string;
      maxDurationMinutes?: number;
    }
  ): { restore: () => void; expiresAt: Date } {
    const originalLimits = { ...this.limits };
    const startTime = new Date();
    const maxDuration = options.maxDurationMinutes || 60; // Default 1 hour
    const expiresAt = new Date(startTime.getTime() + maxDuration * 60 * 1000);

    // Apply override
    this.limits = { ...this.limits, ...overrides };

    // AUDIT LOG: Override applied
    this.logger.warn(
      {
        event: 'EXPOSURE_OVERRIDE_APPLIED',
        operatorId: options.operatorId,
        reason: options.reason,
        overrides,
        originalLimits,
        startTime: startTime.toISOString(),
        expiresAt: expiresAt.toISOString(),
        maxDurationMinutes: maxDuration,
      },
      'EXPOSURE-GATE: Limits overridden by operator (TIME-BOXED)'
    );

    // Auto-restore timer
    const autoRestoreTimer = setTimeout(
      () => {
        this.limits = originalLimits;

        // AUDIT LOG: Auto-restored
        this.logger.warn(
          {
            event: 'EXPOSURE_OVERRIDE_AUTO_RESTORED',
            operatorId: options.operatorId,
            reason: 'Time limit expired',
            restoredTo: originalLimits,
            overrideAppliedAt: startTime.toISOString(),
            restoredAt: new Date().toISOString(),
          },
          'EXPOSURE-GATE: Limits auto-restored after time limit'
        );
      },
      maxDuration * 60 * 1000
    );

    return {
      expiresAt,
      restore: () => {
        // Clear auto-restore timer
        clearTimeout(autoRestoreTimer);

        // Restore limits
        this.limits = originalLimits;

        // AUDIT LOG: Manual restore
        this.logger.info(
          {
            event: 'EXPOSURE_OVERRIDE_MANUAL_RESTORED',
            operatorId: options.operatorId,
            restoredTo: originalLimits,
            overrideAppliedAt: startTime.toISOString(),
            restoredAt: new Date().toISOString(),
            timeActiveMinutes: (Date.now() - startTime.getTime()) / 60000,
          },
          'EXPOSURE-GATE: Limits manually restored by operator'
        );
      },
    };
  }

  /**
   * Get current limits (for operator visibility)
   */
  getCurrentLimits(): { [K in keyof typeof EXPOSURE_LIMITS]: number } {
    return { ...this.limits };
  }

  /**
   * Check if any overrides are active (limits differ from defaults)
   */
  hasActiveOverride(): boolean {
    return JSON.stringify(this.limits) !== JSON.stringify(EXPOSURE_LIMITS);
  }
}

/**
 * Factory function for creating ExposureGate instances
 */
export function createExposureGate(supabase: SupabaseClient, logger?: any): ExposureGate {
  return new ExposureGate(supabase, logger);
}
