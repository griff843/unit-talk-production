#!/usr/bin/env node

/**
 * MASSIVE PARALLEL SGO BACKFILL LAUNCHER
 *
 * Launches the most efficient parallel processing system to handle 1.4M+ props
 *
 * Architecture:
 * - 7 concurrent sport workflows (MLB, NFL, NBA, NCAAF, NCAAB, WNBA, NHL)
 * - 5-10 concurrent date ranges per sport (50+ total concurrent processors)
 * - 20 concurrent games per date range (1000+ concurrent API calls)
 * - Concurrent settlement processing pipeline
 * - Smart rate limiting with API quota optimization
 *
 * Target: Complete 1.4M props in 6-8 hours
 */

import { Connection, Client } from '@temporalio/client';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('MassiveParallelBackfill');

interface BackfillMetrics {
  startTime: Date;
  workflowId: string;
  expectedProps: number;
  apiQuotaLimit: number;
  concurrentWorkflows: number;
}

async function launchMassiveParallelBackfill() {
  const SGO_API_KEY = process.env.SGO_API_KEY || process.env.SPORTSGAMEODDS_KEY;

  if (!SGO_API_KEY) {
    console.error('❌ SGO_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🚀 MASSIVE PARALLEL SGO BACKFILL LAUNCHER');
  console.log('🎯 Target: Process 1.4M+ props across all major sports');
  console.log('⚡ Architecture: Massively parallel with intelligent optimization');
  console.log('📊 Expected Duration: 6-8 hours with full parallelization');
  console.log('');

  try {
    // Connect to Temporal
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_SERVER_URL || 'localhost:7233',
    });

    const client = new Client({ connection });

    const workflowId = `massive-parallel-sgo-backfill-${Date.now()}`;
    const startTime = new Date();

    const metrics: BackfillMetrics = {
      startTime,
      workflowId,
      expectedProps: 1400000, // 1.4M target
      apiQuotaLimit: 10000, // Trial limit
      concurrentWorkflows: 7 // One per sport
    };

    logger.info('🎬 Launching massive parallel backfill workflow', {
      workflowId,
      metrics
    });

    // Launch the main parallel backfill workflow
    const handle = await client.workflow.start('massiveParallelSGOBackfill', {
      args: [{
        sports: ['MLB', 'NFL', 'NBA', 'NCAAF', 'NCAAB', 'WNBA', 'NHL'],
        days: 365, // Full year
        batchSize: 250, // Large batches for efficiency
        maxConcurrentSports: 7, // All sports in parallel
        maxConcurrentDays: 5, // 5 date ranges per sport
        maxConcurrentGames: 20, // 20 games per date range
        smartRateLimit: true, // Intelligent rate limiting
        batchApiCalls: true, // Batch API optimization
        dryRun: false // Live execution
      }],
      workflowId,
      taskQueue: 'unit-talk-dev',
      workflowExecutionTimeout: '8 hours', // Allow up to 8 hours
      memo: {
        description: 'Massive parallel SGO backfill for 1.4M+ props',
        launched_at: startTime.toISOString(),
        target_props: '1400000',
        architecture: 'massively_parallel'
      }
    });

    console.log('✅ Massive parallel backfill workflow launched successfully!');
    console.log(`🆔 Workflow ID: ${workflowId}`);
    console.log(`🌐 Temporal UI: http://localhost:8088/namespaces/default/workflows/${workflowId}`);
    console.log('');

    // Launch concurrent monitoring
    console.log('📊 Starting real-time progress monitoring...');

    const monitoringInterval = setInterval(async () => {
      try {
        const workflowHandle = client.workflow.getHandle(workflowId);
        const description = await workflowHandle.describe();

        console.log(`⏰ Status: ${description.status.name} | Running for: ${Math.round((Date.now() - startTime.getTime()) / 1000 / 60)} minutes`);

        if (description.status.name === 'COMPLETED' ||
            description.status.name === 'FAILED' ||
            description.status.name === 'TERMINATED') {
          clearInterval(monitoringInterval);

          if (description.status.name === 'COMPLETED') {
            const result = await workflowHandle.result();
            displayFinalResults(result, metrics);
          } else {
            console.log(`❌ Workflow ${description.status.name.toLowerCase()}`);
          }
        }

      } catch (error) {
        console.log('⚠️  Monitoring error:', error instanceof Error ? error.message : 'Unknown error');
      }
    }, 30000); // Check every 30 seconds

    // Display architecture information
    displayArchitectureInfo(metrics);

    // Display optimization tips
    displayOptimizationTips();

    console.log('🔄 Workflow is running... Monitor progress in Temporal UI or wait for completion');
    console.log('💡 Tip: You can cancel this monitoring script and check progress later via Temporal UI');

  } catch (error: any) {
    console.error('❌ Failed to launch massive parallel backfill:', error.message);
    console.error('💡 Troubleshooting:');
    console.error('   1. Ensure Docker environment is running: ./dev.sh start');
    console.error('   2. Check Temporal server: curl http://localhost:8088');
    console.error('   3. Verify SGO API key is valid');
    console.error('   4. Check database connectivity');
    process.exit(1);
  }
}

function displayArchitectureInfo(metrics: BackfillMetrics) {
  console.log('🏗️  ARCHITECTURE OVERVIEW:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📊 PARALLEL PROCESSING STRUCTURE:');
  console.log('   ├── Sport Workflows (7 concurrent)');
  console.log('   │   ├── MLB: ~400K props (high volume sport)');
  console.log('   │   ├── NBA: ~350K props (high volume sport)');
  console.log('   │   ├── NFL: ~200K props (medium volume sport)');
  console.log('   │   ├── NCAAF: ~200K props (medium volume sport)');
  console.log('   │   ├── NCAAB: ~180K props (medium volume sport)');
  console.log('   │   ├── WNBA: ~40K props (lower volume sport)');
  console.log('   │   └── NHL: ~150K props (medium volume sport)');
  console.log('   │');
  console.log('   ├── Date Range Processing (5 concurrent per sport = 35 total)');
  console.log('   │   └── 10-day chunks for optimal API efficiency');
  console.log('   │');
  console.log('   ├── Game Processing (20 concurrent per date range = 700 total)');
  console.log('   │   └── Batch API calls with intelligent rate limiting');
  console.log('   │');
  console.log('   └── Settlement Processing (concurrent with backfill)');
  console.log('       └── Processes existing 47K props + new props as they arrive');
  console.log('');
  console.log('⚡ PERFORMANCE TARGETS:');
  console.log(`   • Expected Props: ${metrics.expectedProps.toLocaleString()}`);
  console.log('   • Processing Rate: 3000-4000 props/minute at peak');
  console.log('   • API Efficiency: Smart rate limiting to maximize quota usage');
  console.log('   • Concurrent Workflows: 35+ active processors');
  console.log('   • Total Duration: 6-8 hours (vs 30+ hours sequential)');
  console.log('');
}

function displayOptimizationTips() {
  console.log('💡 OPTIMIZATION FEATURES:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🎯 Smart Rate Limiting:');
  console.log('   • Different rates per sport based on data volume');
  console.log('   • MLB/NBA: 70-80 requests/minute (high volume)');
  console.log('   • NFL/NCAAF/NHL: 60 requests/minute (medium volume)');
  console.log('   • WNBA: 50 requests/minute (lower volume)');
  console.log('');
  console.log('🔄 Intelligent Batching:');
  console.log('   • Larger batch sizes for high-volume sports');
  console.log('   • Concurrent API calls within rate limits');
  console.log('   • Automatic retry with exponential backoff');
  console.log('');
  console.log('📊 Real-time Monitoring:');
  console.log('   • Progress tracking via Temporal UI');
  console.log('   • Database progress updates every batch');
  console.log('   • Error tracking and automatic recovery');
  console.log('');
  console.log('🔧 Concurrent Settlement:');
  console.log('   • Processes existing 47K props immediately');
  console.log('   • Settles new props as they\'re ingested');
  console.log('   • Parallel grading pipeline integration');
  console.log('');
}

function displayFinalResults(result: any, metrics: BackfillMetrics) {
  const duration = Date.now() - metrics.startTime.getTime();
  const hours = Math.round(duration / 1000 / 60 / 60 * 100) / 100;
  const propsPerHour = Math.round(result.processedProps / hours);

  console.log('');
  console.log('🎉 MASSIVE PARALLEL BACKFILL COMPLETED!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📊 FINAL RESULTS:');
  console.log(`   ⏱️  Total Duration: ${hours} hours`);
  console.log(`   📈 Props Processed: ${result.processedProps.toLocaleString()}`);
  console.log(`   🎮 Games Processed: ${result.processedGames.toLocaleString()}`);
  console.log(`   🏃 Sports Completed: ${result.processedSports}/7`);
  console.log(`   ⚡ Processing Rate: ${propsPerHour.toLocaleString()} props/hour`);
  console.log(`   🎯 Target Achievement: ${Math.round((result.processedProps / metrics.expectedProps) * 100)}% of 1.4M`);
  console.log(`   🔄 Duplicates Skipped: ${result.duplicatesSkipped.toLocaleString()}`);
  console.log(`   ❌ Errors: ${result.errors.length}`);
  console.log('');

  if (result.processedProps >= metrics.expectedProps * 0.95) {
    console.log('🏆 SUCCESS: Target achieved! Massive parallel backfill completed successfully.');
  } else if (result.processedProps >= metrics.expectedProps * 0.80) {
    console.log('✅ GOOD: Substantial progress made. Consider running additional targeted backfills.');
  } else {
    console.log('⚠️  PARTIAL: Some issues encountered. Review errors and consider re-running failed sports.');
  }

  console.log('');
  console.log('📋 NEXT STEPS:');
  console.log('   1. Verify settlement processing for new props');
  console.log('   2. Run grading system on all new props');
  console.log('   3. Monitor system performance with increased data volume');
  console.log('   4. Set up ongoing incremental data ingestion');
  console.log('');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Received interrupt signal. The workflow will continue running in the background.');
  console.log('💡 Monitor progress at: http://localhost:8088');
  console.log('🔧 To stop the workflow, use the Temporal UI or CLI');
  process.exit(0);
});

if (require.main === module) {
  launchMassiveParallelBackfill().catch(error => {
    console.error('Launch script failed:', error.message);
    process.exit(1);
  });
}