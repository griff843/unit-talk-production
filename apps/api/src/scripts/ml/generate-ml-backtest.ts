/**
 * ML Backtest Report - Compare Probabilities vs Outcomes
 *
 * Analyzes settled outcomes to validate ML probability calculations
 */

import { createClient } from '@supabase/supabase-js';
import { ProbabilityCalculator } from '../../models/ProbabilityCalculator';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const probabilityCalculator = new ProbabilityCalculator();

interface BacktestResult {
  total: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  avgPredictedProb: number;
  calibrationError: number;
  brier: number;
  logLoss: number;
  byMarket: Record<string, any>;
}

async function runBacktest() {
  console.log('🔬 ML Backtest Starting...\n');

  // Get all settled outcomes (NFL + MLB training data)
  const { data: settlements, error } = await supabase
    .from('settled_outcomes')
    .select('*')
    .not('outcome', 'is', null)
    .not('outcome', 'eq', 'void');

  if (error || !settlements) {
    console.error('Error fetching settlements:', error);
    process.exit(1);
  }

  console.log(`📊 Analyzing ${settlements.length} settled outcomes...\n`);

  let totalWins = 0;
  let totalLosses = 0;
  let totalPushes = 0;
  let totalPredictedProb = 0;
  let brierSum = 0;
  let logLossSum = 0;

  const marketBreakdown: Record<string, any> = {};
  const detailedResults: any[] = [];

  for (const settlement of settlements) {
    // Calculate what the ML probability would have been
    const predicted = await probabilityCalculator.calculateProbability({
      sport: 'NFL',
      playerName: settlement.player_name,
      marketType: settlement.market_type,
      line: settlement.line,
    });

    const predictedProb = predicted?.probability || 0.52; // Default to baseline

    // Actual outcome (1 = win, 0 = loss, skip pushes for calibration)
    const actualOutcome = settlement.outcome === 'win' ? 1 : settlement.outcome === 'loss' ? 0 : null;

    if (actualOutcome !== null) {
      // Brier Score: (predicted - actual)^2
      const brierScore = Math.pow(predictedProb - actualOutcome, 2);
      brierSum += brierScore;

      // Log Loss: -[actual*log(pred) + (1-actual)*log(1-pred)]
      const epsilon = 1e-15; // Prevent log(0)
      const clampedProb = Math.max(epsilon, Math.min(1 - epsilon, predictedProb));
      const logLoss = -(
        actualOutcome * Math.log(clampedProb) +
        (1 - actualOutcome) * Math.log(1 - clampedProb)
      );
      logLossSum += logLoss;

      totalPredictedProb += predictedProb;

      if (actualOutcome === 1) totalWins++;
      else totalLosses++;

      // Market breakdown
      const market = settlement.market_type || 'unknown';
      if (!marketBreakdown[market]) {
        marketBreakdown[market] = {
          count: 0,
          wins: 0,
          losses: 0,
          avgPredictedProb: 0,
          calibrationError: 0,
        };
      }
      marketBreakdown[market].count++;
      if (actualOutcome === 1) marketBreakdown[market].wins++;
      else marketBreakdown[market].losses++;
      marketBreakdown[market].avgPredictedProb += predictedProb;

      detailedResults.push({
        player: settlement.player_name,
        market: settlement.market_type,
        line: settlement.line,
        actual_value: settlement.actual_value,
        outcome: settlement.outcome,
        predicted_prob: (predictedProb * 100).toFixed(1) + '%',
        method: predicted?.method || 'baseline',
        data_points: predicted?.dataPoints || 0,
        brier_score: brierScore.toFixed(4),
        log_loss: logLoss.toFixed(4),
      });
    } else {
      totalPushes++;
    }
  }

  const totalDecided = totalWins + totalLosses;
  const winRate = totalDecided > 0 ? (totalWins / totalDecided) * 100 : 0;
  const avgPredictedProb = totalDecided > 0 ? (totalPredictedProb / totalDecided) * 100 : 0;
  const calibrationError = Math.abs(winRate - avgPredictedProb);
  const brierScore = totalDecided > 0 ? brierSum / totalDecided : 0;
  const logLoss = totalDecided > 0 ? logLossSum / totalDecided : 0;

  // Calculate market-level calibration
  Object.keys(marketBreakdown).forEach(market => {
    const m = marketBreakdown[market];
    m.avgPredictedProb = (m.avgPredictedProb / m.count) * 100;
    const marketWinRate = (m.wins / (m.wins + m.losses)) * 100;
    m.winRate = marketWinRate;
    m.calibrationError = Math.abs(marketWinRate - m.avgPredictedProb);
  });

  const result: BacktestResult = {
    total: settlements.length,
    wins: totalWins,
    losses: totalLosses,
    pushes: totalPushes,
    winRate: winRate,
    avgPredictedProb: avgPredictedProb,
    calibrationError: calibrationError,
    brier: brierScore,
    logLoss: logLoss,
    byMarket: marketBreakdown,
  };

  // Write artifacts
  const outDir = 'apps/api/out/ops/backtest';
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(outDir, 'ml-backtest-summary.json'),
    JSON.stringify(result, null, 2)
  );

  fs.writeFileSync(
    path.join(outDir, 'ml-backtest-detailed.json'),
    JSON.stringify(detailedResults, null, 2)
  );

  // Console output
  console.log('📈 BACKTEST RESULTS\n');
  console.log(`Total Outcomes: ${result.total}`);
  console.log(`Wins: ${totalWins} | Losses: ${totalLosses} | Pushes: ${totalPushes}`);
  console.log(`Win Rate: ${winRate.toFixed(2)}%`);
  console.log(`Avg Predicted Probability: ${avgPredictedProb.toFixed(2)}%`);
  console.log(`Calibration Error: ${calibrationError.toFixed(2)}%`);
  console.log(`Brier Score: ${brierScore.toFixed(4)} (lower is better, <0.25 is good)`);
  console.log(`Log Loss: ${logLoss.toFixed(4)} (lower is better, <0.69 is better than random)`);

  console.log('\n📋 Market Breakdown:');
  console.table(marketBreakdown);

  console.log('\n✅ Sample Best Predictions (low Brier):');
  detailedResults
    .sort((a, b) => parseFloat(a.brier_score) - parseFloat(b.brier_score))
    .slice(0, 5)
    .forEach(r => {
      console.log(`  ${r.player} ${r.market} O${r.line} → ${r.outcome} (predicted: ${r.predicted_prob}, Brier: ${r.brier_score})`);
    });

  console.log('\n❌ Sample Worst Predictions (high Brier):');
  detailedResults
    .sort((a, b) => parseFloat(b.brier_score) - parseFloat(a.brier_score))
    .slice(0, 5)
    .forEach(r => {
      console.log(`  ${r.player} ${r.market} O${r.line} → ${r.outcome} (predicted: ${r.predicted_prob}, Brier: ${r.brier_score})`);
    });

  console.log(`\n📁 Full results written to: ${outDir}/\n`);

  // Tier assessment
  console.log('🎯 TIER ASSESSMENT:\n');

  let tier = 'Tier 3';
  let reasoning = [];

  if (brierScore < 0.20) {
    tier = 'Tier 1';
    reasoning.push('Excellent calibration (Brier < 0.20)');
  } else if (brierScore < 0.25) {
    tier = 'Upper Tier 2';
    reasoning.push('Good calibration (Brier < 0.25)');
  } else {
    tier = 'Tier 2/3';
    reasoning.push('Moderate calibration (Brier > 0.25)');
  }

  if (calibrationError < 3) {
    reasoning.push('Strong prediction accuracy (Calibration Error < 3%)');
  } else if (calibrationError < 5) {
    reasoning.push('Good prediction accuracy (Calibration Error < 5%)');
  } else {
    reasoning.push('Calibration needs improvement (Error > 5%)');
  }

  if (result.total >= 100) {
    reasoning.push('Sufficient validation sample (>100 outcomes)');
  } else {
    reasoning.push('Limited validation sample (<100 outcomes)');
  }

  console.log(`Current Tier: ${tier}`);
  console.log(`Reasoning:`);
  reasoning.forEach(r => console.log(`  - ${r}`));

  console.log('\n📈 Path to Tier 1:');
  if (brierScore >= 0.20) console.log(`  - Improve Brier Score from ${brierScore.toFixed(4)} to <0.20`);
  if (calibrationError >= 3) console.log(`  - Reduce calibration error from ${calibrationError.toFixed(2)}% to <3%`);
  if (result.total < 1000) console.log(`  - Increase validation sample from ${result.total} to 1000+ outcomes`);

  process.exit(0);
}

runBacktest();
