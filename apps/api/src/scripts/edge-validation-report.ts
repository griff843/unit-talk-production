#!/usr/bin/env tsx
/* eslint-disable no-console, max-lines-per-function, complexity, security/detect-object-injection */
/**
 * Edge Engine V1 - Validation Report Generator
 * Sprint: SPRINT-EDGE-ENGINE-V1-IMPLEMENT-097
 *
 * Generates edge decile analysis report:
 * - Edge deciles (0-10, 10-20, ..., 90-100)
 * - Count per bucket
 * - ROI per bucket (if result data available)
 * - Mean CLV per bucket
 * - Tier summary
 *
 * Usage: npx tsx apps/api/src/scripts/edge-validation-report.ts
 */

import { Client } from 'pg';

import {
  computeEdgeV1,
  EdgeV1Input,
  MODEL_VERSION,
} from '../agents/ScoringAgent/scoring/edgeEngineV1';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  'postgresql://postgres:postgres@localhost:54322/postgres';

interface UnifiedPick {
  id: string;
  sport: string;
  stat_type: string;
  side: string;
  player_name: string;
  line: number;
  odds: number;
  bet_line: number;
  bet_odds: number;
  closing_line: number | null;
  closing_odds: number | null;
  result: string | null;
  stake: number | null;
}

interface DecileBucket {
  range: string;
  min: number;
  max: number;
  count: number;
  wins: number;
  losses: number;
  pushes: number;
  totalClv: number;
  avgClv: number;
  roi: number | null;
  tierBreakdown: Record<string, number>;
}

function createDecileBuckets(): DecileBucket[] {
  const buckets: DecileBucket[] = [];
  for (let i = 0; i < 10; i++) {
    buckets.push({
      range: `${i * 10}-${(i + 1) * 10}`,
      min: i * 10,
      max: (i + 1) * 10,
      count: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      totalClv: 0,
      avgClv: 0,
      roi: null,
      tierBreakdown: { S: 0, A: 0, B: 0, PASS: 0 },
    });
  }
  return buckets;
}

function padRight(str: string, len: number): string {
  return str.padEnd(len);
}

function padLeft(str: string, len: number): string {
  return str.padStart(len);
}

async function main(): Promise<void> {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 30000,
  });

  console.log('='.repeat(80));
  console.log('EDGE ENGINE V1 - VALIDATION REPORT');
  console.log(`Model Version: ${MODEL_VERSION}`);
  console.log('Sprint: SPRINT-EDGE-ENGINE-V1-IMPLEMENT-097');
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
  console.log('');

  try {
    await client.connect();
    console.log('[SETUP] Connected to database');

    // Fetch all picks
    console.log('\n[DATA] Fetching picks from unified_picks...');
    const picksQuery = await client.query<UnifiedPick>(`
      SELECT
        id, sport, stat_type, side, player_name,
        line, odds,
        COALESCE(bet_line, line) as bet_line,
        COALESCE(bet_odds, odds::integer) as bet_odds,
        closing_line,
        closing_odds,
        result,
        stake
      FROM unified_picks
      ORDER BY created_at DESC
    `);

    let picks = picksQuery.rows;
    console.log(`  Found ${picks.length} picks in database`);

    // If no real data, use synthetic test data
    if (picks.length === 0) {
      console.log('  No picks found. Generating synthetic test data for report...\n');

      // Generate synthetic picks for demonstration
      const syntheticPicks: UnifiedPick[] = [];
      const players = [
        'LeBron James',
        'Stephen Curry',
        'Kevin Durant',
        'Luka Doncic',
        'Nikola Jokic',
        'Joel Embiid',
        'Giannis Antetokounmpo',
        'Jayson Tatum',
      ];
      const statTypes = ['points', 'rebounds', 'assists', 'threes'];
      const sides: ('over' | 'under')[] = ['over', 'under'];

      for (let i = 0; i < 50; i++) {
        const entryLine = 20 + Math.random() * 15;
        const entryOdds =
          Math.random() > 0.5
            ? -110 - Math.floor(Math.random() * 30)
            : 100 + Math.floor(Math.random() * 50);
        const lineDelta = (Math.random() - 0.3) * 3; // Slight positive bias
        const oddsDelta = Math.floor((Math.random() - 0.3) * 20);

        syntheticPicks.push({
          id: `synthetic-${i}`,
          sport: 'NBA',
          stat_type: statTypes[i % statTypes.length],
          side: sides[i % sides.length],
          player_name: players[i % players.length],
          line: entryLine,
          odds: entryOdds,
          bet_line: entryLine,
          bet_odds: entryOdds,
          closing_line: entryLine + lineDelta,
          closing_odds: entryOdds + oddsDelta,
          result: Math.random() > 0.45 ? 'won' : 'lost',
          stake: 1,
        });
      }

      picks = syntheticPicks;
    }

    // Initialize decile buckets
    const buckets = createDecileBuckets();

    // Tier summary
    const tierSummary: Record<
      string,
      { count: number; wins: number; losses: number; avgClv: number; totalClv: number }
    > = {
      S: { count: 0, wins: 0, losses: 0, avgClv: 0, totalClv: 0 },
      A: { count: 0, wins: 0, losses: 0, avgClv: 0, totalClv: 0 },
      B: { count: 0, wins: 0, losses: 0, avgClv: 0, totalClv: 0 },
      PASS: { count: 0, wins: 0, losses: 0, avgClv: 0, totalClv: 0 },
    };

    // Score all picks
    console.log('\n[SCORING] Running Edge Engine V1 on all picks...');

    for (const pick of picks) {
      const input: EdgeV1Input = {
        pick_id: pick.id,
        sport: pick.sport || 'NBA',
        stat_type: pick.stat_type || 'points',
        side: (pick.side as 'over' | 'under' | 'yes' | 'no') || 'over',
        entry_line: pick.bet_line || pick.line || 25.5,
        entry_odds: pick.bet_odds || (pick.odds ? Number(pick.odds) : -110),
        closing_line: pick.closing_line,
        closing_odds: pick.closing_odds,
        player_name: pick.player_name,
      };

      const output = computeEdgeV1(input);

      // Find bucket
      const bucketIndex = Math.min(Math.floor(output.edge_score / 10), 9);
      const bucket = buckets[bucketIndex];

      bucket.count++;
      bucket.totalClv += output.clv_pct;
      bucket.tierBreakdown[output.tier]++;

      if (pick.result === 'won') {
        bucket.wins++;
      } else if (pick.result === 'lost') {
        bucket.losses++;
      } else if (pick.result === 'push') {
        bucket.pushes++;
      }

      // Update tier summary
      tierSummary[output.tier].count++;
      tierSummary[output.tier].totalClv += output.clv_pct;
      if (pick.result === 'won') {
        tierSummary[output.tier].wins++;
      } else if (pick.result === 'lost') {
        tierSummary[output.tier].losses++;
      }
    }

    // Calculate averages and ROI
    for (const bucket of buckets) {
      if (bucket.count > 0) {
        bucket.avgClv = bucket.totalClv / bucket.count;

        // Simple ROI calculation (assuming -110 odds for simplicity)
        const totalBets = bucket.wins + bucket.losses;
        if (totalBets > 0) {
          const profit = bucket.wins * 0.909 - bucket.losses; // -110 pays 0.909 units
          bucket.roi = (profit / totalBets) * 100;
        }
      }
    }

    for (const tier of Object.keys(tierSummary)) {
      if (tierSummary[tier].count > 0) {
        tierSummary[tier].avgClv = tierSummary[tier].totalClv / tierSummary[tier].count;
      }
    }

    // Print report
    console.log('\n' + '='.repeat(80));
    console.log('EDGE DECILE ANALYSIS');
    console.log('='.repeat(80));
    console.log('');
    console.log(
      '| Decile   | Count | Wins | Losses | Win%   | Avg CLV | ROI%     | Tiers (S/A/B/P) |'
    );
    console.log(
      '|' +
        '-'.repeat(10) +
        '|' +
        '-'.repeat(7) +
        '|' +
        '-'.repeat(6) +
        '|' +
        '-'.repeat(8) +
        '|' +
        '-'.repeat(8) +
        '|' +
        '-'.repeat(9) +
        '|' +
        '-'.repeat(10) +
        '|' +
        '-'.repeat(17) +
        '|'
    );

    for (const bucket of buckets) {
      const winPct =
        bucket.wins + bucket.losses > 0
          ? ((bucket.wins / (bucket.wins + bucket.losses)) * 100).toFixed(1)
          : 'N/A';
      const roi = bucket.roi !== null ? bucket.roi.toFixed(1) + '%' : 'N/A';
      const tierStr = `${bucket.tierBreakdown.S}/${bucket.tierBreakdown.A}/${bucket.tierBreakdown.B}/${bucket.tierBreakdown.PASS}`;

      console.log(
        '| ' +
          padRight(bucket.range, 8) +
          ' | ' +
          padLeft(bucket.count.toString(), 5) +
          ' | ' +
          padLeft(bucket.wins.toString(), 4) +
          ' | ' +
          padLeft(bucket.losses.toString(), 6) +
          ' | ' +
          padLeft(winPct.toString(), 6) +
          ' | ' +
          padLeft(bucket.avgClv.toFixed(2) + '%', 7) +
          ' | ' +
          padLeft(roi, 8) +
          ' | ' +
          padRight(tierStr, 15) +
          ' |'
      );
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('TIER SUMMARY');
    console.log('='.repeat(80));
    console.log('');
    console.log('| Tier | Count | Wins | Losses | Win%   | Avg CLV | Expected ROI |');
    console.log(
      '|' +
        '-'.repeat(6) +
        '|' +
        '-'.repeat(7) +
        '|' +
        '-'.repeat(6) +
        '|' +
        '-'.repeat(8) +
        '|' +
        '-'.repeat(8) +
        '|' +
        '-'.repeat(9) +
        '|' +
        '-'.repeat(14) +
        '|'
    );

    for (const tier of ['S', 'A', 'B', 'PASS']) {
      const data = tierSummary[tier];
      const totalBets = data.wins + data.losses;
      const winPct = totalBets > 0 ? ((data.wins / totalBets) * 100).toFixed(1) : 'N/A';
      const expectedRoi =
        totalBets > 0
          ? (((data.wins * 0.909 - data.losses) / totalBets) * 100).toFixed(1) + '%'
          : 'N/A';

      console.log(
        '| ' +
          padRight(tier, 4) +
          ' | ' +
          padLeft(data.count.toString(), 5) +
          ' | ' +
          padLeft(data.wins.toString(), 4) +
          ' | ' +
          padLeft(data.losses.toString(), 6) +
          ' | ' +
          padLeft(winPct.toString(), 6) +
          ' | ' +
          padLeft(data.avgClv.toFixed(2) + '%', 7) +
          ' | ' +
          padLeft(expectedRoi, 12) +
          ' |'
      );
    }

    // Overall statistics
    console.log('');
    console.log('='.repeat(80));
    console.log('OVERALL STATISTICS');
    console.log('='.repeat(80));
    console.log('');

    const totalPicks = picks.length;
    const totalWins = buckets.reduce((sum, b) => sum + b.wins, 0);
    const totalLosses = buckets.reduce((sum, b) => sum + b.losses, 0);
    const overallWinPct =
      totalWins + totalLosses > 0 ? (totalWins / (totalWins + totalLosses)) * 100 : 0;
    const overallClv = buckets.reduce((sum, b) => sum + b.totalClv, 0) / totalPicks;

    console.log(`  Total picks analyzed: ${totalPicks}`);
    console.log(`  Total wins: ${totalWins}`);
    console.log(`  Total losses: ${totalLosses}`);
    console.log(`  Overall win rate: ${overallWinPct.toFixed(1)}%`);
    console.log(`  Average CLV: ${overallClv.toFixed(2)}%`);
    console.log(`  Model version: ${MODEL_VERSION}`);

    // CLV correlation with results
    console.log('');
    console.log('='.repeat(80));
    console.log('CLV CORRELATION ANALYSIS');
    console.log('='.repeat(80));
    console.log('');

    const positiveCLVWins = buckets.filter(b => b.avgClv > 0).reduce((sum, b) => sum + b.wins, 0);
    const positiveCLVLosses = buckets
      .filter(b => b.avgClv > 0)
      .reduce((sum, b) => sum + b.losses, 0);
    const negativeCLVWins = buckets.filter(b => b.avgClv <= 0).reduce((sum, b) => sum + b.wins, 0);
    const negativeCLVLosses = buckets
      .filter(b => b.avgClv <= 0)
      .reduce((sum, b) => sum + b.losses, 0);

    const positiveCLVWinRate =
      positiveCLVWins + positiveCLVLosses > 0
        ? (positiveCLVWins / (positiveCLVWins + positiveCLVLosses)) * 100
        : 0;
    const negativeCLVWinRate =
      negativeCLVWins + negativeCLVLosses > 0
        ? (negativeCLVWins / (negativeCLVWins + negativeCLVLosses)) * 100
        : 0;

    console.log(`  Positive CLV buckets win rate: ${positiveCLVWinRate.toFixed(1)}%`);
    console.log(`  Negative CLV buckets win rate: ${negativeCLVWinRate.toFixed(1)}%`);
    console.log(`  CLV differential: ${(positiveCLVWinRate - negativeCLVWinRate).toFixed(1)}%`);

    console.log('');
    console.log('='.repeat(80));
    console.log('REPORT COMPLETE');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('\n[ERROR]', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n[CLEANUP] Database connection closed');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
