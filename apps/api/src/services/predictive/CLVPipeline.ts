/**
 * ===============================================================================
 * CLV Pipeline - Closing Line Value tracking and prediction
 * Purpose: Calculate and predict CLV for picks to identify sharp play
 * Reference: Phase 11 predictive pipeline scaffolding
 * ===============================================================================
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../lib/logger';

export interface CLVInput {
  pickId: string;
  submittedLine: number;
  submittedOdds: number;
  submittedAt: Date;
  propId: string;
  sport: string;
  gameTime: Date;
}

export interface CLVOutput {
  pickId: string;
  clvCents: number;
  clvPercentage: number;
  clvStandardDeviations: number;
  clvTier: 'elite' | 'strong' | 'good' | 'neutral' | 'poor';
  beatClosingLine: boolean;
  closingLine: number;
  closingOdds: number;
  lineMovementTotal: number;
  timeToCloseMinutes: number;
}

export class CLVPipeline {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Calculate CLV for a pick (after game closes)
   */
  async calculateCLV(input: CLVInput): Promise<CLVOutput> {
    logger.info('[CLVPipeline] Calculating CLV', { pickId: input.pickId });

    // TODO: Implement actual closing line fetching from odds providers
    // For now, using placeholder logic

    // 1. Fetch closing line from odds provider
    const closingData = await this.fetchClosingLine(input.propId, input.gameTime);

    // 2. Calculate CLV metrics
    const clvMetrics = this.computeCLVMetrics(
      input.submittedOdds,
      closingData.closingOdds,
      input.submittedLine,
      closingData.closingLine
    );

    // 3. Determine CLV tier
    const clvTier = this.classifyCLVTier(clvMetrics.clvPercentage);

    // 4. Calculate time to close
    const timeToCloseMinutes = Math.floor(
      (input.gameTime.getTime() - input.submittedAt.getTime()) / (1000 * 60)
    );

    const output: CLVOutput = {
      pickId: input.pickId,
      clvCents: clvMetrics.clvCents,
      clvPercentage: clvMetrics.clvPercentage,
      clvStandardDeviations: clvMetrics.clvStandardDeviations,
      clvTier,
      beatClosingLine: clvMetrics.clvCents > 0,
      closingLine: closingData.closingLine,
      closingOdds: closingData.closingOdds,
      lineMovementTotal: Math.abs(closingData.closingLine - input.submittedLine),
      timeToCloseMinutes,
    };

    // 5. Store CLV data
    await this.storeCLV(output, input);

    return output;
  }

  /**
   * Fetch closing line from odds provider
   * TODO: Integrate with real odds API
   */
  private async fetchClosingLine(
    propId: string,
    gameTime: Date
  ): Promise<{ closingLine: number; closingOdds: number }> {
    // Placeholder - would query odds provider API
    // For now, simulate slight line movement
    const { data } = await this.supabase.from('props').select('line, over_odds').eq('id', propId).single();

    if (!data) {
      throw new Error(`Prop not found: ${propId}`);
    }

    // Simulate closing line movement (random ±5%)
    const movementPct = (Math.random() * 0.1 - 0.05);

    return {
      closingLine: data.line * (1 + movementPct),
      closingOdds: data.over_odds + Math.floor(movementPct * 20),
    };
  }

  /**
   * Compute CLV metrics
   */
  private computeCLVMetrics(
    submittedOdds: number,
    closingOdds: number,
    submittedLine: number,
    closingLine: number
  ): {
    clvCents: number;
    clvPercentage: number;
    clvStandardDeviations: number;
  } {
    // Calculate CLV in cents (based on $100 bet)
    const submittedProb = this.oddsToImpliedProb(submittedOdds);
    const closingProb = this.oddsToImpliedProb(closingOdds);

    const clvCents = (closingProb - submittedProb) * 100 * 100; // Scale to cents

    // Calculate CLV percentage
    const clvPercentage = ((closingProb - submittedProb) / submittedProb) * 100;

    // Calculate standard deviations (simplified - would use historical variance in production)
    const historicalStdDev = 2.0; // Placeholder std dev
    const clvStandardDeviations = clvPercentage / historicalStdDev;

    return {
      clvCents: Math.round(clvCents * 100) / 100,
      clvPercentage: Math.round(clvPercentage * 100) / 100,
      clvStandardDeviations: Math.round(clvStandardDeviations * 100) / 100,
    };
  }

  /**
   * Convert American odds to implied probability
   */
  private oddsToImpliedProb(odds: number): number {
    if (odds > 0) {
      return 100 / (odds + 100);
    } else {
      return Math.abs(odds) / (Math.abs(odds) + 100);
    }
  }

  /**
   * Classify CLV tier
   */
  private classifyCLVTier(clvPercentage: number): 'elite' | 'strong' | 'good' | 'neutral' | 'poor' {
    if (clvPercentage >= 5.0) return 'elite';
    if (clvPercentage >= 2.0) return 'strong';
    if (clvPercentage >= 0.5) return 'good';
    if (clvPercentage >= -0.5) return 'neutral';
    return 'poor';
  }

  /**
   * Store CLV data in database
   */
  private async storeCLV(output: CLVOutput, input: CLVInput): Promise<void> {
    const { error } = await this.supabase.from('clv_tracking').insert({
      pick_id: output.pickId,
      tenant_id: '00000000-0000-0000-0000-000000000001', // TODO: Get from input
      submitted_at: input.submittedAt.toISOString(),
      submitted_line: input.submittedLine,
      submitted_odds: input.submittedOdds,
      closing_line: output.closingLine,
      closing_odds: output.closingOdds,
      closing_time: input.gameTime.toISOString(),
      clv_cents: output.clvCents,
      clv_percentage: output.clvPercentage,
      clv_standard_deviations: output.clvStandardDeviations,
      clv_tier: output.clvTier,
      beat_closing_line: output.beatClosingLine,
      line_movement_total: output.lineMovementTotal,
      time_to_close_minutes: output.timeToCloseMinutes,
    });

    if (error) {
      logger.error('[CLVPipeline] Failed to store CLV data', { error: error.message });
      throw error;
    }
  }

  /**
   * Batch calculate CLV for multiple picks
   */
  async calculateBatchCLV(inputs: CLVInput[]): Promise<CLVOutput[]> {
    logger.info('[CLVPipeline] Calculating batch CLV', { count: inputs.length });

    const results: CLVOutput[] = [];

    for (const input of inputs) {
      try {
        const clv = await this.calculateCLV(input);
        results.push(clv);
      } catch (error: any) {
        logger.error('[CLVPipeline] Failed to calculate CLV', {
          pickId: input.pickId,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get CLV statistics for a user/capper
   */
  async getUserCLVStats(userId: string): Promise<{
    totalPicks: number;
    avgCLV: number;
    elitePicksCount: number;
    strongPicksCount: number;
    beatClosingLineRate: number;
  }> {
    const { data, error } = await this.supabase
      .from('clv_tracking')
      .select('*')
      .eq('tenant_id', '00000000-0000-0000-0000-000000000001');

    if (error) {
      logger.error('[CLVPipeline] Failed to get user CLV stats', { error: error.message });
      throw error;
    }

    const clvData = data || [];
    const totalPicks = clvData.length;

    if (totalPicks === 0) {
      return {
        totalPicks: 0,
        avgCLV: 0,
        elitePicksCount: 0,
        strongPicksCount: 0,
        beatClosingLineRate: 0,
      };
    }

    const avgCLV = clvData.reduce((sum, row) => sum + (row.clv_percentage || 0), 0) / totalPicks;
    const elitePicksCount = clvData.filter((row) => row.clv_tier === 'elite').length;
    const strongPicksCount = clvData.filter((row) => row.clv_tier === 'strong').length;
    const beatClosingLineCount = clvData.filter((row) => row.beat_closing_line).length;
    const beatClosingLineRate = (beatClosingLineCount / totalPicks) * 100;

    return {
      totalPicks,
      avgCLV: Math.round(avgCLV * 100) / 100,
      elitePicksCount,
      strongPicksCount,
      beatClosingLineRate: Math.round(beatClosingLineRate * 100) / 100,
    };
  }
}

export function createCLVPipeline(supabase: SupabaseClient): CLVPipeline {
  return new CLVPipeline(supabase);
}
