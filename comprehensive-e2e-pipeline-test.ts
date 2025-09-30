#!/usr/bin/env tsx

/**
 * COMPREHENSIVE E2E SYSTEM FLOW VALIDATION
 *
 * Validates the complete Unit Talk platform data pipeline:
 * 1. Data Ingestion (FeedAgent) → 2. Scoring (ScoringAgent) → 3. Approval (Command Center) → 4. Discord Integration
 *
 * This test validates the entire pipeline integrity and identifies any breaks or data inconsistencies.
 *
 * Usage: npx tsx comprehensive-e2e-pipeline-test.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

// Test Results Interface
interface PipelineTestResult {
  stepName: string;
  success: boolean;
  data: any;
  metrics: any;
  errors: string[];
  executionTimeMs: number;
  timestamp: string;
}

interface E2EValidationReport {
  overallSuccess: boolean;
  criticalIssuesFound: string[];
  pipelineHealth: 'healthy' | 'degraded' | 'broken';
  testResults: PipelineTestResult[];
  totalExecutionTimeMs: number;
  recommendations: string[];
}

class ComprehensiveE2EPipelineValidator {
  private supabase: any;
  private results: PipelineTestResult[] = [];
  private criticalIssues: string[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'test-key';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async runCompleteValidation(): Promise<E2EValidationReport> {
    console.log('🔍 UNIT TALK E2E SYSTEM FLOW VALIDATION');
    console.log('================================================');
    console.log('Testing: Data Ingestion → Scoring → Approval → Discord');
    console.log(`Start Time: ${new Date().toISOString()}`);
    console.log('================================================\n');

    // Step 1: Validate Database Schema & Infrastructure
    await this.validateInfrastructure();

    // Step 2: Test FeedAgent Data Ingestion Pipeline
    await this.validateFeedAgentIngestion();

    // Step 3: Validate Enhanced45Factor Scoring System
    await this.validateScoringPipeline();

    // Step 4: Test Command Center Approval Workflow
    await this.validateCommandCenterWorkflow();

    // Step 5: Validate Discord Integration
    await this.validateDiscordIntegration();

    // Step 6: End-to-End Data Flow Verification
    await this.validateCompleteDataFlow();

    return this.generateReport();
  }

  private async validateInfrastructure(): Promise<void> {
    const stepStart = Date.now();
    console.log('🏗️ STEP 1: Infrastructure & Database Schema Validation');
    console.log('-----------------------------------------------------');

    try {
      const errors: string[] = [];
      const data: any = {};

      // Test 1: Database connectivity
      try {
        const { data: pickCount, error } = await this.supabase
          .from('unified_picks')
          .select('count(*)', { count: 'exact' });

        if (error) {
          errors.push(`unified_picks table access failed: ${error.message}`);
          this.criticalIssues.push('unified_picks table schema issue');
        } else {
          data.unifiedPicksCount = pickCount?.count || 0;
          console.log(`✅ unified_picks table: ${data.unifiedPicksCount} records`);
        }
      } catch (error) {
        errors.push(`Database connection failed: ${(error as Error).message}`);
        this.criticalIssues.push('Database connectivity failure');
      }

      // Test 2: Critical table schema validation
      const criticalTables = ['sports_game_odds', 'raw_props', 'users', 'agent_health'];

      for (const table of criticalTables) {
        try {
          const { data: tableData, error } = await this.supabase
            .from(table)
            .select('*')
            .limit(1);

          if (error) {
            errors.push(`Table ${table} schema issue: ${error.message}`);
            if (table === 'sports_game_odds') {
              this.criticalIssues.push('sports_game_odds table missing - critical for FeedAgent');
            }
          } else {
            console.log(`✅ ${table} table accessible`);
            data[`${table}_accessible`] = true;
          }
        } catch (error) {
          errors.push(`Table ${table} access failed: ${(error as Error).message}`);
        }
      }

      // Test 3: Check for schema inconsistencies mentioned in the issue
      try {
        const { data: sgoStructure, error } = await this.supabase
          .rpc('get_table_columns', { table_name: 'sports_game_odds' });

        if (!sgoStructure?.some((col: any) => col.column_name === 'player_name')) {
          errors.push('sports_game_odds.player_name column missing - required for FeedAgent');
          this.criticalIssues.push('FeedAgent will fail due to missing player_name column');
        } else {
          console.log('✅ sports_game_odds.player_name column exists');
        }
      } catch (error) {
        // If RPC doesn't exist, try alternative schema check
        console.log('⚠️ Could not verify sports_game_odds schema structure');
      }

      this.recordResult('Infrastructure Validation', errors.length === 0, data, {}, errors, Date.now() - stepStart);

    } catch (error) {
      this.recordResult('Infrastructure Validation', false, {}, {}, [`Critical error: ${(error as Error).message}`], Date.now() - stepStart);
    }
  }

  private async validateFeedAgentIngestion(): Promise<void> {
    const stepStart = Date.now();
    console.log('\n📡 STEP 2: FeedAgent Data Ingestion Validation');
    console.log('---------------------------------------------');

    try {
      const errors: string[] = [];
      const data: any = {};
      const metrics: any = {};

      // Test 1: Check if FeedAgent has recently ingested data
      const { data: recentProps, error: propsError } = await this.supabase
        .from('sports_game_odds')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('created_at', { ascending: false })
        .limit(100);

      if (propsError) {
        errors.push(`Failed to fetch recent props: ${propsError.message}`);
        this.criticalIssues.push('FeedAgent data ingestion pipeline broken');
      } else {
        data.recentPropsCount = recentProps?.length || 0;
        metrics.propsIngestedLast24h = data.recentPropsCount;

        if (data.recentPropsCount === 0) {
          errors.push('No props ingested in last 24 hours - FeedAgent may not be running');
          this.criticalIssues.push('FeedAgent not ingesting data');
        } else {
          console.log(`✅ FeedAgent ingestion: ${data.recentPropsCount} props in last 24h`);
        }
      }

      // Test 2: Check unified_picks pipeline
      const { data: unifiedPicks, error: unifiedError } = await this.supabase
        .from('unified_picks')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (unifiedError) {
        errors.push(`Failed to fetch unified picks: ${unifiedError.message}`);
      } else {
        data.unifiedPicksCount = unifiedPicks?.length || 0;
        console.log(`📊 Unified picks created: ${data.unifiedPicksCount} in last 24h`);
      }

      // Test 3: Check for data quality issues
      if (recentProps && recentProps.length > 0) {
        const propsWithMissingData = recentProps.filter((prop: any) =>
          !prop.player_name || !prop.stat_type || !prop.odds
        );

        if (propsWithMissingData.length > 0) {
          errors.push(`${propsWithMissingData.length} props missing critical data (player_name, stat_type, or odds)`);
        }

        metrics.dataQualityScore = ((recentProps.length - propsWithMissingData.length) / recentProps.length) * 100;
        console.log(`📈 Data quality score: ${metrics.dataQualityScore.toFixed(1)}%`);
      }

      this.recordResult('FeedAgent Ingestion', errors.length === 0, data, metrics, errors, Date.now() - stepStart);

    } catch (error) {
      this.recordResult('FeedAgent Ingestion', false, {}, {}, [`Critical error: ${(error as Error).message}`], Date.now() - stepStart);
    }
  }

  private async validateScoringPipeline(): Promise<void> {
    const stepStart = Date.now();
    console.log('\n🎯 STEP 3: Enhanced45Factor Scoring Pipeline Validation');
    console.log('------------------------------------------------------');

    try {
      const errors: string[] = [];
      const data: any = {};
      const metrics: any = {};

      // Test 1: Check for scored props in unified_picks
      const { data: scoredPicks, error: scoredError } = await this.supabase
        .from('unified_picks')
        .select('*')
        .not('professional_score', 'is', null)
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('updated_at', { ascending: false })
        .limit(100);

      if (scoredError) {
        errors.push(`Failed to fetch scored picks: ${scoredError.message}`);
        this.criticalIssues.push('ScoringAgent pipeline broken');
      } else {
        data.scoredPicksCount = scoredPicks?.length || 0;
        console.log(`✅ Scored picks: ${data.scoredPicksCount} in last 24h`);

        if (data.scoredPicksCount === 0) {
          errors.push('No props scored in last 24 hours - ScoringAgent may not be running');
          this.criticalIssues.push('Enhanced45Factor scoring pipeline not functioning');
        }
      }

      // Test 2: Validate scoring data quality
      if (scoredPicks && scoredPicks.length > 0) {
        const picksWithProScore = scoredPicks.filter((pick: any) =>
          pick.professional_score && pick.professional_score > 0
        );

        const picksWithEnhanced45Features = scoredPicks.filter((pick: any) =>
          pick.feature_contributions &&
          typeof pick.feature_contributions === 'object' &&
          'playerForm' in pick.feature_contributions
        );

        data.professionalScoredCount = picksWithProScore.length;
        data.enhanced45FactorCount = picksWithEnhanced45Features.length;

        metrics.professionalScoringRate = (picksWithProScore.length / scoredPicks.length) * 100;
        metrics.enhanced45FactorRate = (picksWithEnhanced45Features.length / scoredPicks.length) * 100;

        console.log(`📊 Professional scoring rate: ${metrics.professionalScoringRate.toFixed(1)}%`);
        console.log(`🏆 Enhanced45Factor rate: ${metrics.enhanced45FactorRate.toFixed(1)}%`);

        if (metrics.professionalScoringRate < 50) {
          errors.push('Low professional scoring rate - ScoringAgent may have issues');
        }

        if (metrics.enhanced45FactorRate < 30) {
          errors.push('Low Enhanced45Factor scoring rate - 195-factor system not functioning properly');
        }

        // Test 3: Check for "professional_score is not defined" errors
        const picksWithScoringErrors = scoredPicks.filter((pick: any) =>
          !pick.professional_score || pick.professional_score <= 0
        );

        if (picksWithScoringErrors.length > 0) {
          errors.push(`${picksWithScoringErrors.length} picks have scoring errors or undefined professional_score`);
        }
      }

      // Test 4: Check for tier assignments
      const { data: tieredPicks, error: tierError } = await this.supabase
        .from('unified_picks')
        .select('tier')
        .not('tier', 'is', null)
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (!tierError && tieredPicks) {
        const tierDistribution = tieredPicks.reduce((acc: any, pick: any) => {
          acc[pick.tier] = (acc[pick.tier] || 0) + 1;
          return acc;
        }, {});

        data.tierDistribution = tierDistribution;
        console.log('📈 Tier distribution:', tierDistribution);

        const totalTiered = Object.values(tierDistribution).reduce((sum: number, count: any) => sum + count, 0);
        metrics.tierAssignmentRate = data.scoredPicksCount > 0 ? (totalTiered / data.scoredPicksCount) * 100 : 0;

        if (metrics.tierAssignmentRate < 80) {
          errors.push('Low tier assignment rate - scoring pipeline may be incomplete');
        }
      }

      this.recordResult('Enhanced45Factor Scoring', errors.length === 0, data, metrics, errors, Date.now() - stepStart);

    } catch (error) {
      this.recordResult('Enhanced45Factor Scoring', false, {}, {}, [`Critical error: ${(error as Error).message}`], Date.now() - stepStart);
    }
  }

  private async validateCommandCenterWorkflow(): Promise<void> {
    const stepStart = Date.now();
    console.log('\n🎛️ STEP 4: Command Center Approval Workflow Validation');
    console.log('-----------------------------------------------------');

    try {
      const errors: string[] = [];
      const data: any = {};
      const metrics: any = {};

      // Test 1: Check Command Center API health
      try {
        const response = await fetch('http://localhost:3004/api/health');
        if (response.ok) {
          const health = await response.json();
          data.commandCenterStatus = health.status;
          console.log(`✅ Command Center API: ${health.status}`);
        } else {
          errors.push(`Command Center API returned ${response.status}`);
          this.criticalIssues.push('Command Center not responding');
        }
      } catch (error) {
        errors.push('Command Center API not accessible');
        this.criticalIssues.push('Command Center service down');
      }

      // Test 2: Check for picks ready for approval (high scoring picks)
      const { data: approvalReady, error: approvalError } = await this.supabase
        .from('unified_picks')
        .select('*')
        .gte('professional_score', 70) // High-scoring picks
        .eq('published', false)
        .not('tier', 'is', null)
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('professional_score', { ascending: false })
        .limit(50);

      if (approvalError) {
        errors.push(`Failed to fetch approval-ready picks: ${approvalError.message}`);
      } else {
        data.approvalReadyCount = approvalReady?.length || 0;
        console.log(`📋 Picks ready for approval: ${data.approvalReadyCount}`);

        if (data.approvalReadyCount === 0) {
          console.log('⚠️ No high-scoring picks ready for approval - may indicate scoring issues');
        }
      }

      // Test 3: Check for published picks (successful approvals)
      const { data: publishedPicks, error: publishedError } = await this.supabase
        .from('unified_picks')
        .select('*')
        .eq('published', true)
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (!publishedError && publishedPicks) {
        data.publishedPicksCount = publishedPicks.length;
        metrics.approvalRate = data.approvalReadyCount > 0 ?
          (data.publishedPicksCount / (data.approvalReadyCount + data.publishedPicksCount)) * 100 : 0;

        console.log(`✅ Published picks: ${data.publishedPicksCount} (${metrics.approvalRate.toFixed(1)}% approval rate)`);
      }

      this.recordResult('Command Center Workflow', errors.length === 0, data, metrics, errors, Date.now() - stepStart);

    } catch (error) {
      this.recordResult('Command Center Workflow', false, {}, {}, [`Critical error: ${(error as Error).message}`], Date.now() - stepStart);
    }
  }

  private async validateDiscordIntegration(): Promise<void> {
    const stepStart = Date.now();
    console.log('\n🤖 STEP 5: Discord Integration Validation');
    console.log('---------------------------------------');

    try {
      const errors: string[] = [];
      const data: any = {};
      const metrics: any = {};

      // Test 1: Check for Discord thread/message IDs in published picks
      const { data: discordPicks, error: discordError } = await this.supabase
        .from('unified_picks')
        .select('*')
        .eq('published', true)
        .not('thread_id', 'is', null)
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (discordError) {
        errors.push(`Failed to fetch Discord-posted picks: ${discordError.message}`);
      } else {
        data.discordPostedCount = discordPicks?.length || 0;
        console.log(`✅ Discord posted picks: ${data.discordPostedCount}`);

        if (data.discordPostedCount === 0) {
          errors.push('No picks posted to Discord in last 24h - Discord integration may be broken');
          this.criticalIssues.push('Discord integration not functioning');
        }
      }

      // Test 2: Check Discord bot health (if accessible)
      try {
        const response = await fetch('http://localhost:3001/health');
        if (response.ok) {
          const health = await response.json();
          data.discordBotStatus = health.status;
          console.log(`✅ Discord Bot: ${health.status}`);
        } else {
          errors.push('Discord Bot health check failed');
        }
      } catch (error) {
        console.log('⚠️ Discord Bot health endpoint not accessible (may be normal)');
      }

      // Test 3: Check for recent agent health updates (indicates active Discord posting)
      const { data: agentHealth, error: healthError } = await this.supabase
        .from('agent_health')
        .select('*')
        .eq('agent_name', 'AlertAgent')
        .gte('updated_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .order('updated_at', { ascending: false })
        .limit(1);

      if (!healthError && agentHealth && agentHealth.length > 0) {
        data.alertAgentLastSeen = agentHealth[0].updated_at;
        console.log(`✅ AlertAgent active: ${data.alertAgentLastSeen}`);
      } else {
        errors.push('AlertAgent not reporting health - Discord posting may be down');
      }

      this.recordResult('Discord Integration', errors.length === 0, data, metrics, errors, Date.now() - stepStart);

    } catch (error) {
      this.recordResult('Discord Integration', false, {}, {}, [`Critical error: ${(error as Error).message}`], Date.now() - stepStart);
    }
  }

  private async validateCompleteDataFlow(): Promise<void> {
    const stepStart = Date.now();
    console.log('\n🔄 STEP 6: Complete End-to-End Data Flow Validation');
    console.log('--------------------------------------------------');

    try {
      const errors: string[] = [];
      const data: any = {};
      const metrics: any = {};

      // Test 1: Trace a complete pipeline flow for recent data
      const { data: recentComplete, error: completeError } = await this.supabase
        .from('unified_picks')
        .select('*')
        .not('professional_score', 'is', null)
        .not('tier', 'is', null)
        .eq('published', true)
        .not('thread_id', 'is', null)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (completeError) {
        errors.push(`Failed to fetch complete pipeline data: ${completeError.message}`);
        this.criticalIssues.push('End-to-end pipeline broken');
      } else {
        data.completeFlowCount = recentComplete?.length || 0;
        console.log(`✅ Complete pipeline flows: ${data.completeFlowCount} picks in last 24h`);

        if (data.completeFlowCount === 0) {
          errors.push('No complete end-to-end flows in last 24h - pipeline is broken');
          this.criticalIssues.push('Complete pipeline flow failure');
        }

        // Calculate pipeline metrics
        if (recentComplete && recentComplete.length > 0) {
          const avgProcessingTime = recentComplete.reduce((sum: number, pick: any) => {
            const created = new Date(pick.created_at).getTime();
            const published = pick.published_at ? new Date(pick.published_at).getTime() : Date.now();
            return sum + (published - created);
          }, 0) / recentComplete.length;

          metrics.avgPipelineTimeMinutes = avgProcessingTime / (1000 * 60);
          console.log(`⏱️ Average pipeline time: ${metrics.avgPipelineTimeMinutes.toFixed(1)} minutes`);

          if (metrics.avgPipelineTimeMinutes > 60) {
            errors.push('Pipeline processing time too slow (>60 minutes average)');
          }
        }
      }

      // Test 2: Check for pipeline bottlenecks
      const totalSteps = this.results.length;
      const failedSteps = this.results.filter(r => !r.success).length;
      metrics.pipelineSuccessRate = ((totalSteps - failedSteps) / totalSteps) * 100;

      console.log(`📊 Overall pipeline success rate: ${metrics.pipelineSuccessRate.toFixed(1)}%`);

      if (metrics.pipelineSuccessRate < 80) {
        errors.push('Low overall pipeline success rate');
        this.criticalIssues.push('Multiple pipeline failures detected');
      }

      this.recordResult('Complete Data Flow', errors.length === 0, data, metrics, errors, Date.now() - stepStart);

    } catch (error) {
      this.recordResult('Complete Data Flow', false, {}, {}, [`Critical error: ${(error as Error).message}`], Date.now() - stepStart);
    }
  }

  private recordResult(stepName: string, success: boolean, data: any, metrics: any, errors: string[], executionTimeMs: number): void {
    const result: PipelineTestResult = {
      stepName,
      success,
      data,
      metrics,
      errors,
      executionTimeMs,
      timestamp: new Date().toISOString()
    };

    this.results.push(result);

    // Log result
    const status = success ? '✅' : '❌';
    console.log(`${status} ${stepName}: ${success ? 'PASSED' : 'FAILED'} (${executionTimeMs}ms)`);

    if (!success && errors.length > 0) {
      errors.forEach(error => console.log(`   ⚠️ ${error}`));
    }
  }

  private generateReport(): E2EValidationReport {
    const totalExecutionTime = Date.now() - this.startTime;
    const successfulSteps = this.results.filter(r => r.success).length;
    const totalSteps = this.results.length;
    const overallSuccess = this.criticalIssues.length === 0 && successfulSteps === totalSteps;

    let pipelineHealth: 'healthy' | 'degraded' | 'broken';
    if (this.criticalIssues.length > 0) {
      pipelineHealth = 'broken';
    } else if (successfulSteps / totalSteps < 0.8) {
      pipelineHealth = 'degraded';
    } else {
      pipelineHealth = 'healthy';
    }

    const recommendations = this.generateRecommendations();

    const report: E2EValidationReport = {
      overallSuccess,
      criticalIssuesFound: this.criticalIssues,
      pipelineHealth,
      testResults: this.results,
      totalExecutionTimeMs: totalExecutionTime,
      recommendations
    };

    // Print final report
    console.log('\n================================================');
    console.log('🔍 E2E PIPELINE VALIDATION REPORT');
    console.log('================================================');
    console.log(`Overall Status: ${overallSuccess ? '✅ HEALTHY' : '❌ ISSUES FOUND'}`);
    console.log(`Pipeline Health: ${pipelineHealth.toUpperCase()}`);
    console.log(`Success Rate: ${successfulSteps}/${totalSteps} steps (${((successfulSteps/totalSteps)*100).toFixed(1)}%)`);
    console.log(`Total Execution Time: ${(totalExecutionTime/1000).toFixed(1)}s`);

    if (this.criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES:');
      this.criticalIssues.forEach(issue => console.log(`   • ${issue}`));
    }

    if (recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      recommendations.forEach(rec => console.log(`   • ${rec}`));
    }

    console.log('\n📊 STEP-BY-STEP RESULTS:');
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.stepName} (${result.executionTimeMs}ms)`);
      if (!result.success) {
        result.errors.forEach(error => console.log(`      ⚠️ ${error}`));
      }
    });

    console.log('\n================================================\n');

    return report;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Analyze results and generate specific recommendations
    if (this.criticalIssues.includes('sports_game_odds table schema issue')) {
      recommendations.push('Run database migration to fix sports_game_odds table schema');
    }

    if (this.criticalIssues.includes('FeedAgent not ingesting data')) {
      recommendations.push('Restart FeedAgent service and check API credentials');
    }

    if (this.criticalIssues.includes('Enhanced45Factor scoring pipeline not functioning')) {
      recommendations.push('Check ScoringAgent configuration and restart service');
    }

    if (this.criticalIssues.includes('Discord integration not functioning')) {
      recommendations.push('Verify Discord bot permissions and webhook configuration');
    }

    const failedSteps = this.results.filter(r => !r.success);
    if (failedSteps.length > 2) {
      recommendations.push('Consider system-wide restart as multiple components are failing');
    }

    if (recommendations.length === 0 && this.results.some(r => r.success)) {
      recommendations.push('System is operational - continue monitoring for performance optimization');
    }

    return recommendations;
  }
}

// Execute the validation
async function main() {
  try {
    const validator = new ComprehensiveE2EPipelineValidator();
    const report = await validator.runCompleteValidation();

    // Exit with appropriate code
    process.exit(report.overallSuccess ? 0 : 1);
  } catch (error) {
    console.error('❌ E2E Validation failed with critical error:', (error as Error).message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { ComprehensiveE2EPipelineValidator, E2EValidationReport };