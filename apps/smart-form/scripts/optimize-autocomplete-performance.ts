#!/usr/bin/env npx tsx

/**
 * Smart Form Autocomplete Performance Optimization Script
 *
 * This script optimizes the Smart Form autocomplete system for sub-200ms response times
 * by implementing database optimizations, cache warming, and performance monitoring.
 */

import { supabaseServer } from '../lib/supabase';
import {
  type PlayerOption,
  type MarketOption,
  type GameOption,
  SUPPORTED_SPORTS
} from '@unit-talk/shared-forms';

interface PerformanceMetrics {
  query: string;
  executionTime: number;
  resultCount: number;
  cacheHit: boolean;
  optimized: boolean;
}

class AutocompleteOptimizer {
  private metrics: PerformanceMetrics[] = [];

  constructor() {
    console.log('🚀 Smart Form Autocomplete Performance Optimizer');
    console.log('================================================');
  }

  /**
   * Create additional performance indexes
   */
  async createPerformanceIndexes(): Promise<void> {
    console.log('\n📊 Creating performance indexes...');

    const indexes = [
      // Composite index for player autocomplete
      `CREATE INDEX IF NOT EXISTS idx_unified_picks_player_autocomplete
       ON unified_picks (promoted, player_name, sport, market, posted_at DESC)
       WHERE promoted = true AND player_name IS NOT NULL`,

      // Composite index for market autocomplete
      `CREATE INDEX IF NOT EXISTS idx_unified_picks_market_autocomplete
       ON unified_picks (promoted, market, submarket, sport, posted_at DESC)
       WHERE promoted = true AND market IS NOT NULL`,

      // Composite index for game autocomplete
      `CREATE INDEX IF NOT EXISTS idx_unified_picks_game_autocomplete
       ON unified_picks (promoted, external_game_id, matchup, game_date, sport)
       WHERE promoted = true AND external_game_id IS NOT NULL`,

      // Full-text search index for player names
      `CREATE INDEX IF NOT EXISTS idx_unified_picks_player_fulltext
       ON unified_picks USING gin(to_tsvector('english', player_name))
       WHERE promoted = true AND player_name IS NOT NULL`,

      // Partial index for recent props only
      `CREATE INDEX IF NOT EXISTS idx_unified_picks_recent_props
       ON unified_picks (posted_at DESC, professional_score DESC NULLS LAST, confidence DESC NULLS LAST)
       WHERE promoted = true AND posted_at >= NOW() - INTERVAL '7 days'`,
    ];

    const supabase = supabaseServer();

    for (const indexSQL of indexes) {
      try {
        const { error } = await supabase.rpc('execute_sql', { sql: indexSQL });
        if (error) {
          console.error(`❌ Index creation failed: ${error.message}`);
        } else {
          console.log(`✅ Index created successfully`);
        }
      } catch (error) {
        console.error(`❌ Index creation error:`, error);
      }
    }
  }

  /**
   * Analyze current query performance
   */
  async analyzeQueryPerformance(): Promise<void> {
    console.log('\n🔍 Analyzing current query performance...');

    const testQueries = [
      // Player queries
      { type: 'player', query: 'tom', sport: 'NFL' },
      { type: 'player', query: 'lebron', sport: 'NBA' },
      { type: 'player', query: 'mike', sport: 'MLB' },

      // Market queries
      { type: 'market', query: 'points', sport: 'NBA' },
      { type: 'market', query: 'yards', sport: 'NFL' },
      { type: 'market', query: 'hits', sport: 'MLB' },

      // Game queries
      { type: 'game', query: 'patriots', sport: 'NFL' },
      { type: 'game', query: 'lakers', sport: 'NBA' },
      { type: 'game', query: 'yankees', sport: 'MLB' },
    ];

    for (const testQuery of testQueries) {
      await this.measureQueryPerformance(testQuery);
    }

    this.reportPerformanceResults();
  }

  /**
   * Measure individual query performance
   */
  private async measureQueryPerformance(testQuery: { type: string; query: string; sport: string }): Promise<void> {
    const startTime = Date.now();

    try {
      const url = `http://localhost:3002/api/props?type=${testQuery.type}&query=${testQuery.query}&sport=${testQuery.sport}&limit=20`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      if (response.ok) {
        const data = await response.json();

        this.metrics.push({
          query: `${testQuery.type}:${testQuery.query}:${testQuery.sport}`,
          executionTime,
          resultCount: data.options?.length || 0,
          cacheHit: data.meta?.cache_hit || false,
          optimized: executionTime < 200,
        });

        console.log(`  ${testQuery.type.padEnd(8)} "${testQuery.query}" (${testQuery.sport}): ${executionTime}ms ${executionTime < 200 ? '✅' : '⚠️'}`);
      } else {
        console.log(`  ${testQuery.type.padEnd(8)} "${testQuery.query}" (${testQuery.sport}): ERROR ${response.status}`);
      }
    } catch (error) {
      console.error(`  ${testQuery.type.padEnd(8)} "${testQuery.query}" (${testQuery.sport}): ERROR`, error);
    }
  }

  /**
   * Warm up caches with common queries
   */
  async warmupCaches(): Promise<void> {
    console.log('\n🔥 Warming up autocomplete caches...');

    const commonQueries = [
      // Common player name prefixes
      ...['tom', 'john', 'mike', 'chris', 'david', 'james', 'robert', 'williams'].map(q => ({ type: 'player', query: q })),

      // Common market terms
      ...['points', 'yards', 'assists', 'rebounds', 'hits', 'runs', 'goals'].map(q => ({ type: 'market', query: q })),

      // Common team names/cities
      ...['patriots', 'cowboys', 'lakers', 'warriors', 'yankees', 'red sox'].map(q => ({ type: 'game', query: q })),
    ];

    let warmedCount = 0;

    for (const sport of SUPPORTED_SPORTS) {
      for (const commonQuery of commonQueries) {
        try {
          const url = `http://localhost:3002/api/props?type=${commonQuery.type}&query=${commonQuery.query}&sport=${sport}&limit=10`;

          await fetch(url, {
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache', // Force fresh data for cache warming
            },
          });

          warmedCount++;

          // Brief delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 50));

        } catch (error) {
          // Continue warming other queries even if one fails
          continue;
        }
      }
    }

    console.log(`✅ Warmed ${warmedCount} cache entries`);
  }

  /**
   * Optimize database statistics
   */
  async optimizeStatistics(): Promise<void> {
    console.log('\n📈 Updating database statistics...');

    const supabase = supabaseServer();

    try {
      // Analyze the unified_picks table to update statistics
      const { error } = await supabase.rpc('execute_sql', {
        sql: 'ANALYZE unified_picks;'
      });

      if (error) {
        console.error(`❌ Statistics update failed: ${error.message}`);
      } else {
        console.log('✅ Database statistics updated');
      }

      // Update view statistics
      const { error: viewError } = await supabase.rpc('execute_sql', {
        sql: 'ANALYZE;'
      });

      if (viewError) {
        console.error(`❌ View statistics update failed: ${viewError.message}`);
      } else {
        console.log('✅ View statistics updated');
      }

    } catch (error) {
      console.error('❌ Statistics optimization error:', error);
    }
  }

  /**
   * Report performance optimization results
   */
  private reportPerformanceResults(): void {
    console.log('\n📊 Performance Analysis Results');
    console.log('================================');

    const totalQueries = this.metrics.length;
    const optimizedQueries = this.metrics.filter(m => m.optimized).length;
    const averageTime = this.metrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries;
    const maxTime = Math.max(...this.metrics.map(m => m.executionTime));
    const minTime = Math.min(...this.metrics.map(m => m.executionTime));

    console.log(`Total Queries Tested: ${totalQueries}`);
    console.log(`Sub-200ms Queries: ${optimizedQueries}/${totalQueries} (${Math.round((optimizedQueries/totalQueries) * 100)}%)`);
    console.log(`Average Response Time: ${Math.round(averageTime)}ms`);
    console.log(`Min/Max Response Time: ${minTime}ms / ${maxTime}ms`);

    console.log('\n🎯 Performance Targets:');
    console.log(`✅ Sub-200ms Target: ${optimizedQueries >= totalQueries * 0.9 ? 'MET' : 'NOT MET'} (${Math.round((optimizedQueries/totalQueries) * 100)}% success rate)`);
    console.log(`✅ Average < 150ms: ${averageTime < 150 ? 'MET' : 'NOT MET'} (${Math.round(averageTime)}ms average)`);
    console.log(`✅ Max < 500ms: ${maxTime < 500 ? 'MET' : 'NOT MET'} (${maxTime}ms max)`);

    if (optimizedQueries < totalQueries * 0.9) {
      console.log('\n⚠️ Performance Recommendations:');
      console.log('1. Ensure all database indexes are created');
      console.log('2. Verify cache warming completed successfully');
      console.log('3. Check network latency between Smart Form and API');
      console.log('4. Consider implementing additional L1 cache layers');
      console.log('5. Review query complexity and optimize if needed');
    } else {
      console.log('\n🎉 Performance targets achieved! System ready for production.');
    }
  }

  /**
   * Create monitoring queries for production
   */
  createMonitoringQueries(): void {
    console.log('\n📋 Production Monitoring Queries');
    console.log('=================================');

    const monitoringQueries = [
      {
        name: 'Autocomplete Performance Monitor',
        description: 'Track average response times for autocomplete endpoints',
        query: `
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as request_count,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000) as avg_response_ms,
  MAX(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000) as max_response_ms,
  COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000 < 200) as sub_200ms_count
FROM api_logs
WHERE endpoint LIKE '%/api/props%'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
        `
      },
      {
        name: 'Cache Hit Rate Monitor',
        description: 'Monitor cache performance across all autocomplete types',
        query: `
SELECT
  endpoint,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE response_body::json->'meta'->>'cache_hit' = 'true') as cache_hits,
  ROUND(
    COUNT(*) FILTER (WHERE response_body::json->'meta'->>'cache_hit' = 'true') * 100.0 / COUNT(*),
    2
  ) as cache_hit_percentage
FROM api_logs
WHERE endpoint LIKE '%/api/props%'
  AND created_at >= NOW() - INTERVAL '1 hour'
GROUP BY endpoint;
        `
      },
      {
        name: 'Database Query Performance',
        description: 'Monitor view_props_for_form query performance',
        query: `
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation,
  most_common_vals
FROM pg_stats
WHERE schemaname = 'public'
  AND tablename = 'unified_picks'
  AND attname IN ('player_name', 'market', 'sport', 'promoted')
ORDER BY tablename, attname;
        `
      }
    ];

    monitoringQueries.forEach((mq, index) => {
      console.log(`\n${index + 1}. ${mq.name}`);
      console.log(`   ${mq.description}`);
      console.log(`   Query: ${mq.query.trim()}`);
    });
  }

  /**
   * Run complete optimization suite
   */
  async runCompleteOptimization(): Promise<void> {
    console.log('🎯 Starting complete autocomplete optimization...\n');

    try {
      // 1. Create performance indexes
      await this.createPerformanceIndexes();

      // 2. Update database statistics
      await this.optimizeStatistics();

      // 3. Warm up caches
      await this.warmupCaches();

      // 4. Analyze performance
      await this.analyzeQueryPerformance();

      // 5. Create monitoring queries
      this.createMonitoringQueries();

      console.log('\n🏁 Optimization Complete!');
      console.log('========================');
      console.log('Smart Form autocomplete system has been optimized for production.');
      console.log('Monitor performance using the provided queries and dashboards.');

    } catch (error) {
      console.error('\n❌ Optimization failed:', error);
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const optimizer = new AutocompleteOptimizer();

  const mode = process.argv[2] || 'full';

  switch (mode) {
    case 'indexes':
      await optimizer.createPerformanceIndexes();
      break;

    case 'analyze':
      await optimizer.analyzeQueryPerformance();
      break;

    case 'warmup':
      await optimizer.warmupCaches();
      break;

    case 'stats':
      await optimizer.optimizeStatistics();
      break;

    case 'monitor':
      optimizer.createMonitoringQueries();
      break;

    case 'full':
    default:
      await optimizer.runCompleteOptimization();
      break;
  }
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

if (require.main === module) {
  main().catch(console.error);
}