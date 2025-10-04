/**
 * Comprehensive ML Backtest - NFL + MLB
 *
 * Validates the complete system with fixed MLB probability calculations
 */

import { createClient } from '@supabase/supabase-js';
import { ProbabilityCalculator } from '../../models/ProbabilityCalculator';
import { CalibratedProbabilityCalculator } from '../../models/CalibratedProbabilityCalculator';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface BacktestResult {
  sport: string;
  market: string;
  outcomes: number;
  winRate: number;
  brierScore: number;
  logLoss: number;
  calibrationError: number;
  avgProbability: number;
}

async function runBacktest() {
  console.log('🎯 Running Comprehensive ML Backtest\n');
  console.log('=' .repeat(80));

  // Get all settled outcomes
  const { data: settlements, error } = await supabase
    .from('settled_outcomes')
    .select('*')
    .not('outcome', 'is', null)
    .not('outcome', 'eq', 'void')
    .in('sport', ['NFL', 'MLB']);

  if (error || !settlements) {
    console.error('Error fetching settlements:', error);
    process.exit(1);
  }

  console.log(`\nTotal settled outcomes: ${settlements.length.toLocaleString()}`);
  console.log(`Sports: ${[...new Set(settlements.map(s => s.sport))].join(', ')}`);

  // Calculate probabilities for each settlement
  const baseCalc = new ProbabilityCalculator();
  const calibratedCalc = new CalibratedProbabilityCalculator();

  const results: any[] = [];

  for (const settlement of settlements) {
    // Calculate probability
    const prob = await baseCalc.calculateProbability({
      sport: settlement.sport,
      playerName: settlement.player_name || settlement.player,
      marketType: settlement.market_type || settlement.market,
      line: parseFloat(settlement.line || 0),
    });

    results.push({
      ...settlement,
      predicted_prob: prob.probability,
      method: prob.method,
      dataPoints: prob.dataPoints,
      actual_outcome: settlement.outcome === 'win' ? 1 : 0,
    });
  }

  // Group by sport and market
  const byMarket = results.reduce((acc, r) => {
    const key = `${r.sport}:${r.market_type || r.market}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(r);
    return {};
  }, {} as Record<string, any[]>);

  // Calculate metrics per market
  const marketResults: BacktestResult[] = [];

  for (const [key, outcomes] of Object.entries(byMarket)) {
    const [sport, market] = key.split(':');

    const wins = outcomes.filter(o => o.actual_outcome === 1).length;
    const winRate = wins / outcomes.length;

    const avgProb = outcomes.reduce((sum, o) => sum + o.predicted_prob, 0) / outcomes.length;

    // Brier Score
    const brierScore =
      outcomes.reduce((sum, o) => {
        const error = o.predicted_prob - o.actual_outcome;
        return sum + error * error;
      }, 0) / outcomes.length;

    // Log Loss
    const logLoss =
      -outcomes.reduce((sum, o) => {
        const p = Math.max(0.01, Math.min(0.99, o.predicted_prob));
        return sum + (o.actual_outcome * Math.log(p) + (1 - o.actual_outcome) * Math.log(1 - p));
      }, 0) / outcomes.length;

    // Calibration Error
    const calibrationError = Math.abs(avgProb - winRate);

    marketResults.push({
      sport,
      market,
      outcomes: outcomes.length,
      winRate,
      brierScore,
      logLoss,
      calibrationError,
      avgProbability: avgProb,
    });
  }

  // Sort by outcome count
  marketResults.sort((a, b) => b.outcomes - a.outcomes);

  // Print results
  console.log('\n' + '='.repeat(80));
  console.log('📊 PER-MARKET BACKTEST RESULTS\n');

  console.log('| Sport | Market | Outcomes | Win Rate | Brier | Log Loss | Cal Error | Avg Prob |');
  console.log('|-------|--------|----------|----------|-------|----------|-----------|----------|');

  for (const result of marketResults) {
    const status =
      result.calibrationError < 0.05
        ? '🔥'
        : result.calibrationError < 0.10
          ? '✅'
          : result.calibrationError < 0.15
            ? '⚠️'
            : '❌';

    console.log(
      `| ${status} ${result.sport.padEnd(3)} | ${result.market.padEnd(20).slice(0, 20)} | ` +
        `${result.outcomes.toString().padStart(8)} | ` +
        `${(result.winRate * 100).toFixed(1).padStart(7)}% | ` +
        `${result.brierScore.toFixed(4)} | ` +
        `${result.logLoss.toFixed(4).padStart(8)} | ` +
        `${(result.calibrationError * 100).toFixed(2).padStart(8)}% | ` +
        `${(result.avgProbability * 100).toFixed(1).padStart(7)}% |`
    );
  }

  // Overall metrics
  const totalOutcomes = results.length;
  const totalWins = results.filter(r => r.actual_outcome === 1).length;
  const overallWinRate = totalWins / totalOutcomes;

  const overallAvgProb = results.reduce((sum, r) => sum + r.predicted_prob, 0) / totalOutcomes;

  const overallBrier =
    results.reduce((sum, r) => {
      const error = r.predicted_prob - r.actual_outcome;
      return sum + error * error;
    }, 0) / totalOutcomes;

  const overallLogLoss =
    -results.reduce((sum, r) => {
      const p = Math.max(0.01, Math.min(0.99, r.predicted_prob));
      return sum + (r.actual_outcome * Math.log(p) + (1 - r.actual_outcome) * Math.log(1 - p));
    }, 0) / totalOutcomes;

  const overallCalError = Math.abs(overallAvgProb - overallWinRate);

  console.log('\n' + '='.repeat(80));
  console.log('🎯 OVERALL SYSTEM PERFORMANCE\n');

  console.log(`Total Outcomes: ${totalOutcomes.toLocaleString()}`);
  console.log(`Win Rate: ${(overallWinRate * 100).toFixed(2)}%`);
  console.log(`Avg Predicted Probability: ${(overallAvgProb * 100).toFixed(2)}%`);
  console.log(`Brier Score: ${overallBrier.toFixed(4)} (Tier 1: <0.20)`);
  console.log(`Log Loss: ${overallLogLoss.toFixed(4)} (Better than random: <0.69)`);
  console.log(`Calibration Error: ${(overallCalError * 100).toFixed(2)}% (Target: <3%)`);

  // Tier assessment
  let tier = '';
  if (overallBrier < 0.17 && overallCalError < 0.03 && totalOutcomes >= 1000) {
    tier = 'TIER 1 - ELITE';
  } else if (overallBrier < 0.20 && overallCalError < 0.05) {
    tier = 'TIER 1 - PROFESSIONAL';
  } else if (overallBrier < 0.25 && overallCalError < 0.10) {
    tier = 'TIER 2 - ADVANCED';
  } else {
    tier = 'TIER 3 - DEVELOPING';
  }

  console.log(`\n🏆 TIER RATING: ${tier}`);

  // Method distribution
  const methodCounts = results.reduce(
    (acc, r) => {
      acc[r.method] = (acc[r.method] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('\n📊 Probability Calculation Methods:\n');
  for (const [method, count] of Object.entries(methodCounts)) {
    const pct = ((count / totalOutcomes) * 100).toFixed(1);
    console.log(`  ${method}: ${count.toLocaleString()} (${pct}%)`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Backtest complete\n');

  process.exit(0);
}

runBacktest();
