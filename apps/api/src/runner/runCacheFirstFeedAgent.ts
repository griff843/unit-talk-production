#!/usr/bin/env tsx

/**
 * Cache-First FeedAgent Runner Script
 *
 * Example usage of the refactored FeedAgent with cache-first unified_picks writes
 * Demonstrates CLI flags, feature flags, and backward compatibility testing
 *
 * Usage Examples:
 *
 * Basic usage:
 * npx tsx src/runner/runCacheFirstFeedAgent.ts
 *
 * With CLI flags:
 * npx tsx src/runner/runCacheFirstFeedAgent.ts --sports=NFL,NBA --rate=500 --batch=50
 *
 * Shadow mode testing:
 * FEED_AGENT_SHADOW_MODE=true npx tsx src/runner/runCacheFirstFeedAgent.ts --verbose
 *
 * Dry run mode:
 * npx tsx src/runner/runCacheFirstFeedAgent.ts --dry-run --sports=MLB --verbose
 */

import { FeedAgent } from '../agents/FeedAgent';
import { createBaseAgentConfig } from '../agents/BaseAgent/config';
import { supabaseClient } from '../utils/supabaseUtils';
import { featureFlags } from '../services/featureFlags';
import { cachedOddsApiClient } from '../services/cachedOddsApiClient';
import { CacheFirstUnifiedPicksService } from '../services/CacheFirstUnifiedPicksService';
import { parseCliArgs, validateCliArgs, displayHelp } from '../utils/cliArgs';
import { logger } from '../shared/logger';

async function main() {
  console.log('🚀 Cache-First FeedAgent Runner');
  console.log('===============================');

  try {
    // Parse command line arguments
    const parsed = parseCliArgs();
    const args = parsed.args;

    if (args.help) {
      displayHelp();
      process.exit(0);
    }

    // Validate CLI arguments
    validateCliArgs(args);

    // Display feature flag status
    const flagStatus = featureFlags.getStatus();
    console.log('\n📊 Feature Flag Status:');
    console.log(`   Phase: ${flagStatus.rollout.phase}`);
    console.log(`   Cache-First: ${flagStatus.flags.cacheFirstEnabled ? '✅' : '❌'}`);
    console.log(`   Unified Picks Direct: ${flagStatus.flags.unifiedPicksDirectWrite ? '✅' : '❌'}`);
    console.log(`   Shadow Mode: ${flagStatus.shadowMode.enabled ? '✅' : '❌'}`);
    console.log(`   Sports: ${flagStatus.flags.enabledSports.join(', ') || 'ALL'}`);
    console.log(`   Rollout: ${flagStatus.rollout.percentage}%`);

    // Show CLI configuration
    if (Object.keys(args).length > 0) {
      console.log('\n🎛️  CLI Configuration:');
      Object.entries(args).forEach(([key, value]) => {
        console.log(`   ${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
      });
    }

    // Health checks before starting
    console.log('\n🔍 Running Health Checks...');

    // Check cache service health
    const cacheHealth = await CacheFirstUnifiedPicksService.getInstance().healthCheck();
    console.log(`   Cache Service: ${cacheHealth.status} ${cacheHealth.status === 'healthy' ? '✅' : '⚠️'}`);

    // Check cached API client health
    const apiHealth = await cachedOddsApiClient.healthCheck();
    console.log(`   API Client: ${apiHealth.status} ${apiHealth.status === 'healthy' ? '✅' : '⚠️'}`);

    // Check database connection
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('unified_picks').select('id').limit(1);
        console.log(`   Database: ${error ? 'unhealthy ❌' : 'healthy ✅'}`);
      } catch (dbError) {
        console.log('   Database: unhealthy ❌');
      }
    }

    // Create FeedAgent configuration
    const config = createBaseAgentConfig({
      name: 'CacheFirstFeedAgent',
      enabled: true,
      version: '2.0.0',
      logLevel: args.verbose ? 'debug' : 'info',

      // Pass CLI args to agent
      cliArgs: process.argv.slice(2),

      // Agent-specific settings
      sports: args.sports || ['NFL', 'NBA', 'MLB', 'NHL'],
      batchSize: args.batch || 100,
      maxRatePerHour: args.rate || 1000,
      cacheFirst: args.cache !== false,
      dryRun: args.dryRun || false,

      metrics: {
        enabled: true
      },

      providers: {} // Will be populated based on sports
    });

    // Create agent dependencies
    const deps = {
      supabase: supabaseClient,
      logger
    };

    console.log('\n🤖 Initializing Cache-First FeedAgent...');

    // Create and initialize agent
    const agent = new FeedAgent(config, deps);

    await agent.start();

    // Monitor processing for 30 seconds in non-dry-run mode
    if (!args.dryRun) {
      console.log('\n📊 Processing Monitor (30s)...');

      const monitorInterval = setInterval(async () => {
        try {
          const health = await agent.checkHealth();
          const metrics = await agent.collectMetrics();
          const cacheMetrics = CacheFirstUnifiedPicksService.getInstance().getMetrics();

          console.log(`   Status: ${health.status} | Processed: ${metrics.successCount} | Errors: ${metrics.errorCount} | Cache Hit Ratio: ${cacheMetrics.hitRatio.toFixed(1)}%`);
        } catch (error) {
          console.log('   Monitor error:', error instanceof Error ? error.message : String(error));
        }
      }, 5000);

      // Stop monitoring after 30 seconds
      setTimeout(() => {
        clearInterval(monitorInterval);
        console.log('\n📈 Final Results:');

        agent.collectMetrics().then(finalMetrics => {
          console.log(`   Total Processed: ${finalMetrics.successCount}`);
          console.log(`   Total Errors: ${finalMetrics.errorCount}`);
          console.log(`   Processing Time: ${finalMetrics.processingTimeMs}ms`);
          console.log(`   Memory Usage: ${finalMetrics.memoryUsageMb.toFixed(1)}MB`);

          const cacheMetrics = CacheFirstUnifiedPicksService.getInstance().getMetrics();
          console.log(`   Cache Stats: L1 ${cacheMetrics.l1Hits} | L2 ${cacheMetrics.l2Hits} | L3 ${cacheMetrics.l3Hits} | Miss ${cacheMetrics.misses}`);
          console.log(`   Cache Hit Ratio: ${cacheMetrics.hitRatio.toFixed(1)}%`);
          console.log(`   Avg Response Time: ${cacheMetrics.avgResponseTime.toFixed(1)}ms`);
        }).finally(() => {
          console.log('\n✅ FeedAgent processing completed');
          process.exit(0);
        });
      }, 30000);

    } else {
      console.log('\n🏃‍♂️ Dry run completed successfully');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ FeedAgent runner failed:', error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n⚠️ Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}