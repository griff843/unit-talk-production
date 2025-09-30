/**
 * S-Tier Enforcement Service
 * Enforces strict S-tier thresholds with EV/CLV/Steam validation gates
 */

import type { Logger } from '../utils/logger';
import { createLogger } from '../utils/logger';
import { supabaseClient } from './supabaseClient';
import { requireSupabase } from '../utils/supabaseUtils';

export interface STierRequirements {
  // Core S-tier Requirements
  minExpectedValue: number;          // 5% minimum EV for S-tier
  minCLVThreshold: number;           // 15+ BPS positive CLV required
  maxNegativeCLVAllowed: number;     // -3 BPS max negative CLV tolerance
  minConfidenceScore: number;        // 75% minimum confidence
  minProfessionalScore: number;      // 85+ professional grading professional_score
  
  // Steam Requirements
  requiresPositiveSteam: boolean;    // Must have positive steam movement
  minSteamStrength: number;          // 20+ BPS steam strength
  maxCounterSteam: number;           // -10 BPS max counter-steam tolerance
  
  // Risk Thresholds
  maxDrawdownRisk: number;           // 15% max potential drawdown
  minKellyFraction: number;          // 0.05 min Kelly sizing
  maxKellyFraction: number;          // 0.25 max Kelly sizing
  
  // Market Validation
  minMarketDepth: number;            // $10K minimum market depth
  maxMarketImpact: number;           // 5% max market impact from bet size
  requiresSharpMoney: boolean;       // Must have sharp money confirmation
}

export interface STierValidation {
  pickId: string;
  tier: string;
  passed: boolean;
  enforced: boolean;
  violations: STierViolation[];
  adjustedTier?: string;
  reasoning: string;
  riskAssessment: RiskAssessment;
  marketValidation: MarketValidation;
  steamAnalysis: SteamAnalysis;
}

export interface STierViolation {
  rule: string;
  severity: 'critical' | 'major' | 'minor';
  value: number;
  threshold: number;
  message: string;
  autoCorrect: boolean;
}

export interface RiskAssessment {
  expectedDrawdown: number;
  kellyFraction: number;
  portfolioImpact: number;
  correlationRisk: number;
  liquidityRisk: number;
  overallRisk: 'low' | 'medium' | 'high' | 'extreme';
}

export interface MarketValidation {
  depth: number;
  impact: number;
  efficiency: number;
  sharpMoneyPresent: boolean;
  institutionalFlow: number;
  retailPercentage: number;
  qualityScore: number;
}

export interface SteamAnalysis {
  strength: number;
  direction: 'for' | 'against' | 'neutral';
  volume: number;
  timeframe: string;
  sustainability: number;
  qualityScore: number;
}

class STierEnforcer {
  private static instance: STierEnforcer;
  private logger: Logger;
  
  // S-tier requirements (production-grade thresholds)
  private readonly REQUIREMENTS: STierRequirements = {
    minExpectedValue: 0.05,           // 5% minimum EV
    minCLVThreshold: 15,              // 15+ BPS positive CLV
    maxNegativeCLVAllowed: -3,        // -3 BPS max negative
    minConfidenceScore: 0.75,         // 75% confidence
    minProfessionalScore: 85,         // 85+ professional professional_score
    
    requiresPositiveSteam: true,      // Must have steam
    minSteamStrength: 20,             // 20+ BPS steam
    maxCounterSteam: -10,             // -10 BPS max counter
    
    maxDrawdownRisk: 0.15,            // 15% max drawdown
    minKellyFraction: 0.05,           // 5% min Kelly
    maxKellyFraction: 0.25,           // 25% max Kelly
    
    minMarketDepth: 10000,            // $10K depth
    maxMarketImpact: 0.05,            // 5% max impact
    requiresSharpMoney: true          // Sharp money required
  };

  private constructor() {
    this.logger = createLogger('STierEnforcer');
  }

  public static getInstance(): STierEnforcer {
    if (!STierEnforcer.instance) {
      STierEnforcer.instance = new STierEnforcer();
    }
    return STierEnforcer.instance;
  }

  /**
   * Main S-tier validation and enforcement
   */
  public async enforceSTierStandards(pick: any): Promise<STierValidation> {
    this.logger.info('Enforcing S-tier standards', {
      pickId: pick.id,
      currentTier: pick.tier,
      professionalScore: pick.professional_score
    });

    const violations: STierViolation[] = [];
    
    // Core threshold validations
    await this.validateCoreThresholds(pick, violations);
    
    // EV/CLV validation
    await this.validateEVCLV(pick, violations);
    
    // Steam validation
    const steamAnalysis = await this.validateSteam(pick, violations);
    
    // Risk assessment
    const riskAssessment = await this.assessRisk(pick, violations);
    
    // Market validation
    const marketValidation = await this.validateMarket(pick, violations);
    
    // Determine enforcement action
    const enforcement = this.determineEnforcement(pick, violations);
    
    const validation: STierValidation = {
      pickId: pick.id,
      tier: pick.tier,
      passed: violations.filter(v => v.severity === 'critical').length === 0,
      enforced: enforcement.enforced,
      violations,
      adjustedTier: enforcement.adjustedTier,
      reasoning: enforcement.reasoning,
      riskAssessment,
      marketValidation,
      steamAnalysis
    };

    // Store validation result
    await this.storeValidation(validation);
    
    // Take enforcement action if needed
    if (enforcement.enforced && enforcement.adjustedTier && enforcement.adjustedTier !== pick.tier) {
      await this.applyTierAdjustment(pick, enforcement.adjustedTier, enforcement.reasoning);
    }

    this.logger.info('S-tier enforcement completed', {
      pickId: pick.id,
      passed: validation.passed,
      enforced: validation.enforced,
      violations: violations.length,
      adjustedTier: validation.adjustedTier
    });

    return validation;
  }

  /**
   * Validate core S-tier thresholds
   */
  private async validateCoreThresholds(pick: any, violations: STierViolation[]): Promise<void> {
    const req = this.REQUIREMENTS;
    
    // Expected Value check
    if (pick.expected_value < req.minExpectedValue) {
      violations.push({
        rule: 'min_expected_value',
        severity: 'critical',
        value: pick.expected_value,
        threshold: req.minExpectedValue,
        message: `EV ${(pick.expected_value * 100).toFixed(1)}% below ${(req.minExpectedValue * 100)}% S-tier minimum`,
        autoCorrect: false
      });
    }
    
    // Confidence professional_score check
    if (pick.confidence < req.minConfidenceScore) {
      violations.push({
        rule: 'min_confidence',
        severity: 'critical',
        value: pick.confidence,
        threshold: req.minConfidenceScore,
        message: `Confidence ${(pick.confidence * 100).toFixed(1)}% below ${(req.minConfidenceScore * 100)}% S-tier minimum`,
        autoCorrect: false
      });
    }
    
    // Professional professional_score check
    if (pick.professional_score < req.minProfessionalScore) {
      violations.push({
        rule: 'min_professional_score',
        severity: 'critical',
        value: pick.professional_score,
        threshold: req.minProfessionalScore,
        message: `Professional professional_score ${pick.professional_score} below ${req.minProfessionalScore} S-tier minimum`,
        autoCorrect: false
      });
    }
  }

  /**
   * Validate EV and CLV requirements
   */
  private async validateEVCLV(pick: any, violations: STierViolation[]): Promise<void> {
    const req = this.REQUIREMENTS;
    
    // CLV tracking validation
    if (pick.clv_tracking) {
      const clvBps = pick.clv_tracking.current_clv_bps || 0;
      
      // Positive CLV requirement
      if (clvBps < req.minCLVThreshold) {
        violations.push({
          rule: 'min_clv_threshold',
          severity: 'critical',
          value: clvBps,
          threshold: req.minCLVThreshold,
          message: `CLV ${clvBps} BPS below ${req.minCLVThreshold} BPS S-tier minimum`,
          autoCorrect: false
        });
      }
      
      // Negative CLV tolerance
      if (clvBps < req.maxNegativeCLVAllowed) {
        violations.push({
          rule: 'max_negative_clv',
          severity: 'critical',
          value: clvBps,
          threshold: req.maxNegativeCLVAllowed,
          message: `CLV ${clvBps} BPS exceeds ${req.maxNegativeCLVAllowed} BPS negative tolerance`,
          autoCorrect: false
        });
      }
    } else {
      // Missing CLV tracking is critical for S-tier
      violations.push({
        rule: 'missing_clv_tracking',
        severity: 'critical',
        value: 0,
        threshold: 1,
        message: 'S-tier picks must have active CLV tracking',
        autoCorrect: true
      });
    }
  }

  /**
   * Validate steam requirements
   */
  private async validateSteam(pick: any, violations: STierViolation[]): Promise<SteamAnalysis> {
    const req = this.REQUIREMENTS;
    const steamData = await this.getSteamData(pick.prop_id);
    
    if (req.requiresPositiveSteam) {
      if (!steamData || steamData.strength < req.minSteamStrength) {
        violations.push({
          rule: 'min_steam_strength',
          severity: 'major',
          value: steamData?.strength || 0,
          threshold: req.minSteamStrength,
          message: `Steam strength ${steamData?.strength || 0} BPS below ${req.minSteamStrength} BPS requirement`,
          autoCorrect: false
        });
      }
      
      if (steamData && steamData.direction === 'against' && steamData.strength > Math.abs(req.maxCounterSteam)) {
        violations.push({
          rule: 'max_counter_steam',
          severity: 'major',
          value: -steamData.strength,
          threshold: req.maxCounterSteam,
          message: `Counter-steam ${steamData.strength} BPS exceeds ${Math.abs(req.maxCounterSteam)} BPS tolerance`,
          autoCorrect: false
        });
      }
    }
    
    return steamData || {
      strength: 0,
      direction: 'neutral',
      volume: 0,
      timeframe: '1h',
      sustainability: 0,
      qualityScore: 0
    };
  }

  /**
   * Assess risk factors
   */
  private async assessRisk(pick: any, violations: STierViolation[]): Promise<RiskAssessment> {
    const req = this.REQUIREMENTS;
    
    // Kelly fraction validation
    const kellyFraction = pick.kelly_fraction || this.calculateKellyFraction(pick);
    
    if (kellyFraction < req.minKellyFraction) {
      violations.push({
        rule: 'min_kelly_fraction',
        severity: 'major',
        value: kellyFraction,
        threshold: req.minKellyFraction,
        message: `Kelly fraction ${(kellyFraction * 100).toFixed(1)}% below ${(req.minKellyFraction * 100)}% minimum`,
        autoCorrect: true
      });
    }
    
    if (kellyFraction > req.maxKellyFraction) {
      violations.push({
        rule: 'max_kelly_fraction',
        severity: 'major',
        value: kellyFraction,
        threshold: req.maxKellyFraction,
        message: `Kelly fraction ${(kellyFraction * 100).toFixed(1)}% exceeds ${(req.maxKellyFraction * 100)}% maximum`,
        autoCorrect: true
      });
    }
    
    // Calculate expected drawdown
    const expectedDrawdown = this.calculateExpectedDrawdown(pick);
    
    if (expectedDrawdown > req.maxDrawdownRisk) {
      violations.push({
        rule: 'max_drawdown_risk',
        severity: 'major',
        value: expectedDrawdown,
        threshold: req.maxDrawdownRisk,
        message: `Expected drawdown ${(expectedDrawdown * 100).toFixed(1)}% exceeds ${(req.maxDrawdownRisk * 100)}% limit`,
        autoCorrect: false
      });
    }
    
    return {
      expectedDrawdown,
      kellyFraction,
      portfolioImpact: this.calculatePortfolioImpact(pick),
      correlationRisk: this.calculateCorrelationRisk(pick),
      liquidityRisk: this.calculateLiquidityRisk(pick),
      overallRisk: this.classifyOverallRisk(expectedDrawdown, kellyFraction)
    };
  }

  /**
   * Validate market conditions
   */
  private async validateMarket(pick: any, violations: STierViolation[]): Promise<MarketValidation> {
    const req = this.REQUIREMENTS;
    const marketData = await this.getMarketData(pick.prop_id);
    
    if (marketData.depth < req.minMarketDepth) {
      violations.push({
        rule: 'min_market_depth',
        severity: 'minor',
        value: marketData.depth,
        threshold: req.minMarketDepth,
        message: `Market depth $${marketData.depth.toLocaleString()} below $${req.minMarketDepth.toLocaleString()} minimum`,
        autoCorrect: false
      });
    }
    
    if (marketData.impact > req.maxMarketImpact) {
      violations.push({
        rule: 'max_market_impact',
        severity: 'major',
        value: marketData.impact,
        threshold: req.maxMarketImpact,
        message: `Market impact ${(marketData.impact * 100).toFixed(1)}% exceeds ${(req.maxMarketImpact * 100)}% maximum`,
        autoCorrect: false
      });
    }
    
    if (req.requiresSharpMoney && !marketData.sharpMoneyPresent) {
      violations.push({
        rule: 'requires_sharp_money',
        severity: 'minor',
        value: marketData.institutionalFlow,
        threshold: 0.5,
        message: 'S-tier picks require sharp money confirmation',
        autoCorrect: false
      });
    }
    
    return marketData;
  }

  /**
   * Determine enforcement action
   */
  private determineEnforcement(pick: any, violations: STierViolation[]): {
    enforced: boolean;
    adjustedTier?: string;
    reasoning: string;
  } {
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    const majorViolations = violations.filter(v => v.severity === 'major');
    
    if (pick.tier !== 'S') {
      return {
        enforced: false,
        reasoning: 'Pick is not S-tier, no enforcement needed'
      };
    }
    
    // Critical violations = immediate downgrade
    if (criticalViolations.length > 0) {
      return {
        enforced: true,
        adjustedTier: 'A',
        reasoning: `Downgraded from S to A: ${criticalViolations.length} critical violation(s) - ${criticalViolations.map(v => v.rule).join(', ')}`
      };
    }
    
    // Multiple major violations = downgrade
    if (majorViolations.length >= 3) {
      return {
        enforced: true,
        adjustedTier: 'A',
        reasoning: `Downgraded from S to A: ${majorViolations.length} major violations exceed threshold`
      };
    }
    
    return {
      enforced: false,
      reasoning: `S-tier standards maintained: ${violations.length} minor violations within tolerance`
    };
  }

  /**
   * Apply tier adjustment
   */
  private async applyTierAdjustment(pick: any, newTier: string, reasoning: string): Promise<void> {
    try {
      if (!supabaseClient) {
        throw new Error('Supabase client not initialized');
      }

      const supabaseClient = requireSupabase();
    await supabaseClient
        .from('unified_picks')
        .update({
          tier: newTier,
          tier_adjustment_reason: reasoning,
          tier_adjusted_at: new Date().toISOString(),
          adjusted_by: 'STierEnforcer'
        })
        .eq('id', pick.id);
        
      this.logger.info('Tier adjustment applied', {
        pickId: pick.id,
        oldTier: pick.tier,
        newTier,
        reasoning
      });
    } catch (error) {
      this.logger.error('Failed to apply tier adjustment', { error, pickId: pick.id });
    }
  }

  /**
   * Store validation result
   */
  private async storeValidation(validation: STierValidation): Promise<void> {
    try {
      if (!supabaseClient) {
        throw new Error('Supabase client not initialized');
      }

      const supabaseClient = requireSupabase();
    await supabaseClient
        .from('stier_validations')
        .insert({
          pick_id: validation.pickId,
          tier: validation.tier,
          passed: validation.passed,
          enforced: validation.enforced,
          violations: validation.violations,
          adjusted_tier: validation.adjustedTier,
          reasoning: validation.reasoning,
          risk_assessment: validation.riskAssessment,
          market_validation: validation.marketValidation,
          steam_analysis: validation.steamAnalysis,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      this.logger.error('Failed to store S-tier validation', { error, pickId: validation.pickId });
    }
  }

  /**
   * Helper methods for calculations
   */
  private calculateKellyFraction(pick: any): number {
    if (!pick.expected_value || !pick.confidence) return 0;
    
    const edge = pick.expected_value;
    const odds = pick.odds || -110;
    const impliedProbability = Math.abs(odds) / (Math.abs(odds) + 100);
    
    // Kelly = (edge * confidence) / variance
    return Math.max(0, (edge * pick.confidence) / (impliedProbability * (1 - impliedProbability)));
  }

  private calculateExpectedDrawdown(pick: any): number {
    const volatility = pick.variance || 0.2;
    const kellyFraction = pick.kelly_fraction || this.calculateKellyFraction(pick);
    
    // Simplified drawdown calculation
    return volatility * kellyFraction * 2.5;
  }

  private calculatePortfolioImpact(_pick: any): number {
    // Placeholder - would calculate based on portfolio size and bet size
    return 0.1;
  }

  private calculateCorrelationRisk(_pick: any): number {
    // Placeholder - would analyze correlations with other positions
    return 0.05;
  }

  private calculateLiquidityRisk(_pick: any): number {
    // Placeholder - would assess liquidity conditions
    return 0.02;
  }

  private classifyOverallRisk(drawdown: number, kellyFraction: number): 'low' | 'medium' | 'high' | 'extreme' {
    if (drawdown > 0.25 || kellyFraction > 0.3) return 'extreme';
    if (drawdown > 0.15 || kellyFraction > 0.25) return 'high';
    if (drawdown > 0.1 || kellyFraction > 0.15) return 'medium';
    return 'low';
  }

  private async getSteamData(propId: string): Promise<SteamAnalysis | null> {
    try {
      if (!supabaseClient) {
        throw new Error('Supabase client not initialized');
      }

      const supabaseClient = requireSupabase();
      const { data } = await supabaseClient
        .from('steam_tracking')
        .select('*')
        .eq('prop_id', propId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (!data) return null;
      
      return {
        strength: data.strength || 0,
        direction: data.direction || 'neutral',
        volume: data.volume || 0,
        timeframe: data.timeframe || '1h',
        sustainability: data.sustainability || 0,
        qualityScore: data.quality_score || 0
      };
    } catch (error) {
      this.logger.error('Failed to get steam data', { error, propId });
      return null;
    }
  }

  private async getMarketData(propId: string): Promise<MarketValidation> {
    try {
      if (!supabaseClient) {
        throw new Error('Supabase client not initialized');
      }

      const supabaseClient = requireSupabase();
      const { data } = await supabaseClient
        .from('market_data')
        .select('*')
        .eq('prop_id', propId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      return {
        depth: data?.depth || 5000,
        impact: data?.impact || 0.03,
        efficiency: data?.efficiency || 0.85,
        sharpMoneyPresent: data?.sharp_money_present || false,
        institutionalFlow: data?.institutional_flow || 0.3,
        retailPercentage: data?.retail_percentage || 0.7,
        qualityScore: data?.quality_score || 0.75
      };
    } catch (error) {
      this.logger.error('Failed to get market data', { error, propId });
      return {
        depth: 5000,
        impact: 0.03,
        efficiency: 0.85,
        sharpMoneyPresent: false,
        institutionalFlow: 0.3,
        retailPercentage: 0.7,
        qualityScore: 0.75
      };
    }
  }

  /**
   * Get S-tier enforcement statistics
   */
  public async getEnforcementStats(_timeframe: 'day' | 'week' | 'month' = 'day'): Promise<{
    totalValidations: number;
    stierPicks: number;
    downgrades: number;
    violationTypes: Record<string, number>;
    avgConfidence: number;
    avgEV: number;
    avgCLV: number;
  }> {
    // Implementation would query stier_validations table
    return {
      totalValidations: 0,
      stierPicks: 0,
      downgrades: 0,
      violationTypes: {},
      avgConfidence: 0,
      avgEV: 0,
      avgCLV: 0
    };
  }
}

export const sTierEnforcer = STierEnforcer.getInstance();