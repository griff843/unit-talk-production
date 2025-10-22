#!/usr/bin/env tsx

/**
 * Line Change Monitor Script
 *
 * Purpose: Detect and report line movements from time-series data
 * Tracks: Props with multiple snapshots, line changes, velocity
 *
 * Usage: npx tsx src/scripts/monitor-line-changes.ts
 */

import { Client } from 'pg';

interface LineChangeStats {
  propGroup: string;
  playerName: string;
  sport: string;
  statType: string;
  bookmaker: string;
  snapshotCount: number;
  firstLine: number;
  lastLine: number;
  lineMovement: number;
  firstOdds: { over: number; under: number };
  lastOdds: { over: number; under: number };
  firstSnapshot: Date;
  lastSnapshot: Date;
  timespanSeconds: number;
  externalPropIds: string[];
}

interface MonitoringSummary {
  totalProps: number;
  propsWithMovement: number;
  totalSnapshots: number;
  averageSnapshotsPerProp: number;
  topMovers: LineChangeStats[];
  bySport: Record<string, number>;
  byBookmaker: Record<string, number>;
}

async function monitorLineChanges(): Promise<void> {
  // Use Supabase pooler URL (production database)
  const connectionString = process.env.DATABASE_POOLER_URL ||
    'postgresql://postgres.lxqmuzmqtnnlpfapvief:Adalise843!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require';

  const client = new Client({
    connectionString,
    ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Query to group props and detect line changes
    const query = `
      WITH prop_groups AS (
        SELECT
          player_name,
          sport,
          stat_type,
          source as bookmaker,
          CONCAT(player_name, '|', sport, '|', stat_type, '|', source) as prop_group,
          COUNT(*) as snapshot_count,
          ARRAY_AGG(external_prop_id ORDER BY created_at) as external_prop_ids,

          -- First snapshot
          (ARRAY_AGG(line ORDER BY created_at))[1] as first_line,
          (ARRAY_AGG(over_odds ORDER BY created_at))[1] as first_over_odds,
          (ARRAY_AGG(under_odds ORDER BY created_at))[1] as first_under_odds,
          MIN(created_at) as first_snapshot,

          -- Last snapshot
          (ARRAY_AGG(line ORDER BY created_at DESC))[1] as last_line,
          (ARRAY_AGG(over_odds ORDER BY created_at DESC))[1] as last_over_odds,
          (ARRAY_AGG(under_odds ORDER BY created_at DESC))[1] as last_under_odds,
          MAX(created_at) as last_snapshot
        FROM raw_props
        WHERE
          player_name IS NOT NULL
          AND line IS NOT NULL
          AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY player_name, sport, stat_type, source
      )
      SELECT
        prop_group,
        player_name,
        sport,
        stat_type,
        bookmaker,
        snapshot_count,
        first_line,
        last_line,
        (last_line - first_line) as line_movement,
        first_over_odds,
        first_under_odds,
        last_over_odds,
        last_under_odds,
        first_snapshot,
        last_snapshot,
        EXTRACT(EPOCH FROM (last_snapshot - first_snapshot)) as timespan_seconds,
        external_prop_ids
      FROM prop_groups
      WHERE snapshot_count > 1
      ORDER BY ABS(last_line - first_line) DESC, snapshot_count DESC
      LIMIT 100
    `;

    const result = await client.query(query);
    const lineChanges: LineChangeStats[] = result.rows.map((row) => ({
      propGroup: row.prop_group,
      playerName: row.player_name,
      sport: row.sport,
      statType: row.stat_type,
      bookmaker: row.bookmaker,
      snapshotCount: parseInt(row.snapshot_count),
      firstLine: parseFloat(row.first_line),
      lastLine: parseFloat(row.last_line),
      lineMovement: parseFloat(row.line_movement),
      firstOdds: {
        over: parseInt(row.first_over_odds),
        under: parseInt(row.first_under_odds),
      },
      lastOdds: {
        over: parseInt(row.last_over_odds),
        under: parseInt(row.last_under_odds),
      },
      firstSnapshot: new Date(row.first_snapshot),
      lastSnapshot: new Date(row.last_snapshot),
      timespanSeconds: parseFloat(row.timespan_seconds),
      externalPropIds: row.external_prop_ids,
    }));

    // Generate summary statistics
    const summary = generateSummary(lineChanges);

    // Output results
    console.log('\n' + '='.repeat(80));
    console.log('📊 LINE MOVEMENT MONITORING REPORT');
    console.log('='.repeat(80));
    console.log(`Generated: ${new Date().toISOString()}`);
    console.log(`Time Window: Last 24 hours`);
    console.log('='.repeat(80));

    printSummary(summary);
    printTopMovers(lineChanges.slice(0, 10));
    printDetailedStats(lineChanges);

    // Save to file
    const outputPath = 'C:\\Users\\griff\\OneDrive\\Desktop\\unit-talk-production-main\\apps\\api\\out\\ops\\line-changes-monitor.json';
    const fs = require('fs');
    const output = {
      generatedAt: new Date().toISOString(),
      summary,
      topMovers: lineChanges.slice(0, 20),
      allChanges: lineChanges,
    };
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n💾 Full report saved to: ${outputPath}`);

  } catch (error) {
    console.error('❌ Error monitoring line changes:', error);
    throw error;
  } finally {
    await client.end();
  }
}

function generateSummary(lineChanges: LineChangeStats[]): MonitoringSummary {
  const totalSnapshots = lineChanges.reduce((sum, lc) => sum + lc.snapshotCount, 0);
  const bySport: Record<string, number> = {};
  const byBookmaker: Record<string, number> = {};

  lineChanges.forEach((lc) => {
    bySport[lc.sport] = (bySport[lc.sport] || 0) + 1;
    byBookmaker[lc.bookmaker] = (byBookmaker[lc.bookmaker] || 0) + 1;
  });

  return {
    totalProps: lineChanges.length,
    propsWithMovement: lineChanges.filter((lc) => lc.lineMovement !== 0).length,
    totalSnapshots,
    averageSnapshotsPerProp: lineChanges.length > 0 ? totalSnapshots / lineChanges.length : 0,
    topMovers: lineChanges.slice(0, 5),
    bySport,
    byBookmaker,
  };
}

function printSummary(summary: MonitoringSummary): void {
  console.log('\n📈 SUMMARY STATISTICS');
  console.log('-'.repeat(80));
  console.log(`Total Props with Multiple Snapshots: ${summary.totalProps}`);
  console.log(`Props with Line Movement: ${summary.propsWithMovement}`);
  console.log(`Total Snapshots Captured: ${summary.totalSnapshots}`);
  console.log(`Average Snapshots per Prop: ${summary.averageSnapshotsPerProp.toFixed(2)}`);

  console.log('\n📊 BY SPORT:');
  Object.entries(summary.bySport)
    .sort((a, b) => b[1] - a[1])
    .forEach(([sport, count]) => {
      console.log(`  ${sport.padEnd(15)}: ${count} props`);
    });

  console.log('\n🏢 BY BOOKMAKER:');
  Object.entries(summary.byBookmaker)
    .sort((a, b) => b[1] - a[1])
    .forEach(([bookmaker, count]) => {
      console.log(`  ${bookmaker.padEnd(15)}: ${count} props`);
    });
}

function printTopMovers(topMovers: LineChangeStats[]): void {
  console.log('\n🔥 TOP 10 LINE MOVERS');
  console.log('-'.repeat(80));

  if (topMovers.length === 0) {
    console.log('  No line movements detected yet.');
    console.log('  (Need multiple snapshots of the same prop)');
    return;
  }

  topMovers.forEach((mover, idx) => {
    const direction = mover.lineMovement > 0 ? '📈' : '📉';
    const velocity = mover.timespanSeconds > 0
      ? (Math.abs(mover.lineMovement) / (mover.timespanSeconds / 3600)).toFixed(4)
      : 'N/A';

    console.log(`\n${idx + 1}. ${direction} ${mover.playerName} - ${mover.sport} ${mover.statType}`);
    console.log(`   Bookmaker: ${mover.bookmaker}`);
    console.log(`   Line: ${mover.firstLine} → ${mover.lastLine} (${mover.lineMovement > 0 ? '+' : ''}${mover.lineMovement})`);
    console.log(`   Odds: O${mover.firstOdds.over}/U${mover.firstOdds.under} → O${mover.lastOdds.over}/U${mover.lastOdds.under}`);
    console.log(`   Snapshots: ${mover.snapshotCount} over ${(mover.timespanSeconds / 60).toFixed(1)} minutes`);
    console.log(`   Velocity: ${velocity} points/hour`);
  });
}

function printDetailedStats(lineChanges: LineChangeStats[]): void {
  console.log('\n📊 DETAILED STATISTICS');
  console.log('-'.repeat(80));

  if (lineChanges.length === 0) {
    console.log('  No data available yet.');
    console.log('  Start the continuous poller and check back in 5-10 minutes.');
    return;
  }

  // Calculate statistics
  const movements = lineChanges.map((lc) => Math.abs(lc.lineMovement)).filter((m) => m > 0);
  const snapshots = lineChanges.map((lc) => lc.snapshotCount);
  const timespans = lineChanges.map((lc) => lc.timespanSeconds);

  const avgMovement = movements.length > 0 ? movements.reduce((a, b) => a + b, 0) / movements.length : 0;
  const maxMovement = movements.length > 0 ? Math.max(...movements) : 0;
  const avgSnapshots = snapshots.reduce((a, b) => a + b, 0) / snapshots.length;
  const maxSnapshots = Math.max(...snapshots);
  const avgTimespan = timespans.reduce((a, b) => a + b, 0) / timespans.length;

  console.log(`Average Line Movement: ${avgMovement.toFixed(3)} points`);
  console.log(`Maximum Line Movement: ${maxMovement.toFixed(3)} points`);
  console.log(`Average Snapshots per Prop: ${avgSnapshots.toFixed(1)}`);
  console.log(`Maximum Snapshots: ${maxSnapshots}`);
  console.log(`Average Timespan: ${(avgTimespan / 60).toFixed(1)} minutes`);

  // Steam detection opportunity
  const steamCandidates = lineChanges.filter((lc) => {
    const velocity = lc.timespanSeconds > 0 ? Math.abs(lc.lineMovement) / (lc.timespanSeconds / 3600) : 0;
    return velocity > 0.5; // Moving >0.5 points/hour
  });

  if (steamCandidates.length > 0) {
    console.log(`\n🔥 STEAM CANDIDATES: ${steamCandidates.length} props with velocity >0.5 pts/hr`);
    steamCandidates.slice(0, 5).forEach((candidate) => {
      const velocity = (Math.abs(candidate.lineMovement) / (candidate.timespanSeconds / 3600)).toFixed(3);
      console.log(`   ${candidate.playerName} (${candidate.sport}): ${velocity} pts/hr`);
    });
  }
}

// Main execution
if (require.main === module) {
  monitorLineChanges()
    .then(() => {
      console.log('\n✅ Line change monitoring complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

export { monitorLineChanges };
