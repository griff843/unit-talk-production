/**
 * Generate Training Data from Player Stats
 *
 * Strategy: Use 134,970 player_stats to create synthetic "outcomes" for ML training
 * This gives us 100K+ training examples without needing to wait for games
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface TrainingExample {
  player_name: string;
  sport: string;
  game_date: string;
  market_type: string;
  line: number;
  actual_value: number;
  outcome: 'win' | 'loss' | 'push';
  predicted_prob?: number;
}

async function generateTrainingData() {
  console.log('🔬 Generating Training Data from 135K Player Stats...\n');

  const { data: stats, error } = await supabase
    .from('player_stats')
    .select('*')
    .eq('sport', 'MLB');

  if (error || !stats) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`📊 Processing ${stats.length.toLocaleString()} MLB stats...\n`);

  const trainingExamples: TrainingExample[] = [];
  const marketTypes = ['hits', 'totalBases', 'homeRuns', 'rbi', 'runs', 'strikeouts'];

  // Common line values for each market
  const linesByMarket: Record<string, number[]> = {
    hits: [0.5, 1.5, 2.5],
    totalBases: [0.5, 1.5, 2.5, 3.5],
    homeRuns: [0.5, 1.5],
    rbi: [0.5, 1.5, 2.5],
    runs: [0.5, 1.5],
    strikeouts: [3.5, 4.5, 5.5, 6.5]
  };

  for (const stat of stats) {
    const statData = stat.stats || {};

    // Generate training examples for each market type
    for (const market of marketTypes) {
      let actualValue = 0;

      // Map stat fields to market types
      switch (market) {
        case 'hits':
          actualValue = parseFloat(statData.hits || 0);
          break;
        case 'totalBases':
          actualValue = parseFloat(statData.totalBases || 0);
          break;
        case 'homeRuns':
          actualValue = parseFloat(statData.homeRuns || 0);
          break;
        case 'rbi':
          actualValue = parseFloat(statData.rbi || 0);
          break;
        case 'runs':
          actualValue = parseFloat(statData.runs || 0);
          break;
        case 'strikeouts':
          actualValue = parseFloat(statData.strikeouts || 0);
          break;
      }

      // Skip if we don't have this stat
      if (actualValue === 0 && market !== 'hits') continue;

      // Generate examples for each common line
      const lines = linesByMarket[market] || [0.5, 1.5];
      for (const line of lines) {
        let outcome: 'win' | 'loss' | 'push';

        if (actualValue > line) outcome = 'win';
        else if (actualValue < line) outcome = 'loss';
        else outcome = 'push';

        trainingExamples.push({
          player_name: stat.player_name,
          sport: 'MLB',
          game_date: stat.game_date,
          market_type: market,
          line: line,
          actual_value: actualValue,
          outcome: outcome,
        });
      }
    }
  }

  console.log(`✅ Generated ${trainingExamples.length.toLocaleString()} training examples\n`);

  // Calculate distribution
  const outcomes = {
    win: trainingExamples.filter(e => e.outcome === 'win').length,
    loss: trainingExamples.filter(e => e.outcome === 'loss').length,
    push: trainingExamples.filter(e => e.outcome === 'push').length,
  };

  const winRate = (outcomes.win / (outcomes.win + outcomes.loss)) * 100;

  console.log('📊 Training Data Distribution:');
  console.log(`  Wins: ${outcomes.win.toLocaleString()}`);
  console.log(`  Losses: ${outcomes.loss.toLocaleString()}`);
  console.log(`  Pushes: ${outcomes.push.toLocaleString()}`);
  console.log(`  Win Rate: ${winRate.toFixed(2)}%\n`);

  // Save to file
  const outDir = 'apps/api/out/ops/ml-training';
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(outDir, 'training-data.json'),
    JSON.stringify(trainingExamples, null, 2)
  );

  console.log(`💾 Saved to: ${outDir}/training-data.json\n`);

  // Insert into settled_outcomes for model training
  console.log('📥 Inserting into settled_outcomes table...');

  const batchSize = 1000;
  let inserted = 0;

  for (let i = 0; i < trainingExamples.length; i += batchSize) {
    const batch = trainingExamples.slice(i, i + batchSize);

    const rows = batch.map(ex => ({
      prop_id: `training_${ex.player_name}_${ex.game_date}_${ex.market_type}_${ex.line}`,
      sport: ex.sport,
      player_name: ex.player_name,
      market_type: ex.market_type,
      market: ex.market_type,
      line: ex.line,
      actual_value: ex.actual_value,
      actual: ex.actual_value,
      outcome: ex.outcome,
      decision: ex.outcome,
      game_date: ex.game_date,
      settled_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('settled_outcomes')
      .insert(rows);

    if (insertError) {
      console.error(`Batch ${i / batchSize + 1} error:`, insertError.message);
    } else {
      inserted += rows.length;
      console.log(`  Inserted batch ${i / batchSize + 1}: ${inserted.toLocaleString()} total`);
    }
  }

  console.log(`\n✅ Training data generation complete!`);
  console.log(`   Total examples: ${trainingExamples.length.toLocaleString()}`);
  console.log(`   Inserted to DB: ${inserted.toLocaleString()}`);

  process.exit(0);
}

generateTrainingData();
