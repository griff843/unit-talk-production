#!/usr/bin/env tsx
/**
 * COMPREHENSIVE DATABASE AUDIT
 * Deep analysis of data quality issues
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface AuditReport {
  timestamp: string;
  findings: string[];
  criticalIssues: string[];
  recommendations: string[];
}

async function comprehensiveAudit() {
  console.log('🔍 COMPREHENSIVE DATABASE AUDIT');
  console.log('='.repeat(80));
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    findings: [],
    criticalIssues: [],
    recommendations: []
  };

  // ============================================================================
  // SECTION 1: RAW_PROPS TABLE AUDIT
  // ============================================================================
  console.log('\n📊 SECTION 1: RAW_PROPS TABLE AUDIT');
  console.log('-'.repeat(80));

  try {
    // Total count
    const { count: totalRawProps } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    console.log(`Total rows: ${totalRawProps?.toLocaleString()}`);
    report.findings.push(`raw_props total: ${totalRawProps?.toLocaleString()} rows`);

    if (totalRawProps && totalRawProps > 1000000) {
      report.criticalIssues.push(`⚠️ raw_props has ${totalRawProps.toLocaleString()} rows - abnormally high for recent data`);
    }

    // Sample player_name field (first 100 rows)
    const { data: playerNameSample } = await supabase
      .from('raw_props')
      .select('player_name, stat_type, sport, game_date, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    console.log('\nPlayer name analysis (most recent 100 rows):');

    const playerNameTypes = {
      teamNames: 0,
      overUnder: 0,
      actualPlayers: 0,
      other: 0
    };

    const sampleNames: string[] = [];

    playerNameSample?.forEach(row => {
      const name = row.player_name?.toLowerCase() || '';

      if (name === 'over' || name === 'under') {
        playerNameTypes.overUnder++;
      } else if (
        name.includes('cowboys') || name.includes('eagles') ||
        name.includes('patriots') || name.includes('bulldogs') ||
        name.includes('spartans') || name.includes('bears')
      ) {
        playerNameTypes.teamNames++;
      } else if (name.length > 3) {
        playerNameTypes.actualPlayers++;
        if (sampleNames.length < 10) {
          sampleNames.push(row.player_name);
        }
      } else {
        playerNameTypes.other++;
      }
    });

    console.log(`  Over/Under values: ${playerNameTypes.overUnder}%`);
    console.log(`  Team names: ${playerNameTypes.teamNames}%`);
    console.log(`  Actual player names: ${playerNameTypes.actualPlayers}%`);
    console.log(`  Other: ${playerNameTypes.other}%`);

    if (playerNameTypes.overUnder > 10 || playerNameTypes.teamNames > 10) {
      report.criticalIssues.push(`❌ raw_props.player_name contains Over/Under (${playerNameTypes.overUnder}%) and team names (${playerNameTypes.teamNames}%)`);
    }

    if (sampleNames.length > 0) {
      console.log(`\n  Sample actual player names: ${sampleNames.slice(0, 5).join(', ')}`);
    }

    // Date range analysis
    const { data: dateRange } = await supabase
      .from('raw_props')
      .select('game_date, created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: oldestDate } = await supabase
      .from('raw_props')
      .select('game_date, created_at')
      .order('created_at', { ascending: true })
      .limit(1);

    console.log(`\n  Date range:`);
    console.log(`    Newest: ${dateRange?.[0]?.created_at} (game: ${dateRange?.[0]?.game_date})`);
    console.log(`    Oldest: ${oldestDate?.[0]?.created_at} (game: ${oldestDate?.[0]?.game_date})`);

    // Check for today's data
    const today = new Date().toISOString().split('T')[0];
    const { count: todayCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .gte('game_date', today);

    console.log(`    Today (${today}): ${todayCount?.toLocaleString()} rows`);

    if (todayCount && todayCount > 1000000) {
      report.criticalIssues.push(`❌ ${todayCount.toLocaleString()} rows for today's date - indicates duplicate/bulk ingestion issue`);
    }

  } catch (error) {
    report.criticalIssues.push(`❌ Error auditing raw_props: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // ============================================================================
  // SECTION 2: MARKET_PROPS TABLE AUDIT
  // ============================================================================
  console.log('\n\n📊 SECTION 2: MARKET_PROPS TABLE AUDIT');
  console.log('-'.repeat(80));

  try {
    const { count: totalMarketProps } = await supabase
      .from('market_props')
      .select('*', { count: 'exact', head: true });

    console.log(`Total rows: ${totalMarketProps?.toLocaleString()}`);
    report.findings.push(`market_props total: ${totalMarketProps?.toLocaleString()} rows`);

    // Sample player names from market_props
    const { data: marketSample } = await supabase
      .from('market_props')
      .select('player_name, market, sport, game_date, selection')
      .order('created_at', { ascending: false })
      .limit(50);

    console.log('\nPlayer name analysis (most recent 50 rows):');

    const marketNameTypes = {
      teamNames: 0,
      overUnder: 0,
      actualPlayers: 0,
      other: 0
    };

    const marketPlayerSample: string[] = [];

    marketSample?.forEach(row => {
      const name = row.player_name?.toLowerCase() || '';

      if (name === 'over' || name === 'under') {
        marketNameTypes.overUnder++;
      } else if (
        name.includes('cowboys') || name.includes('eagles') ||
        name.includes('patriots') || name.includes('bulldogs')
      ) {
        marketNameTypes.teamNames++;
      } else if (name.length > 3 && !name.includes('over') && !name.includes('under')) {
        marketNameTypes.actualPlayers++;
        if (marketPlayerSample.length < 10) {
          marketPlayerSample.push(row.player_name);
        }
      } else {
        marketNameTypes.other++;
      }
    });

    console.log(`  Over/Under values: ${marketNameTypes.overUnder} (${(marketNameTypes.overUnder/50*100).toFixed(1)}%)`);
    console.log(`  Team names: ${marketNameTypes.teamNames} (${(marketNameTypes.teamNames/50*100).toFixed(1)}%)`);
    console.log(`  Actual player names: ${marketNameTypes.actualPlayers} (${(marketNameTypes.actualPlayers/50*100).toFixed(1)}%)`);

    if (marketPlayerSample.length > 0) {
      console.log(`\n  Sample player names: ${marketPlayerSample.slice(0, 10).join(', ')}`);
    }

    // Check selection field
    const { data: selectionSample } = await supabase
      .from('market_props')
      .select('selection, market')
      .ilike('market', 'player%')
      .limit(20);

    console.log('\n  Selection field (player props):');
    const selections = new Set(selectionSample?.map(s => s.selection));
    console.log(`    Unique values: ${Array.from(selections).join(', ')}`);

  } catch (error) {
    report.criticalIssues.push(`❌ Error auditing market_props: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // ============================================================================
  // SECTION 3: SCORED_PROPS TABLE AUDIT
  // ============================================================================
  console.log('\n\n📊 SECTION 3: SCORED_PROPS TABLE AUDIT');
  console.log('-'.repeat(80));

  try {
    const { data: scoredSample } = await supabase
      .from('scored_props')
      .select('professional_score, tier, edge, confidence, kelly_fraction, metadata')
      .order('updated_at', { ascending: false })
      .limit(50);

    console.log(`Total sampled: ${scoredSample?.length || 0} rows\n`);

    // Check for hardcoded values
    const scores = scoredSample?.map(s => s.professional_score) || [];
    const uniqueScores = new Set(scores);
    const edges = scoredSample?.map(s => s.edge) || [];
    const uniqueEdges = new Set(edges);
    const kellys = scoredSample?.map(s => s.kelly_fraction) || [];
    const uniqueKellys = new Set(kellys);

    console.log('Value diversity analysis:');
    console.log(`  Unique professional_score values: ${uniqueScores.size}/${scores.length}`);
    console.log(`  Unique edge values: ${uniqueEdges.size}/${edges.length}`);
    console.log(`  Unique kelly_fraction values: ${uniqueKellys.size}/${kellys.length}`);

    if (uniqueScores.size === 1) {
      report.criticalIssues.push(`❌ ALL professional_score values are identical: ${Array.from(uniqueScores)[0]} - hardcoded/mock data`);
    }

    if (uniqueEdges.size === 1) {
      report.criticalIssues.push(`❌ ALL edge values are identical: ${Array.from(uniqueEdges)[0]} - hardcoded/mock data`);
    }

    // Kelly fraction analysis
    const nullKellys = kellys.filter(k => k === null || k === undefined).length;
    const zeroKellys = kellys.filter(k => k === 0).length;
    const validKellys = kellys.filter(k => k && k > 0).length;

    console.log(`\n  Kelly fraction breakdown:`);
    console.log(`    Null/undefined: ${nullKellys} (${(nullKellys/kellys.length*100).toFixed(1)}%)`);
    console.log(`    Zero: ${zeroKellys} (${(zeroKellys/kellys.length*100).toFixed(1)}%)`);
    console.log(`    Valid (>0): ${validKellys} (${(validKellys/kellys.length*100).toFixed(1)}%)`);

    if (nullKellys > kellys.length * 0.5) {
      report.criticalIssues.push(`❌ ${(nullKellys/kellys.length*100).toFixed(1)}% of kelly_fraction values are null`);
    }

    // Sample some scores
    console.log('\n  Sample professional_score values:');
    scores.slice(0, 10).forEach((score, i) => {
      console.log(`    ${i + 1}. ${score}`);
    });

    // Check metadata for scoring details
    const withMetadata = scoredSample?.filter(s => s.metadata && typeof s.metadata === 'object') || [];
    console.log(`\n  Rows with metadata: ${withMetadata.length}/${scoredSample?.length || 0}`);

    if (withMetadata.length > 0) {
      const sample = withMetadata[0];
      console.log('\n  Sample metadata structure:');
      console.log(`    ${JSON.stringify(sample.metadata, null, 2)}`);
    }

  } catch (error) {
    report.criticalIssues.push(`❌ Error auditing scored_props: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // ============================================================================
  // SECTION 4: DATA RELATIONSHIPS
  // ============================================================================
  console.log('\n\n📊 SECTION 4: DATA RELATIONSHIPS');
  console.log('-'.repeat(80));

  try {
    // Check if market_props references match scored_props
    const { data: marketIds } = await supabase
      .from('market_props')
      .select('id')
      .gte('game_date', new Date().toISOString().split('T')[0])
      .limit(100);

    const ids = marketIds?.map(m => m.id) || [];

    const { data: scoredMatches } = await supabase
      .from('scored_props')
      .select('prop_ref')
      .in('prop_ref', ids);

    const matchRate = ids.length > 0 ? (scoredMatches?.length || 0) / ids.length * 100 : 0;

    console.log(`Scoring coverage for today's market_props:`);
    console.log(`  market_props sample: ${ids.length}`);
    console.log(`  scored_props matches: ${scoredMatches?.length || 0}`);
    console.log(`  Match rate: ${matchRate.toFixed(1)}%`);

    if (matchRate < 10) {
      report.criticalIssues.push(`❌ Only ${matchRate.toFixed(1)}% of market_props are scored`);
    }

  } catch (error) {
    report.criticalIssues.push(`❌ Error checking relationships: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // ============================================================================
  // FINAL REPORT
  // ============================================================================
  console.log('\n\n' + '='.repeat(80));
  console.log('🚨 CRITICAL ISSUES FOUND');
  console.log('='.repeat(80));

  if (report.criticalIssues.length === 0) {
    console.log('✅ No critical issues found');
  } else {
    report.criticalIssues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('💡 RECOMMENDATIONS');
  console.log('='.repeat(80));

  // Generate recommendations based on findings
  if (report.criticalIssues.some(i => i.includes('raw_props'))) {
    report.recommendations.push('🔧 Clean up raw_props: Delete rows older than 7 days');
    report.recommendations.push('🔧 Re-run ingestion with player props fix for fresh data');
  }

  if (report.criticalIssues.some(i => i.includes('Over/Under') || i.includes('team names'))) {
    report.recommendations.push('🔧 Fix player name extraction in oddsApi.ts (use outcome.description)');
    report.recommendations.push('🔧 Backfill market_props with corrected player names');
  }

  if (report.criticalIssues.some(i => i.includes('hardcoded') || i.includes('identical'))) {
    report.recommendations.push('❌ Enhanced45FactorEngine is returning mock/default values');
    report.recommendations.push('🔧 Debug scoring engine - check if feature extraction is working');
    report.recommendations.push('🔧 Verify calibration models are loaded correctly');
  }

  if (report.criticalIssues.some(i => i.includes('kelly_fraction'))) {
    report.recommendations.push('🔧 Fix Kelly fraction calculation in scoring engine');
    report.recommendations.push('🔧 Ensure edge > 0 before calculating Kelly');
  }

  if (report.recommendations.length === 0) {
    report.recommendations.push('✅ System appears healthy - no immediate action needed');
  }

  report.recommendations.forEach((rec, i) => {
    console.log(`${i + 1}. ${rec}`);
  });

  // Save report
  const reportPath = path.join(__dirname, '../../out/ops/DB_AUDIT_REPORT.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n📄 Full report saved to: ${reportPath}`);
  console.log('='.repeat(80));

  process.exit(report.criticalIssues.length > 0 ? 1 : 0);
}

comprehensiveAudit().catch(error => {
  console.error('❌ Audit failed:', error);
  process.exit(1);
});
