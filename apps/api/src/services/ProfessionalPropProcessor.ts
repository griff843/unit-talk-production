/**
 * Professional Prop Processor
 * Sprint: SPRINT-SCORING-PIPELINE-ACTIVATION-018
 *
 * Canonical scoring path for SGO-derived props:
 *   A) Determine devig mode (paired vs single-sided)
 *   B) DeviggingService.devigTwoWay() → market probabilities
 *   C) computeProbabilityLayer() → p_final, edge_final, uncertainty_final, clv_forecast
 *   D) computeScoreV2() → tier, score, ev, feature_audit
 *   E) evaluatePromotion() → promotion_band
 *   F) lifecycleInsert() → single-writer compliant write
 *
 * INVARIANTS:
 * - No inline edge calculation. All scoring via production modules.
 * - Single-writer discipline via lifecycleInsert only.
 * - Single-sided odds cannot qualify for HARD promotion band.
 * - Probability layer fail-closed: missing primitives → Gate 8 blocks promotion.
 */

import { computeScoreV2 } from '../agents/GradingAgent/scoring/computeScoreV2';
import {
  evaluatePromotion,
  parsePromotionPolicyConfig,
} from '../agents/GradingAgent/scoring/promotionPolicy';
import { MODEL_VERSION } from '../agents/ScoringAgent/scoring/edgeEngineV1';
import { lifecycleInsert } from '../lib/lifecycle/write-adapter';
import { PROBABILITY_MODEL_VERSION } from '../lib/probability/devigConsensus';
import { computeProbabilityLayer } from '../lib/probability/probabilityLayer';
import { createLogger } from '../utils/logger';

import { CLVTrackingService } from './clv/CLVTrackingService';
import { DeviggingService } from './devigging/DeviggingService';
import { supabaseClient } from './supabaseClient';

import type { ComputeScoreV2Result } from '../agents/GradingAgent/scoring/computeScoreV2';
import type {
  ProbabilityPrimitives,
  PromotionBand,
  PromotionDecision,
} from '../agents/GradingAgent/scoring/promotionPolicy';
import type { WriteResult } from '../lib/lifecycle/write-adapter';
import type {
  BookOffer,
  BookProfile,
  DataQuality,
  LiquidityTier,
} from '../lib/probability/devigConsensus';
import type {
  ProbabilityInput,
  ProbabilityOutput,
  ProbabilityOutputOk,
} from '../lib/probability/probabilityLayer';
import type { GradingFeatureSet } from '../types/GradingFeatureSet';

// ---------------------------------------------------------------------------
// Raw prop type (matches raw_props table schema)
// ---------------------------------------------------------------------------

interface RawPropRow {
  id: string;
  player_name?: string | null;
  team?: string | null;
  opponent?: string | null;
  sport?: string | null;
  stat_type?: string | null;
  market_type?: string | null;
  line?: number | null;
  over_odds?: number | null;
  under_odds?: number | null;
  provider?: string | null;
  game_time?: string | null;
  matchup?: string | null;
  processed_at?: string | null;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Devig result type (from DeviggingService.devigTwoWay)
// ---------------------------------------------------------------------------

interface DevigTwoWayResult {
  outcome1: {
    trueProb: number;
    fairOdds: number;
    totalVig: number;
    edge: number;
    impliedProbability: number;
  };
  outcome2: {
    trueProb: number;
    fairOdds: number;
    totalVig: number;
    edge: number;
    impliedProbability: number;
  };
  totalVig: number;
  deviggedEdge?: number;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

type DevigMode = 'PAIRED' | 'FALLBACK_SINGLE_SIDED';

export interface ProfessionalPropResult {
  pickId: string;
  professionalScore: number;
  tier: string;
  confidence: number;
  devigged_edge: number;
  kelly_fraction: number;
  professional_insights: Record<string, unknown>;
  clv_tracking_id: string;
  auto_approved: boolean;
  processing_time: number;
  p_final: number | null;
  edge_final: number | null;
  uncertainty_final: number | null;
  clv_forecast: number | null;
  promotion_band: string;
  model_version: string;
  devig_mode: DevigMode;
}

export interface PropProcessingOptions {
  auto_approve_threshold: number;
  require_admin_review: string[];
  max_batch_size: number;
  timeout_ms: number;
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export class ProfessionalPropProcessor {
  private static instance: ProfessionalPropProcessor;
  private readonly logger: ReturnType<typeof createLogger>;
  private readonly deviggingService: DeviggingService;
  private readonly clvTrackingService: CLVTrackingService;

  private readonly defaultOptions: PropProcessingOptions = {
    auto_approve_threshold: 3.0,
    require_admin_review: ['B', 'C', 'D'],
    max_batch_size: 50,
    timeout_ms: 30_000,
  };

  private constructor() {
    this.logger = createLogger('ProfessionalPropProcessor');
    this.deviggingService = DeviggingService.getInstance();
    this.clvTrackingService = CLVTrackingService.getInstance();
  }

  public static getInstance(): ProfessionalPropProcessor {
    if (!ProfessionalPropProcessor.instance) {
      ProfessionalPropProcessor.instance = new ProfessionalPropProcessor();
    }
    return ProfessionalPropProcessor.instance;
  }

  // =========================================================================
  // MAIN ENTRY POINT
  // =========================================================================

  async processRawProps(
    options?: Partial<PropProcessingOptions>
  ): Promise<ProfessionalPropResult[]> {
    const config = { ...this.defaultOptions, ...options };
    const results: ProfessionalPropResult[] = [];

    this.logger.info('Starting professional prop processing...');

    try {
      const rawProps = await this.getUnprocessedRawProps(config.max_batch_size);

      if (rawProps.length === 0) {
        this.logger.info('No unprocessed props found');
        return results;
      }

      this.logger.info(`Processing ${rawProps.length} raw props through production pipeline`);

      for (const rawProp of rawProps) {
        try {
          const result = await this.processIndividualProp(rawProp, config);
          results.push(result);
          await this.markRawPropProcessed(rawProp.id);
        } catch (error) {
          this.logger.error(`Failed to process prop ${rawProp.id}`, error);
          await this.markRawPropError(
            rawProp.id,
            error instanceof Error ? error.message : String(error)
          );
        }
      }

      this.logger.info(`Successfully processed ${results.length}/${rawProps.length} props`);
      this.logProcessingSummary(results);

      return results;
    } catch (error) {
      this.logger.error('Professional prop processing failed', error);
      throw error;
    }
  }

  // =========================================================================
  // PIPELINE: strict order A → F
  // =========================================================================

  private async processIndividualProp(
    rawProp: RawPropRow,
    config: PropProcessingOptions
  ): Promise<ProfessionalPropResult> {
    const startTime = Date.now();
    const propLogger = this.logger.child({ propId: rawProp.id, sport: rawProp.sport });

    try {
      // ── A) Determine devig mode ──────────────────────────────────────────
      const devigMode = this.determineDevigMode(rawProp);
      propLogger.info('Devig mode determined', { devigMode });

      // ── B) Devig odds ────────────────────────────────────────────────────
      const deviggingResult = this.deviggOdds(rawProp, devigMode);
      propLogger.info('Devigging completed', {
        totalVig: deviggingResult.totalVig.toFixed(4),
        overTrueProb: deviggingResult.outcome1.trueProb.toFixed(4),
        underTrueProb: deviggingResult.outcome2.trueProb.toFixed(4),
      });

      // ── C) Probability layer ─────────────────────────────────────────────
      const side = this.determineBetSide(deviggingResult);
      const probResult = this.runProbabilityLayer(rawProp, side, devigMode);
      propLogger.info('Probability layer completed', {
        ok: probResult.ok,
        reason: probResult.ok ? undefined : (probResult as { reason: string }).reason,
      });

      // ── D) CLV tracking ──────────────────────────────────────────────────
      const clvTrackingId = await this.startCLVTracking(rawProp, deviggingResult, side);

      // ── E) Grading via computeScoreV2 ────────────────────────────────────
      const v2Result = this.runScoring(rawProp, deviggingResult);
      propLogger.info('Scoring completed', {
        score: v2Result.score,
        tier: v2Result.tier,
        ev: v2Result.ev.toFixed(4),
      });

      // ── F) Promotion evaluation ──────────────────────────────────────────
      const { promoDecision, dbPromotionBand } = this.runPromotionEvaluation(
        rawProp,
        v2Result,
        probResult,
        devigMode
      );
      propLogger.info('Promotion evaluated', {
        band: dbPromotionBand,
        promote: promoDecision.promote,
      });

      // ── G) Auto-approval check ──────────────────────────────────────────
      const autoApproved = this.shouldAutoApprove(v2Result, config);

      // ── H) Write via lifecycleInsert ─────────────────────────────────────
      const pickId = await this.createUnifiedPick(
        rawProp,
        v2Result,
        probResult,
        promoDecision,
        dbPromotionBand,
        devigMode,
        deviggingResult,
        clvTrackingId,
        autoApproved,
        side
      );

      const processingTime = Date.now() - startTime;
      propLogger.info('Processing completed', { pickId, processingTime: `${processingTime}ms` });

      return {
        pickId,
        professionalScore: v2Result.score,
        tier: v2Result.tier,
        confidence: v2Result.score / 100,
        devigged_edge: v2Result.ev,
        kelly_fraction: 0,
        professional_insights: {},
        clv_tracking_id: clvTrackingId,
        auto_approved: autoApproved,
        processing_time: processingTime,
        p_final: probResult.ok ? (probResult as ProbabilityOutputOk).pFinal : null,
        edge_final: probResult.ok ? (probResult as ProbabilityOutputOk).edgeFinal : null,
        uncertainty_final: probResult.ok
          ? (probResult as ProbabilityOutputOk).uncertaintyFinal
          : null,
        clv_forecast: probResult.ok ? (probResult as ProbabilityOutputOk).clvForecast : null,
        promotion_band: dbPromotionBand,
        model_version: MODEL_VERSION,
        devig_mode: devigMode,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      propLogger.error('Processing failed', {
        error: error instanceof Error ? error.message : String(error),
        processingTime: `${processingTime}ms`,
      });
      throw error;
    }
  }

  // =========================================================================
  // STEP A: Determine devig mode
  // =========================================================================

  private determineDevigMode(rawProp: RawPropRow): DevigMode {
    const hasOver = rawProp.over_odds != null && isFinite(Number(rawProp.over_odds));
    const hasUnder = rawProp.under_odds != null && isFinite(Number(rawProp.under_odds));
    return hasOver && hasUnder ? 'PAIRED' : 'FALLBACK_SINGLE_SIDED';
  }

  // =========================================================================
  // STEP B: Devig odds
  // =========================================================================

  private deviggOdds(rawProp: RawPropRow, devigMode: DevigMode): DevigTwoWayResult {
    const overOdds = Number(rawProp.over_odds) || -110;
    const underOdds = Number(rawProp.under_odds) || -110;

    if (devigMode === 'FALLBACK_SINGLE_SIDED') {
      // For single-sided: use -110 as synthetic complementary side
      // This allows devig to run but results carry higher uncertainty
      this.logger.warn(`Single-sided odds for prop ${rawProp.id}, using synthetic complement`);
    }

    return this.deviggingService.devigTwoWay({
      odds1: overOdds,
      odds2: underOdds,
    });
  }

  // =========================================================================
  // STEP C: Probability layer
  // =========================================================================

  private determineBetSide(deviggingResult: DevigTwoWayResult): 'over' | 'under' {
    return deviggingResult.outcome1.trueProb > deviggingResult.outcome2.trueProb ? 'over' : 'under';
  }

  private runProbabilityLayer(
    rawProp: RawPropRow,
    side: 'over' | 'under',
    devigMode: DevigMode
  ): ProbabilityOutput {
    // Build BookOffer from raw_props data.
    // NOTE: Currently raw_props stores single-book odds from SGO.
    // SGO API supports multi-book via byBookmaker — when sgoFetcher is updated
    // to store per-book odds, this should build multiple BookOffers to meet
    // MIN_BOOKS_FOR_CONSENSUS (2). Until then, probability layer will correctly
    // return INSUFFICIENT_BOOKS (fail-closed).
    const bookOffer: BookOffer = {
      bookId: String(rawProp.provider || 'sgo'),
      bookName: String(rawProp.provider || 'SGO'),
      overOdds: Number(rawProp.over_odds) || -110,
      underOdds: Number(rawProp.under_odds) || -110,
      bookProfile: 'retail' as BookProfile,
      liquidityTier: 'medium' as LiquidityTier,
      dataQuality: (devigMode === 'PAIRED' ? 'good' : 'partial') as DataQuality,
    };

    const entryOdds =
      side === 'over' ? Number(rawProp.over_odds) || -110 : Number(rawProp.under_odds) || -110;

    const input: ProbabilityInput = {
      confidenceScore: 5.0, // Neutral (market-anchored delta = 0)
      bookOffers: [bookOffer],
      side,
      entryOdds,
      sport: String(rawProp.sport || 'NBA'),
      marketType: String(rawProp.stat_type || 'unknown'),
      hoursToStart: null,
      featureCompleteness: devigMode === 'PAIRED' ? 0.7 : 0.4,
    };

    return computeProbabilityLayer(input);
  }

  // =========================================================================
  // STEP D: CLV tracking
  // =========================================================================

  private async startCLVTracking(
    rawProp: RawPropRow,
    deviggingResult: DevigTwoWayResult,
    side: 'over' | 'under'
  ): Promise<string> {
    const betOdds =
      side === 'over' ? Number(rawProp.over_odds) || -110 : Number(rawProp.under_odds) || -110;
    const modelProb =
      side === 'over' ? deviggingResult.outcome1.trueProb : deviggingResult.outcome2.trueProb;

    try {
      await this.clvTrackingService.trackPick({
        propId: rawProp.id,
        userId: 'system',
        sport: String(rawProp.sport || 'NBA'),
        market: String(rawProp.stat_type || 'unknown'),
        book: String(rawProp.provider || 'sgo'),
        openingLine: Number(rawProp.line) || 0,
        openingOdds: betOdds,
        betLine: Number(rawProp.line) || 0,
        betOdds: betOdds,
        gameTime: rawProp.game_time
          ? new Date(rawProp.game_time)
          : new Date(Date.now() + 4 * 60 * 60 * 1000),
        modelEdge: this.deviggingService.calculateEdge(modelProb, betOdds, false).edge,
      });
    } catch (err) {
      this.logger.warn(`CLV tracking failed for prop ${rawProp.id}`, err);
    }

    return rawProp.id;
  }

  // =========================================================================
  // STEP E: Scoring via computeScoreV2
  // =========================================================================

  private runScoring(
    rawProp: RawPropRow,
    deviggingResult: DevigTwoWayResult
  ): ComputeScoreV2Result {
    const featureSet = this.buildGradingFeatureSet(rawProp, deviggingResult);
    return computeScoreV2(featureSet);
  }

  private buildGradingFeatureSet(
    rawProp: RawPropRow,
    deviggingResult: DevigTwoWayResult
  ): GradingFeatureSet {
    return {
      propId: rawProp.id,
      sport: String(rawProp.sport || 'NBA'),
      league: String(rawProp.sport || 'NBA'),
      player: rawProp.player_name || undefined,
      marketType: String(rawProp.stat_type || 'unknown'),
      date: new Date().toISOString(),
      market: {
        type: String(rawProp.stat_type || 'unknown'),
        odds: Number(rawProp.over_odds) || -110,
        line: Number(rawProp.line) || 0,
      },
      expectedValue: deviggingResult.deviggedEdge || 0,
      lineMovement: 0,
      matchupRating: 0.6,
      playerForm: 0.7,
      injuryImpact: 0,
      weatherImpact: 0,
      marketIntelligence: 0.5,
      sharpMoney: 0.5,
      volumeProfile: 0.5,
      closingLineValue: 0,
      playerFatigue: 0.5,
      venueAdvantage: 0,
      refereeImpact: 0,
      paceImpact: 0.5,
      motivationalFactors: 0.5,
      correlationRisk: 0,
      volatility: 0.5,
      portfolioImpact: 0,
      dataQuality: {
        dataValidationScore: 0.8,
        outlierScore: 0.9,
        consistencyScore: 0.85,
        completeness: 0.7,
      },
      timestamp: new Date().toISOString(),
      version: MODEL_VERSION,
      source: 'ProfessionalPropProcessor',
      confidence: 5.0,
    };
  }

  // =========================================================================
  // STEP F: Promotion evaluation
  // =========================================================================

  private runPromotionEvaluation(
    rawProp: RawPropRow,
    v2Result: ComputeScoreV2Result,
    probResult: ProbabilityOutput,
    devigMode: DevigMode
  ): { promoDecision: PromotionDecision; dbPromotionBand: string } {
    const promoCfg = parsePromotionPolicyConfig();

    const probabilityPrimitives: ProbabilityPrimitives | undefined = probResult.ok
      ? {
          pFinal: (probResult as ProbabilityOutputOk).pFinal,
          uncertaintyFinal: (probResult as ProbabilityOutputOk).uncertaintyFinal,
          pMarketDevig: (probResult as ProbabilityOutputOk).pMarketDevig,
          edgeFinal: (probResult as ProbabilityOutputOk).edgeFinal,
          clvForecast: (probResult as ProbabilityOutputOk).clvForecast,
        }
      : undefined; // null primitives → Gate 8 blocks promotion

    const promoDecision = evaluatePromotion(
      v2Result,
      String(rawProp.sport || 'NBA'),
      rawProp.id,
      promoCfg,
      probabilityPrimitives
    );

    // Single-sided fallback: HARD band not eligible
    let promotionBand: PromotionBand = promoDecision.band;
    if (devigMode === 'FALLBACK_SINGLE_SIDED' && promotionBand === 'HARD') {
      promotionBand = 'SOFT';
      this.logger.info(`Prop ${rawProp.id}: HARD→SOFT downgrade (single-sided odds)`);
    }

    // Map NONE → NO_POST for DB storage
    const dbPromotionBand = promotionBand === 'NONE' ? 'NO_POST' : promotionBand;

    return { promoDecision, dbPromotionBand };
  }

  // =========================================================================
  // STEP G: Auto-approval
  // =========================================================================

  private shouldAutoApprove(
    v2Result: ComputeScoreV2Result,
    config: PropProcessingOptions
  ): boolean {
    if (v2Result.tier === 'S' || v2Result.tier === 'A') {
      return v2Result.score >= config.auto_approve_threshold * 100;
    }
    return false;
  }

  // =========================================================================
  // STEP H: Create unified pick via lifecycleInsert
  // =========================================================================

  private async createUnifiedPick(
    rawProp: RawPropRow,
    v2Result: ComputeScoreV2Result,
    probResult: ProbabilityOutput,
    promoDecision: PromotionDecision,
    dbPromotionBand: string,
    devigMode: DevigMode,
    deviggingResult: DevigTwoWayResult,
    clvTrackingId: string,
    autoApproved: boolean,
    side: 'over' | 'under'
  ): Promise<string> {
    const prediction = side;

    const pickId = crypto.randomUUID();

    const pickPayload = {
      id: pickId,
      raw_prop_id: rawProp.id,
      user_id: 'system',
      sport: rawProp.sport,
      prediction,
      confidence: v2Result.score / 100,
      status: 'pending' as const,
      tier: v2Result.tier,
      professional_score: v2Result.score,

      // Probability primitives (null when layer fails — fail-closed)
      p_final: probResult.ok ? (probResult as ProbabilityOutputOk).pFinal : null,
      edge_final: probResult.ok ? (probResult as ProbabilityOutputOk).edgeFinal : null,
      uncertainty_final: probResult.ok
        ? (probResult as ProbabilityOutputOk).uncertaintyFinal
        : null,
      clv_forecast: probResult.ok ? (probResult as ProbabilityOutputOk).clvForecast : null,

      // Promotion
      promotion_band: dbPromotionBand,

      // Model versioning
      model_version: MODEL_VERSION,
      feature_set_version: PROBABILITY_MODEL_VERSION,

      // Devig results
      devigged_edge: deviggingResult.deviggedEdge ?? 0,

      // Metadata
      meta: {
        devig_mode: devigMode,
        sprint: 'SPRINT-SCORING-PIPELINE-ACTIVATION-018',
        total_vig: deviggingResult.totalVig,
        over_true_prob: deviggingResult.outcome1.trueProb,
        under_true_prob: deviggingResult.outcome2.trueProb,
        promotion_reason_codes: promoDecision.reason_codes,
        promotion_notes: promoDecision.notes,
        probability_layer_ok: probResult.ok,
        probability_layer_reason: probResult.ok ? null : (probResult as { reason: string }).reason,
      },

      posted_to_discord: false,
    };

    const writeResult: WriteResult = await lifecycleInsert(supabaseClient, pickPayload, {
      writerRole: 'submitter',
      traceId: `ppp-${rawProp.id}`,
    });

    if (!writeResult.success) {
      throw new Error(`lifecycleInsert failed: ${writeResult.error}`);
    }

    return writeResult.pickId ?? pickId;
  }

  // =========================================================================
  // DB helpers
  // =========================================================================

  private async getUnprocessedRawProps(limit: number): Promise<RawPropRow[]> {
    const { data, error } = await supabaseClient
      .from('raw_props')
      .select('*')
      .is('processed_at', null)
      .is('error_message', null)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch raw props: ${error.message}`);
    }

    return (data as RawPropRow[]) || [];
  }

  private async markRawPropProcessed(propId: string): Promise<void> {
    const { error } = await supabaseClient
      .from('raw_props')
      .update({
        processed_at: new Date().toISOString(),
        processed_by: 'professional_system',
      })
      .eq('id', propId);

    if (error) {
      this.logger.error(`Failed to mark prop ${propId} as processed:`, error);
    }
  }

  private async markRawPropError(propId: string, errorMessage: string): Promise<void> {
    const { error } = await supabaseClient
      .from('raw_props')
      .update({
        error_message: errorMessage,
        error_at: new Date().toISOString(),
      })
      .eq('id', propId);

    if (error) {
      this.logger.error(`Failed to mark prop ${propId} with error:`, error);
    }
  }

  // =========================================================================
  // Monitoring
  // =========================================================================

  private logProcessingSummary(results: ProfessionalPropResult[]): void {
    if (results.length === 0) return;

    const summary = {
      total_processed: results.length,
      auto_approved: results.filter(r => r.auto_approved).length,
      manual_review: results.filter(r => !r.auto_approved).length,
      tier_distribution: {
        S: results.filter(r => r.tier === 'S').length,
        A: results.filter(r => r.tier === 'A').length,
        B: results.filter(r => r.tier === 'B').length,
        C: results.filter(r => r.tier === 'C').length,
        D: results.filter(r => r.tier === 'D').length,
        F: results.filter(r => r.tier === 'F').length,
      },
      promotion_band_distribution: {
        HARD: results.filter(r => r.promotion_band === 'HARD').length,
        SOFT: results.filter(r => r.promotion_band === 'SOFT').length,
        NO_POST: results.filter(r => r.promotion_band === 'NO_POST').length,
      },
      devig_mode_distribution: {
        PAIRED: results.filter(r => r.devig_mode === 'PAIRED').length,
        FALLBACK_SINGLE_SIDED: results.filter(r => r.devig_mode === 'FALLBACK_SINGLE_SIDED').length,
      },
      avg_processing_time: results.reduce((sum, r) => sum + r.processing_time, 0) / results.length,
      avg_professional_score:
        results.reduce((sum, r) => sum + r.professionalScore, 0) / results.length,
    };

    this.logger.info('Processing summary', summary);
  }

  /**
   * Process a single prop from GradingFeatureSet (called by GradingAgent).
   * Routes through production pipeline: devig → probability → scoring → promotion.
   */
  async processGradingFeatureSet(features: GradingFeatureSet): Promise<ProfessionalPropResult> {
    const rawProp: RawPropRow = {
      id: features.propId,
      sport: features.sport,
      stat_type: features.market?.type || features.marketType,
      player_name: features.player,
      line: features.market?.line || 0,
      over_odds: features.market?.odds || features.odds || -110,
      under_odds: features.market?.odds || features.odds || -110,
      created_at: features.timestamp || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return this.processIndividualProp(rawProp, this.defaultOptions);
  }

  /**
   * Get processing statistics from recent logs
   */
  async getProcessingStats(): Promise<Record<string, unknown>> {
    const { data: stats } = await supabaseClient
      .from('processing_logs')
      .select('*')
      .eq('processor', 'professional_prop_processor')
      .order('processed_at', { ascending: false })
      .limit(10);

    return {
      recent_runs: stats,
      total_processed:
        stats?.reduce(
          (sum, s) => sum + ((s.summary as Record<string, number>)?.total_processed || 0),
          0
        ) || 0,
    };
  }
}

// Export singleton instance
export const professionalPropProcessor = ProfessionalPropProcessor.getInstance();
