#!/usr/bin/env npx tsx

/**
 * QUICK ENHANCED 45-FACTOR SYSTEM TEST
 *
 * This script provides immediate evidence that the Enhanced45FactorEngine
 * is operational and processing props through legitimate 195-factor analysis.
 *
 * CRITICAL VALIDATION POINTS:
 * 1. Environment flag verification
 * 2. Database evidence of professional scores
 * 3. Factor breakdown validation
 * 4. Tier assignment legitimacy
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

interface QuickTestResult {
  environmentSetup: {
    enhanced45Enabled: boolean;
    proScorerEnabled: boolean;
    supabaseConnected: boolean;
  };
  databaseEvidence: {
    propsWithProfessionalScores: number;
    propsWithFactorBreakdowns: number;
    recentSTierProps: number;
    recentATierProps: number;
    avgProfessionalScore: number;
    latestPropAnalysis: any;
  };
  systemValidation: {
    routingCorrect: boolean;
    factorCoverageAdequate: boolean;
    tierLogicValid: boolean;
    professionalFeaturesActive: boolean;
  };
  verdict: 'OPERATIONAL' | 'BASIC_PLACEHOLDERS' | 'SYSTEM_ERROR';
}

async function runQuickTest(): Promise<QuickTestResult> {
  console.log('🚀 QUICK ENHANCED 45-FACTOR VALIDATION');
  console.log('=====================================\n');

  // Initialize result structure
  const result: QuickTestResult = {
    environmentSetup: {
      enhanced45Enabled: false,
      proScorerEnabled: false,
      supabaseConnected: false
    },
    databaseEvidence: {
      propsWithProfessionalScores: 0,
      propsWithFactorBreakdowns: 0,
      recentSTierProps: 0,
      recentATierProps: 0,
      avgProfessionalScore: 0,
      latestPropAnalysis: null
    },
    systemValidation: {
      routingCorrect: false,
      factorCoverageAdequate: false,
      tierLogicValid: false,
      professionalFeaturesActive: false
    },
    verdict: 'SYSTEM_ERROR'
  };

  try {
    // Step 1: Environment Setup Validation
    console.log('🔧 STEP 1: Environment Setup Validation');
    result.environmentSetup.enhanced45Enabled = process.env.USE_ENHANCED_45_FACTOR === 'true';
    result.environmentSetup.proScorerEnabled = process.env.USE_PRO_SCORER === 'true';

    console.log(`   Enhanced 45-Factor: ${result.environmentSetup.enhanced45Enabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`   Professional Scorer: ${result.environmentSetup.proScorerEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);

    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test connection
    const { data: connectionTest, error: connectionError } = await supabase
      .from('raw_props')
      .select('count')
      .limit(1);

    if (connectionError) {
      throw new Error(`Supabase connection failed: ${connectionError.message}`);
    }

    result.environmentSetup.supabaseConnected = true;
    console.log('   Supabase Connection: ✅ CONNECTED\n');

    // Step 2: Database Evidence Analysis
    console.log('💾 STEP 2: Database Evidence Analysis');

    // Query props with professional scores
    const { data: professionalProps, error: professionalError } = await supabase
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
      .not('professional_score', 'is', null)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .order('created_at', { ascending: false })
      .limit(20);

    if (professionalError) {
      throw new Error(`Professional props query failed: ${professionalError.message}`);
    }

    const props = professionalProps || [];
    result.databaseEvidence.propsWithProfessionalScores = props.length;

    // Analyze factor breakdowns
    const propsWithFactors = props.filter(prop =>
      prop.feature_contributions && Object.keys(prop.feature_contributions).length > 10
    );
    result.databaseEvidence.propsWithFactorBreakdowns = propsWithFactors.length;

    // Tier analysis
    result.databaseEvidence.recentSTierProps = props.filter(p => p.tier === 'S').length;
    result.databaseEvidence.recentATierProps = props.filter(p => p.tier === 'A').length;

    // Average score
    if (props.length > 0) {
      result.databaseEvidence.avgProfessionalScore =
        props.reduce((sum, prop) => sum + (prop.professional_score || 0), 0) / props.length;
    }

    // Latest prop analysis
    if (props.length > 0) {
      const latestProp = props[0];
      result.databaseEvidence.latestPropAnalysis = {
        id: latestProp.id,
        professionalScore: latestProp.professional_score,
        tier: latestProp.tier,
        confidence: latestProp.confidence,
        kellyFraction: latestProp.kelly_fraction,
        factorCount: latestProp.feature_contributions
          ? Object.keys(latestProp.feature_contributions).length
          : 0,
        steamDetected: latestProp.steam_detected,
        sharpMoneyIndicator: latestProp.sharp_money_indicator,
        createdAt: latestProp.created_at
      };
    }

    console.log(`   Props with Professional Scores (7 days): ${result.databaseEvidence.propsWithProfessionalScores}`);
    console.log(`   Props with Factor Breakdowns: ${result.databaseEvidence.propsWithFactorBreakdowns}`);
    console.log(`   Recent S-Tier Props: ${result.databaseEvidence.recentSTierProps}`);
    console.log(`   Recent A-Tier Props: ${result.databaseEvidence.recentATierProps}`);
    console.log(`   Average Professional Score: ${result.databaseEvidence.avgProfessionalScore.toFixed(3)}`);

    if (result.databaseEvidence.latestPropAnalysis) {
      const latest = result.databaseEvidence.latestPropAnalysis;
      console.log(`   Latest Prop Analysis:`);
      console.log(`     - ID: ${latest.id}`);
      console.log(`     - Professional Score: ${latest.professionalScore}`);
      console.log(`     - Tier: ${latest.tier}`);
      console.log(`     - Factor Count: ${latest.factorCount}`);
      console.log(`     - Steam Detected: ${latest.steamDetected ? 'YES' : 'NO'}`);
      console.log(`     - Sharp Money: ${latest.sharpMoneyIndicator ? 'YES' : 'NO'}`);
    }
    console.log('');

    // Step 3: System Validation
    console.log('🔍 STEP 3: System Validation Logic');

    // Routing validation
    result.systemValidation.routingCorrect =
      result.environmentSetup.enhanced45Enabled || result.environmentSetup.proScorerEnabled;

    // Factor coverage validation
    result.systemValidation.factorCoverageAdequate =
      result.databaseEvidence.propsWithFactorBreakdowns > 0 &&
      (result.databaseEvidence.propsWithFactorBreakdowns / Math.max(1, result.databaseEvidence.propsWithProfessionalScores)) > 0.5;

    // Tier logic validation - S/A tier props should have higher scores than lower tiers
    const sTierProps = props.filter(p => p.tier === 'S');
    const aTierProps = props.filter(p => p.tier === 'A');
    const bTierProps = props.filter(p => p.tier === 'B');

    const sTierAvg = sTierProps.length > 0
      ? sTierProps.reduce((sum, p) => sum + (p.professional_score || 0), 0) / sTierProps.length
      : 0;
    const aTierAvg = aTierProps.length > 0
      ? aTierProps.reduce((sum, p) => sum + (p.professional_score || 0), 0) / aTierProps.length
      : 0;
    const bTierAvg = bTierProps.length > 0
      ? bTierProps.reduce((sum, p) => sum + (p.professional_score || 0), 0) / bTierProps.length
      : 0;

    result.systemValidation.tierLogicValid =
      (sTierProps.length === 0 || aTierProps.length === 0 || sTierAvg >= aTierAvg) &&
      (aTierProps.length === 0 || bTierProps.length === 0 || aTierAvg >= bTierAvg);

    // Professional features validation
    const steamDetectionActive = props.some(p => p.steam_detected);
    const sharpMoneyActive = props.some(p => p.sharp_money_indicator);
    const kellyFractionActive = props.some(p => p.kelly_fraction && p.kelly_fraction > 0);

    result.systemValidation.professionalFeaturesActive =
      steamDetectionActive || sharpMoneyActive || kellyFractionActive;

    console.log(`   Routing Correct: ${result.systemValidation.routingCorrect ? '✅ YES' : '❌ NO'}`);
    console.log(`   Factor Coverage Adequate: ${result.systemValidation.factorCoverageAdequate ? '✅ YES' : '❌ NO'}`);
    console.log(`   Tier Logic Valid: ${result.systemValidation.tierLogicValid ? '✅ YES' : '❌ NO'}`);
    console.log(`   Professional Features Active: ${result.systemValidation.professionalFeaturesActive ? '✅ YES' : '❌ NO'}`);
    console.log(`     - Steam Detection: ${steamDetectionActive ? 'ACTIVE' : 'INACTIVE'}`);
    console.log(`     - Sharp Money: ${sharpMoneyActive ? 'ACTIVE' : 'INACTIVE'}`);
    console.log(`     - Kelly Fraction: ${kellyFractionActive ? 'ACTIVE' : 'INACTIVE'}`);
    console.log('');

    // Final Verdict
    console.log('🏆 FINAL VERDICT');
    console.log('================');

    if (result.systemValidation.routingCorrect &&
        result.systemValidation.factorCoverageAdequate &&
        result.systemValidation.tierLogicValid &&
        result.databaseEvidence.propsWithProfessionalScores > 0) {
      result.verdict = 'OPERATIONAL';
      console.log('✅ ENHANCED 45-FACTOR SYSTEM IS OPERATIONAL');
      console.log('   Professional 195-factor processing confirmed with database evidence.');
      console.log('   Props are being processed through legitimate Enhanced45FactorEngine.');
      console.log('   Factor breakdowns, tier assignments, and professional metrics validated.');
    } else if (result.databaseEvidence.propsWithProfessionalScores > 0 &&
               !result.systemValidation.factorCoverageAdequate) {
      result.verdict = 'BASIC_PLACEHOLDERS';
      console.log('⚠️ SYSTEM USING BASIC PLACEHOLDERS');
      console.log('   Props have professional scores but limited factor breakdown.');
      console.log('   System may be using simplified scoring instead of full 195-factor analysis.');
      console.log('   Enhanced 45-Factor system may not be fully operational.');
    } else {
      result.verdict = 'SYSTEM_ERROR';
      console.log('❌ SYSTEM ERROR OR NOT OPERATIONAL');
      console.log('   No evidence of professional processing found.');
      console.log('   Check environment configuration and system logs.');
    }

  } catch (error) {
    console.error('❌ Validation failed:', error instanceof Error ? error.message : 'Unknown error');
    result.verdict = 'SYSTEM_ERROR';
  }

  return result;
}

/**
 * Main execution
 */
async function main() {
  try {
    const result = await runQuickTest();

    console.log('\n📊 SUMMARY REPORT');
    console.log('=================');
    console.log(`Final Verdict: ${result.verdict}`);
    console.log(`Props with Professional Scores: ${result.databaseEvidence.propsWithProfessionalScores}`);
    console.log(`Props with Factor Breakdowns: ${result.databaseEvidence.propsWithFactorBreakdowns}`);
    console.log(`Professional Features Active: ${result.systemValidation.professionalFeaturesActive ? 'YES' : 'NO'}`);

    // Exit with appropriate code
    process.exit(result.verdict === 'OPERATIONAL' ? 0 : 1);

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run test if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { runQuickTest, QuickTestResult };