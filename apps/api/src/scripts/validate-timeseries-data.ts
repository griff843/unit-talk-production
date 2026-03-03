#!/usr/bin/env tsx

/**
 * Time-Series Data Validator
 *
 * Purpose: Validate quality of time-series data from continuous polling
 * Checks: Polling intervals, gaps, data completeness, consistency
 *
 * Usage: npx tsx src/scripts/validate-timeseries-data.ts
 */

import { Client } from 'pg';

interface TimeSeriesQuality {
  propGroup: string;
  playerName: string;
  sport: string;
  snapshotCount: number;
  firstSnapshot: Date;
  lastSnapshot: Date;
  timespanMinutes: number;
  expectedSnapshots: number;
  actualSnapshots: number;
  completeness: number; // percentage
  averageInterval: number; // seconds
  minInterval: number;
  maxInterval: number;
  intervalStdDev: number;
  gaps: number; // intervals >120 seconds
  reliability: number; // percentage
}

interface ValidationReport {
  overallStats: {
    totalProps: number;
    totalSnapshots: number;
    averageReliability: number;
    goodQuality: number; // >90% reliability
    mediumQuality: number; // 75-90%
    poorQuality: number; // <75%
  };
  pollingHealth: {
    expectedInterval: number; // target 60 seconds
    actualAverageInterval: number;
    intervalVariance: number;
    gapsDetected: number;
    uptime: number; // percentage
  };
  recommendations: string[];
  qualityMetrics: TimeSeriesQuality[];
}

async function validateTimeSeriesData(): Promise<void> {
  // Use Supabase pooler URL (production database)
  const connectionString =
    process.env.DATABASE_POOLER_URL ||
    'postgresql://postgres.cqfnsozknjzvyiziwicl:Adalise843!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require';

  const client = new Client({
    connectionString,
    ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Query time-series data grouped by prop
    const query = `
      WITH prop_snapshots AS (
        SELECT
          CONCAT(player_name, '|', sport, '|', stat_type, '|', source) as prop_group,
          player_name,
          sport,
          stat_type,
          source,
          created_at,
          LAG(created_at) OVER (
            PARTITION BY player_name, sport, stat_type, source
            ORDER BY created_at
          ) as prev_snapshot
        FROM raw_props
        WHERE
          player_name IS NOT NULL
          AND created_at >= NOW() - INTERVAL '24 hours'
      ),
      intervals AS (
        SELECT
          prop_group,
          player_name,
          sport,
          created_at,
          EXTRACT(EPOCH FROM (created_at - prev_snapshot)) as interval_seconds
        FROM prop_snapshots
        WHERE prev_snapshot IS NOT NULL
      ),
      aggregated AS (
        SELECT
          prop_group,
          player_name,
          sport,
          COUNT(*) + 1 as snapshot_count,
          MIN(created_at) as first_snapshot,
          MAX(created_at) as last_snapshot,
          AVG(interval_seconds) as avg_interval,
          MIN(interval_seconds) as min_interval,
          MAX(interval_seconds) as max_interval,
          STDDEV(interval_seconds) as stddev_interval,
          COUNT(*) FILTER (WHERE interval_seconds > 120) as gap_count
        FROM intervals
        GROUP BY prop_group, player_name, sport
      )
      SELECT
        prop_group,
        player_name,
        sport,
        snapshot_count,
        first_snapshot,
        last_snapshot,
        EXTRACT(EPOCH FROM (last_snapshot - first_snapshot)) / 60 as timespan_minutes,
        avg_interval,
        min_interval,
        max_interval,
        stddev_interval,
        gap_count
      FROM aggregated
      WHERE snapshot_count > 1
      ORDER BY snapshot_count DESC, gap_count ASC
    `;

    const result = await client.query(query);
    const timeSeriesData: TimeSeriesQuality[] = result.rows.map(row => {
      const timespanMinutes = parseFloat(row.timespan_minutes);
      const expectedSnapshots = Math.floor(timespanMinutes); // 1 per minute ideally
      const actualSnapshots = parseInt(row.snapshot_count);
      const completeness = expectedSnapshots > 0 ? (actualSnapshots / expectedSnapshots) * 100 : 0;
      const avgInterval = parseFloat(row.avg_interval);
      const reliability = avgInterval > 0 ? Math.min(100, (60 / avgInterval) * 100) : 0;

      return {
        propGroup: row.prop_group,
        playerName: row.player_name,
        sport: row.sport,
        snapshotCount: actualSnapshots,
        firstSnapshot: new Date(row.first_snapshot),
        lastSnapshot: new Date(row.last_snapshot),
        timespanMinutes,
        expectedSnapshots,
        actualSnapshots,
        completeness: Math.min(100, completeness),
        averageInterval: avgInterval,
        minInterval: parseFloat(row.min_interval),
        maxInterval: parseFloat(row.max_interval),
        intervalStdDev: parseFloat(row.stddev_interval) || 0,
        gaps: parseInt(row.gap_count),
        reliability: Math.min(100, reliability),
      };
    });

    // Generate validation report
    const report = generateValidationReport(timeSeriesData);

    // Output results
    console.log('\n' + '='.repeat(80));
    console.log('⏱️  TIME-SERIES DATA VALIDATION REPORT');
    console.log('='.repeat(80));
    console.log(`Generated: ${new Date().toISOString()}`);
    console.log(`Time Window: Last 24 hours`);
    console.log('='.repeat(80));

    printOverallStats(report.overallStats);
    printPollingHealth(report.pollingHealth);
    printQualityBreakdown(timeSeriesData);
    printRecommendations(report.recommendations);

    // Save to file
    const outputPath =
      'C:\\Users\\griff\\OneDrive\\Desktop\\unit-talk-production-main\\apps\\api\\out\\ops\\timeseries-validation.json';
    const fs = require('fs');
    const output = {
      generatedAt: new Date().toISOString(),
      report,
      detailedMetrics: timeSeriesData,
    };
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n💾 Full report saved to: ${outputPath}`);

    // Exit code based on quality
    if (report.overallStats.averageReliability < 75) {
      console.log('\n⚠️  WARNING: Data quality below acceptable threshold');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error validating time-series data:', error);
    throw error;
  } finally {
    await client.end();
  }
}

function generateValidationReport(data: TimeSeriesQuality[]): ValidationReport {
  if (data.length === 0) {
    return {
      overallStats: {
        totalProps: 0,
        totalSnapshots: 0,
        averageReliability: 0,
        goodQuality: 0,
        mediumQuality: 0,
        poorQuality: 0,
      },
      pollingHealth: {
        expectedInterval: 60,
        actualAverageInterval: 0,
        intervalVariance: 0,
        gapsDetected: 0,
        uptime: 0,
      },
      recommendations: [
        'No time-series data available yet',
        'Start the continuous poller and wait 5-10 minutes',
      ],
      qualityMetrics: [],
    };
  }

  const totalSnapshots = data.reduce((sum, d) => sum + d.snapshotCount, 0);
  const averageReliability = data.reduce((sum, d) => sum + d.reliability, 0) / data.length;
  const goodQuality = data.filter(d => d.reliability >= 90).length;
  const mediumQuality = data.filter(d => d.reliability >= 75 && d.reliability < 90).length;
  const poorQuality = data.filter(d => d.reliability < 75).length;

  const totalIntervals = data.reduce((sum, d) => sum + (d.snapshotCount - 1), 0);
  const avgInterval =
    data.reduce((sum, d) => sum + d.averageInterval * (d.snapshotCount - 1), 0) / totalIntervals;
  const totalGaps = data.reduce((sum, d) => sum + d.gaps, 0);
  const intervalVariance = Math.sqrt(
    data.reduce((sum, d) => sum + Math.pow(d.intervalStdDev, 2), 0) / data.length
  );
  const uptime = totalIntervals > 0 ? ((totalIntervals - totalGaps) / totalIntervals) * 100 : 0;

  const recommendations: string[] = [];
  if (averageReliability < 75) {
    recommendations.push('⚠️  CRITICAL: Polling reliability below 75% - investigate poller issues');
  }
  if (avgInterval > 90) {
    recommendations.push('⚠️  WARNING: Average interval >90s - poller may be running slow');
  }
  if (totalGaps > totalIntervals * 0.1) {
    recommendations.push('⚠️  WARNING: >10% gaps detected - check for API throttling or failures');
  }
  if (intervalVariance > 30) {
    recommendations.push('⚠️  High interval variance - polling may be inconsistent');
  }
  if (averageReliability >= 90 && totalGaps === 0) {
    recommendations.push('✅ EXCELLENT: Data quality is excellent');
  }
  if (data.length < 10) {
    recommendations.push('ℹ️  Low sample size - continue polling to improve reliability estimates');
  }

  return {
    overallStats: {
      totalProps: data.length,
      totalSnapshots,
      averageReliability,
      goodQuality,
      mediumQuality,
      poorQuality,
    },
    pollingHealth: {
      expectedInterval: 60,
      actualAverageInterval: avgInterval,
      intervalVariance,
      gapsDetected: totalGaps,
      uptime,
    },
    recommendations,
    qualityMetrics: data,
  };
}

function printOverallStats(stats: ValidationReport['overallStats']): void {
  console.log('\n📊 OVERALL STATISTICS');
  console.log('-'.repeat(80));
  console.log(`Total Props Tracked: ${stats.totalProps}`);
  console.log(`Total Snapshots: ${stats.totalSnapshots}`);
  console.log(`Average Reliability: ${stats.averageReliability.toFixed(2)}%`);
  console.log('\nQuality Distribution:');
  console.log(
    `  ✅ Good (≥90%):   ${stats.goodQuality} props (${((stats.goodQuality / stats.totalProps) * 100).toFixed(1)}%)`
  );
  console.log(
    `  ⚠️  Medium (75-90%): ${stats.mediumQuality} props (${((stats.mediumQuality / stats.totalProps) * 100).toFixed(1)}%)`
  );
  console.log(
    `  ❌ Poor (<75%):   ${stats.poorQuality} props (${((stats.poorQuality / stats.totalProps) * 100).toFixed(1)}%)`
  );
}

function printPollingHealth(health: ValidationReport['pollingHealth']): void {
  console.log('\n⏱️  POLLING HEALTH');
  console.log('-'.repeat(80));
  console.log(`Expected Interval: ${health.expectedInterval}s`);
  console.log(`Actual Average Interval: ${health.actualAverageInterval.toFixed(2)}s`);
  console.log(`Interval Variance: ±${health.intervalVariance.toFixed(2)}s`);
  console.log(`Gaps Detected (>120s): ${health.gapsDetected}`);
  console.log(`Uptime: ${health.uptime.toFixed(2)}%`);

  // Color-coded status
  const status =
    health.uptime >= 95
      ? '✅ EXCELLENT'
      : health.uptime >= 85
        ? '⚠️  GOOD'
        : health.uptime >= 75
          ? '⚠️  FAIR'
          : '❌ POOR';
  console.log(`Status: ${status}`);
}

function printQualityBreakdown(data: TimeSeriesQuality[]): void {
  console.log('\n📈 TOP 10 MOST RELIABLE PROPS');
  console.log('-'.repeat(80));

  if (data.length === 0) {
    console.log('  No data available yet.');
    return;
  }

  const topReliable = [...data].sort((a, b) => b.reliability - a.reliability).slice(0, 10);
  topReliable.forEach((prop, idx) => {
    const status = prop.reliability >= 95 ? '✅' : prop.reliability >= 85 ? '⚠️' : '❌';
    console.log(`${idx + 1}. ${status} ${prop.playerName} (${prop.sport})`);
    console.log(
      `   Snapshots: ${prop.snapshotCount}, Avg Interval: ${prop.averageInterval.toFixed(1)}s, Reliability: ${prop.reliability.toFixed(1)}%`
    );
    console.log(`   Gaps: ${prop.gaps}, Timespan: ${prop.timespanMinutes.toFixed(1)} min`);
  });

  if (data.some(d => d.reliability < 75)) {
    console.log('\n⚠️  PROPS WITH POOR RELIABILITY (<75%)');
    console.log('-'.repeat(80));
    const poorReliable = data.filter(d => d.reliability < 75).slice(0, 5);
    poorReliable.forEach((prop, idx) => {
      console.log(`${idx + 1}. ❌ ${prop.playerName} (${prop.sport})`);
      console.log(
        `   Reliability: ${prop.reliability.toFixed(1)}%, Gaps: ${prop.gaps}, Avg Interval: ${prop.averageInterval.toFixed(1)}s`
      );
    });
  }
}

function printRecommendations(recommendations: string[]): void {
  console.log('\n💡 RECOMMENDATIONS');
  console.log('-'.repeat(80));
  recommendations.forEach(rec => {
    console.log(`  ${rec}`);
  });
}

// Main execution
if (require.main === module) {
  validateTimeSeriesData()
    .then(() => {
      console.log('\n✅ Time-series validation complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

export { validateTimeSeriesData };
