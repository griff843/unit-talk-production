/**
 * Auto Re-check Service
 * Automated 5-15 minute pre-post game validation with real-time monitoring
 */

import { publishGuard } from '../promotion/PublishGuard';
import { Logger, createLogger } from '../utils/logger';

import { portfolioRiskManager } from './PortfolioRiskManager';
import { promotionGatekeeper } from './PromotionGatekeeper';
import { sTierEnforcer } from './STierEnforcer';
import { supabaseClient } from './supabaseClient';

export interface RecheckSchedule {
  pickId: string;
  gameTime: Date;
  preGameChecks: RecheckPoint[];
  postGameChecks: RecheckPoint[];
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  lastCheck: Date | null;
  nextCheck: Date | null;
}

export interface RecheckPoint {
  id: string;
  type: 'pre_game' | 'post_game';
  scheduledTime: Date;
  actualTime?: Date;
  minutesBeforeGame: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  validationResults?: ValidationSnapshot;
  oddsMovement?: OddsMovementData;
  actionTaken?: RecheckAction;
}

export interface ValidationSnapshot {
  timestamp: Date;
  pickStatus: 'valid' | 'warning' | 'invalid' | 'cancelled';
  promotionValidation: {
    stillQualifies: boolean;
    gateResults: any[];
    riskScore: number;
  };
  sTierValidation?: {
    meetsStandards: boolean;
    violations: any[];
    recommendedTier?: string;
  };
  portfolioValidation: {
    withinLimits: boolean;
    correlationRisk: string;
    positionSizeAdjustment?: number;
  };
  marketValidation: {
    liquidityAdequate: boolean;
    steamDirection: 'for' | 'against' | 'neutral';
    sharpMoneyFlow: number;
  };
}

export interface OddsMovementData {
  timestamp: Date;
  initialOdds: number;
  currentOdds: number;
  movementBps: number;
  movementDirection: 'favorable' | 'unfavorable' | 'neutral';
  volume: number;
  steamStrength: number;
  clvImpact: number;
  marketDepth: number;
}

export interface RecheckAction {
  type: 'maintain' | 'adjust_size' | 'tier_change' | 'cancel' | 'republish';
  reason: string;
  changes: {
    oldTier?: string;
    newTier?: string;
    oldSize?: number;
    newSize?: number;
    statusChange?: string;
  };
  confidence: number;
  riskImpact: number;
}

class AutoRecheckService {
  private static instance: AutoRecheckService;
  private logger: Logger;
  private activeSchedules: Map<string, RecheckSchedule> = new Map();

  // Configurable recheck intervals (minutes before game)
  private readonly DEFAULT_RECHECK_INTERVALS = [
    { minutes: 15, type: 'final_validation' as const },
    { minutes: 10, type: 'market_check' as const },
    { minutes: 5, type: 'emergency_check' as const },
    { minutes: -30, type: 'post_game_settlement' as const }, // 30 min after game
    { minutes: -60, type: 'final_settlement' as const }, // 1 hour after game
  ];

  private constructor() {
    this.logger = createLogger('AutoRecheckService');
    this.initializeService();
  }

  public static getInstance(): AutoRecheckService {
    if (!AutoRecheckService.instance) {
      AutoRecheckService.instance = new AutoRecheckService();
    }
    return AutoRecheckService.instance;
  }

  /**
   * Initialize the auto re-check service
   */
  private async initializeService(): Promise<void> {
    this.logger.info('Initializing Auto Re-check Service');

    // Load active schedules from database
    await this.loadActiveSchedules();

    // Start monitoring loop
    this.startMonitoringLoop();

    this.logger.info('Auto Re-check Service initialized', {
      activeSchedules: this.activeSchedules.size,
    });
  }

  /**
   * Schedule auto re-checks for a new pick
   */
  public async scheduleRecheckForPick(pick: any): Promise<RecheckSchedule> {
    this.logger.info('Scheduling auto re-checks', {
      pickId: pick.id,
      gameTime: pick.game_time,
      tier: pick.tier,
    });

    const gameTime = new Date(pick.game_time);
    const now = new Date();

    // Calculate pre-game check points
    const preGameChecks: RecheckPoint[] = [];
    for (const interval of this.DEFAULT_RECHECK_INTERVALS.filter(i => i.minutes > 0)) {
      const checkTime = new Date(gameTime.getTime() - interval.minutes * 60 * 1000);

      // Only schedule if check time is in the future
      if (checkTime > now) {
        preGameChecks.push({
          id: `${pick.id}_pre_${interval.minutes}`,
          type: 'pre_game',
          scheduledTime: checkTime,
          minutesBeforeGame: interval.minutes,
          status: 'pending',
        });
      }
    }

    // Calculate post-game check points
    const postGameChecks: RecheckPoint[] = [];
    for (const interval of this.DEFAULT_RECHECK_INTERVALS.filter(i => i.minutes < 0)) {
      const checkTime = new Date(gameTime.getTime() + Math.abs(interval.minutes) * 60 * 1000);

      postGameChecks.push({
        id: `${pick.id}_post_${Math.abs(interval.minutes)}`,
        type: 'post_game',
        scheduledTime: checkTime,
        minutesBeforeGame: interval.minutes,
        status: 'pending',
      });
    }

    const schedule: RecheckSchedule = {
      pickId: pick.id,
      gameTime,
      preGameChecks,
      postGameChecks,
      status: 'scheduled',
      lastCheck: null,
      nextCheck: this.getNextCheckTime(preGameChecks, postGameChecks),
    };

    // Store schedule
    this.activeSchedules.set(pick.id, schedule);
    await this.storeRecheckSchedule(schedule);

    this.logger.info('Re-check schedule created', {
      pickId: pick.id,
      preGameChecks: preGameChecks.length,
      postGameChecks: postGameChecks.length,
      nextCheck: schedule.nextCheck,
    });

    return schedule;
  }

  /**
   * Main monitoring loop
   */
  private startMonitoringLoop(): void {
    setInterval(async () => {
      await this.processScheduledRechecks();
    }, 30000); // Check every 30 seconds

    this.logger.info('Monitoring loop started');
  }

  /**
   * Process all scheduled re-checks that are due
   */
  private async processScheduledRechecks(): Promise<void> {
    const now = new Date();
    const dueSchedules: Array<{ schedule: RecheckSchedule; checkPoint: RecheckPoint }> = [];

    // Find all due check points
    for (const schedule of this.activeSchedules.values()) {
      if (schedule.status !== 'active' && schedule.status !== 'scheduled') {
        continue;
      }

      // Check pre-game points
      for (const checkPoint of schedule.preGameChecks) {
        if (checkPoint.status === 'pending' && checkPoint.scheduledTime <= now) {
          dueSchedules.push({ schedule, checkPoint });
        }
      }

      // Check post-game points
      for (const checkPoint of schedule.postGameChecks) {
        if (checkPoint.status === 'pending' && checkPoint.scheduledTime <= now) {
          dueSchedules.push({ schedule, checkPoint });
        }
      }
    }

    // Process due checks
    for (const { schedule, checkPoint } of dueSchedules) {
      await this.executeRecheckPoint(schedule, checkPoint);
    }

    if (dueSchedules.length > 0) {
      this.logger.info('Processed scheduled re-checks', {
        processedCount: dueSchedules.length,
      });
    }
  }

  /**
   * Execute a single re-check point
   */
  private async executeRecheckPoint(
    schedule: RecheckSchedule,
    checkPoint: RecheckPoint
  ): Promise<void> {
    this.logger.info('Executing re-check point', {
      pickId: schedule.pickId,
      checkPointId: checkPoint.id,
      type: checkPoint.type,
      minutesBeforeGame: checkPoint.minutesBeforeGame,
    });

    checkPoint.status = 'in_progress';
    checkPoint.actualTime = new Date();

    try {
      // Get current pick data
      const pick = await this.getCurrentPickData(schedule.pickId);
      if (!pick) {
        checkPoint.status = 'skipped';
        this.logger.warn('Pick not found during re-check', { pickId: schedule.pickId });
        return;
      }

      // Get current odds data
      const oddsMovement = await this.getOddsMovementData(pick);
      checkPoint.oddsMovement = oddsMovement;

      // Perform comprehensive validation
      const validationSnapshot = await this.performValidation(pick, checkPoint.type);
      checkPoint.validationResults = validationSnapshot;

      // Determine action based on validation results
      const action = await this.determineRecheckAction(
        pick,
        validationSnapshot,
        oddsMovement,
        checkPoint
      );
      checkPoint.actionTaken = action;

      // Execute action if needed
      if (action.type !== 'maintain') {
        await this.executeRecheckAction(pick, action);
      }

      checkPoint.status = 'completed';
      schedule.lastCheck = new Date();
      schedule.nextCheck = this.getNextCheckTime(schedule.preGameChecks, schedule.postGameChecks);

      // Update schedule status if all checks are complete
      if (this.isScheduleComplete(schedule)) {
        schedule.status = 'completed';
      }

      this.logger.info('Re-check point completed', {
        pickId: schedule.pickId,
        checkPointId: checkPoint.id,
        action: action.type,
        validationStatus: validationSnapshot.pickStatus,
      });
    } catch (error) {
      checkPoint.status = 'failed';
      this.logger.error('Re-check point failed', {
        error,
        pickId: schedule.pickId,
        checkPointId: checkPoint.id,
      });
    }

    // Update stored schedule
    await this.updateRecheckSchedule(schedule);
  }

  /**
   * Perform comprehensive validation
   */
  private async performValidation(
    pick: any,
    checkType: 'pre_game' | 'post_game'
  ): Promise<ValidationSnapshot> {
    const timestamp = new Date();

    // Promotion gate validation
    const promotionValidation = await promotionGatekeeper.evaluatePromotion({
      id: pick.id,
      propId: pick.prop_id,
      tier: pick.tier,
      confidence: pick.confidence,
      professionalScore: pick.professional_score,
      expectedValue: pick.expected_value,
      clvTracking: pick.clv_tracking,
      gameTime: new Date(pick.game_time),
      sport: pick.sport,
      correlatedPicks: pick.correlated_picks || [],
      portfolioExposure: pick.portfolio_exposure || 0,
    });

    // S-tier validation (if applicable)
    let sTierValidation;
    if (pick.tier === 'S') {
      const sTierResult = await sTierEnforcer.enforceSTierStandards(pick);
      sTierValidation = {
        meetsStandards: sTierResult.passed,
        violations: sTierResult.violations,
        recommendedTier: sTierResult.adjustedTier,
      };
    }

    // Portfolio risk validation
    const portfolioResult = await portfolioRiskManager.assessPositionRisk(
      pick,
      pick.kelly_fraction || 0.1
    );
    const portfolioValidation = {
      withinLimits: portfolioResult.approved,
      correlationRisk: 'medium', // Would calculate based on correlation analysis
      positionSizeAdjustment:
        portfolioResult.recommendedSize !== (pick.kelly_fraction || 0.1)
          ? portfolioResult.recommendedSize
          : undefined,
    };

    // Market validation
    const marketValidation = await this.validateMarketConditions(pick);

    // Determine overall pick status
    let pickStatus: 'valid' | 'warning' | 'invalid' | 'cancelled' = 'valid';

    if (!promotionValidation.approved || !portfolioValidation.withinLimits) {
      pickStatus = 'invalid';
    } else if (sTierValidation && !sTierValidation.meetsStandards) {
      pickStatus = 'warning';
    } else if (!marketValidation.liquidityAdequate) {
      pickStatus = 'warning';
    }

    return {
      timestamp,
      pickStatus,
      promotionValidation: {
        stillQualifies: promotionValidation.approved,
        gateResults: promotionValidation.gateResults,
        riskScore: promotionValidation.riskScore,
      },
      sTierValidation,
      portfolioValidation,
      marketValidation,
    };
  }

  /**
   * Validate current market conditions
   */
  private async validateMarketConditions(pick: any): Promise<{
    liquidityAdequate: boolean;
    steamDirection: 'for' | 'against' | 'neutral';
    sharpMoneyFlow: number;
  }> {
    try {
      // Get current market data
      const { data: marketData } = await supabaseClient
        .from('market_data')
        .select('*')
        .eq('prop_id', pick.prop_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Get steam data
      const { data: steamData } = await supabaseClient
        .from('steam_tracking')
        .select('*')
        .eq('prop_id', pick.prop_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        liquidityAdequate: (marketData?.depth || 0) > 5000,
        steamDirection: steamData?.direction || 'neutral',
        sharpMoneyFlow: marketData?.institutional_flow || 0.5,
      };
    } catch (error) {
      this.logger.error('Failed to validate market conditions', { error, propId: pick.prop_id });
      return {
        liquidityAdequate: true,
        steamDirection: 'neutral',
        sharpMoneyFlow: 0.5,
      };
    }
  }

  /**
   * Get current odds movement data
   */
  private async getOddsMovementData(pick: any): Promise<OddsMovementData> {
    try {
      // Get initial and current odds
      const { data: oddsHistory } = await supabaseClient
        .from('odds_tracking')
        .select('*')
        .eq('prop_id', pick.prop_id)
        .order('created_at', { ascending: true });

      if (!oddsHistory || oddsHistory.length === 0) {
        // Fallback to pick's stored odds
        return {
          timestamp: new Date(),
          initialOdds: pick.initial_odds || -110,
          currentOdds: pick.current_odds || -110,
          movementBps: 0,
          movementDirection: 'neutral',
          volume: 0,
          steamStrength: 0,
          clvImpact: 0,
          marketDepth: 10000,
        };
      }

      const initialOdds = oddsHistory[0].odds;
      const currentOdds = oddsHistory[oddsHistory.length - 1].odds;
      const movementBps = this.calculateOddsMovementBps(initialOdds, currentOdds);

      return {
        timestamp: new Date(),
        initialOdds,
        currentOdds,
        movementBps,
        movementDirection:
          movementBps > 5 ? 'favorable' : movementBps < -5 ? 'unfavorable' : 'neutral',
        volume: oddsHistory[oddsHistory.length - 1].volume || 0,
        steamStrength: oddsHistory[oddsHistory.length - 1].steam_strength || 0,
        clvImpact: movementBps,
        marketDepth: oddsHistory[oddsHistory.length - 1].market_depth || 10000,
      };
    } catch (error) {
      this.logger.error('Failed to get odds movement data', { error, propId: pick.prop_id });
      return {
        timestamp: new Date(),
        initialOdds: -110,
        currentOdds: -110,
        movementBps: 0,
        movementDirection: 'neutral',
        volume: 0,
        steamStrength: 0,
        clvImpact: 0,
        marketDepth: 10000,
      };
    }
  }

  /**
   * Determine what action to take based on validation results
   */
  private async determineRecheckAction(
    pick: any,
    validation: ValidationSnapshot,
    oddsMovement: OddsMovementData,
    checkPoint: RecheckPoint
  ): Promise<RecheckAction> {
    // Critical failures require immediate action
    if (validation.pickStatus === 'invalid') {
      return {
        type: 'cancel',
        reason: 'Pick no longer meets promotion gate requirements or portfolio limits',
        changes: { statusChange: 'cancelled' },
        confidence: 0.9,
        riskImpact: -0.5,
      };
    }

    // S-tier violations may require tier adjustment
    if (validation.sTierValidation && validation.sTierValidation.recommendedTier !== pick.tier) {
      return {
        type: 'tier_change',
        reason: `S-tier standards violated: ${validation.sTierValidation.violations.length} violations`,
        changes: {
          oldTier: pick.tier,
          newTier: validation.sTierValidation.recommendedTier,
        },
        confidence: 0.8,
        riskImpact: -0.2,
      };
    }

    // Position size adjustments for portfolio risk
    if (validation.portfolioValidation.positionSizeAdjustment) {
      const currentSize = pick.kelly_fraction || 0.1;
      const newSize = validation.portfolioValidation.positionSizeAdjustment;

      if (Math.abs(newSize - currentSize) > 0.02) {
        // Only adjust if >2% difference
        return {
          type: 'adjust_size',
          reason: 'Portfolio risk management requires position size adjustment',
          changes: {
            oldSize: currentSize,
            newSize,
          },
          confidence: 0.7,
          riskImpact: 0.1,
        };
      }
    }

    // Significant favorable odds movement may warrant republishing
    if (oddsMovement.movementDirection === 'favorable' && oddsMovement.movementBps > 25) {
      return {
        type: 'republish',
        reason: `Significant favorable odds movement: ${oddsMovement.movementBps} BPS`,
        changes: {},
        confidence: 0.6,
        riskImpact: 0.2,
      };
    }

    // Default: maintain current status
    return {
      type: 'maintain',
      reason: 'All validation checks passed, no action required',
      changes: {},
      confidence: 0.9,
      riskImpact: 0,
    };
  }

  /**
   * Execute the determined action
   */
  private async executeRecheckAction(pick: any, action: RecheckAction): Promise<void> {
    this.logger.info('Executing re-check action', {
      pickId: pick.id,
      actionType: action.type,
      reason: action.reason,
    });

    // Handle recheck decision through publish guard (shadow mode aware)
    await publishGuard.handleRecheckDecision(
      pick.id,
      action.type,
      action.type === 'cancel' ? 'invalid' : 'valid',
      action.type,
      {
        evAtRecheck: pick.expected_value,
        clvAtRecheck: pick.clv_tracking?.current_clv_bps,
        oddsMovement: action.changes?.oldSize !== action.changes?.newSize ? 10 : 0,
      }
    );

    try {
      switch (action.type) {
        case 'cancel':
          await supabaseClient
            .from('unified_picks')
            .update({
              status: 'cancelled',
              cancellation_reason: action.reason,
              cancelled_at: new Date().toISOString(),
              cancelled_by: 'AutoRecheckService',
            })
            .eq('id', pick.id);
          break;

        case 'tier_change':
          await supabaseClient
            .from('unified_picks')
            .update({
              tier: action.changes.newTier,
              tier_adjustment_reason: action.reason,
              tier_adjusted_at: new Date().toISOString(),
              adjusted_by: 'AutoRecheckService',
            })
            .eq('id', pick.id);
          break;

        case 'adjust_size':
          await supabaseClient
            .from('unified_picks')
            .update({
              position_size: action.changes.newSize,
              size_adjustment_reason: action.reason,
              size_adjusted_at: new Date().toISOString(),
              adjusted_by: 'AutoRecheckService',
            })
            .eq('id', pick.id);
          break;

        case 'republish':
          // Trigger republication logic (would integrate with promotion system)
          await this.triggerRepublication(pick, action.reason);
          break;

        default:
          // No action needed for 'maintain'
          break;
      }

      this.logger.info('Re-check action executed successfully', {
        pickId: pick.id,
        actionType: action.type,
      });
    } catch (error) {
      this.logger.error('Failed to execute re-check action', {
        error,
        pickId: pick.id,
        actionType: action.type,
      });
      throw error;
    }
  }

  /**
   * Helper methods
   */
  private calculateOddsMovementBps(initialOdds: number, currentOdds: number): number {
    if (initialOdds === 0) return 0;
    const difference = Math.abs(currentOdds - initialOdds);
    return (difference / Math.abs(initialOdds)) * 10000;
  }

  private getNextCheckTime(
    preGameChecks: RecheckPoint[],
    postGameChecks: RecheckPoint[]
  ): Date | null {
    const allChecks = [...preGameChecks, ...postGameChecks];
    const pendingChecks = allChecks.filter(c => c.status === 'pending');

    if (pendingChecks.length === 0) return null;

    return pendingChecks.reduce(
      (earliest, check) => (check.scheduledTime < earliest ? check.scheduledTime : earliest),
      pendingChecks[0].scheduledTime
    );
  }

  private isScheduleComplete(schedule: RecheckSchedule): boolean {
    const allChecks = [...schedule.preGameChecks, ...schedule.postGameChecks];
    return allChecks.every(
      check =>
        check.status === 'completed' || check.status === 'skipped' || check.status === 'failed'
    );
  }

  private async getCurrentPickData(pickId: string): Promise<any> {
    try {
      const { data } = await supabaseClient
        .from('unified_picks')
        .select('*')
        .eq('id', pickId)
        .single();
      return data;
    } catch (error) {
      this.logger.error('Failed to get current pick data', { error, pickId });
      return null;
    }
  }

  private async loadActiveSchedules(): Promise<void> {
    try {
      const { data: schedules } = await supabaseClient
        .from('recheck_schedules')
        .select('*')
        .in('status', ['scheduled', 'active']);

      if (schedules) {
        schedules.forEach(schedule => {
          this.activeSchedules.set(schedule.pick_id, {
            pickId: schedule.pick_id,
            gameTime: new Date(schedule.game_time),
            preGameChecks: schedule.pre_game_checks || [],
            postGameChecks: schedule.post_game_checks || [],
            status: schedule.status,
            lastCheck: schedule.last_check ? new Date(schedule.last_check) : null,
            nextCheck: schedule.next_check ? new Date(schedule.next_check) : null,
          });
        });
      }
    } catch (error) {
      this.logger.error('Failed to load active schedules', { error });
    }
  }

  private async storeRecheckSchedule(schedule: RecheckSchedule): Promise<void> {
    try {
      await supabaseClient.from('recheck_schedules').insert({
        pick_id: schedule.pickId,
        game_time: schedule.gameTime.toISOString(),
        pre_game_checks: schedule.preGameChecks,
        post_game_checks: schedule.postGameChecks,
        status: schedule.status,
        last_check: schedule.lastCheck?.toISOString(),
        next_check: schedule.nextCheck?.toISOString(),
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to store recheck schedule', { error, pickId: schedule.pickId });
    }
  }

  private async updateRecheckSchedule(schedule: RecheckSchedule): Promise<void> {
    try {
      await supabaseClient
        .from('recheck_schedules')
        .update({
          pre_game_checks: schedule.preGameChecks,
          post_game_checks: schedule.postGameChecks,
          status: schedule.status,
          last_check: schedule.lastCheck?.toISOString(),
          next_check: schedule.nextCheck?.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('pick_id', schedule.pickId);
    } catch (error) {
      this.logger.error('Failed to update recheck schedule', { error, pickId: schedule.pickId });
    }
  }

  private async triggerRepublication(pick: any, reason: string): Promise<void> {
    // Implementation would trigger republication through promotion system
    this.logger.info('Triggering republication', { pickId: pick.id, reason });
  }

  /**
   * Get recheck statistics
   */
  public async getRecheckStats(timeframe: 'day' | 'week' | 'month' = 'day'): Promise<{
    totalSchedules: number;
    activeSchedules: number;
    completedChecks: number;
    actionsKnown: Record<string, number>;
    avgCheckTime: number;
    successRate: number;
  }> {
    // Implementation would query recheck data
    return {
      totalSchedules: this.activeSchedules.size,
      activeSchedules: Array.from(this.activeSchedules.values()).filter(s => s.status === 'active')
        .length,
      completedChecks: 0,
      actionsKnown: {},
      avgCheckTime: 0,
      successRate: 0,
    };
  }
}

export const autoRecheckService = AutoRecheckService.getInstance();
