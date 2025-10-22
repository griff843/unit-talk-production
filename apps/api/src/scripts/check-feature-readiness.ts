#!/usr/bin/env tsx

/**
 * Feature Readiness Checker
 *
 * Purpose: Determine if enough historical data exists for ML features
 * Features Checked:
 *   - Feature 2: Line velocity (needs 10+ snapshots)
 *   - Feature 3: Player form (needs 5+ games)
 *   - Feature 5: CLV prediction (needs 20+ snapshots)
 *
 * Usage: npx tsx src/scripts/check-feature-readiness.ts
 */

import { Client } from 'pg';

interface FeatureReadiness {
  featureId: number;
  featureName: string;
  description: string;
  requirement: string;
  ready: boolean;
  progress: number; // percentage
  propsReady: number;
  propsTotal: number;
  details: string;
}

interface ReadinessReport {
  overallReady: boolean;
  featuresReady: number;
  featuresTotal: number;
  features: FeatureReadiness[];
  recommendations: string[];
  estimatedTimeToReady: string;
}

async function checkFeatureReadiness(): Promise<void> {
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

    // Check each feature's readiness
    const features: FeatureReadiness[] = [];

    // Feature 2: Line Velocity
    features.push(await checkLineVelocityReadiness(client));

    // Feature 3: Player Form
    features.push(await checkPlayerFormReadiness(client));

    // Feature 5: CLV Prediction
    features.push(await checkCLVPredictionReadiness(client));

    // Generate overall report
    const report = generateReadinessReport(features);

    // Output results
    console.log('\n' + '='.repeat(80));
    console.log('🎯 ML FEATURE READINESS REPORT');
    console.log('='.repeat(80));
    console.log(`Generated: ${new Date().toISOString()}`);
    console.log('='.repeat(80));

    printFeatureStatus(features);
    printOverallStatus(report);
    printRecommendations(report.recommendations);

    // Save to file
    const outputPath = 'C:\\Users\\griff\\OneDrive\\Desktop\\unit-talk-production-main\\apps\\api\\out\\ops\\feature-readiness.json';
    const fs = require('fs');
    const output = {
      generatedAt: new Date().toISOString(),
      report,
    };
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n💾 Full report saved to: ${outputPath}`);

    // Exit code based on readiness
    if (!report.overallReady) {
      console.log('\n⚠️  System not ready for full ML feature deployment');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error checking feature readiness:', error);
    throw error;
  } finally {
    await client.end();
  }
}

async function checkLineVelocityReadiness(client: Client): Promise<FeatureReadiness> {
  // Feature 2 needs 10+ snapshots per prop to calculate velocity trends
  const query = `
    WITH prop_counts AS (
      SELECT
        CONCAT(player_name, '|', sport, '|', stat_type, '|', source) as prop_group,
        COUNT(*) as snapshot_count
      FROM raw_props
      WHERE
        player_name IS NOT NULL
        AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY player_name, sport, stat_type, source
    )
    SELECT
      COUNT(*) as total_props,
      COUNT(*) FILTER (WHERE snapshot_count >= 10) as ready_props,
      AVG(snapshot_count) as avg_snapshots,
      MAX(snapshot_count) as max_snapshots
    FROM prop_counts
  `;

  const result = await client.query(query);
  const row = result.rows[0];
  const totalProps = parseInt(row.total_props) || 0;
  const readyProps = parseInt(row.ready_props) || 0;
  const avgSnapshots = parseFloat(row.avg_snapshots) || 0;
  const maxSnapshots = parseInt(row.max_snapshots) || 0;

  const progress = totalProps > 0 ? (readyProps / totalProps) * 100 : 0;
  const ready = progress >= 80; // 80% of props need 10+ snapshots

  return {
    featureId: 2,
    featureName: 'Line Velocity Tracking',
    description: 'Tracks rate of line movement over time',
    requirement: '10+ snapshots per prop (80% of props)',
    ready,
    progress,
    propsReady: readyProps,
    propsTotal: totalProps,
    details: `Avg snapshots: ${avgSnapshots.toFixed(1)}, Max: ${maxSnapshots}`,
  };
}

async function checkPlayerFormReadiness(client: Client): Promise<FeatureReadiness> {
  // Feature 3 needs 5+ games per player to establish form trends
  const query = `
    WITH player_games AS (
      SELECT
        player_name,
        sport,
        COUNT(DISTINCT external_game_id) as game_count
      FROM raw_props
      WHERE
        player_name IS NOT NULL
        AND external_game_id IS NOT NULL
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY player_name, sport
    )
    SELECT
      COUNT(*) as total_players,
      COUNT(*) FILTER (WHERE game_count >= 5) as ready_players,
      AVG(game_count) as avg_games,
      MAX(game_count) as max_games
    FROM player_games
  `;

  const result = await client.query(query);
  const row = result.rows[0];
  const totalPlayers = parseInt(row.total_players) || 0;
  const readyPlayers = parseInt(row.ready_players) || 0;
  const avgGames = parseFloat(row.avg_games) || 0;
  const maxGames = parseInt(row.max_games) || 0;

  const progress = totalPlayers > 0 ? (readyPlayers / totalPlayers) * 100 : 0;
  const ready = progress >= 50; // 50% of players need 5+ games

  return {
    featureId: 3,
    featureName: 'Player Form Analysis',
    description: 'Analyzes player performance trends across recent games',
    requirement: '5+ games per player (50% of players)',
    ready,
    progress,
    propsReady: readyPlayers,
    propsTotal: totalPlayers,
    details: `Avg games: ${avgGames.toFixed(1)}, Max: ${maxGames}`,
  };
}

async function checkCLVPredictionReadiness(client: Client): Promise<FeatureReadiness> {
  // Feature 5 needs 20+ snapshots per prop to predict closing line value
  const query = `
    WITH prop_counts AS (
      SELECT
        CONCAT(player_name, '|', sport, '|', stat_type, '|', source) as prop_group,
        COUNT(*) as snapshot_count
      FROM raw_props
      WHERE
        player_name IS NOT NULL
        AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY player_name, sport, stat_type, source
    )
    SELECT
      COUNT(*) as total_props,
      COUNT(*) FILTER (WHERE snapshot_count >= 20) as ready_props,
      AVG(snapshot_count) as avg_snapshots,
      MAX(snapshot_count) as max_snapshots
    FROM prop_counts
  `;

  const result = await client.query(query);
  const row = result.rows[0];
  const totalProps = parseInt(row.total_props) || 0;
  const readyProps = parseInt(row.ready_props) || 0;
  const avgSnapshots = parseFloat(row.avg_snapshots) || 0;
  const maxSnapshots = parseInt(row.max_snapshots) || 0;

  const progress = totalProps > 0 ? (readyProps / totalProps) * 100 : 0;
  const ready = progress >= 60; // 60% of props need 20+ snapshots

  return {
    featureId: 5,
    featureName: 'CLV Prediction',
    description: 'Predicts closing line value based on movement patterns',
    requirement: '20+ snapshots per prop (60% of props)',
    ready,
    progress,
    propsReady: readyProps,
    propsTotal: totalProps,
    details: `Avg snapshots: ${avgSnapshots.toFixed(1)}, Max: ${maxSnapshots}`,
  };
}

function generateReadinessReport(features: FeatureReadiness[]): ReadinessReport {
  const featuresReady = features.filter((f) => f.ready).length;
  const featuresTotal = features.length;
  const overallReady = featuresReady === featuresTotal;

  const recommendations: string[] = [];

  if (overallReady) {
    recommendations.push('✅ All features ready for deployment!');
    recommendations.push('🚀 You can now enable ML-driven prop selection');
  } else {
    recommendations.push('⚠️  Continue polling to gather more historical data');

    features.forEach((feature) => {
      if (!feature.ready) {
        if (feature.progress < 25) {
          recommendations.push(`❌ ${feature.featureName}: Critical - only ${feature.progress.toFixed(1)}% ready`);
        } else if (feature.progress < 50) {
          recommendations.push(`⚠️  ${feature.featureName}: Low - ${feature.progress.toFixed(1)}% ready`);
        } else {
          recommendations.push(`ℹ️  ${feature.featureName}: Almost ready - ${feature.progress.toFixed(1)}% complete`);
        }
      }
    });
  }

  // Estimate time to ready
  const minProgress = Math.min(...features.map((f) => f.progress));
  let estimatedTimeToReady = 'Unknown';
  if (minProgress < 10) {
    estimatedTimeToReady = '12-24 hours';
  } else if (minProgress < 25) {
    estimatedTimeToReady = '6-12 hours';
  } else if (minProgress < 50) {
    estimatedTimeToReady = '3-6 hours';
  } else if (minProgress < 75) {
    estimatedTimeToReady = '1-3 hours';
  } else if (!overallReady) {
    estimatedTimeToReady = '30-60 minutes';
  } else {
    estimatedTimeToReady = 'Ready now';
  }

  return {
    overallReady,
    featuresReady,
    featuresTotal,
    features,
    recommendations,
    estimatedTimeToReady,
  };
}

function printFeatureStatus(features: FeatureReadiness[]): void {
  console.log('\n📊 FEATURE STATUS');
  console.log('-'.repeat(80));

  features.forEach((feature) => {
    const statusIcon = feature.ready ? '✅' : '⏳';
    const progressBar = generateProgressBar(feature.progress);

    console.log(`\n${statusIcon} Feature ${feature.featureId}: ${feature.featureName}`);
    console.log(`   Description: ${feature.description}`);
    console.log(`   Requirement: ${feature.requirement}`);
    console.log(`   Progress: ${progressBar} ${feature.progress.toFixed(1)}%`);
    console.log(`   Ready Props: ${feature.propsReady} / ${feature.propsTotal}`);
    console.log(`   Details: ${feature.details}`);
    console.log(`   Status: ${feature.ready ? 'READY ✅' : 'NOT READY ⏳'}`);
  });
}

function printOverallStatus(report: ReadinessReport): void {
  console.log('\n' + '='.repeat(80));
  console.log('📈 OVERALL READINESS');
  console.log('='.repeat(80));
  console.log(`Features Ready: ${report.featuresReady} / ${report.featuresTotal}`);
  console.log(`Overall Status: ${report.overallReady ? '✅ READY' : '⏳ NOT READY'}`);
  console.log(`Estimated Time to Ready: ${report.estimatedTimeToReady}`);
}

function printRecommendations(recommendations: string[]): void {
  console.log('\n💡 RECOMMENDATIONS');
  console.log('-'.repeat(80));
  recommendations.forEach((rec) => {
    console.log(`  ${rec}`);
  });
}

function generateProgressBar(progress: number, width: number = 20): string {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

// Main execution
if (require.main === module) {
  checkFeatureReadiness()
    .then(() => {
      console.log('\n✅ Feature readiness check complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

export { checkFeatureReadiness };
