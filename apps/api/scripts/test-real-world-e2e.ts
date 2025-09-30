#!/usr/bin/env npx tsx

/**
 * 🚀 Real-World End-to-End Testing Script
 * 
 * Complete pipeline test: Props → Database → Grading → Discord → Recaps
 * Uses LIVE DATA, REAL PICKS, ACTUAL DISCORD POSTING
 * 
 * Usage:
 *   npm run test:real-world-e2e
 *   npm run test:real-world-e2e --duration=30min
 *   npm run test:real-world-e2e --sports=NFL,NCAAF --validate-settlement
 */

import { performance } from 'perf_hooks';

import { createClient } from '@supabase/supabase-js';
import { Connection, WorkflowClient } from '@temporalio/client';
import { Client as DiscordClient } from 'discord.js';

// Import our agents and services
import { AlertAgent } from '../src/agents/AlertAgent';
import { ScoringAgent } from '../src/agents/ScoringAgent/ScoringAgent';
import { IngestionAgent } from '../src/agents/IngestionAgent';
import { RecapAgent } from '../src/agents/RecapAgent/recapService';
import { SettlementAgent } from '../src/agents/SettlementAgent';
import { logger } from '../src/shared/logger';
import { getEnv } from '../src/utils/getEnv';

interface E2ETestConfig {
  duration: number; // minutes
  sports: string[];
  testSettlement: boolean;
  validateDiscord: boolean;
  targetPicks: number;
  maxProcessingTime: number; // seconds
}

interface E2ETestResults {
  startTime: number;
  endTime: number;
  totalDuration: number;
  
  // Data Ingestion
  propsIngested: number;
  gamesProcessed: number;
  apiCallsUsed: number;
  
  // Grading & Scoring
  picksGenerated: number;
  tierDistribution: Record<string, number>;
  averageProcessingTime: number;
  
  // Discord Integration
  alertsSent: number;
  threadsCreated: number;
  discordPostingSuccess: boolean;
  
  // Recap Generation
  recapsGenerated: number;
  performanceMetrics: any;
  
  // Settlement (if tested)
  settledPicks?: number;
  settlementAccuracy?: number;
  
  // Overall Success
  overallSuccess: boolean;
  errorCount: number;
  warnings: string[];
  recommendations: string[];
}

class RealWorldE2ETestRunner {
  private config: E2ETestConfig;
  private results: E2ETestResults;
  private supabase: ReturnType<typeof createClient>;
  private discord: DiscordClient;
  private temporal: WorkflowClient;
  
  // Agents
  private ingestionAgent: IngestionAgent;
  private scoringAgent: ScoringAgent;
  private alertAgent: AlertAgent;
  private recapAgent: RecapAgent;
  private settlementAgent?: SettlementAgent;

  constructor(config: Partial<E2ETestConfig> = {}) {
    this.config = {
      duration: 30, // 30 minutes default
      sports: ['NFL', 'NCAAF', 'NBA', 'WNBA', 'MLB', 'NHL'],
      testSettlement: false,
      validateDiscord: true,
      targetPicks: 50, // Minimum picks to generate
      maxProcessingTime: 50, // Max 50 seconds per cycle
      ...config
    };

    this.results = {
      startTime: performance.now(),
      endTime: 0,
      totalDuration: 0,
      propsIngested: 0,
      gamesProcessed: 0,
      apiCallsUsed: 0,
      picksGenerated: 0,
      tierDistribution: {},
      averageProcessingTime: 0,
      alertsSent: 0,
      threadsCreated: 0,
      discordPostingSuccess: false,
      recapsGenerated: 0,
      performanceMetrics: {},
      overallSuccess: false,
      errorCount: 0,
      warnings: [],
      recommendations: []
    };
  }

  async initialize(): Promise<void> {
    logger.info('🚀 Initializing Real-World E2E Test Environment');

    try {
      // Initialize Supabase
      this.supabase = createClient(
        getEnv('SUPABASE_URL'),
        getEnv('SUPABASE_SERVICE_ROLE_KEY')
      );

      // Initialize Discord
      this.discord = new DiscordClient({
        intents: ['Guilds', 'GuildMessages', 'MessageContent']
      });
      await this.discord.login(getEnv('DISCORD_BOT_TOKEN'));

      // Initialize Temporal
      const connection = await Connection.connect({
        address: getEnv('TEMPORAL_ADDRESS', 'localhost:7233')
      });
      this.temporal = new WorkflowClient({ connection });

      // Initialize Agents with real configuration
      const agentConfig = {
        agentName: 'E2ETest',
        enabled: true,
        logLevel: 'info' as const,
        metricsEnabled: true,
        retryConfig: {
          maxRetries: 3,
          backoffMs: 1000
        }
      };

      const agentDeps = {
        supabase: this.supabase,
        redis: null, // Will be initialized by agents
        temporal: this.temporal,
        logger
      };

      this.ingestionAgent = new IngestionAgent(agentConfig, agentDeps);
      this.scoringAgent = new ScoringAgent(agentConfig, agentDeps);
      this.alertAgent = new AlertAgent(agentConfig, agentDeps);
      this.recapAgent = new RecapAgent(agentConfig, agentDeps);

      if (this.config.testSettlement) {
        this.settlementAgent = new SettlementAgent(agentConfig, agentDeps);
      }

      logger.info('✅ E2E Test Environment Initialized Successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize E2E test environment', { error });
      throw error;
    }
  }

  async runCompleteE2ETest(): Promise<E2ETestResults> {
    logger.info('🔥 Starting Real-World E2E Test', {
      duration: `${this.config.duration} minutes`,
      sports: this.config.sports,
      targetPicks: this.config.targetPicks
    });

    try {
      await this.initialize();

      // Phase 1: Data Ingestion (Live Props)
      await this.testDataIngestion();

      // Phase 2: Grading & Scoring
      await this.testGradingAndScoring();

      // Phase 3: Alert Generation & Discord Posting
      await this.testDiscordIntegration();

      // Phase 4: Recap Generation
      await this.testRecapGeneration();

      // Phase 5: Settlement Testing (if enabled)
      if (this.config.testSettlement) {
        await this.testSettlementProcessing();
      }

      // Phase 6: Performance Validation
      await this.validatePerformance();

      // Calculate final results
      this.calculateFinalResults();

      return this.results;

    } catch (error) {
      logger.error('❌ E2E Test Failed', { error });
      this.results.errorCount++;
      this.results.overallSuccess = false;
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async testDataIngestion(): Promise<void> {
    logger.info('📥 Phase 1: Testing Live Data Ingestion');
    
    const ingestionStart = performance.now();

    try {
      // Test ingestion for each sport with live data
      for (const sport of this.config.sports) {
        logger.info(`🏈 Ingesting live ${sport} data`);
        
        const result = await this.ingestionAgent.processLiveData({
          sport,
          marketType: 'player-props',
          useRealData: true
        });

        this.results.propsIngested += result.propsIngested || 0;
        this.results.gamesProcessed += result.gamesProcessed || 0;
        this.results.apiCallsUsed += result.apiCallsUsed || 0;

        // Verify data in database
        const { count } = await this.supabase
          .from('raw_props')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
          .eq('sport', sport);

        if (!count || count === 0) {
          this.results.warnings.push(`No recent ${sport} props found in database`);
        }
      }

      const ingestionTime = (performance.now() - ingestionStart) / 1000;
      logger.info('✅ Data Ingestion Complete', {
        propsIngested: this.results.propsIngested,
        gamesProcessed: this.results.gamesProcessed,
        processingTime: `${ingestionTime.toFixed(2)}s`
      });

    } catch (error) {
      logger.error('❌ Data Ingestion Failed', { error });
      this.results.errorCount++;
      throw error;
    }
  }

  private async testGradingAndScoring(): Promise<void> {
    logger.info('🎯 Phase 2: Testing Grading & Scoring with Live Data');
    
    const gradingStart = performance.now();

    try {
      // Get recent ungraded props
      const { data: ungradedProps } = await this.supabase
        .from('raw_props')
        .select('*')
        .is('final_grade', null)
        .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .limit(100);

      if (!ungradedProps || ungradedProps.length === 0) {
        throw new Error('No ungraded props found for testing');
      }

      logger.info(`📊 Grading ${ungradedProps.length} live props`);

      // Process grading in batches
      const batchSize = 10;
      const processingTimes: number[] = [];

      for (let i = 0; i < ungradedProps.length; i += batchSize) {
        const batch = ungradedProps.slice(i, i + batchSize);
        const batchStart = performance.now();

        const gradingResults = await this.gradingAgent.processBatch(batch);
        
        const batchTime = (performance.now() - batchStart) / 1000;
        processingTimes.push(batchTime);

        // Track tier distribution
        gradingResults.forEach(result => {
          const tier = result.tier || 'Unknown';
          this.results.tierDistribution[tier] = (this.results.tierDistribution[tier] || 0) + 1;
        });

        this.results.picksGenerated += gradingResults.length;

        // Validate processing time
        if (batchTime > this.config.maxProcessingTime) {
          this.results.warnings.push(`Batch processing took ${batchTime.toFixed(2)}s (over ${this.config.maxProcessingTime}s limit)`);
        }
      }

      this.results.averageProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;

      logger.info('✅ Grading & Scoring Complete', {
        picksGenerated: this.results.picksGenerated,
        averageProcessingTime: `${this.results.averageProcessingTime.toFixed(2)}s`,
        tierDistribution: this.results.tierDistribution
      });

      if (this.results.picksGenerated < this.config.targetPicks) {
        this.results.warnings.push(`Only generated ${this.results.picksGenerated} picks (target: ${this.config.targetPicks})`);
      }

    } catch (error) {
      logger.error('❌ Grading & Scoring Failed', { error });
      this.results.errorCount++;
      throw error;
    }
  }

  private async testDiscordIntegration(): Promise<void> {
    logger.info('🔔 Phase 3: Testing Discord Alert System');

    try {
      // Get recently grading_status picks for alerts
      const { data: gradedPicks } = await this.supabase
        .from('raw_props')
        .select('*')
        .not('final_grade', 'is', null)
        .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
        .in('tier', ['Elite', 'Premium']) // Only test high-tier picks
        .limit(10);

      if (!gradedPicks || gradedPicks.length === 0) {
        this.results.warnings.push('No grading_status picks found for Discord testing');
        return;
      }

      logger.info(`📢 Posting ${gradedPicks.length} alerts to Discord`);

      // Test alert generation and posting
      for (const pick of gradedPicks) {
        try {
          const alertResult = await this.alertAgent.generateAndPostAlert(pick);
          
          if (alertResult.success) {
            this.results.alertsSent++;
            if (alertResult.threadCreated) {
              this.results.threadsCreated++;
            }
          }
        } catch (alertError) {
          logger.warn('Alert posting failed for pick', { pickId: pick.id, error: alertError });
        }
      }

      this.results.discordPostingSuccess = this.results.alertsSent > 0;

      logger.info('✅ Discord Integration Complete', {
        alertsSent: this.results.alertsSent,
        threadsCreated: this.results.threadsCreated,
        success: this.results.discordPostingSuccess
      });

    } catch (error) {
      logger.error('❌ Discord Integration Failed', { error });
      this.results.errorCount++;
      this.results.discordPostingSuccess = false;
    }
  }

  private async testRecapGeneration(): Promise<void> {
    logger.info('📊 Phase 4: Testing Recap Generation');

    try {
      // Generate daily recap with real data
      const recapResult = await this.recapAgent.generateDailyRecap({
        date: new Date().toISOString().split('T')[0],
        includePerformanceMetrics: true,
        postToDiscord: this.config.validateDiscord
      });

      if (recapResult.success) {
        this.results.recapsGenerated++;
        this.results.performanceMetrics = recapResult.metrics;
      }

      logger.info('✅ Recap Generation Complete', {
        recapsGenerated: this.results.recapsGenerated,
        metrics: this.results.performanceMetrics
      });

    } catch (error) {
      logger.error('❌ Recap Generation Failed', { error });
      this.results.errorCount++;
    }
  }

  private async testSettlementProcessing(): Promise<void> {
    if (!this.settlementAgent) return;

    logger.info('🏁 Phase 5: Testing Settlement Processing');

    try {
      // Find completed games for settlement testing
      const { data: completedGames } = await this.supabase
        .from('games')
        .select('*')
        .eq('status', 'completed')
        .gte('game_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(5);

      if (!completedGames || completedGames.length === 0) {
        this.results.warnings.push('No completed games found for settlement testing');
        return;
      }

      let settledCount = 0;
      let accuracySum = 0;

      for (const game of completedGames) {
        const settlementResult = await this.settlementAgent.processGameSettlement(game);
        
        if (settlementResult.success) {
          settledCount++;
          accuracySum += settlementResult.accuracy || 0;
        }
      }

      this.results.settledPicks = settledCount;
      this.results.settlementAccuracy = settledCount > 0 ? accuracySum / settledCount : 0;

      logger.info('✅ Settlement Processing Complete', {
        settledPicks: this.results.settledPicks,
        accuracy: `${(this.results.settlementAccuracy * 100).toFixed(1)}%`
      });

    } catch (error) {
      logger.error('❌ Settlement Processing Failed', { error });
      this.results.errorCount++;
    }
  }

  private async validatePerformance(): Promise<void> {
    logger.info('⚡ Phase 6: Performance Validation');

    // Check system performance metrics
    const performanceChecks = [
      {
        metric: 'Average Processing Time',
        value: this.results.averageProcessingTime,
        threshold: this.config.maxProcessingTime,
        unit: 'seconds'
      },
      {
        metric: 'Props Ingested',
        value: this.results.propsIngested,
        threshold: 100,
        unit: 'props'
      },
      {
        metric: 'Picks Generated',
        value: this.results.picksGenerated,
        threshold: this.config.targetPicks,
        unit: 'picks'
      },
      {
        metric: 'Discord Success Rate',
        value: this.results.discordPostingSuccess ? 100 : 0,
        threshold: 95,
        unit: '%'
      }
    ];

    for (const check of performanceChecks) {
      if (check.value < check.threshold) {
        this.results.warnings.push(
          `${check.metric} below threshold: ${check.value}${check.unit} < ${check.threshold}${check.unit}`
        );
      }
    }

    // Generate recommendations
    this.generateRecommendations();
  }

  private generateRecommendations(): void {
    const recommendations: string[] = [];

    // Performance recommendations
    if (this.results.averageProcessingTime > 30) {
      recommendations.push('Consider optimizing grading algorithms for faster processing');
    }

    // Data quality recommendations
    if (this.results.propsIngested < 500) {
      recommendations.push('Increase data ingestion frequency or add more sports coverage');
    }

    // Alert system recommendations
    if (this.results.alertsSent < this.results.picksGenerated * 0.1) {
      recommendations.push('Review alert thresholds - very few picks are generating alerts');
    }

    // Elite tier recommendations
    const elitePercentage = (this.results.tierDistribution['Elite'] || 0) / this.results.picksGenerated * 100;
    if (elitePercentage > 10) {
      recommendations.push('Elite tier percentage is high - consider tightening elite criteria');
    } else if (elitePercentage < 2) {
      recommendations.push('Elite tier percentage is low - consider adjusting elite thresholds');
    }

    this.results.recommendations = recommendations;
  }

  private calculateFinalResults(): void {
    this.results.endTime = performance.now();
    this.results.totalDuration = (this.results.endTime - this.results.startTime) / 1000 / 60; // minutes

    // Determine overall success
    const criticalFailures = this.results.errorCount > 0;
    const majorIssues = this.results.warnings.filter(w => 
      w.includes('No recent') || w.includes('Failed') || w.includes('below threshold')
    ).length > 2;

    this.results.overallSuccess = !criticalFailures && !majorIssues && 
      this.results.picksGenerated >= this.config.targetPicks * 0.8;
  }

  private async cleanup(): Promise<void> {
    logger.info('🧹 Cleaning up E2E test environment');

    try {
      if (this.discord) {
        await this.discord.destroy();
      }
      // Additional cleanup as needed
    } catch (error) {
      logger.warn('Cleanup warning', { error });
    }
  }
}

// Main execution function
async function runRealWorldE2ETest(): Promise<void> {
  const args = process.argv.slice(2);
  const config: Partial<E2ETestConfig> = {};

  // Parse command line arguments
  args.forEach(arg => {
    if (arg.startsWith('--duration=')) {
      config.duration = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--sports=')) {
      config.sports = arg.split('=')[1].split(',');
    } else if (arg === '--validate-settlement') {
      config.testSettlement = true;
    } else if (arg === '--no-discord') {
      config.validateDiscord = false;
    }
  });

  const testRunner = new RealWorldE2ETestRunner(config);

  try {
    const results = await testRunner.runCompleteE2ETest();

    // Display comprehensive results
    console.log('\n🎯 REAL-WORLD E2E TEST RESULTS');
    console.log('================================\n');
    
    console.log(`⏱️  Total Duration: ${results.totalDuration.toFixed(1)} minutes`);
    console.log(`✅ Overall Success: ${results.overallSuccess ? 'PASS' : 'FAIL'}\n`);
    
    console.log('📊 DATA INGESTION:');
    console.log(`   Props Ingested: ${results.propsIngested}`);
    console.log(`   Games Processed: ${results.gamesProcessed}`);
    console.log(`   API Calls Used: ${results.apiCallsUsed}\n`);
    
    console.log('🎯 GRADING & SCORING:');
    console.log(`   Picks Generated: ${results.picksGenerated}`);
    console.log(`   Average Processing: ${results.averageProcessingTime.toFixed(2)}s`);
    console.log(`   Tier Distribution:`, results.tierDistribution);
    console.log('');
    
    console.log('🔔 DISCORD INTEGRATION:');
    console.log(`   Alerts Sent: ${results.alertsSent}`);
    console.log(`   Threads Created: ${results.threadsCreated}`);
    console.log(`   Posting Success: ${results.discordPostingSuccess}\n`);
    
    console.log('📊 RECAP GENERATION:');
    console.log(`   Recaps Generated: ${results.recapsGenerated}\n`);
    
    if (results.settledPicks !== undefined) {
      console.log('🏁 SETTLEMENT:');
      console.log(`   Picks Settled: ${results.settledPicks}`);
      console.log(`   Accuracy: ${(results.settlementAccuracy! * 100).toFixed(1)}%\n`);
    }
    
    if (results.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      results.warnings.forEach(warning => console.log(`   - ${warning}`));
      console.log('');
    }
    
    if (results.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS:');
      results.recommendations.forEach(rec => console.log(`   - ${rec}`));
      console.log('');
    }
    
    console.log(`🎯 SYSTEM STATUS: ${results.overallSuccess ? '🟢 READY FOR PRODUCTION' : '🔴 NEEDS ATTENTION'}`);

    // Exit with appropriate code
    process.exit(results.overallSuccess ? 0 : 1);

  } catch (error) {
    console.error('❌ E2E Test Failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runRealWorldE2ETest().catch(console.error);
}

export { RealWorldE2ETestRunner, E2ETestConfig, E2ETestResults };