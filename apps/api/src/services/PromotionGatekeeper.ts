/* eslint-disable max-lines, max-lines-per-function */
/**
 * Promotion Gatekeeper Service
 * Manages pick promotion through Instant vs 10am lanes with comprehensive validation
 */

import { createHash } from 'crypto';

import { publishGuard } from '../promotion/PublishGuard';
import { Logger } from '../shared/logger';

import { supabaseClient } from './supabaseClient';

// ─── V2 Gate Recalibration (Tranche 7, Stage 1) ────────────────────────────
// When SCORING_ENGINE_V2=true, V2 produces scores in 38-62 range (mean ~53,
// stddev ~7). Legacy gates (85/75/70) are structurally unreachable.
// V2 overrides recalibrate minProfessionalScore and minTier to the V2
// distribution so shadow promotion decisions become non-zero and controllable.
// V1 behavior is completely unchanged (useV2Gates()=false).
// SPRINT-SCHEMA-ENV-GATES-002: Lazy env access
function useV2Gates(): boolean {
  return process.env['SCORING_ENGINE_V2'] === 'true';
}

interface V2GateOverride {
  minProfessionalScore: number;
  minTier?: 'S' | 'A' | 'B' | 'C';
}

/**
 * V2-calibrated gate thresholds derived from fixture analysis (40 picks):
 *   instant-s-tier: 62 → 5.0% pass (target 5-15%)
 *   10am-premium:   58 → 22.5% pass (target 15-30%)
 *   steam-hunter:   55 → 45.0% score-pass (further filtered by steam requirement)
 *
 * Override via env vars for runtime tuning without code changes.
 */
const V2_GATE_OVERRIDES: Record<string, V2GateOverride> = {
  'instant-s-tier': {
    minProfessionalScore: Number(process.env['V2_GATE_INSTANT_S_TIER']) || 62,
    minTier: 'A', // V2 max tier is A (score ≤ 62 < S-threshold 70)
  },
  '10am-premium': {
    minProfessionalScore: Number(process.env['V2_GATE_10AM_PREMIUM']) || 58,
    // minTier stays 'A' — already reachable under V2
  },
  'steam-hunter': {
    minProfessionalScore: Number(process.env['V2_GATE_STEAM_HUNTER']) || 55,
    // minTier stays 'A' — already reachable under V2
  },
};

export interface PromotionGate {
  gateId: string;
  name: string;
  type: 'instant' | 'scheduled' | 'manual';
  requirements: GateRequirements;
  enabled: boolean;
  priority: number;
}

export interface GateRequirements {
  // S-tier Requirements
  minTier: 'S' | 'A' | 'B' | 'C';
  minConfidence: number;
  minProfessionalScore: number;

  // EV/CLV Requirements
  minExpectedValue: number;
  minCLVThreshold: number;
  maxNegativeCLV: number;

  // Steam Detection
  requiresSteam: boolean;
  minSteamStrength: number;
  maxReverseSteam: number;

  // Risk Management
  maxCorrelation: number;
  maxPortfolioExposure: number;
  maxSingleGameExposure: number;

  // Timing Requirements
  minTimeBeforeGame: number; // minutes
  maxTimeBeforeGame: number; // minutes
}

export interface PromotionDecisionFactors {
  top_factors: Array<{ factor: string; value: number; threshold: number; passed: boolean }>;
  triggered_rules: Array<{ gate: string; passed: boolean; reason: string }>;
  edge_at_decision: {
    ev: number;
    clv_bps: number | null;
    confidence: number;
    professional_score: number;
  };
  trace_id: string;
}

export interface PromotionDecision {
  approved: boolean;
  lane: 'instant' | '10am' | 'hold' | 'reject';
  gateResults: GateResult[];
  reasoning: string;
  decisionFactors: PromotionDecisionFactors;
  scheduledTime?: Date;
  riskScore: number;
  confidence: number;
  estimatedImpact: number;
}

export interface GateResult {
  gateId: string;
  gateName: string;
  passed: boolean;
  score: number;
  threshold: number;
  impact: 'blocking' | 'warning' | 'informational';
  message: string;
}

export interface PickForPromotion {
  id: string;
  propId: string;
  tier: string;
  confidence: number;
  professionalScore: number;
  expectedValue: number;
  clvTracking?: {
    initialOdds: number;
    currentOdds: number;
    clvBps: number;
  };
  steamData?: {
    strength: number;
    direction: 'for' | 'against';
    volume: number;
  };
  gameTime: Date;
  sport: string;
  correlatedPicks: string[];
  portfolioExposure: number;
}

class PromotionGatekeeper {
  private static instance: PromotionGatekeeper;
  private logger: Logger;
  private gates: Map<string, PromotionGate> = new Map();

  // Default gate configurations
  private readonly DEFAULT_GATES: PromotionGate[] = [
    {
      gateId: 'instant-s-tier',
      name: 'Instant S-Tier Gate',
      type: 'instant',
      priority: 1,
      enabled: true,
      requirements: {
        minTier: 'S',
        minConfidence: 0.75,
        minProfessionalScore: 85,
        minExpectedValue: 0.05, // 5% minimum EV
        minCLVThreshold: 10, // 10 BPS minimum CLV
        maxNegativeCLV: -5, // Allow small negative CLV
        requiresSteam: false,
        minSteamStrength: 0,
        maxReverseSteam: -20,
        maxCorrelation: 0.7,
        maxPortfolioExposure: 0.25, // 25% max portfolio exposure
        maxSingleGameExposure: 0.15, // 15% max single game
        minTimeBeforeGame: 30, // 30 min minimum
        maxTimeBeforeGame: 1440, // 24 hours maximum
      },
    },
    {
      gateId: '10am-premium',
      name: '10am Premium Release',
      type: 'scheduled',
      priority: 2,
      enabled: true,
      requirements: {
        minTier: 'A',
        minConfidence: 0.65,
        minProfessionalScore: 75,
        minExpectedValue: 0.03, // 3% minimum EV
        minCLVThreshold: 5, // 5 BPS minimum CLV
        maxNegativeCLV: -10,
        requiresSteam: false,
        minSteamStrength: 0,
        maxReverseSteam: -30,
        maxCorrelation: 0.8,
        maxPortfolioExposure: 0.35,
        maxSingleGameExposure: 0.2,
        minTimeBeforeGame: 60, // 1 hour minimum
        maxTimeBeforeGame: 2160, // 36 hours maximum
      },
    },
    {
      gateId: 'steam-hunter',
      name: 'Steam Detection Gate',
      type: 'instant',
      priority: 3,
      enabled: true,
      requirements: {
        minTier: 'A',
        minConfidence: 0.6,
        minProfessionalScore: 70,
        minExpectedValue: 0.02,
        minCLVThreshold: 15, // Higher CLV for steam plays
        maxNegativeCLV: 0, // No negative CLV for steam
        requiresSteam: true,
        minSteamStrength: 25, // Strong steam required
        maxReverseSteam: -10,
        maxCorrelation: 0.6,
        maxPortfolioExposure: 0.2,
        maxSingleGameExposure: 0.1,
        minTimeBeforeGame: 15, // Quick steam plays
        maxTimeBeforeGame: 360, // 6 hours max
      },
    },
  ];

  private constructor() {
    this.logger = new Logger('PromotionGatekeeper');
    this.initializeGates();
  }

  public static getInstance(): PromotionGatekeeper {
    if (!PromotionGatekeeper.instance) {
      PromotionGatekeeper.instance = new PromotionGatekeeper();
    }
    return PromotionGatekeeper.instance;
  }

  /**
   * Initialize default gates
   */
  private initializeGates(): void {
    this.DEFAULT_GATES.forEach(gate => {
      this.gates.set(gate.gateId, gate);
    });

    this.logger.info('Promotion gates initialized', {
      gateCount: this.gates.size,
      gates: Array.from(this.gates.keys()),
    });
  }

  /**
   * Main promotion decision engine
   */
  public async evaluatePromotion(pick: PickForPromotion): Promise<PromotionDecision> {
    const startTime = Date.now();

    this.logger.info('Evaluating pick for promotion', {
      pickId: pick.id,
      tier: pick.tier,
      confidence: pick.confidence,
      ev: pick.expectedValue,
    });

    // Run all applicable gates
    const gateResults: GateResult[] = [];
    let highestPriorityPassed: PromotionGate | null = null;
    let totalRiskScore = 0;
    let blockerCount = 0;

    // Sort gates by priority
    const sortedGates = Array.from(this.gates.values())
      .filter(gate => gate.enabled)
      .sort((a, b) => a.priority - b.priority || a.gateId.localeCompare(b.gateId));

    for (const gate of sortedGates) {
      const result = await this.evaluateGate(pick, gate);
      gateResults.push(result);

      if (result.impact === 'blocking' && !result.passed) {
        blockerCount++;
      }

      totalRiskScore += this.calculateRiskContribution(result);

      if (result.passed && !highestPriorityPassed) {
        highestPriorityPassed = gate;
      }
    }

    // Make promotion decision
    const decision = this.makePromotionDecision(pick, gateResults, {
      highestPriorityGate: highestPriorityPassed,
      riskScore: totalRiskScore,
      blockerCount,
    });

    // Log decision
    const processingTime = Date.now() - startTime;
    this.logger.info('Promotion decision made', {
      pickId: pick.id,
      decision: decision.lane,
      approved: decision.approved,
      riskScore: decision.riskScore,
      confidence: decision.confidence,
      processingTimeMs: processingTime,
      gatesPassed: gateResults.filter(r => r.passed).length,
      blockers: blockerCount,
    });

    // Store decision for audit trail
    await this.storePromotionDecision(pick, decision);

    // PROMOTION_SHADOW_MODE: skip publish guard entirely (decisions still stored above)
    const promotionShadow = process.env['PROMOTION_SHADOW_MODE'] !== 'false';
    if (promotionShadow) {
      this.logger.info('Promotion shadow mode — skipping PublishGuard (decision stored)', {
        pickId: pick.id,
      });
      return decision;
    }

    // Handle promotion decision through publish guard (shadow mode aware)
    const publishResult = await publishGuard.handlePromotionDecision(
      {
        approved: decision.approved,
        lane:
          decision.lane === '10am'
            ? 'scheduled'
            : decision.lane === 'instant'
              ? 'instant'
              : 'rejected',
        reasons: this.extractReasons(gateResults),
        pick: pick,
        gateResults,
        riskScore: decision.riskScore,
      },
      {
        tier: pick.tier,
        isInstant: decision.lane === 'instant',
        groupKey: this.generateGroupKey(pick),
      }
    );

    this.logger.info('Promotion handled by publish guard', {
      pickId: pick.id,
      published: publishResult.published,
      shadowLogged: publishResult.shadowLogged,
      channels: publishResult.channelsNotified,
    });

    return decision;
  }

  /**
   * Evaluate single gate against pick
   */
  private async evaluateGate(pick: PickForPromotion, gate: PromotionGate): Promise<GateResult> {
    const req = gate.requirements;
    const results: Array<{
      test: string;
      passed: boolean;
      score: number;
      threshold: number;
      weight: number;
    }> = [];

    // V2 gate override (Tranche 7): use recalibrated thresholds when V2 active
    const v2Override = useV2Gates() ? V2_GATE_OVERRIDES[gate.gateId] : undefined;

    // Tier check — V2 may relax minTier (e.g. S→A for instant-s-tier)
    const effectiveMinTier = v2Override?.minTier ?? req.minTier;
    const tierScore = this.getTierScore(pick.tier);
    const minTierScore = this.getTierScore(effectiveMinTier);
    results.push({
      test: 'tier',
      passed: tierScore >= minTierScore,
      score: tierScore,
      threshold: minTierScore,
      weight: 20,
    });

    // Confidence check
    results.push({
      test: 'confidence',
      passed: pick.confidence >= req.minConfidence,
      score: pick.confidence,
      threshold: req.minConfidence,
      weight: 15,
    });

    // Professional score check — V2 uses distribution-calibrated thresholds
    const effectiveMinScore = v2Override?.minProfessionalScore ?? req.minProfessionalScore;
    results.push({
      test: 'professional_score',
      passed: pick.professionalScore >= effectiveMinScore,
      score: pick.professionalScore,
      threshold: effectiveMinScore,
      weight: 15,
    });

    // Expected Value check
    results.push({
      test: 'expected_value',
      passed: pick.expectedValue >= req.minExpectedValue,
      score: pick.expectedValue,
      threshold: req.minExpectedValue,
      weight: 20,
    });

    // CLV check
    if (pick.clvTracking) {
      const clvBps = pick.clvTracking.clvBps;
      results.push({
        test: 'clv_threshold',
        passed: clvBps >= req.minCLVThreshold,
        score: clvBps,
        threshold: req.minCLVThreshold,
        weight: 15,
      });

      results.push({
        test: 'max_negative_clv',
        passed: clvBps >= req.maxNegativeCLV,
        score: clvBps,
        threshold: req.maxNegativeCLV,
        weight: 10,
      });
    }

    // Steam check
    if (req.requiresSteam && pick.steamData) {
      const steamScore =
        pick.steamData.direction === 'for' ? pick.steamData.strength : -pick.steamData.strength;
      results.push({
        test: 'steam_strength',
        passed: steamScore >= req.minSteamStrength,
        score: steamScore,
        threshold: req.minSteamStrength,
        weight: 15,
      });
    }

    // Timing check
    const minutesToGame = (pick.gameTime.getTime() - Date.now()) / (1000 * 60);
    results.push({
      test: 'timing_window',
      passed: minutesToGame >= req.minTimeBeforeGame && minutesToGame <= req.maxTimeBeforeGame,
      score: minutesToGame,
      threshold: req.minTimeBeforeGame,
      weight: 10,
    });

    // Portfolio exposure check
    results.push({
      test: 'portfolio_exposure',
      passed: pick.portfolioExposure <= req.maxPortfolioExposure,
      score: 1 - pick.portfolioExposure, // Invert for scoring
      threshold: 1 - req.maxPortfolioExposure,
      weight: 15,
    });

    // Calculate weighted score
    const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
    const weightedScore =
      results.reduce((sum, r) => {
        const normalizedScore = r.passed ? 1 : r.score / r.threshold;
        return sum + normalizedScore * r.weight;
      }, 0) / totalWeight;

    const overallPassed = results.every(r => r.passed);
    const failedTests = results.filter(r => !r.passed);

    return {
      gateId: gate.gateId,
      gateName: gate.name,
      passed: overallPassed,
      score: weightedScore * 100,
      threshold: 100,
      impact: this.getGateImpact(gate, failedTests.length),
      message: this.generateGateMessage(gate, overallPassed, failedTests),
    };
  }

  /**
   * Build structured decision factors for explainability (P-04)
   */
  private buildDecisionFactors(
    pick: PickForPromotion,
    gateResults: GateResult[]
  ): PromotionDecisionFactors {
    // Deterministic trace_id: SHA-256 of promotion:{pick.id}:{pick.propId}
    const traceId = createHash('sha256')
      .update(`promotion:${pick.id}:${pick.propId}`)
      .digest('hex');

    // Top factors: extract the most impactful gate sub-results
    const topFactors = gateResults.map(r => ({
      factor: r.gateName,
      value: r.score,
      threshold: r.threshold,
      passed: r.passed,
    }));

    // Triggered rules: one entry per gate
    const triggeredRules: Array<{ gate: string; passed: boolean; reason: string }> =
      gateResults.map(r => ({
        gate: r.gateId,
        passed: r.passed,
        reason: r.message,
      }));

    // Stage 5 — Guardrail rules appended to triggered_rules for audit
    const minEdgePct = Number(process.env['PROMO_GUARD_MIN_EDGE_PCT']) || 1;
    const evPct = pick.expectedValue * 100;
    const edgePassed = evPct >= minEdgePct;
    triggeredRules.push({
      gate: 'G-06:min_edge',
      passed: edgePassed,
      reason: edgePassed
        ? `EV ${evPct.toFixed(1)}% meets minimum ${minEdgePct}%`
        : `EV ${evPct.toFixed(1)}% below guardrail minimum ${minEdgePct}%`,
    });

    // Edge snapshot at decision time
    const edgeAtDecision = {
      ev: pick.expectedValue,
      clv_bps: pick.clvTracking?.clvBps ?? null,
      confidence: pick.confidence,
      professional_score: pick.professionalScore,
    };

    return {
      top_factors: topFactors,
      triggered_rules: triggeredRules,
      edge_at_decision: edgeAtDecision,
      trace_id: traceId,
    };
  }

  /** Make final promotion decision */
  private makePromotionDecision(
    pick: PickForPromotion,
    gateResults: GateResult[],
    ctx: { highestPriorityGate: PromotionGate | null; riskScore: number; blockerCount: number }
  ): PromotionDecision {
    const decisionFactors = this.buildDecisionFactors(pick, gateResults);
    const { highestPriorityGate, riskScore, blockerCount } = ctx;

    if (blockerCount > 0) {
      return {
        approved: false,
        lane: 'reject',
        gateResults,
        decisionFactors,
        riskScore,
        confidence: 0,
        estimatedImpact: 0,
        reasoning: `Failed ${blockerCount} blocking gate(s). Pick does not meet minimum requirements.`,
      };
    }
    if (!highestPriorityGate) {
      return {
        approved: false,
        lane: 'hold',
        gateResults,
        decisionFactors,
        riskScore,
        confidence: 0.2,
        estimatedImpact: 0,
        reasoning: 'Pick did not pass any promotion gates. Holding for review.',
      };
    }

    let lane: 'instant' | '10am' | 'hold' | 'reject' = 'hold';
    let scheduledTime: Date | undefined;
    if (highestPriorityGate.type === 'instant') {
      lane = 'instant';
    } else if (highestPriorityGate.type === 'scheduled') {
      lane = '10am';
      scheduledTime = this.getNext10amSlot();
    }

    const avgGateScore = gateResults.reduce((sum, r) => sum + r.score, 0) / gateResults.length;
    const confidence = Math.min(0.95, avgGateScore / 100);
    const estimatedImpact = this.calculateEstimatedImpact(pick, confidence);

    return {
      approved: true,
      lane,
      gateResults,
      decisionFactors,
      scheduledTime,
      riskScore,
      confidence,
      estimatedImpact,
      reasoning: this.generateDecisionReasoning(highestPriorityGate, gateResults),
    };
  }

  /**
   * Get tier numeric professional_score
   */
  private getTierScore(tier: string): number {
    switch (tier.toUpperCase()) {
      case 'S':
        return 4;
      case 'A':
        return 3;
      case 'B':
        return 2;
      case 'C':
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Determine gate impact level
   */
  private getGateImpact(
    gate: PromotionGate,
    failedTestCount: number
  ): 'blocking' | 'warning' | 'informational' {
    if (gate.gateId === 'instant-s-tier' || gate.gateId === 'steam-hunter') {
      return failedTestCount > 2 ? 'blocking' : 'warning';
    }
    return failedTestCount > 3 ? 'blocking' : 'warning';
  }

  /**
   * Generate human-readable gate message
   */
  private generateGateMessage(gate: PromotionGate, passed: boolean, failedTests: any[]): string {
    if (passed) {
      return `✅ ${gate.name}: All requirements met`;
    }

    const failedTestNames = failedTests.map(t => t.test).join(', ');
    return `❌ ${gate.name}: Failed ${failedTests.length} requirement(s): ${failedTestNames}`;
  }

  /**
   * Calculate risk contribution from gate result
   */
  private calculateRiskContribution(result: GateResult): number {
    const baseRisk = result.passed ? 0 : 10;
    const impactMultiplier =
      result.impact === 'blocking' ? 2 : result.impact === 'warning' ? 1 : 0.5;
    return baseRisk * impactMultiplier * (1 - result.score / 100);
  }

  /**
   * Get next 10am scheduled slot
   */
  private getNext10amSlot(): Date {
    const now = new Date();
    const next10am = new Date(now);
    next10am.setHours(10, 0, 0, 0);

    // If past 10am today, schedule for tomorrow
    if (now.getHours() >= 10) {
      next10am.setDate(next10am.getDate() + 1);
    }

    return next10am;
  }

  /**
   * Calculate estimated impact
   */
  private calculateEstimatedImpact(pick: PickForPromotion, confidence: number): number {
    const baseImpact = pick.expectedValue * 1000; // Convert to basis points
    const confidenceMultiplier = confidence;
    const tierMultiplier = this.getTierScore(pick.tier) / 4;

    return baseImpact * confidenceMultiplier * tierMultiplier;
  }

  /**
   * Generate decision reasoning
   */
  private generateDecisionReasoning(gate: PromotionGate, gateResults: GateResult[]): string {
    const passedGates = gateResults.filter(r => r.passed).length;
    const totalGates = gateResults.length;

    return `Approved via ${gate.name}. Passed ${passedGates}/${totalGates} gates with ${gate.type === 'instant' ? 'immediate' : '10am scheduled'} release.`;
  }

  /**
   * Store promotion decision for audit trail (P-03: idempotent — checks for existing record)
   */
  private async storePromotionDecision(
    pick: PickForPromotion,
    decision: PromotionDecision
  ): Promise<void> {
    try {
      // P-03: Check for existing decision to prevent duplicates
      const { data: existing } = await supabaseClient
        .from('promotion_decisions')
        .select('id')
        .eq('trace_id', decision.decisionFactors.trace_id)
        .limit(1);

      if (existing && existing.length > 0) {
        this.logger.info(
          { pickId: pick.id, traceId: decision.decisionFactors.trace_id },
          'Promotion decision already stored — skipping (idempotent)'
        );
        return;
      }

      await supabaseClient.from('promotion_decisions').insert({
        pick_id: pick.id,
        prop_id: pick.propId,
        decision: decision.lane,
        approved: decision.approved,
        gate_results: decision.gateResults,
        reasoning: decision.reasoning,
        decision_factors: decision.decisionFactors,
        trace_id: decision.decisionFactors.trace_id,
        risk_score: decision.riskScore,
        confidence: decision.confidence,
        estimated_impact: decision.estimatedImpact,
        scheduled_time: decision.scheduledTime,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to store promotion decision', { error, pickId: pick.id });
    }
  }

  /**
   * Get gate configuration
   */
  public getGate(gateId: string): PromotionGate | undefined {
    return this.gates.get(gateId);
  }

  /**
   * Update gate configuration
   */
  public updateGate(gateId: string, updates: Partial<PromotionGate>): boolean {
    const gate = this.gates.get(gateId);
    if (!gate) return false;

    const updatedGate = { ...gate, ...updates };
    this.gates.set(gateId, updatedGate);

    this.logger.info('Gate configuration updated', { gateId, updates });
    return true;
  }

  /**
   * Get all gate configurations
   */
  public getAllGates(): PromotionGate[] {
    return Array.from(this.gates.values());
  }

  /**
   * Get promotion statistics
   */
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  public async getPromotionStats(_timeframe: 'day' | 'week' | 'month' = 'day'): Promise<{
    totalEvaluated: number;
    approved: number;
    rejected: number;
    instant: number;
    scheduled: number;
    avgRiskScore: number;
    avgConfidence: number;
    topGates: Array<{ gateId: string; passRate: number }>;
  }> {
    // Implementation would query promotion_decisions table
    // Placeholder for now
    return {
      totalEvaluated: 0,
      approved: 0,
      rejected: 0,
      instant: 0,
      scheduled: 0,
      avgRiskScore: 0,
      avgConfidence: 0,
      topGates: [],
    };
  }

  /**
   * Extract rejection reasons from gate results for shadow logging
   */
  private extractReasons(gateResults: GateResult[]): string[] {
    const reasons: string[] = [];

    gateResults.forEach(result => {
      if (!result.passed && result.impact === 'blocking') {
        reasons.push(`${result.gateName}: ${result.message}`);
      }
    });

    // If no blocking reasons, add general professional_score info
    if (reasons.length === 0) {
      const failedResults = gateResults.filter(r => !r.passed);
      if (failedResults.length > 0) {
        reasons.push(`Failed ${failedResults.length} gates`);
      }
    }

    return reasons.slice(0, 5); // Limit to 5 reasons
  }

  /**
   * Generate group key for pick batching
   */
  private generateGroupKey(pick: PickForPromotion): string {
    const gameDate = pick.gameTime.toISOString().split('T')[0];
    const sportKey = pick.sport.toLowerCase();
    return `${sportKey}_${gameDate}`;
  }
}

export const promotionGatekeeper = PromotionGatekeeper.getInstance();
