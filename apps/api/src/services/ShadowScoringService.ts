/**
 * Shadow Scoring Service (V3)
 * Sprint: SPRINT-022-V3-SHADOW-SCORING
 *
 * Reads provider_offers for a league + time window,
 * groups by canonical market key,
 * requires book_count >= 3,
 * runs computeConsensus() → computeProbabilityLayer() → computeScoreV2() → tier
 * in SHADOW mode (no publish impact).
 *
 * INVARIANTS:
 * - Does NOT touch legacy scoring entrypoints.
 * - Does NOT change Discord publishing behavior.
 * - Shadow writes go to unified_picks.meta.shadow_v3 only.
 * - Fail-closed: only markets with book_count >= 3 are eligible.
 */

import { computeScoreV2 } from '../agents/GradingAgent/scoring/computeScoreV2';
import { computeConsensus, PROBABILITY_MODEL_VERSION } from '../lib/probability/devigConsensus';
import { computeProbabilityLayer } from '../lib/probability/probabilityLayer';
import { createLogger } from '../utils/logger';

import type { ComputeScoreV2Result } from '../agents/GradingAgent/scoring/computeScoreV2';
import type { Tier } from '../agents/GradingAgent/scoring/TierScale';
import type {
  BookOffer,
  BookProfile,
  DataQuality,
  LiquidityTier,
} from '../lib/probability/devigConsensus';
import type { ExplanationPayload, ProbabilityOutputOk } from '../lib/probability/probabilityLayer';
import type { GradingFeatureSet } from '../types/GradingFeatureSet';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHADOW_MODEL_VERSION = 'shadow_v3.0.0_provider_offers';
const MIN_BOOKS_SHADOW = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShadowScoreResult {
  market_key: string;
  event_id: string;
  market_type_id: number;
  participant_id: string | null;
  book_count: number;
  providers: string[];
  p_market_devig: number;
  p_final: number;
  edge_final: number;
  uncertainty_final: number;
  clv_forecast: number;
  tier_shadow: Tier;
  confidence_shadow: number;
  score_shadow: number;
  model_version_shadow: string;
  probability_model_version: string;
  reasons: string[];
  explain_v3: ExplanationPayload | null;
  scored_at: string;
}

export interface ShadowScoringRunResult {
  total_markets_scanned: number;
  eligible_markets: number;
  scored_markets: number;
  failed_markets: number;
  results: ShadowScoreResult[];
  errors: Array<{ market_key: string; error: string }>;
  run_at: string;
  model_version: string;
}

interface ProviderOfferRow {
  id: string;
  event_id: string;
  market_type_id: number | null;
  participant_id: string | null;
  provider: string;
  provider_id: number | null;
  line: number | null;
  over_odds: number | null;
  under_odds: number | null;
  home_odds: number | null;
  away_odds: number | null;
  yes_odds: number | null;
  no_odds: number | null;
  snapshot_at: string;
}

interface MarketGroup {
  event_id: string;
  market_type_id: number;
  participant_id: string | null;
  offers: ProviderOfferRow[];
  providers: Set<string>;
}

// ---------------------------------------------------------------------------
// Provider profiles (fallback when provider_registry not joined)
// ---------------------------------------------------------------------------

const PROVIDER_PROFILES: Record<
  string,
  { bookProfile: BookProfile; liquidityTier: LiquidityTier; dataQuality: DataQuality }
> = {
  fanduel: { bookProfile: 'market_maker', liquidityTier: 'high', dataQuality: 'good' },
  draftkings: { bookProfile: 'market_maker', liquidityTier: 'high', dataQuality: 'good' },
  betmgm: { bookProfile: 'retail', liquidityTier: 'medium', dataQuality: 'good' },
  caesars: { bookProfile: 'retail', liquidityTier: 'medium', dataQuality: 'good' },
  pointsbet: { bookProfile: 'retail', liquidityTier: 'low', dataQuality: 'good' },
  pinnacle: { bookProfile: 'sharp', liquidityTier: 'high', dataQuality: 'good' },
  betrivers: { bookProfile: 'retail', liquidityTier: 'medium', dataQuality: 'good' },
  bet365: { bookProfile: 'market_maker', liquidityTier: 'high', dataQuality: 'good' },
};

function getProviderProfile(provider: string): {
  bookProfile: BookProfile;
  liquidityTier: LiquidityTier;
  dataQuality: DataQuality;
} {
  const key = provider.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    PROVIDER_PROFILES[key] ?? {
      bookProfile: 'retail' as BookProfile,
      liquidityTier: 'medium' as LiquidityTier,
      dataQuality: 'good' as DataQuality,
    }
  );
}

// ---------------------------------------------------------------------------
// Moneyline / yes-no market type detection
// ---------------------------------------------------------------------------

const MONEYLINE_MARKET_TYPES = [1];
const YES_NO_MARKET_TYPES = [5, 6, 10, 11];

function detectOddsPair(
  row: ProviderOfferRow,
  marketTypeId: number
): { sideA: number; sideB: number } | null {
  if (MONEYLINE_MARKET_TYPES.includes(marketTypeId)) {
    if (row.home_odds != null && row.away_odds != null) {
      return { sideA: row.home_odds, sideB: row.away_odds };
    }
  }
  if (YES_NO_MARKET_TYPES.includes(marketTypeId)) {
    if (row.yes_odds != null && row.no_odds != null) {
      return { sideA: row.yes_odds, sideB: row.no_odds };
    }
  }
  if (row.over_odds != null && row.under_odds != null) {
    return { sideA: row.over_odds, sideB: row.under_odds };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const logger = createLogger('ShadowScoringService');

export class ShadowScoringService {
  private supabase: import('@supabase/supabase-js').SupabaseClient;

  constructor(supabase: import('@supabase/supabase-js').SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Run shadow scoring for all eligible markets in a time window.
   * Fail-closed: only markets with book_count >= MIN_BOOKS_SHADOW are scored.
   */
  async runShadowScoring(
    options: {
      windowHours?: number;
      maxMarkets?: number;
    } = {}
  ): Promise<ShadowScoringRunResult> {
    const { windowHours = 24, maxMarkets = 200 } = options;
    const runAt = new Date().toISOString();

    logger.info('Starting shadow scoring run', { windowHours, maxMarkets });

    // Step 1: Fetch recent offers
    const offers = await this.fetchRecentOffers(windowHours);
    if (offers.length === 0) {
      logger.warn('No offers found in window');
      return {
        total_markets_scanned: 0,
        eligible_markets: 0,
        scored_markets: 0,
        failed_markets: 0,
        results: [],
        errors: [],
        run_at: runAt,
        model_version: SHADOW_MODEL_VERSION,
      };
    }

    // Step 2: Group by canonical market key
    const marketGroups = this.groupByMarket(offers);
    const totalMarkets = marketGroups.size;

    // Step 3: Filter to eligible markets (book_count >= MIN_BOOKS_SHADOW)
    const eligible = Array.from(marketGroups.values())
      .filter(g => g.providers.size >= MIN_BOOKS_SHADOW)
      .slice(0, maxMarkets);

    logger.info(
      `Markets: ${totalMarkets} total, ${eligible.length} eligible (>= ${MIN_BOOKS_SHADOW} books)`
    );

    // Step 4: Score each eligible market
    const results: ShadowScoreResult[] = [];
    const errors: Array<{ market_key: string; error: string }> = [];

    for (const group of eligible) {
      const marketKey = this.marketKey(group);
      try {
        const result = this.scoreMarket(group);
        if (result) {
          results.push(result);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ market_key: marketKey, error: msg });
        logger.warn(`Shadow scoring failed for ${marketKey}`, { error: msg });
      }
    }

    logger.info(`Shadow scoring complete: ${results.length} scored, ${errors.length} failed`);

    return {
      total_markets_scanned: totalMarkets,
      eligible_markets: eligible.length,
      scored_markets: results.length,
      failed_markets: errors.length,
      results,
      errors,
      run_at: runAt,
      model_version: SHADOW_MODEL_VERSION,
    };
  }

  // =========================================================================
  // Data fetch
  // =========================================================================

  private async fetchRecentOffers(windowHours: number): Promise<ProviderOfferRow[]> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - windowHours);

    const { data, error } = await this.supabase
      .from('provider_offers')
      .select(
        'id, event_id, market_type_id, participant_id, provider, provider_id, line, over_odds, under_odds, home_odds, away_odds, yes_odds, no_odds, snapshot_at'
      )
      .gte('snapshot_at', cutoff.toISOString())
      .order('snapshot_at', { ascending: false })
      .limit(10000);

    if (error) {
      logger.error('Failed to fetch provider_offers', { error: error.message });
      return [];
    }

    return (data ?? []) as ProviderOfferRow[];
  }

  // =========================================================================
  // Grouping
  // =========================================================================

  private groupByMarket(offers: ProviderOfferRow[]): Map<string, MarketGroup> {
    const groups = new Map<string, MarketGroup>();

    for (const offer of offers) {
      if (!offer.event_id || offer.market_type_id == null) continue;

      const key = this.marketKeyFromOffer(offer);
      const existing = groups.get(key);

      if (existing) {
        existing.offers.push(offer);
        existing.providers.add(offer.provider);
      } else {
        groups.set(key, {
          event_id: offer.event_id,
          market_type_id: offer.market_type_id,
          participant_id: offer.participant_id,
          offers: [offer],
          providers: new Set([offer.provider]),
        });
      }
    }

    return groups;
  }

  private marketKeyFromOffer(offer: ProviderOfferRow): string {
    return `${offer.event_id}|${offer.market_type_id}|${offer.participant_id ?? 'null'}`;
  }

  private marketKey(group: MarketGroup): string {
    return `${group.event_id}|${group.market_type_id}|${group.participant_id ?? 'null'}`;
  }

  // =========================================================================
  // Scoring pipeline (consensus → probability → score → tier)
  // =========================================================================

  private scoreMarket(group: MarketGroup): ShadowScoreResult | null {
    const marketKey = this.marketKey(group);
    const reasons: string[] = [];

    // Step A: Dedupe to latest offer per provider
    const latestByProvider = new Map<string, ProviderOfferRow>();
    for (const offer of group.offers) {
      const existing = latestByProvider.get(offer.provider);
      if (!existing || offer.snapshot_at > existing.snapshot_at) {
        latestByProvider.set(offer.provider, offer);
      }
    }

    // Step B: Convert to BookOffer[]
    const bookOffers: BookOffer[] = [];
    for (const [, offer] of latestByProvider) {
      const pair = detectOddsPair(offer, group.market_type_id);
      if (!pair) continue;

      const profile = getProviderProfile(offer.provider);
      bookOffers.push({
        bookId: String(offer.provider_id ?? offer.provider),
        bookName: offer.provider,
        overOdds: pair.sideA,
        underOdds: pair.sideB,
        bookProfile: profile.bookProfile,
        liquidityTier: profile.liquidityTier,
        dataQuality: profile.dataQuality,
      });
    }

    // Fail-closed: require MIN_BOOKS_SHADOW valid book offers
    if (bookOffers.length < MIN_BOOKS_SHADOW) {
      reasons.push(`INSUFFICIENT_VALID_BOOKS:${bookOffers.length}`);
      return null;
    }

    // Step C: computeConsensus()
    const consensus = computeConsensus(bookOffers, 'proportional');
    if (!consensus.ok) {
      const fail = consensus as { ok: false; reason: string; reasonDetail: string };
      reasons.push(`CONSENSUS_FAILED:${fail.reason}`);
      return null;
    }

    const p_market_devig = consensus.overConsensus;

    // Step D: computeProbabilityLayer()
    const probResult = computeProbabilityLayer({
      confidenceScore: 5.0, // Neutral — market-anchored delta = 0
      bookOffers,
      side: 'over',
      entryOdds: bookOffers[0].overOdds,
      sport: 'NBA',
      marketType: String(group.market_type_id),
      hoursToStart: null,
      featureCompleteness: 0.8,
    });

    if (!probResult.ok) {
      const fail = probResult as { ok: false; reason: string; reasonDetail: string };
      reasons.push(`PROBABILITY_FAILED:${fail.reason}`);
      return null;
    }

    const prob = probResult as ProbabilityOutputOk;

    // Step E: computeScoreV2()
    const featureSet = this.buildMinimalFeatureSet(group, prob, bookOffers);
    const scoreResult: ComputeScoreV2Result = computeScoreV2(featureSet);

    reasons.push(
      `consensus:${consensus.booksUsed}books`,
      `devig:${consensus.devigMethod}`,
      `prob:market_anchored`,
      `tier:${scoreResult.tier}`,
      `score:${scoreResult.score.toFixed(1)}`
    );

    return {
      market_key: marketKey,
      event_id: group.event_id,
      market_type_id: group.market_type_id,
      participant_id: group.participant_id,
      book_count: bookOffers.length,
      providers: Array.from(group.providers),
      p_market_devig,
      p_final: prob.pFinal,
      edge_final: prob.edgeFinal,
      uncertainty_final: prob.uncertaintyFinal,
      clv_forecast: prob.clvForecast,
      tier_shadow: scoreResult.tier,
      confidence_shadow: scoreResult.score / 100,
      score_shadow: scoreResult.score,
      model_version_shadow: SHADOW_MODEL_VERSION,
      probability_model_version: prob.probabilityModelVersion,
      reasons,
      explain_v3: prob.explain,
      scored_at: new Date().toISOString(),
    };
  }

  // =========================================================================
  // Feature set builder (minimal, market-anchored)
  // =========================================================================

  /**
   * Build a minimal GradingFeatureSet from probability output.
   * Uses neutral defaults for features not available from provider_offers.
   * This is intentional: shadow scoring measures the V3 pipeline quality
   * from market data alone, without legacy enrichment.
   */
  private buildMinimalFeatureSet(
    group: MarketGroup,
    prob: ProbabilityOutputOk,
    bookOffers: BookOffer[]
  ): GradingFeatureSet {
    const bookSpread = this.computeBookSpread(bookOffers);

    return {
      propId: `shadow_${group.event_id}_${group.market_type_id}_${group.participant_id ?? 'game'}`,
      date: new Date().toISOString().slice(0, 10),
      sport: 'NBA',
      league: 'NBA',
      marketType: String(group.market_type_id),
      market: {
        type: String(group.market_type_id),
        odds: bookOffers[0].overOdds,
        line: group.offers[0]?.line ?? 0,
      },

      // Market intelligence (from real data)
      expectedValue: prob.edgeFinal * 100,
      lineMovement: 0,
      matchupRating: 5,
      playerForm: 5,
      injuryImpact: 0,
      weatherImpact: 0,

      // Market features (from consensus)
      marketIntelligence: Math.min(10, bookOffers.length * 2),
      sharpMoney: 50,
      volumeProfile: 5,
      closingLineValue: prob.clvForecast * 10,
      crossBookVariance: bookSpread * 100,
      marketEfficiency: bookOffers.length >= 3 ? 8 : 5,

      // Context (neutral defaults)
      playerFatigue: 5,
      venueAdvantage: 0,
      refereeImpact: 0,
      paceImpact: 5,
      motivationalFactors: 5,

      // Risk (conservative defaults)
      correlationRisk: 0.2,
      volatility: 5,
      portfolioImpact: 0.1,

      // Data quality
      dataQuality: {
        dataValidationScore: 1.0,
        outlierScore: 0,
        consistencyScore: bookOffers.length >= 3 ? 0.9 : 0.7,
        completeness: bookOffers.length >= 3 ? 0.8 : 0.5,
      },

      // Metadata
      timestamp: new Date().toISOString(),
      version: SHADOW_MODEL_VERSION,
      source: 'provider_offers',
      confidence: prob.pFinal > 0.5 ? Math.min(10, prob.edgeFinal * 100 + 5) : 5,
    };
  }

  private computeBookSpread(bookOffers: BookOffer[]): number {
    if (bookOffers.length < 2) return 0;
    const probs = bookOffers.map(b => {
      const implied = Math.abs(b.overOdds) / (Math.abs(b.overOdds) + 100);
      return b.overOdds < 0 ? implied : 100 / (b.overOdds + 100);
    });
    return Math.max(...probs) - Math.min(...probs);
  }
}
