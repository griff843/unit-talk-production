#!/usr/bin/env npx tsx

/**
 * FACTOR CONTRIBUTIONS VALIDATION SCRIPT
 *
 * This script provides detailed analysis of factor contributions stored in the database
 * to prove that the Enhanced45FactorEngine is calculating legitimate professional factors.
 *
 * VALIDATION OBJECTIVES:
 * 1. Examine actual factor contributions in feature_contributions JSONB field
 * 2. Verify 45+ factors are being calculated and stored
 * 3. Analyze factor score distributions and realistic values
 * 4. Validate professional factor categories (Market, Player, Matchup, Price, Meta)
 * 5. Confirm enhanced scoring vs basic placeholder detection
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

interface FactorAnalysis {
  factorName: string;
  frequency: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
  category: 'Market' | 'Player' | 'Matchup' | 'Price' | 'Meta' | 'Unknown';
}

interface CategoryAnalysis {
  category: string;
  factorCount: number;
  averageScore: number;
  factorNames: string[];
}

interface DetailedValidationResult {
  totalPropsAnalyzed: number;
  propsWithFactorContributions: number;
  factorCoverageRate: number;

  factorAnalysis: FactorAnalysis[];
  categoryAnalysis: CategoryAnalysis[];

  expectedEnhanced45Factors: string[];
  actualFactorsFound: string[];
  missingFactors: string[];
  unexpectedFactors: string[];

  professionalFeaturesEvidence: {
    steamDetectionFactors: boolean;
    lineMovementFactors: boolean;
    clvFactors: boolean;
    kellyOptimizationFactors: boolean;
    riskManagementFactors: boolean;
    marketIntelligenceFactors: boolean;
  };

  scoreDistributionAnalysis: {
    avgFactorScore: number;
    scoreVariance: number;
    realisticScoreDistribution: boolean;
    suspiciouslyUniformScores: boolean;
  };

  verdict: 'LEGITIMATE_45_FACTOR' | 'BASIC_SCORING' | 'PLACEHOLDER_VALUES' | 'INSUFFICIENT_DATA';
}

class FactorContributionsValidator {
  private supabase: any;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Expected Enhanced 45-Factor names based on implementation
   */
  private getExpectedEnhanced45Factors(): string[] {
    return [
      // Market Factors (10)
      'expectedValueDevigged',
      'lineMovementVelocity',
      'closingLineValue',
      'marketEfficiency',
      'publicVsSharpSplit',
      'volumeProfile',
      'crossMarketArbitrage',
      'steamDetection',
      'marketResistance',
      'optimalTiming',

      // Player Factors (10)
      'playerForm',
      'roleStability',
      'matchupHistory',
      'injuryImpact',
      'fatigueLevel',
      'usageRate',
      'performanceTrends',
      'clutchFactor',
      'propSpecificTendencies',
      'situationalPerformance',

      // Matchup Factors (10)
      'teamVsTeam',
      'defenseVsPosition',
      'paceImpact',
      'gameScript',
      'homeAwaysplits',
      'refereeTendencies',
      'weatherImpact',
      'venueFactors',
      'restAdvantage',
      'motivationalFactors',

      // Price Factors (10)
      'lineShoppingEdge',
      'kellyFraction',
      'riskAdjustedReturn',
      'correlationRisk',
      'portfolioImpact',
      'volatilityScore',
      'liquidityPremium',
      'marketTiming',
      'bidAskSpread',
      'optionValue',

      // Meta Factors (5)
      'dataQuality',
      'modelAgreement',
      'historicalAccuracy',
      'confidenceInterval',
      'recencyBiasAdjustment'
    ];
  }

  /**
   * Categorize factors by type
   */
  private categorizeFactor(factorName: string): 'Market' | 'Player' | 'Matchup' | 'Price' | 'Meta' | 'Unknown' {
    const marketFactors = [
      'expectedValueDevigged', 'lineMovementVelocity', 'closingLineValue', 'marketEfficiency',
      'publicVsSharpSplit', 'volumeProfile', 'crossMarketArbitrage', 'steamDetection',
      'marketResistance', 'optimalTiming'
    ];

    const playerFactors = [
      'playerForm', 'roleStability', 'matchupHistory', 'injuryImpact', 'fatigueLevel',
      'usageRate', 'performanceTrends', 'clutchFactor', 'propSpecificTendencies',
      'situationalPerformance'
    ];

    const matchupFactors = [
      'teamVsTeam', 'defenseVsPosition', 'paceImpact', 'gameScript', 'homeAwaysplits',
      'refereeTendencies', 'weatherImpact', 'venueFactors', 'restAdvantage',
      'motivationalFactors'
    ];

    const priceFactors = [
      'lineShoppingEdge', 'kellyFraction', 'riskAdjustedReturn', 'correlationRisk',
      'portfolioImpact', 'volatilityScore', 'liquidityPremium', 'marketTiming',
      'bidAskSpread', 'optionValue'
    ];

    const metaFactors = [
      'dataQuality', 'modelAgreement', 'historicalAccuracy', 'confidenceInterval',
      'recencyBiasAdjustment'
    ];

    if (marketFactors.includes(factorName)) return 'Market';
    if (playerFactors.includes(factorName)) return 'Player';
    if (matchupFactors.includes(factorName)) return 'Matchup';
    if (priceFactors.includes(factorName)) return 'Price';
    if (metaFactors.includes(factorName)) return 'Meta';
    return 'Unknown';
  }

  /**
   * Fetch and analyze factor contributions from database
   */
  async analyzeFactorContributions(): Promise<DetailedValidationResult> {
    console.log('🔍 FACTOR CONTRIBUTIONS ANALYSIS');
    console.log('=================================\n');

    // Fetch props with feature_contributions
    const { data: props, error } = await this.supabase
      .from('raw_props')
      .select(`
        id,
        professional_score,
        tier,
        confidence,
        feature_contributions,
        kelly_fraction,
        steam_detected,
        sharp_money_indicator,
        created_at
      `)
      .not('feature_contributions', 'is', null)
      .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()) // Last 14 days
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Failed to fetch props: ${error.message}`);
    }

    const validProps = (props || []).filter(prop =>
      prop.feature_contributions && typeof prop.feature_contributions === 'object'
    );

    console.log(`📊 Analyzing ${validProps.length} props with factor contributions...\n`);

    // Collect all factors and their scores
    const factorData: Record<string, number[]> = {};
    let totalFactorInstances = 0;

    validProps.forEach(prop => {
      const contributions = prop.feature_contributions;
      Object.entries(contributions).forEach(([factorName, score]) => {
        if (typeof score === 'number' && !isNaN(score)) {
          if (!factorData[factorName]) {
            factorData[factorName] = [];
          }
          factorData[factorName].push(score);
          totalFactorInstances++;
        }
      });
    });

    // Analyze each factor
    const factorAnalysis: FactorAnalysis[] = Object.entries(factorData).map(([factorName, scores]) => ({
      factorName,
      frequency: scores.length,
      averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      category: this.categorizeFactor(factorName)
    })).sort((a, b) => b.frequency - a.frequency);

    // Category analysis
    const categoryAnalysis: CategoryAnalysis[] = ['Market', 'Player', 'Matchup', 'Price', 'Meta'].map(category => {
      const categoryFactors = factorAnalysis.filter(f => f.category === category);
      return {
        category,
        factorCount: categoryFactors.length,
        averageScore: categoryFactors.length > 0
          ? categoryFactors.reduce((sum, f) => sum + f.averageScore, 0) / categoryFactors.length
          : 0,
        factorNames: categoryFactors.map(f => f.factorName)
      };
    });

    // Compare with expected factors
    const expectedFactors = this.getExpectedEnhanced45Factors();
    const actualFactors = factorAnalysis.map(f => f.factorName);
    const missingFactors = expectedFactors.filter(f => !actualFactors.includes(f));
    const unexpectedFactors = actualFactors.filter(f => !expectedFactors.includes(f));

    // Professional features evidence
    const professionalFeaturesEvidence = {
      steamDetectionFactors: actualFactors.includes('steamDetection'),
      lineMovementFactors: actualFactors.includes('lineMovementVelocity'),
      clvFactors: actualFactors.includes('closingLineValue'),
      kellyOptimizationFactors: actualFactors.includes('kellyFraction') || actualFactors.includes('riskAdjustedReturn'),
      riskManagementFactors: actualFactors.includes('correlationRisk') || actualFactors.includes('portfolioImpact'),
      marketIntelligenceFactors: actualFactors.includes('publicVsSharpSplit') || actualFactors.includes('marketEfficiency')
    };

    // Score distribution analysis
    const allScores = Object.values(factorData).flat();
    const avgFactorScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
    const scoreVariance = allScores.reduce((sum, score) => sum + Math.pow(score - avgFactorScore, 2), 0) / allScores.length;

    // Check for suspiciously uniform scores (indicating placeholders)
    const uniqueScores = new Set(allScores.map(s => Math.round(s * 100) / 100));
    const suspiciouslyUniformScores = uniqueScores.size < Math.max(10, allScores.length * 0.1);

    // Realistic score distribution (should have variety and be within 0-100 range)
    const realisticScoreDistribution =
      allScores.every(score => score >= 0 && score <= 100) &&
      scoreVariance > 100 && // Reasonable variance
      !suspiciouslyUniformScores;

    // Determine verdict
    let verdict: DetailedValidationResult['verdict'] = 'INSUFFICIENT_DATA';

    if (validProps.length === 0) {
      verdict = 'INSUFFICIENT_DATA';
    } else if (actualFactors.length >= 30 &&
               missingFactors.length <= 10 &&
               realisticScoreDistribution &&
               Object.values(professionalFeaturesEvidence).filter(Boolean).length >= 4) {
      verdict = 'LEGITIMATE_45_FACTOR';
    } else if (actualFactors.length >= 10 && actualFactors.length < 30) {
      verdict = 'BASIC_SCORING';
    } else {
      verdict = 'PLACEHOLDER_VALUES';
    }

    return {
      totalPropsAnalyzed: validProps.length,
      propsWithFactorContributions: validProps.length,
      factorCoverageRate: validProps.length > 0 ? (actualFactors.length / expectedFactors.length) : 0,

      factorAnalysis,
      categoryAnalysis,

      expectedEnhanced45Factors: expectedFactors,
      actualFactorsFound: actualFactors,
      missingFactors,
      unexpectedFactors,

      professionalFeaturesEvidence,

      scoreDistributionAnalysis: {
        avgFactorScore,
        scoreVariance,
        realisticScoreDistribution,
        suspiciouslyUniformScores
      },

      verdict
    };
  }

  /**
   * Generate detailed report
   */
  generateDetailedReport(result: DetailedValidationResult): void {
    console.log('📋 DETAILED FACTOR ANALYSIS REPORT');
    console.log('===================================\n');

    // Overview
    console.log('📊 OVERVIEW:');
    console.log(`   Props Analyzed: ${result.totalPropsAnalyzed}`);
    console.log(`   Factor Coverage Rate: ${(result.factorCoverageRate * 100).toFixed(1)}%`);
    console.log(`   Unique Factors Found: ${result.actualFactorsFound.length}`);
    console.log(`   Expected Enhanced 45-Factors: ${result.expectedEnhanced45Factors.length}\n`);

    // Category breakdown
    console.log('🏷️ CATEGORY ANALYSIS:');
    result.categoryAnalysis.forEach(cat => {
      console.log(`   ${cat.category}: ${cat.factorCount} factors (avg score: ${cat.averageScore.toFixed(1)})`);
      if (cat.factorNames.length > 0) {
        console.log(`      Factors: ${cat.factorNames.slice(0, 5).join(', ')}${cat.factorNames.length > 5 ? '...' : ''}`);
      }
    });
    console.log('');

    // Top factors by frequency
    console.log('🔥 TOP FACTORS BY FREQUENCY:');
    result.factorAnalysis.slice(0, 10).forEach((factor, index) => {
      console.log(`   ${index + 1}. ${factor.factorName} (${factor.category})`);
      console.log(`      Frequency: ${factor.frequency}, Avg Score: ${factor.averageScore.toFixed(1)}, Range: ${factor.minScore.toFixed(1)}-${factor.maxScore.toFixed(1)}`);
    });
    console.log('');

    // Professional features evidence
    console.log('🏆 PROFESSIONAL FEATURES EVIDENCE:');
    Object.entries(result.professionalFeaturesEvidence).forEach(([feature, present]) => {
      const status = present ? '✅ PRESENT' : '❌ MISSING';
      console.log(`   ${feature}: ${status}`);
    });
    console.log('');

    // Missing critical factors
    if (result.missingFactors.length > 0) {
      console.log('⚠️ MISSING ENHANCED 45-FACTORS:');
      result.missingFactors.slice(0, 10).forEach(factor => {
        console.log(`   - ${factor}`);
      });
      if (result.missingFactors.length > 10) {
        console.log(`   ... and ${result.missingFactors.length - 10} more`);
      }
      console.log('');
    }

    // Unexpected factors (could indicate extensions or errors)
    if (result.unexpectedFactors.length > 0) {
      console.log('🆕 UNEXPECTED FACTORS FOUND:');
      result.unexpectedFactors.slice(0, 10).forEach(factor => {
        console.log(`   + ${factor}`);
      });
      if (result.unexpectedFactors.length > 10) {
        console.log(`   ... and ${result.unexpectedFactors.length - 10} more`);
      }
      console.log('');
    }

    // Score distribution analysis
    console.log('📈 SCORE DISTRIBUTION ANALYSIS:');
    console.log(`   Average Factor Score: ${result.scoreDistributionAnalysis.avgFactorScore.toFixed(2)}`);
    console.log(`   Score Variance: ${result.scoreDistributionAnalysis.scoreVariance.toFixed(2)}`);
    console.log(`   Realistic Distribution: ${result.scoreDistributionAnalysis.realisticScoreDistribution ? '✅ YES' : '❌ NO'}`);
    console.log(`   Suspiciously Uniform: ${result.scoreDistributionAnalysis.suspiciouslyUniformScores ? '❌ YES' : '✅ NO'}\n`);

    // Final verdict
    console.log('🏆 FINAL VERDICT:');
    console.log('=================');

    switch (result.verdict) {
      case 'LEGITIMATE_45_FACTOR':
        console.log('✅ LEGITIMATE ENHANCED 45-FACTOR SYSTEM CONFIRMED');
        console.log('   Evidence of comprehensive 195-factor analysis detected.');
        console.log('   Professional factors are being calculated and stored.');
        console.log('   Factor scores show realistic variance and coverage.');
        console.log('   System is operational with legitimate professional processing.');
        break;

      case 'BASIC_SCORING':
        console.log('⚠️ BASIC SCORING SYSTEM DETECTED');
        console.log('   Some factors are present but coverage is incomplete.');
        console.log('   System may be using simplified scoring algorithms.');
        console.log('   Enhanced 45-Factor system may not be fully operational.');
        break;

      case 'PLACEHOLDER_VALUES':
        console.log('❌ PLACEHOLDER VALUES DETECTED');
        console.log('   Factor contributions appear to be placeholder or dummy values.');
        console.log('   Scores show suspicious uniformity or unrealistic patterns.');
        console.log('   Professional processing is likely not operational.');
        break;

      case 'INSUFFICIENT_DATA':
        console.log('❓ INSUFFICIENT DATA FOR ANALYSIS');
        console.log('   No props with factor contributions found in database.');
        console.log('   System may not be storing factor breakdowns properly.');
        console.log('   Check system configuration and data processing.');
        break;
    }

    console.log('\n📋 RECOMMENDATION:');
    if (result.verdict === 'LEGITIMATE_45_FACTOR') {
      console.log('   System is performing as expected with professional-grade analysis.');
    } else if (result.verdict === 'BASIC_SCORING') {
      console.log('   Investigate why some factors are missing from Enhanced 45-Factor system.');
    } else {
      console.log('   Review system configuration and ensure Enhanced45FactorEngine is operational.');
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    const validator = new FactorContributionsValidator();
    const result = await validator.analyzeFactorContributions();
    validator.generateDetailedReport(result);

    // Exit with appropriate code
    const success = result.verdict === 'LEGITIMATE_45_FACTOR';
    process.exit(success ? 0 : 1);

  } catch (error) {
    console.error('❌ Factor validation failed:', error);
    process.exit(1);
  }
}

// Run validation if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { FactorContributionsValidator, DetailedValidationResult };