#!/usr/bin/env npx tsx
/**
 * Export Training Data for ML Models
 * Extracts 142K settled props with all features needed for syndicate-level model training
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import { parse } from 'json2csv';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/unit_talk_dev'
});

interface TrainingRecord {
  // Identifiers
  prop_id: string;
  game_id: string;

  // Sport & Type
  sport: string;
  stat_type: string;

  // Player/Team Info
  player_name: string;

  // Betting Data
  line: number;
  over_odds: number | null;
  under_odds: number | null;

  // Outcome Data
  actual_value: number;
  result: string; // won/lost/push/cancelled

  // Temporal Features
  start_time: string;
  day_of_week: number;
  hour_of_day: number;
  month: number;

  // Derived Features (to be calculated)
  days_until_game: number;
  is_primetime: boolean;
  is_weekend: boolean;
}

async function exportTrainingData() {
  console.log('🚀 EXPORTING ML TRAINING DATA');
  console.log('================================\n');

  try {
    // First, get statistics about the data
    const statsQuery = `
      SELECT
        COUNT(*) as total_props,
        COUNT(CASE WHEN result = 'won' THEN 1 END) as won,
        COUNT(CASE WHEN result = 'lost' THEN 1 END) as lost,
        COUNT(CASE WHEN result = 'push' THEN 1 END) as push,
        COUNT(CASE WHEN result = 'cancelled' THEN 1 END) as cancelled
      FROM raw_props
      WHERE source = 'sgo'
      AND result IS NOT NULL
    `;

    const stats = await pool.query(statsQuery);
    console.log('📊 Training Data Statistics:');
    console.log(`  Total settled props: ${stats.rows[0].total_props}`);
    console.log(`  Won: ${stats.rows[0].won} (${(stats.rows[0].won / stats.rows[0].total_props * 100).toFixed(1)}%)`);
    console.log(`  Lost: ${stats.rows[0].lost} (${(stats.rows[0].lost / stats.rows[0].total_props * 100).toFixed(1)}%)`);
    console.log(`  Push: ${stats.rows[0].push}`);
    console.log(`  Cancelled: ${stats.rows[0].cancelled}\n`);

    // Main query to extract training data
    const dataQuery = `
      SELECT
        r.id as prop_id,
        r.game_id,
        r.sport,
        r.stat_type,
        r.player_name,
        r.line,
        r.over_odds,
        r.under_odds,
        r.actual_value,
        r.result,
        r.start_time,
        EXTRACT(DOW FROM r.start_time) as day_of_week,
        EXTRACT(HOUR FROM r.start_time) as hour_of_day,
        EXTRACT(MONTH FROM r.start_time) as month,
        EXTRACT(DAY FROM (r.start_time - r.created_at)) as days_until_game,
        CASE
          WHEN EXTRACT(HOUR FROM r.start_time) >= 19 THEN true
          ELSE false
        END as is_primetime,
        CASE
          WHEN EXTRACT(DOW FROM r.start_time) IN (0, 6) THEN true
          ELSE false
        END as is_weekend
      FROM raw_props r
      WHERE r.source = 'sgo'
      AND r.result IS NOT NULL
      AND r.result NOT IN ('cancelled', 'settled')
      ORDER BY r.start_time, r.sport, r.stat_type
    `;

    console.log('📥 Fetching training data from database...');
    const result = await pool.query(dataQuery);
    console.log(`✅ Fetched ${result.rows.length} training samples\n`);

    // Split by sport for sport-specific models
    const bySport: { [key: string]: any[] } = {};
    result.rows.forEach(row => {
      if (!bySport[row.sport]) {
        bySport[row.sport] = [];
      }
      bySport[row.sport].push(row);
    });

    // Create output directory
    const outputDir = path.join(process.cwd(), 'ml-training-data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Export complete dataset
    console.log('💾 Exporting complete dataset...');
    const allDataCsv = parse(result.rows, {
      header: true,
      fields: Object.keys(result.rows[0] || {})
    });
    fs.writeFileSync(path.join(outputDir, 'all_training_data.csv'), allDataCsv);
    console.log(`  ✅ Saved: all_training_data.csv (${result.rows.length} rows)\n`);

    // Export sport-specific datasets
    console.log('🏆 Exporting sport-specific datasets:');
    for (const [sport, data] of Object.entries(bySport)) {
      const sportCsv = parse(data, {
        header: true,
        fields: Object.keys(data[0] || {})
      });
      const filename = `${sport.toLowerCase()}_training_data.csv`;
      fs.writeFileSync(path.join(outputDir, filename), sportCsv);
      console.log(`  ✅ ${sport}: ${filename} (${data.length} rows)`);
    }

    // Create train/validation/test splits
    console.log('\n📊 Creating train/validation/test splits:');
    const shuffled = result.rows.sort(() => Math.random() - 0.5);
    const trainSize = Math.floor(shuffled.length * 0.6);
    const valSize = Math.floor(shuffled.length * 0.2);

    const trainData = shuffled.slice(0, trainSize);
    const valData = shuffled.slice(trainSize, trainSize + valSize);
    const testData = shuffled.slice(trainSize + valSize);

    // Save splits
    const splits = [
      { name: 'train', data: trainData, size: trainSize },
      { name: 'validation', data: valData, size: valSize },
      { name: 'test', data: testData, size: testData.length }
    ];

    for (const split of splits) {
      const csv = parse(split.data, {
        header: true,
        fields: Object.keys(split.data[0] || {})
      });
      fs.writeFileSync(path.join(outputDir, `${split.name}_data.csv`), csv);
      console.log(`  ✅ ${split.name}: ${split.size} samples (${(split.size / shuffled.length * 100).toFixed(1)}%)`);
    }

    // Create metadata file
    const metadata = {
      exportDate: new Date().toISOString(),
      totalSamples: result.rows.length,
      sportBreakdown: Object.entries(bySport).map(([sport, data]) => ({
        sport,
        count: data.length,
        percentage: (data.length / result.rows.length * 100).toFixed(1)
      })),
      splits: {
        train: trainSize,
        validation: valSize,
        test: testData.length
      },
      features: [
        'sport', 'stat_type', 'player_name', 'home_team', 'away_team',
        'line', 'over_odds', 'under_odds', 'actual_value', 'result',
        'day_of_week', 'hour_of_day', 'month', 'days_until_game',
        'is_primetime', 'is_weekend'
      ],
      targetVariable: 'result',
      notes: 'Exported from Unit Talk production database for syndicate-level ML training'
    };

    fs.writeFileSync(
      path.join(outputDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log('\n📁 All files saved to:', outputDir);
    console.log('\n✅ EXPORT COMPLETE!');
    console.log('🚀 Ready for ML model training!');

    // Create README for the data
    const readme = `# ML Training Data

## Overview
This directory contains training data exported from Unit Talk's production database for building syndicate-level betting models.

## Files
- **all_training_data.csv**: Complete dataset (${result.rows.length} samples)
- **train_data.csv**: Training set (60%)
- **validation_data.csv**: Validation set (20%)
- **test_data.csv**: Test set (20%)
- **[sport]_training_data.csv**: Sport-specific datasets
- **metadata.json**: Export metadata and feature descriptions

## Features
- Sport & stat type identifiers
- Player and team information
- Betting lines and odds
- Actual outcomes (won/lost/push)
- Temporal features (day, time, seasonality)
- Derived features (primetime, weekend, etc.)

## Usage
\`\`\`python
import pandas as pd

# Load training data
train_df = pd.read_csv('train_data.csv')
val_df = pd.read_csv('validation_data.csv')
test_df = pd.read_csv('test_data.csv')

# Target variable
y_train = train_df['result'].map({'won': 1, 'lost': 0})
X_train = train_df.drop(['result', 'prop_id', 'game_id'], axis=1)
\`\`\`

## Next Steps
1. Feature engineering (player stats, team performance, etc.)
2. Model training (XGBoost, Neural Networks, etc.)
3. Hyperparameter optimization
4. Ensemble creation
5. Backtesting validation

Generated: ${new Date().toISOString()}
`;

    fs.writeFileSync(path.join(outputDir, 'README.md'), readme);

  } catch (error) {
    console.error('❌ Export failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the export
if (require.main === module) {
  exportTrainingData().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}