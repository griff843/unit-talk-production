#!/usr/bin/env tsx

/**
 * Real-Time Stats Dashboard
 *
 * Purpose: Live monitoring of polling system with auto-refresh
 * Shows: Total polls, API calls, line changes, props with movement
 * Updates: Every 60 seconds (configurable)
 *
 * Usage: npx tsx src/scripts/live-stats-dashboard.ts [--interval=60]
 */

import { Client } from 'pg';

interface DashboardStats {
  timestamp: Date;
  polling: {
    totalProps: number;
    uniqueProps: number;
    propsWithMovement: number;
    movementPercentage: number;
    totalSnapshots: number;
    averageSnapshotsPerProp: number;
  };
  lineChanges: {
    last5min: number;
    last15min: number;
    last60min: number;
    totalToday: number;
  };
  quality: {
    averageInterval: number;
    gapsDetected: number;
    reliability: number;
  };
  breakdown: {
    bySport: Record<string, number>;
    byBookmaker: Record<string, number>;
  };
  topMovers: Array<{
    playerName: string;
    sport: string;
    lineMovement: number;
    snapshotCount: number;
  }>;
}

let previousStats: DashboardStats | null = null;

async function fetchDashboardStats(client: Client): Promise<DashboardStats> {
  // Main stats query
  const mainQuery = `
    WITH prop_snapshots AS (
      SELECT
        CONCAT(player_name, '|', sport, '|', stat_type, '|', source) as prop_group,
        player_name,
        sport,
        source,
        COUNT(*) as snapshot_count,
        (ARRAY_AGG(line ORDER BY created_at))[1] as first_line,
        (ARRAY_AGG(line ORDER BY created_at DESC))[1] as last_line
      FROM raw_props
      WHERE
        player_name IS NOT NULL
        AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY player_name, sport, stat_type, source
    )
    SELECT
      COUNT(*) as total_unique_props,
      SUM(snapshot_count) as total_snapshots,
      COUNT(*) FILTER (WHERE snapshot_count > 1) as props_with_multiple_snapshots,
      COUNT(*) FILTER (WHERE snapshot_count > 1 AND first_line != last_line) as props_with_movement,
      AVG(snapshot_count) as avg_snapshots
    FROM prop_snapshots
  `;

  const mainResult = await client.query(mainQuery);
  const mainStats = mainResult.rows[0];

  // Line changes by time period
  const changesQuery = `
    WITH prop_snapshots AS (
      SELECT
        CONCAT(player_name, '|', sport, '|', stat_type, '|', source) as prop_group,
        COUNT(*) as snapshot_count,
        (ARRAY_AGG(line ORDER BY created_at))[1] as first_line,
        (ARRAY_AGG(line ORDER BY created_at DESC))[1] as last_line,
        MAX(created_at) as last_snapshot
      FROM raw_props
      WHERE
        player_name IS NOT NULL
        AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY player_name, sport, stat_type, source
    )
    SELECT
      COUNT(*) FILTER (
        WHERE snapshot_count > 1
          AND first_line != last_line
          AND last_snapshot >= NOW() - INTERVAL '5 minutes'
      ) as changes_5min,
      COUNT(*) FILTER (
        WHERE snapshot_count > 1
          AND first_line != last_line
          AND last_snapshot >= NOW() - INTERVAL '15 minutes'
      ) as changes_15min,
      COUNT(*) FILTER (
        WHERE snapshot_count > 1
          AND first_line != last_line
          AND last_snapshot >= NOW() - INTERVAL '60 minutes'
      ) as changes_60min,
      COUNT(*) FILTER (
        WHERE snapshot_count > 1
          AND first_line != last_line
      ) as changes_today
    FROM prop_snapshots
  `;

  const changesResult = await client.query(changesQuery);
  const changesStats = changesResult.rows[0];

  // Quality metrics
  const qualityQuery = `
    WITH intervals AS (
      SELECT
        created_at,
        LAG(created_at) OVER (ORDER BY created_at) as prev_created_at
      FROM (
        SELECT DISTINCT created_at
        FROM raw_props
        WHERE created_at >= NOW() - INTERVAL '1 hour'
        ORDER BY created_at
      ) t
    )
    SELECT
      AVG(EXTRACT(EPOCH FROM (created_at - prev_created_at))) as avg_interval,
      COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (created_at - prev_created_at)) > 120) as gap_count,
      COUNT(*) as total_intervals
    FROM intervals
    WHERE prev_created_at IS NOT NULL
  `;

  const qualityResult = await client.query(qualityQuery);
  const qualityStats = qualityResult.rows[0];

  // Breakdown by sport and bookmaker
  const breakdownQuery = `
    SELECT
      sport,
      source as bookmaker,
      COUNT(DISTINCT CONCAT(player_name, '|', sport, '|', stat_type, '|', source)) as prop_count
    FROM raw_props
    WHERE
      player_name IS NOT NULL
      AND created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY sport, source
  `;

  const breakdownResult = await client.query(breakdownQuery);
  const bySport: Record<string, number> = {};
  const byBookmaker: Record<string, number> = {};

  breakdownResult.rows.forEach(row => {
    bySport[row.sport] = (bySport[row.sport] || 0) + parseInt(row.prop_count);
    byBookmaker[row.bookmaker] = (byBookmaker[row.bookmaker] || 0) + parseInt(row.prop_count);
  });

  // Top movers
  const moversQuery = `
    WITH prop_snapshots AS (
      SELECT
        player_name,
        sport,
        COUNT(*) as snapshot_count,
        (ARRAY_AGG(line ORDER BY created_at))[1] as first_line,
        (ARRAY_AGG(line ORDER BY created_at DESC))[1] as last_line
      FROM raw_props
      WHERE
        player_name IS NOT NULL
        AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY player_name, sport, stat_type, source
    )
    SELECT
      player_name,
      sport,
      (last_line - first_line) as line_movement,
      snapshot_count
    FROM prop_snapshots
    WHERE snapshot_count > 1 AND first_line != last_line
    ORDER BY ABS(last_line - first_line) DESC
    LIMIT 5
  `;

  const moversResult = await client.query(moversQuery);
  const topMovers = moversResult.rows.map(row => ({
    playerName: row.player_name,
    sport: row.sport,
    lineMovement: parseFloat(row.line_movement),
    snapshotCount: parseInt(row.snapshot_count),
  }));

  const totalProps = parseInt(mainStats.total_snapshots) || 0;
  const uniqueProps = parseInt(mainStats.total_unique_props) || 0;
  const propsWithMovement = parseInt(mainStats.props_with_movement) || 0;
  const movementPercentage = uniqueProps > 0 ? (propsWithMovement / uniqueProps) * 100 : 0;

  const avgInterval = parseFloat(qualityStats.avg_interval) || 0;
  const gapsDetected = parseInt(qualityStats.gap_count) || 0;
  const totalIntervals = parseInt(qualityStats.total_intervals) || 0;
  const reliability =
    totalIntervals > 0 ? ((totalIntervals - gapsDetected) / totalIntervals) * 100 : 0;

  return {
    timestamp: new Date(),
    polling: {
      totalProps,
      uniqueProps,
      propsWithMovement,
      movementPercentage,
      totalSnapshots: totalProps,
      averageSnapshotsPerProp: parseFloat(mainStats.avg_snapshots) || 0,
    },
    lineChanges: {
      last5min: parseInt(changesStats.changes_5min) || 0,
      last15min: parseInt(changesStats.changes_15min) || 0,
      last60min: parseInt(changesStats.changes_60min) || 0,
      totalToday: parseInt(changesStats.changes_today) || 0,
    },
    quality: {
      averageInterval: avgInterval,
      gapsDetected,
      reliability,
    },
    breakdown: {
      bySport,
      byBookmaker,
    },
    topMovers,
  };
}

function displayDashboard(stats: DashboardStats): void {
  // Clear console (cross-platform)
  console.clear();

  console.log('\n' + '='.repeat(80));
  console.log('📊 LIVE STATS DASHBOARD - Unit Talk Polling System');
  console.log('='.repeat(80));
  console.log(`Last Updated: ${stats.timestamp.toLocaleString()}`);
  console.log('='.repeat(80));

  // Polling Stats
  console.log('\n📡 POLLING STATISTICS');
  console.log('-'.repeat(80));
  console.log(`Total Snapshots:     ${stats.polling.totalSnapshots.toLocaleString()}`);
  console.log(`Unique Props:        ${stats.polling.uniqueProps.toLocaleString()}`);
  console.log(
    `Props with Movement: ${stats.polling.propsWithMovement.toLocaleString()} (${stats.polling.movementPercentage.toFixed(1)}%)`
  );
  console.log(`Avg Snapshots/Prop:  ${stats.polling.averageSnapshotsPerProp.toFixed(1)}`);

  // Change indicator
  if (previousStats) {
    const propDelta = stats.polling.totalSnapshots - previousStats.polling.totalSnapshots;
    const movementDelta = stats.polling.propsWithMovement - previousStats.polling.propsWithMovement;
    console.log(`\n📈 Since last update: +${propDelta} snapshots, +${movementDelta} movements`);
  }

  // Line Changes
  console.log('\n🔥 LINE CHANGES DETECTED');
  console.log('-'.repeat(80));
  console.log(`Last 5 minutes:  ${stats.lineChanges.last5min}`);
  console.log(`Last 15 minutes: ${stats.lineChanges.last15min}`);
  console.log(`Last 60 minutes: ${stats.lineChanges.last60min}`);
  console.log(`Total today:     ${stats.lineChanges.totalToday}`);

  // Quality Metrics
  const qualityStatus =
    stats.quality.reliability >= 90 ? '✅' : stats.quality.reliability >= 75 ? '⚠️' : '❌';
  console.log('\n⏱️  DATA QUALITY');
  console.log('-'.repeat(80));
  console.log(`Average Interval: ${stats.quality.averageInterval.toFixed(1)}s (target: 60s)`);
  console.log(`Gaps Detected:    ${stats.quality.gapsDetected}`);
  console.log(`Reliability:      ${qualityStatus} ${stats.quality.reliability.toFixed(1)}%`);

  // Sport Breakdown
  console.log('\n🏈 BY SPORT');
  console.log('-'.repeat(80));
  Object.entries(stats.breakdown.bySport)
    .sort((a, b) => b[1] - a[1])
    .forEach(([sport, count]) => {
      console.log(`  ${sport.padEnd(15)}: ${count.toLocaleString()} props`);
    });

  // Bookmaker Breakdown
  console.log('\n🏢 BY BOOKMAKER');
  console.log('-'.repeat(80));
  Object.entries(stats.breakdown.byBookmaker)
    .sort((a, b) => b[1] - a[1])
    .forEach(([bookmaker, count]) => {
      console.log(`  ${bookmaker.padEnd(15)}: ${count.toLocaleString()} props`);
    });

  // Top Movers
  console.log('\n🔥 TOP 5 LINE MOVERS');
  console.log('-'.repeat(80));
  if (stats.topMovers.length === 0) {
    console.log('  No line movements detected yet.');
    console.log('  (Waiting for multiple snapshots of same prop)');
  } else {
    stats.topMovers.forEach((mover, idx) => {
      const direction = mover.lineMovement > 0 ? '📈' : '📉';
      console.log(`${idx + 1}. ${direction} ${mover.playerName} (${mover.sport})`);
      console.log(
        `   Movement: ${mover.lineMovement > 0 ? '+' : ''}${mover.lineMovement.toFixed(2)} | Snapshots: ${mover.snapshotCount}`
      );
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('Press Ctrl+C to exit | Updates every 60 seconds');
  console.log('='.repeat(80));
}

async function runDashboard(intervalSeconds: number = 60): Promise<void> {
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
    console.log('📊 Starting live dashboard...\n');

    // Initial fetch
    const stats = await fetchDashboardStats(client);
    displayDashboard(stats);
    previousStats = stats;

    // Auto-refresh every interval
    setInterval(async () => {
      try {
        const stats = await fetchDashboardStats(client);
        displayDashboard(stats);
        previousStats = stats;
      } catch (error) {
        console.error('❌ Error fetching stats:', error);
      }
    }, intervalSeconds * 1000);
  } catch (error) {
    console.error('❌ Error starting dashboard:', error);
    throw error;
  }
  // Note: Don't close client, keep connection open for continuous monitoring
}

// Parse command line arguments
const args = process.argv.slice(2);
const intervalArg = args.find(arg => arg.startsWith('--interval='));
const intervalSeconds = intervalArg ? parseInt(intervalArg.split('=')[1]) : 60;

// Main execution
if (require.main === module) {
  console.log(`Starting dashboard with ${intervalSeconds}s refresh interval...`);
  runDashboard(intervalSeconds).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Dashboard stopped');
    process.exit(0);
  });
}

export { runDashboard };
