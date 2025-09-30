#!/usr/bin/env npx tsx
/**
 * NBA Model Analysis
 * Analyzes the NBA training data and creates baseline predictions
 * Prepares data for future ML model implementation
 */

import * as fs from 'fs';
import * as path from 'path';

interface NBATrainingRecord {
  prop_id: string;
  sport: string;
  stat_type: string;
  player_name: string;
  line: number;
  over_odds: number | null;
  under_odds: number | null;
  actual_value: number;
  result: string;
  start_time: string;
  day_of_week: number;
  hour_of_day: number;
  month: number;
  days_until_game: number;
  is_primetime: boolean;
  is_weekend: boolean;
}

function parseCSV(csvContent: string): NBATrainingRecord[] {
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');
  const records: NBATrainingRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',');
    if (values.length !== headers.length) continue;

    const record: any = {};
    headers.forEach((header, index) => {
      const value = values[index];
      const cleanHeader = header.trim();

      // Parse numeric fields
      if (['line', 'over_odds', 'under_odds', 'actual_value', 'day_of_week', 'hour_of_day', 'month', 'days_until_game'].includes(cleanHeader)) {
        record[cleanHeader] = value === '' || value === 'null' ? null : parseFloat(value);
      }
      // Parse boolean fields
      else if (['is_primetime', 'is_weekend'].includes(cleanHeader)) {
        record[cleanHeader] = value === 'true' || value === '1';
      }
      // String fields
      else {
        record[cleanHeader] = value;
      }
    });

    records.push(record);
  }

  return records;
}

function analyzeNBAData(records: NBATrainingRecord[]) {
  console.log('🏀 NBA MODEL ANALYSIS');
  console.log('='.repeat(40));

  // Basic statistics
  const totalRecords = records.length;
  const winRate = records.filter(r => r.result === 'won').length / totalRecords;
  const lossRate = records.filter(r => r.result === 'lost').length / totalRecords;
  const pushRate = records.filter(r => r.result === 'push').length / totalRecords;

  console.log(`📊 Dataset Overview:`);
  console.log(`  Total NBA props: ${totalRecords.toLocaleString()}`);
  console.log(`  Win rate: ${(winRate * 100).toFixed(1)}%`);
  console.log(`  Loss rate: ${(lossRate * 100).toFixed(1)}%`);
  console.log(`  Push rate: ${(pushRate * 100).toFixed(1)}%`);
  console.log(`  Target improvement: +${(55 - winRate * 100).toFixed(1)}% to reach 55%`);

  // Stat type analysis
  const statTypes = new Map<string, number>();
  records.forEach(r => {
    statTypes.set(r.stat_type, (statTypes.get(r.stat_type) || 0) + 1);
  });

  console.log(`\n🏆 Most Common NBA Prop Types:`);
  Array.from(statTypes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([stat, count], index) => {
      console.log(`  ${index + 1}. ${stat}: ${count.toLocaleString()} props`);
    });

  // Player analysis
  const playerStats = new Map<string, { total: number, wins: number }>();
  records.forEach(r => {
    if (!playerStats.has(r.player_name)) {
      playerStats.set(r.player_name, { total: 0, wins: 0 });
    }
    const stats = playerStats.get(r.player_name)!;
    stats.total++;
    if (r.result === 'won') stats.wins++;
  });

  console.log(`\n⭐ Top Performing Players (min 50 props):`);
  Array.from(playerStats.entries())
    .filter(([_, stats]) => stats.total >= 50)
    .map(([player, stats]) => ({
      player,
      winRate: stats.wins / stats.total,
      total: stats.total
    }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 10)
    .forEach(({ player, winRate, total }, index) => {
      console.log(`  ${index + 1}. ${player}: ${(winRate * 100).toFixed(1)}% (${total} props)`);
    });

  // Feature importance analysis
  const features = {
    primetime: records.filter(r => r.is_primetime),
    weekend: records.filter(r => r.is_weekend),
    highLine: records.filter(r => r.line > 20),
    lowLine: records.filter(r => r.line < 10),
  };

  console.log(`\n🔬 Feature Analysis:`);
  Object.entries(features).forEach(([feature, subset]) => {
    const subsetWinRate = subset.filter(r => r.result === 'won').length / subset.length;
    const improvement = subsetWinRate - winRate;
    console.log(`  ${feature}: ${(subsetWinRate * 100).toFixed(1)}% win rate (${improvement > 0 ? '+' : ''}${(improvement * 100).toFixed(1)}% vs baseline)`);
  });

  // Generate baseline predictions
  const baselineAccuracy = Math.max(winRate, lossRate); // Predict most common outcome
  console.log(`\n🎯 Baseline Model Performance:`);
  console.log(`  Baseline accuracy: ${(baselineAccuracy * 100).toFixed(1)}%`);
  console.log(`  Target accuracy: 55.0%`);
  console.log(`  Improvement needed: +${(55 - baselineAccuracy * 100).toFixed(1)}% points`);

  // Save analysis results
  const analysisResults = {
    dataset: {
      totalRecords,
      winRate,
      lossRate,
      pushRate,
      targetImprovement: 55 - winRate * 100
    },
    statTypes: Array.from(statTypes.entries()).sort((a, b) => b[1] - a[1]),
    topPlayers: Array.from(playerStats.entries())
      .filter(([_, stats]) => stats.total >= 50)
      .map(([player, stats]) => ({
        player,
        winRate: stats.wins / stats.total,
        total: stats.total
      }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 20),
    featureAnalysis: Object.fromEntries(
      Object.entries(features).map(([feature, subset]) => [
        feature,
        {
          winRate: subset.filter(r => r.result === 'won').length / subset.length,
          sampleSize: subset.length
        }
      ])
    ),
    baseline: {
      accuracy: baselineAccuracy,
      targetAccuracy: 0.55,
      improvementNeeded: 55 - baselineAccuracy * 100
    },
    recommendations: [
      'Focus on high-performing players for model training',
      'Consider stat_type specific models for different prop categories',
      'Analyze temporal patterns (primetime, weekend effects)',
      'Implement feature engineering for line value optimization',
      'Consider ensemble approach combining multiple strategies'
    ]
  };

  return analysisResults;
}

async function main() {
  try {
    const dataPath = '/app/apps/api/ml-training-data/nba_training_data.csv';

    if (!fs.existsSync(dataPath)) {
      console.error(`❌ NBA training data not found at: ${dataPath}`);
      console.log('🔧 Run export-training-data.ts first to generate the data');
      process.exit(1);
    }

    console.log(`📥 Loading NBA training data from: ${dataPath}`);
    const csvContent = fs.readFileSync(dataPath, 'utf-8');
    const records = parseCSV(csvContent);

    if (records.length === 0) {
      console.error('❌ No NBA training records found');
      process.exit(1);
    }

    const analysis = analyzeNBAData(records);

    // Save analysis results
    const outputPath = '/app/apps/api/ml-training-data/nba_analysis_results.json';
    fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));

    console.log(`\n💾 Analysis Results Saved:`);
    console.log(`  📁 ${outputPath}`);

    console.log(`\n🚀 NEXT STEPS FOR NBA MODEL:`);
    console.log(`  1. Set up Python ML environment with scikit-learn, xgboost`);
    console.log(`  2. Implement feature engineering pipeline (150+ features)`);
    console.log(`  3. Train XGBoost model with hyperparameter optimization`);
    console.log(`  4. Target: Achieve 55%+ win rate on NBA props`);
    console.log(`  5. Deploy for live NBA prop scoring`);

    console.log(`\n✅ NBA ANALYSIS COMPLETE!`);

  } catch (error) {
    console.error('❌ Error during NBA analysis:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}