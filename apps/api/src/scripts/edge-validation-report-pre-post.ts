#!/usr/bin/env tsx
/* eslint-disable no-console, max-lines-per-function, max-lines, complexity, security/detect-object-injection */
/**
 * Edge Engine PRE/POST Validation Report
 * Sprint: SPRINT-EDGE-ENGINE-PRESCORE-SPLIT-098
 *
 * Generates validation report with:
 * 1. PRE score deciles vs ROI (production-relevant)
 * 2. POST score deciles vs CLV and ROI (validation)
 * 3. PRE vs POST correlation analysis
 *
 * Usage: npx tsx apps/api/src/scripts/edge-validation-report-pre-post.ts
 */

import {
  computeEdgeScorePre,
  EdgePreInput,
  MODEL_VERSION_PRE,
} from '../agents/ScoringAgent/scoring/edgeEnginePre';
import {
  computeEdgeScorePost,
  EdgePostInput,
  MODEL_VERSION_POST,
} from '../agents/ScoringAgent/scoring/edgeEngineV1';

// =============================================================================
// CONFIGURATION
// =============================================================================

const NUM_SYNTHETIC_PICKS = 50;

// =============================================================================
// TYPES
// =============================================================================

interface DecileBucket {
  range: string;
  min: number;
  max: number;
  count: number;
  wins: number;
  losses: number;
  totalScore: number;
  avgScore: number;
  roi: number | null;
  tierBreakdown: Record<string, number>;
}

interface SyntheticPick {
  id: string;
  sport: string;
  stat_type: string;
  side: 'over' | 'under';
  entry_line: number;
  entry_odds: number;
  projection: number | null;
  opening_line: number | null;
  opening_odds: number | null;
  closing_line: number | null;
  closing_odds: number | null;
  result: 'won' | 'lost' | 'push';
  player_name: string;
}

// =============================================================================
// DATA GENERATION
// =============================================================================

function generateSyntheticPicks(): SyntheticPick[] {
  const picks: SyntheticPick[] = [];
  const sports = ['NBA', 'MLB', 'NFL'];
  const statTypes = ['points', 'rebounds', 'assists', 'strikeouts', 'passing_yards'];
  const sides: ('over' | 'under')[] = ['over', 'under'];
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

  for (let i = 0; i < NUM_SYNTHETIC_PICKS; i++) {
    const entryLine = 20 + Math.random() * 15;
    const entryOdds =
      Math.random() > 0.5
        ? -110 - Math.floor(Math.random() * 30)
        : 100 + Math.floor(Math.random() * 50);

    const hasProjection = Math.random() > 0.2;
    const hasOpening = Math.random() > 0.2;
    const hasClosing = Math.random() > 0.1;

    const projectionDelta = (Math.random() - 0.3) * 5;
    const openingDelta = (Math.random() - 0.5) * 2;
    const closingDelta = (Math.random() - 0.3) * 3;
    const closingOddsDelta = Math.floor((Math.random() - 0.3) * 20);

    // Simulate result with slight edge for high-score picks
    const baseWinRate = 0.48;
    const result: 'won' | 'lost' | 'push' =
      Math.random() < baseWinRate + Math.random() * 0.1 ? 'won' : 'lost';

    picks.push({
      id: `synthetic-${i + 1}`,
      sport: sports[i % sports.length],
      stat_type: statTypes[i % statTypes.length],
      side: sides[i % sides.length],
      entry_line: Math.round(entryLine * 10) / 10,
      entry_odds: entryOdds,
      projection: hasProjection ? Math.round((entryLine + projectionDelta) * 10) / 10 : null,
      opening_line: hasOpening ? Math.round((entryLine + openingDelta) * 10) / 10 : null,
      opening_odds: hasOpening ? entryOdds + Math.floor((Math.random() - 0.5) * 20) : null,
      closing_line: hasClosing ? Math.round((entryLine + closingDelta) * 10) / 10 : null,
      closing_odds: hasClosing ? entryOdds + closingOddsDelta : null,
      result,
      player_name: players[i % players.length],
    });
  }

  return picks;
}

// =============================================================================
// BUCKET FUNCTIONS
// =============================================================================

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
      totalScore: 0,
      avgScore: 0,
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

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('='.repeat(80));
  console.log('EDGE ENGINE PRE/POST VALIDATION REPORT');
  console.log(`PRE Model Version: ${MODEL_VERSION_PRE}`);
  console.log(`POST Model Version: ${MODEL_VERSION_POST}`);
  console.log('Sprint: SPRINT-EDGE-ENGINE-PRESCORE-SPLIT-098');
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
  console.log('');

  // Generate synthetic data
  console.log('[DATA] Generating synthetic test data...');
  const picks = generateSyntheticPicks();
  console.log(`  Generated ${picks.length} synthetic picks`);
  console.log('');

  // Initialize buckets
  const preBuckets = createDecileBuckets();
  const postBuckets = createDecileBuckets();

  // Tier summaries
  const preTierSummary: Record<
    string,
    { count: number; wins: number; losses: number; totalScore: number }
  > = {
    S: { count: 0, wins: 0, losses: 0, totalScore: 0 },
    A: { count: 0, wins: 0, losses: 0, totalScore: 0 },
    B: { count: 0, wins: 0, losses: 0, totalScore: 0 },
    PASS: { count: 0, wins: 0, losses: 0, totalScore: 0 },
  };
  const postTierSummary: Record<
    string,
    { count: number; wins: number; losses: number; totalScore: number; totalClv: number }
  > = {
    S: { count: 0, wins: 0, losses: 0, totalScore: 0, totalClv: 0 },
    A: { count: 0, wins: 0, losses: 0, totalScore: 0, totalClv: 0 },
    B: { count: 0, wins: 0, losses: 0, totalScore: 0, totalClv: 0 },
    PASS: { count: 0, wins: 0, losses: 0, totalScore: 0, totalClv: 0 },
  };

  // Score arrays for correlation
  const preScores: number[] = [];
  const postScores: number[] = [];

  // Score all picks
  console.log('[SCORING] Running PRE and POST scoring...');

  for (const pick of picks) {
    // Build PRE input
    const preInput: EdgePreInput = {
      pick_id: pick.id,
      sport: pick.sport,
      stat_type: pick.stat_type,
      side: pick.side,
      entry_line: pick.entry_line,
      entry_odds: pick.entry_odds,
      projection: pick.projection,
      opening_line: pick.opening_line,
      opening_odds: pick.opening_odds,
      player_name: pick.player_name,
    };

    // Build POST input
    const postInput: EdgePostInput = {
      pick_id: pick.id,
      sport: pick.sport,
      stat_type: pick.stat_type,
      side: pick.side,
      entry_line: pick.entry_line,
      entry_odds: pick.entry_odds,
      closing_line: pick.closing_line,
      closing_odds: pick.closing_odds,
      player_name: pick.player_name,
    };

    const preOutput = computeEdgeScorePre(preInput);
    const postOutput = computeEdgeScorePost(postInput);

    preScores.push(preOutput.edge_score_pre);
    postScores.push(postOutput.edge_score_post);

    // PRE buckets
    const preBucketIndex = Math.min(Math.floor(preOutput.edge_score_pre / 10), 9);
    const preBucket = preBuckets[preBucketIndex];
    preBucket.count++;
    preBucket.totalScore += preOutput.edge_score_pre;
    preBucket.tierBreakdown[preOutput.tier_pre]++;
    if (pick.result === 'won') preBucket.wins++;
    else if (pick.result === 'lost') preBucket.losses++;

    // PRE tier summary
    preTierSummary[preOutput.tier_pre].count++;
    preTierSummary[preOutput.tier_pre].totalScore += preOutput.edge_score_pre;
    if (pick.result === 'won') preTierSummary[preOutput.tier_pre].wins++;
    else if (pick.result === 'lost') preTierSummary[preOutput.tier_pre].losses++;

    // POST buckets
    const postBucketIndex = Math.min(Math.floor(postOutput.edge_score_post / 10), 9);
    const postBucket = postBuckets[postBucketIndex];
    postBucket.count++;
    postBucket.totalScore += postOutput.clv_pct;
    postBucket.tierBreakdown[postOutput.tier_post]++;
    if (pick.result === 'won') postBucket.wins++;
    else if (pick.result === 'lost') postBucket.losses++;

    // POST tier summary
    postTierSummary[postOutput.tier_post].count++;
    postTierSummary[postOutput.tier_post].totalScore += postOutput.edge_score_post;
    postTierSummary[postOutput.tier_post].totalClv += postOutput.clv_pct;
    if (pick.result === 'won') postTierSummary[postOutput.tier_post].wins++;
    else if (pick.result === 'lost') postTierSummary[postOutput.tier_post].losses++;
  }

  // Calculate averages and ROI
  for (const bucket of preBuckets) {
    if (bucket.count > 0) {
      bucket.avgScore = bucket.totalScore / bucket.count;
      const totalBets = bucket.wins + bucket.losses;
      if (totalBets > 0) {
        const profit = bucket.wins * 0.909 - bucket.losses;
        bucket.roi = (profit / totalBets) * 100;
      }
    }
  }

  for (const bucket of postBuckets) {
    if (bucket.count > 0) {
      bucket.avgScore = bucket.totalScore / bucket.count; // This is avg CLV for POST
      const totalBets = bucket.wins + bucket.losses;
      if (totalBets > 0) {
        const profit = bucket.wins * 0.909 - bucket.losses;
        bucket.roi = (profit / totalBets) * 100;
      }
    }
  }

  // Print PRE report
  console.log('');
  console.log('='.repeat(80));
  console.log('PRE SCORE DECILE ANALYSIS (Production-Relevant)');
  console.log('='.repeat(80));
  console.log('');
  console.log(
    '| Decile   | Count | Wins | Losses | Win%   | Avg Score | ROI%     | Tiers (S/A/B/P) |'
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
      '-'.repeat(11) +
      '|' +
      '-'.repeat(10) +
      '|' +
      '-'.repeat(17) +
      '|'
  );

  for (const bucket of preBuckets) {
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
        padLeft(bucket.avgScore.toFixed(1), 9) +
        ' | ' +
        padLeft(roi, 8) +
        ' | ' +
        padRight(tierStr, 15) +
        ' |'
    );
  }

  // Print POST report
  console.log('');
  console.log('='.repeat(80));
  console.log('POST SCORE DECILE ANALYSIS (Validation with CLV)');
  console.log('='.repeat(80));
  console.log('');
  console.log(
    '| Decile   | Count | Wins | Losses | Win%   | Avg CLV  | ROI%     | Tiers (S/A/B/P) |'
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
      '-'.repeat(10) +
      '|' +
      '-'.repeat(10) +
      '|' +
      '-'.repeat(17) +
      '|'
  );

  for (const bucket of postBuckets) {
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
        padLeft(bucket.avgScore.toFixed(2) + '%', 8) +
        ' | ' +
        padLeft(roi, 8) +
        ' | ' +
        padRight(tierStr, 15) +
        ' |'
    );
  }

  // PRE Tier Summary
  console.log('');
  console.log('='.repeat(80));
  console.log('PRE TIER SUMMARY');
  console.log('='.repeat(80));
  console.log('');
  console.log('| Tier | Count | Wins | Losses | Win%   | Avg Score | Expected ROI |');
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
      '-'.repeat(11) +
      '|' +
      '-'.repeat(14) +
      '|'
  );

  for (const tier of ['S', 'A', 'B', 'PASS']) {
    const data = preTierSummary[tier];
    const totalBets = data.wins + data.losses;
    const winPct = totalBets > 0 ? ((data.wins / totalBets) * 100).toFixed(1) : 'N/A';
    const avgScore = data.count > 0 ? (data.totalScore / data.count).toFixed(1) : 'N/A';
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
        padLeft(avgScore.toString(), 9) +
        ' | ' +
        padLeft(expectedRoi, 12) +
        ' |'
    );
  }

  // POST Tier Summary
  console.log('');
  console.log('='.repeat(80));
  console.log('POST TIER SUMMARY (with CLV)');
  console.log('='.repeat(80));
  console.log('');
  console.log('| Tier | Count | Wins | Losses | Win%   | Avg CLV  | Expected ROI |');
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
      '-'.repeat(10) +
      '|' +
      '-'.repeat(14) +
      '|'
  );

  for (const tier of ['S', 'A', 'B', 'PASS']) {
    const data = postTierSummary[tier];
    const totalBets = data.wins + data.losses;
    const winPct = totalBets > 0 ? ((data.wins / totalBets) * 100).toFixed(1) : 'N/A';
    const avgClv = data.count > 0 ? (data.totalClv / data.count).toFixed(2) + '%' : 'N/A';
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
        padLeft(avgClv.toString(), 8) +
        ' | ' +
        padLeft(expectedRoi, 12) +
        ' |'
    );
  }

  // Correlation Analysis
  console.log('');
  console.log('='.repeat(80));
  console.log('PRE vs POST CORRELATION ANALYSIS');
  console.log('='.repeat(80));
  console.log('');

  const n = preScores.length;
  const avgPre = preScores.reduce((a, b) => a + b, 0) / n;
  const avgPost = postScores.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomPre = 0;
  let denomPost = 0;

  for (let i = 0; i < n; i++) {
    const diffPre = preScores[i] - avgPre;
    const diffPost = postScores[i] - avgPost;
    numerator += diffPre * diffPost;
    denomPre += diffPre * diffPre;
    denomPost += diffPost * diffPost;
  }

  const correlation =
    denomPre > 0 && denomPost > 0 ? numerator / Math.sqrt(denomPre * denomPost) : 0;

  console.log(`  Total picks analyzed: ${n}`);
  console.log(`  Average PRE Score: ${avgPre.toFixed(2)}`);
  console.log(`  Average POST Score: ${avgPost.toFixed(2)}`);
  console.log(`  Pearson Correlation (r): ${correlation.toFixed(3)}`);
  console.log('');

  if (correlation > 0.5) {
    console.log('  INTERPRETATION: Strong positive correlation');
    console.log('  PRE and POST scores are well-aligned.');
  } else if (correlation > 0.3) {
    console.log('  INTERPRETATION: Moderate positive correlation');
    console.log('  PRE reasonably predicts POST (with expected noise from CLV).');
  } else if (correlation > 0) {
    console.log('  INTERPRETATION: Weak positive correlation');
    console.log('  PRE and POST capture different signals (expected with synthetic data).');
  } else {
    console.log('  INTERPRETATION: No/negative correlation');
    console.log('  Review scoring models if this persists with real data.');
  }

  // Summary
  console.log('');
  console.log('='.repeat(80));
  console.log('REPORT COMPLETE');
  console.log('='.repeat(80));
  console.log('');
  console.log(`PRE_MODEL_VERSION: ${MODEL_VERSION_PRE}`);
  console.log(`POST_MODEL_VERSION: ${MODEL_VERSION_POST}`);
  console.log('');
  console.log('KEY INSIGHTS:');
  console.log('  - PRE score is for PRODUCTION decisions (promotion/posting)');
  console.log('  - POST score is for VALIDATION (CLV analysis, model calibration)');
  console.log('  - Positive correlation indicates model consistency');
  console.log('='.repeat(80));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
