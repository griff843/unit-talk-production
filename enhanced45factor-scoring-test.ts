#!/usr/bin/env tsx

/**
 * ENHANCED45FACTOR SCORING SYSTEM VALIDATION
 *
 * Specifically tests the 195-factor Enhanced45Factor scoring system to identify:
 * 1. "professional_score is not defined" errors
 * 2. Database schema inconsistencies
 * 3. Scoring pipeline breaks
 *
 * Usage: npx tsx enhanced45factor-scoring-test.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

interface ScoringTestResult {
  testName: string;
  success: boolean;
  data: any;
  errors: string[];
  recommendations: string[];
}

class Enhanced45FactorScoringValidator {
  private supabase: any;
  private results: ScoringTestResult[] = [];

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'test-key';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async runScoringValidation(): Promise<void> {
    console.log('🏆 ENHANCED45FACTOR SCORING SYSTEM VALIDATION');
    console.log('==============================================');
    console.log('Testing 195-factor Enhanced45Factor scoring pipeline');
    console.log(`Start Time: ${new Date().toISOString()}`);
    console.log('==============================================\n');

    await this.validateDatabaseSchema();
    await this.validateScoringData();
    await this.validateEnhanced45FactorFeatures();
    await this.validateScoringErrors();
    await this.validateTierAssignments();
    await this.generateFixRecommendations();
  }

  private async validateDatabaseSchema(): Promise<void> {
    console.log('🗄️ Database Schema Validation');
    console.log('-----------------------------');

    const errors: string[] = [];
    const data: any = {};
    const recommendations: string[] = [];

    try {
      // Test 1: Check sports_game_odds table structure
      const { data: sgoData, error: sgoError } = await this.supabase
        .from('sports_game_odds')
        .select('*')
        .limit(1);

      if (sgoError) {
        errors.push(`sports_game_odds table error: ${sgoError.message}`);

        if (sgoError.message.includes('player_name')) {
          recommendations.push('ALTER TABLE sports_game_odds ADD COLUMN player_name TEXT;');
          recommendations.push('Run database migration to add missing player_name column');
        }
      } else {
        console.log('✅ sports_game_odds table accessible');
        data.sportsGameOddsAccessible = true;

        // Check for required columns
        if (sgoData && sgoData.length > 0) {
          const requiredColumns = ['player_name', 'stat_type', 'odds', 'line'];
          const missingColumns = requiredColumns.filter(col => !(col in sgoData[0]));

          if (missingColumns.length > 0) {
            errors.push(`Missing required columns in sports_game_odds: ${missingColumns.join(', ')}`);
            missingColumns.forEach(col => {
              recommendations.push(`ALTER TABLE sports_game_odds ADD COLUMN ${col} TEXT;`);
            });
          } else {
            console.log('✅ All required columns present in sports_game_odds');
          }
        }
      }

      // Test 2: Check unified_picks table structure
      const { data: upData, error: upError } = await this.supabase
        .from('unified_picks')
        .select('*')
        .limit(1);

      if (upError) {
        errors.push(`unified_picks table error: ${upError.message}`);
      } else {
        console.log('✅ unified_picks table accessible');
        data.unifiedPicksAccessible = true;

        // Check for Enhanced45Factor columns
        if (upData && upData.length > 0) {
          const enhanced45Columns = [
            'professional_score',
            'feature_contributions',
            'kelly_fraction',
            'clv_tracking_id',
            'tier'
          ];

          const missingEnhanced45Columns = enhanced45Columns.filter(col => !(col in upData[0]));

          if (missingEnhanced45Columns.length > 0) {
            errors.push(`Missing Enhanced45Factor columns: ${missingEnhanced45Columns.join(', ')}`);
            missingEnhanced45Columns.forEach(col => {
              if (col === 'professional_score') {
                recommendations.push('ALTER TABLE unified_picks ADD COLUMN professional_score DOUBLE PRECISION;');
              } else if (col === 'feature_contributions') {
                recommendations.push('ALTER TABLE unified_picks ADD COLUMN feature_contributions JSONB;');
              } else if (col === 'kelly_fraction') {
                recommendations.push('ALTER TABLE unified_picks ADD COLUMN kelly_fraction DOUBLE PRECISION;');
              } else if (col === 'clv_tracking_id') {
                recommendations.push('ALTER TABLE unified_picks ADD COLUMN clv_tracking_id UUID;');
              } else if (col === 'tier') {
                recommendations.push('ALTER TABLE unified_picks ADD COLUMN tier TEXT CHECK (tier IN (\'S\', \'A\', \'B\', \'C\', \'D\'));');
              }
            });
          } else {
            console.log('✅ All Enhanced45Factor columns present in unified_picks');
          }
        }
      }

      this.recordResult('Database Schema', errors.length === 0, data, errors, recommendations);

    } catch (error) {
      this.recordResult('Database Schema', false, {}, [`Critical error: ${(error as Error).message}`], ['Verify database connection and permissions']);
    }
  }

  private async validateScoringData(): Promise<void> {
    console.log('\n🎯 Scoring Data Validation');
    console.log('---------------------------');

    const errors: string[] = [];
    const data: any = {};
    const recommendations: string[] = [];

    try {
      // Test 1: Check for unscored props
      const { data: unscoredProps, error: unscoredError } = await this.supabase
        .from('unified_picks')
        .select('*')
        .is('professional_score', null)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(100);

      if (unscoredError) {
        errors.push(`Failed to fetch unscored props: ${unscoredError.message}`);
      } else {
        data.unscoredPropsCount = unscoredProps?.length || 0;
        console.log(`📊 Unscored props in last 24h: ${data.unscoredPropsCount}`);

        if (data.unscoredPropsCount > 50) {
          errors.push('High number of unscored props - ScoringAgent may not be processing');
          recommendations.push('Restart ScoringAgent service');
          recommendations.push('Check ScoringAgent logs for "professional_score is not defined" errors');
        }
      }

      // Test 2: Check for props with professional_score but no features
      const { data: incompleteScoredProps, error: incompleteError } = await this.supabase
        .from('unified_picks')
        .select('*')
        .not('professional_score', 'is', null)
        .is('feature_contributions', null)
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(50);

      if (!incompleteError && incompleteScoredProps) {
        data.incompleteScoredCount = incompleteScoredProps.length;
        console.log(`⚠️ Props with score but no features: ${data.incompleteScoredCount}`);

        if (data.incompleteScoredCount > 0) {
          errors.push('Props scored without Enhanced45Factor features - incomplete scoring pipeline');
          recommendations.push('Enable USE_ENHANCED_45_FACTOR=true environment variable');
          recommendations.push('Verify Enhanced45FactorEngine initialization');
        }
      }

      // Test 3: Check for valid professional scores
      const { data: scoredProps, error: scoredError } = await this.supabase
        .from('unified_picks')
        .select('*')
        .not('professional_score', 'is', null)
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(100);

      if (!scoredError && scoredProps) {
        data.scoredPropsCount = scoredProps.length;

        const invalidScores = scoredProps.filter((prop: any) =>
          prop.professional_score <= 0 || prop.professional_score > 100 || isNaN(prop.professional_score)
        );

        data.invalidScoresCount = invalidScores.length;
        console.log(`📈 Valid scored props: ${data.scoredPropsCount - data.invalidScoresCount}/${data.scoredPropsCount}`);

        if (data.invalidScoresCount > 0) {
          errors.push(`${data.invalidScoresCount} props have invalid professional_score values`);
          recommendations.push('Check ScoringAgent scoring calculation logic');
          recommendations.push('Validate convertScoreToImpliedProb function');
        }

        // Calculate average score
        const validScores = scoredProps
          .filter((prop: any) => prop.professional_score > 0 && prop.professional_score <= 100)
          .map((prop: any) => prop.professional_score);

        if (validScores.length > 0) {
          data.averageScore = validScores.reduce((sum: number, score: number) => sum + score, 0) / validScores.length;
          console.log(`📊 Average professional score: ${data.averageScore.toFixed(1)}`);

          if (data.averageScore < 30 || data.averageScore > 80) {
            errors.push('Average professional score outside expected range (30-80)');
            recommendations.push('Review Enhanced45Factor scoring algorithm calibration');
          }
        }
      }

      this.recordResult('Scoring Data', errors.length === 0, data, errors, recommendations);

    } catch (error) {
      this.recordResult('Scoring Data', false, {}, [`Critical error: ${(error as Error).message}`], ['Check database connectivity and scoring service']);
    }
  }

  private async validateEnhanced45FactorFeatures(): Promise<void> {
    console.log('\n🏆 Enhanced45Factor Features Validation');
    console.log('----------------------------------------');

    const errors: string[] = [];
    const data: any = {};
    const recommendations: string[] = [];

    try {
      // Test 1: Check for Enhanced45Factor feature contributions
      const { data: featuredProps, error: featuredError } = await this.supabase
        .from('unified_picks')
        .select('feature_contributions')
        .not('feature_contributions', 'is', null)
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(50);

      if (featuredError) {
        errors.push(`Failed to fetch feature contributions: ${featuredError.message}`);
      } else {
        data.featuredPropsCount = featuredProps?.length || 0;
        console.log(`🎯 Props with feature contributions: ${data.featuredPropsCount}`);

        if (data.featuredPropsCount === 0) {
          errors.push('No props have Enhanced45Factor feature contributions');
          recommendations.push('Verify Enhanced45FactorEngine is enabled and functioning');
          recommendations.push('Check if USE_ENHANCED_45_FACTOR environment variable is set to true');
        } else {
          // Analyze feature contributions structure
          const validFeatures = featuredProps.filter((prop: any) => {
            try {
              const features = typeof prop.feature_contributions === 'string' ?
                JSON.parse(prop.feature_contributions) : prop.feature_contributions;

              // Check for Enhanced45Factor specific features
              return features &&
                ('playerForm' in features || 'factorScores' in features) &&
                ('optimalTiming' in features || 'categoryBreakdown' in features);
            } catch {
              return false;
            }
          });

          data.validEnhanced45FactorCount = validFeatures.length;
          data.enhanced45FactorRate = (validFeatures.length / featuredProps.length) * 100;

          console.log(`🏆 Valid Enhanced45Factor features: ${data.validEnhanced45FactorCount}/${data.featuredPropsCount} (${data.enhanced45FactorRate.toFixed(1)}%)`);

          if (data.enhanced45FactorRate < 70) {
            errors.push('Low Enhanced45Factor feature rate - system may not be using 195-factor scoring');
            recommendations.push('Verify Enhanced45FactorEngine implementation');
            recommendations.push('Check scoring system is using Enhanced45Factor path, not legacy path');
          }
        }
      }

      // Test 2: Check for CLV tracking
      const { data: clvProps, error: clvError } = await this.supabase
        .from('unified_picks')
        .select('clv_tracking_id')
        .not('clv_tracking_id', 'is', null)
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(50);

      if (!clvError && clvProps) {
        data.clvTrackingCount = clvProps.length;
        console.log(`📈 Props with CLV tracking: ${data.clvTrackingCount}`);

        if (data.clvTrackingCount === 0) {
          errors.push('No props have CLV tracking IDs - professional grading rule violation');
          recommendations.push('Ensure CLV tracking is enabled in scoring pipeline');
          recommendations.push('Verify randomUUID() is being called for clvTrackingId');
        }
      }

      // Test 3: Check Kelly fraction calculations
      const { data: kellyProps, error: kellyError } = await this.supabase
        .from('unified_picks')
        .select('kelly_fraction')
        .not('kelly_fraction', 'is', null)
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(50);

      if (!kellyError && kellyProps) {
        data.kellyFractionCount = kellyProps.length;

        const validKellyFractions = kellyProps.filter((prop: any) =>
          prop.kelly_fraction >= 0.001 && prop.kelly_fraction <= 0.25
        );

        data.validKellyCount = validKellyFractions.length;
        console.log(`💰 Valid Kelly fractions: ${data.validKellyCount}/${data.kellyFractionCount}`);

        if (data.validKellyCount < data.kellyFractionCount * 0.8) {
          errors.push('Many props have invalid Kelly fraction values');
          recommendations.push('Review Kelly fraction calculation in Enhanced45Factor system');
          recommendations.push('Ensure Kelly fractions are bounded between 0.001 and 0.25');
        }
      }

      this.recordResult('Enhanced45Factor Features', errors.length === 0, data, errors, recommendations);

    } catch (error) {
      this.recordResult('Enhanced45Factor Features', false, {}, [`Critical error: ${(error as Error).message}`], ['Verify Enhanced45Factor system configuration']);
    }
  }

  private async validateScoringErrors(): Promise<void> {
    console.log('\n🚨 Scoring Errors Validation');
    console.log('-----------------------------');

    const errors: string[] = [];
    const data: any = {};
    const recommendations: string[] = [];

    try {
      // Test 1: Look for props that failed scoring (created but never scored)
      const { data: createdProps, error: createdError } = await this.supabase
        .from('unified_picks')
        .select('*')
        .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()) // Last 6 hours
        .limit(100);

      if (!createdError && createdProps) {
        const unscoredAfter1Hour = createdProps.filter((prop: any) => {
          const createdTime = new Date(prop.created_at).getTime();
          const oneHourAgo = Date.now() - (60 * 60 * 1000);
          return createdTime < oneHourAgo && (!prop.professional_score || prop.professional_score <= 0);
        });

        data.unscoredAfter1HourCount = unscoredAfter1Hour.length;
        console.log(`⏰ Props unscored after 1+ hour: ${data.unscoredAfter1HourCount}`);

        if (data.unscoredAfter1HourCount > 5) {
          errors.push('High number of props remain unscored after 1 hour - scoring pipeline failure');
          recommendations.push('Check ScoringAgent error logs for "professional_score is not defined" errors');
          recommendations.push('Restart ScoringAgent service');
          recommendations.push('Verify Enhanced45FactorEngine initialization');
        }
      }

      // Test 2: Check for props with scoring attempts but errors
      const { data: errorProps, error: errorPropsError } = await this.supabase
        .from('unified_picks')
        .select('*')
        .not('scored_at', 'is', null) // Has attempted scoring
        .is('professional_score', null) // But no score
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(20);

      if (!errorPropsError && errorProps) {
        data.scoringErrorCount = errorProps.length;
        console.log(`❌ Props with scoring errors: ${data.scoringErrorCount}`);

        if (data.scoringErrorCount > 0) {
          errors.push('Props attempted scoring but failed - check for scoring system errors');
          recommendations.push('Review ScoringAgent logs for error details');
          recommendations.push('Check Enhanced45FactorEngine.calculate45FactorScore() method');
          recommendations.push('Verify convertUnifiedPickToFeatureSet() function');
        }
      }

      // Test 3: Check for recent scoring activity
      const { data: recentScored, error: recentError } = await this.supabase
        .from('unified_picks')
        .select('*')
        .not('scored_at', 'is', null)
        .gte('scored_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .limit(10);

      if (!recentError) {
        data.recentScoringActivity = recentScored?.length || 0;
        console.log(`⚡ Recent scoring activity (last hour): ${data.recentScoringActivity}`);

        if (data.recentScoringActivity === 0) {
          errors.push('No scoring activity in last hour - ScoringAgent may be down');
          recommendations.push('Check if ScoringAgent service is running');
          recommendations.push('Verify ScoringAgent health endpoint');
          recommendations.push('Check for process crashes or memory issues');
        }
      }

      this.recordResult('Scoring Errors', errors.length === 0, data, errors, recommendations);

    } catch (error) {
      this.recordResult('Scoring Errors', false, {}, [`Critical error: ${(error as Error).message}`], ['Check scoring system status and logs']);
    }
  }

  private async validateTierAssignments(): Promise<void> {
    console.log('\n🏅 Tier Assignment Validation');
    console.log('------------------------------');

    const errors: string[] = [];
    const data: any = {};
    const recommendations: string[] = [];

    try {
      // Test 1: Check tier distribution
      const { data: tieredProps, error: tierError } = await this.supabase
        .from('unified_picks')
        .select('tier, professional_score')
        .not('tier', 'is', null)
        .not('professional_score', 'is', null)
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(200);

      if (tierError) {
        errors.push(`Failed to fetch tiered props: ${tierError.message}`);
      } else if (tieredProps && tieredProps.length > 0) {
        const tierDistribution = tieredProps.reduce((acc: any, prop: any) => {
          acc[prop.tier] = (acc[prop.tier] || 0) + 1;
          return acc;
        }, {});

        data.tierDistribution = tierDistribution;
        data.totalTiered = tieredProps.length;

        console.log('📊 Tier distribution:', tierDistribution);

        // Check for reasonable tier distribution
        const sTierCount = tierDistribution.S || 0;
        const aTierCount = tierDistribution.A || 0;
        const topTierPercent = ((sTierCount + aTierCount) / tieredProps.length) * 100;

        data.topTierPercent = topTierPercent;
        console.log(`🏆 S+A tier percentage: ${topTierPercent.toFixed(1)}%`);

        if (topTierPercent > 50) {
          errors.push('Too many S/A tier props - tier assignment may be too generous');
          recommendations.push('Review Enhanced45Factor tier thresholds');
          recommendations.push('Calibrate scoring system to be more selective');
        } else if (topTierPercent < 5) {
          errors.push('Too few S/A tier props - tier assignment may be too strict');
          recommendations.push('Review Enhanced45Factor scoring algorithm');
          recommendations.push('Check if score-to-tier mapping is correct');
        }

        // Check score-tier consistency
        const tierScoreRanges = {
          S: { min: 85, max: 100 },
          A: { min: 70, max: 84 },
          B: { min: 55, max: 69 },
          C: { min: 40, max: 54 },
          D: { min: 0, max: 39 }
        };

        let inconsistentCount = 0;
        tieredProps.forEach((prop: any) => {
          const range = tierScoreRanges[prop.tier as keyof typeof tierScoreRanges];
          if (range && (prop.professional_score < range.min || prop.professional_score > range.max)) {
            inconsistentCount++;
          }
        });

        data.inconsistentTierCount = inconsistentCount;
        if (inconsistentCount > 0) {
          errors.push(`${inconsistentCount} props have inconsistent tier-score mappings`);
          recommendations.push('Review tier assignment logic in Enhanced45Factor system');
          recommendations.push('Ensure score ranges align with tier definitions');
        }
      } else {
        errors.push('No tiered props found in last 24 hours');
        recommendations.push('Check if tier assignment is working in scoring pipeline');
      }

      // Test 2: Check for props with scores but no tiers
      const { data: untieredProps, error: untieredError } = await this.supabase
        .from('unified_picks')
        .select('*')
        .not('professional_score', 'is', null)
        .is('tier', null)
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(50);

      if (!untieredError && untieredProps) {
        data.untieredButScoredCount = untieredProps.length;
        console.log(`⚠️ Scored props without tiers: ${data.untieredButScoredCount}`);

        if (data.untieredButScoredCount > 0) {
          errors.push('Props scored but not assigned tiers - tier assignment logic failing');
          recommendations.push('Check Enhanced45Factor tier assignment in convertEnhanced45ResultToScoringResult()');
          recommendations.push('Verify tier field is being set in scoring result');
        }
      }

      this.recordResult('Tier Assignment', errors.length === 0, data, errors, recommendations);

    } catch (error) {
      this.recordResult('Tier Assignment', false, {}, [`Critical error: ${(error as Error).message}`], ['Check tier assignment system']);
    }
  }

  private async generateFixRecommendations(): Promise<void> {
    console.log('\n💡 Fix Recommendations Generation');
    console.log('----------------------------------');

    const allRecommendations = this.results.flatMap(result => result.recommendations);
    const criticalFixes = [];
    const databaseFixes = [];
    const configFixes = [];
    const serviceFixes = [];

    for (const rec of allRecommendations) {
      if (rec.includes('ALTER TABLE')) {
        databaseFixes.push(rec);
      } else if (rec.includes('environment variable') || rec.includes('USE_ENHANCED_45_FACTOR')) {
        configFixes.push(rec);
      } else if (rec.includes('restart') || rec.includes('service')) {
        serviceFixes.push(rec);
      } else {
        criticalFixes.push(rec);
      }
    }

    console.log('\n🔧 PRIORITIZED FIX RECOMMENDATIONS:');
    console.log('===================================');

    if (databaseFixes.length > 0) {
      console.log('\n1. DATABASE SCHEMA FIXES (HIGHEST PRIORITY):');
      databaseFixes.forEach((fix, i) => console.log(`   ${i + 1}. ${fix}`));
    }

    if (configFixes.length > 0) {
      console.log('\n2. CONFIGURATION FIXES:');
      configFixes.forEach((fix, i) => console.log(`   ${i + 1}. ${fix}`));
    }

    if (serviceFixes.length > 0) {
      console.log('\n3. SERVICE FIXES:');
      serviceFixes.forEach((fix, i) => console.log(`   ${i + 1}. ${fix}`));
    }

    if (criticalFixes.length > 0) {
      console.log('\n4. SYSTEM FIXES:');
      criticalFixes.forEach((fix, i) => console.log(`   ${i + 1}. ${fix}`));
    }

    // Generate automated fix script
    if (databaseFixes.length > 0) {
      console.log('\n📝 AUTOMATED DATABASE FIX SCRIPT:');
      console.log('-- Run these SQL commands to fix schema issues');
      databaseFixes.forEach(fix => {
        if (fix.startsWith('ALTER TABLE')) {
          console.log(fix);
        }
      });
    }
  }

  private recordResult(testName: string, success: boolean, data: any, errors: string[], recommendations: string[]): void {
    const result: ScoringTestResult = {
      testName,
      success,
      data,
      errors,
      recommendations
    };

    this.results.push(result);

    const status = success ? '✅' : '❌';
    console.log(`${status} ${testName}: ${success ? 'PASSED' : 'FAILED'}`);

    if (!success && errors.length > 0) {
      errors.forEach(error => console.log(`   ⚠️ ${error}`));
    }
  }

  generateSummaryReport(): void {
    const successfulTests = this.results.filter(r => r.success).length;
    const totalTests = this.results.length;
    const overallSuccess = successfulTests === totalTests;

    console.log('\n================================================');
    console.log('🏆 ENHANCED45FACTOR SCORING VALIDATION SUMMARY');
    console.log('================================================');
    console.log(`Overall Status: ${overallSuccess ? '✅ HEALTHY' : '❌ ISSUES FOUND'}`);
    console.log(`Success Rate: ${successfulTests}/${totalTests} tests (${((successfulTests/totalTests)*100).toFixed(1)}%)`);

    const criticalIssues = this.results.filter(r => !r.success && r.errors.some(e =>
      e.includes('professional_score is not defined') ||
      e.includes('schema') ||
      e.includes('table error')
    ));

    if (criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES AFFECTING E2E PIPELINE:');
      criticalIssues.forEach(issue => {
        console.log(`   • ${issue.testName}: ${issue.errors.join(', ')}`);
      });
    }

    console.log('\n📊 TEST RESULTS SUMMARY:');
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.testName}`);
    });

    console.log('\n================================================\n');
  }
}

// Execute the validation
async function main() {
  try {
    const validator = new Enhanced45FactorScoringValidator();
    await validator.runScoringValidation();
    validator.generateSummaryReport();

    // Exit with appropriate code
    const allPassed = validator['results'].every((r: any) => r.success);
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('❌ Enhanced45Factor validation failed:', (error as Error).message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { Enhanced45FactorScoringValidator };