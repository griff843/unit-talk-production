#!/usr/bin/env tsx
/**
 * COMPREHENSIVE TABLE-BY-TABLE DATABASE ANALYSIS
 * Systematic audit of ALL tables to identify data quality issues
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

interface TableIssue {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  issue: string;
  impact: string;
  recommendation: string;
}

interface TableAnalysis {
  tableName: string;
  rowCount: number | null;
  columns: { name: string; type: string; nullable: boolean }[];
  issues: TableIssue[];
  sampleData: any[];
  nullPercentages: Record<string, number>;
}

const CRITICAL_TABLES = [
  'market_props',
  'scored_props',
  'raw_props',
  'users',
  'unified_picks',
  'games',
  'agent_health',
  'promotion_queue'
];

async function getAllTables(): Promise<string[]> {
  // Query information_schema for all tables
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_type', 'BASE TABLE');

  if (error) {
    console.error('Error fetching tables:', error);
    return CRITICAL_TABLES; // Fallback to known tables
  }

  return data?.map((t: any) => t.table_name) || CRITICAL_TABLES;
}

async function analyzeTable(tableName: string): Promise<TableAnalysis> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 ANALYZING: ${tableName}`);
  console.log('='.repeat(80));

  const analysis: TableAnalysis = {
    tableName,
    rowCount: null,
    columns: [],
    issues: [],
    sampleData: [],
    nullPercentages: {}
  };

  try {
    // Get row count
    const { count, error: countError } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    analysis.rowCount = count;
    console.log(`  Rows: ${count?.toLocaleString() || 'ERROR'}`);

    if (countError) {
      analysis.issues.push({
        severity: 'HIGH',
        issue: `Cannot query table: ${countError.message}`,
        impact: 'Table may have RLS issues or permission problems',
        recommendation: 'Check RLS policies and service role permissions'
      });
      console.log(`  ❌ Error: ${countError.message}`);
      return analysis;
    }

    // Get column information
    const { data: columns } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', tableName)
      .eq('table_schema', 'public');

    analysis.columns = columns?.map((col: any) => ({
      name: col.column_name,
      type: col.data_type,
      nullable: col.is_nullable === 'YES'
    })) || [];

    console.log(`  Columns: ${analysis.columns.length}`);

    // Get sample data (10 rows)
    const { data: sampleData } = await supabase
      .from(tableName)
      .select('*')
      .limit(10);

    analysis.sampleData = sampleData || [];

    // Check for null values in sample
    if (sampleData && sampleData.length > 0) {
      const firstRow = sampleData[0];
      const columnNames = Object.keys(firstRow);

      console.log(`\n  🔍 Checking data quality...`);

      // Count nulls in sample
      const nullCounts: Record<string, number> = {};
      columnNames.forEach(col => {
        nullCounts[col] = 0;
      });

      sampleData.forEach(row => {
        columnNames.forEach(col => {
          if (row[col] === null || row[col] === undefined || row[col] === '') {
            nullCounts[col]++;
          }
        });
      });

      // Calculate percentages
      columnNames.forEach(col => {
        const nullPercent = (nullCounts[col] / sampleData.length) * 100;
        analysis.nullPercentages[col] = nullPercent;

        if (nullPercent > 50) {
          analysis.issues.push({
            severity: 'HIGH',
            issue: `Column "${col}" is ${nullPercent.toFixed(0)}% null in sample`,
            impact: 'Missing critical data',
            recommendation: `Investigate why ${col} is mostly empty - may need backfill or schema fix`
          });
          console.log(`    ⚠️  ${col}: ${nullPercent.toFixed(0)}% null`);
        }
      });

      // Check for specific data quality issues
      await checkDataQuality(tableName, sampleData, analysis);
    }

    // Check row count sanity
    if (count !== null) {
      if (count === 0) {
        analysis.issues.push({
          severity: 'HIGH',
          issue: 'Table is empty',
          impact: 'No data available for processing',
          recommendation: 'Run ingestion or backfill scripts'
        });
      } else if (count > 10000000) {
        analysis.issues.push({
          severity: 'CRITICAL',
          issue: `Table has ${count.toLocaleString()} rows - abnormally high`,
          impact: 'Query performance degradation, storage issues',
          recommendation: 'Implement data retention policy, archive old data'
        });
      }
    }

  } catch (error) {
    analysis.issues.push({
      severity: 'CRITICAL',
      issue: `Failed to analyze table: ${error instanceof Error ? error.message : 'Unknown error'}`,
      impact: 'Cannot assess data quality',
      recommendation: 'Check database connection and permissions'
    });
    console.log(`  ❌ Analysis failed: ${error}`);
  }

  console.log(`  Issues found: ${analysis.issues.length}`);
  return analysis;
}

async function checkDataQuality(tableName: string, sampleData: any[], analysis: TableAnalysis) {
  const firstRow = sampleData[0];

  // Table-specific checks
  switch (tableName) {
    case 'market_props':
      checkMarketProps(sampleData, analysis);
      break;
    case 'scored_props':
      checkScoredProps(sampleData, analysis);
      break;
    case 'raw_props':
      checkRawProps(sampleData, analysis);
      break;
    case 'users':
      checkUsers(sampleData, analysis);
      break;
    case 'games':
      checkGames(sampleData, analysis);
      break;
  }
}

function checkMarketProps(sampleData: any[], analysis: TableAnalysis) {
  // Check player_name field
  const playerNames = sampleData.map(row => row.player_name?.toLowerCase() || '');
  const hasOverUnder = playerNames.filter(n => n === 'over' || n === 'under').length;
  const hasTeamNames = playerNames.filter(n =>
    n.includes('cowboys') || n.includes('eagles') || n.includes('patriots') ||
    n.includes('bulldogs') || n.includes('spartans')
  ).length;

  if (hasOverUnder > 0) {
    analysis.issues.push({
      severity: 'CRITICAL',
      issue: `player_name contains "Over"/"Under" (${hasOverUnder}/${sampleData.length})`,
      impact: 'Player props data is corrupted',
      recommendation: 'Fix oddsApi.ts to use outcome.description for player name extraction'
    });
  }

  if (hasTeamNames > 0) {
    analysis.issues.push({
      severity: 'HIGH',
      issue: `player_name contains team names (${hasTeamNames}/${sampleData.length})`,
      impact: 'Cannot distinguish game markets from player props',
      recommendation: 'Separate team markets from player props in ingestion logic'
    });
  }

  // Check for missing selection field on player props
  const playerProps = sampleData.filter(row => row.market?.startsWith('player_'));
  const missingSelection = playerProps.filter(row => !row.selection || row.selection === '').length;

  if (missingSelection > 0) {
    analysis.issues.push({
      severity: 'MEDIUM',
      issue: `${missingSelection} player props missing "selection" field (Over/Under)`,
      impact: 'Cannot determine bet direction',
      recommendation: 'Store outcome.name as selection field'
    });
  }

  // Check odds values
  const invalidOdds = sampleData.filter(row => !row.odds || row.odds === 0).length;
  if (invalidOdds > 0) {
    analysis.issues.push({
      severity: 'HIGH',
      issue: `${invalidOdds}/${sampleData.length} rows have missing/invalid odds`,
      impact: 'Cannot calculate scores or edge',
      recommendation: 'Ensure odds are populated during ingestion'
    });
  }
}

function checkScoredProps(sampleData: any[], analysis: TableAnalysis) {
  // Check for identical scores
  const scores = sampleData.map(row => row.professional_score);
  const uniqueScores = new Set(scores);

  if (uniqueScores.size === 1 && sampleData.length > 1) {
    analysis.issues.push({
      severity: 'CRITICAL',
      issue: 'ALL professional_score values are identical',
      impact: 'Scoring engine returning hardcoded/mock data',
      recommendation: 'Fix FeatureStoreIntegration.queryFeatures() method'
    });
  } else if (uniqueScores.size < sampleData.length * 0.3) {
    analysis.issues.push({
      severity: 'HIGH',
      issue: `Only ${uniqueScores.size} unique scores for ${sampleData.length} props`,
      impact: 'Scoring engine not differentiating between props',
      recommendation: 'Debug feature extraction and scoring logic'
    });
  }

  // Check kelly_fraction
  const nullKelly = sampleData.filter(row => row.kelly_fraction === null || row.kelly_fraction === 0).length;
  if (nullKelly > sampleData.length * 0.5) {
    analysis.issues.push({
      severity: 'HIGH',
      issue: `${(nullKelly/sampleData.length*100).toFixed(0)}% of kelly_fraction values are null/0`,
      impact: 'Cannot size bets properly',
      recommendation: 'Fix Kelly calculation in scoring engine'
    });
  }

  // Check edge values
  const edges = sampleData.map(row => row.edge);
  const uniqueEdges = new Set(edges);
  if (uniqueEdges.size === 1) {
    analysis.issues.push({
      severity: 'CRITICAL',
      issue: 'ALL edge values are identical',
      impact: 'Edge calculation not working',
      recommendation: 'Fix devigged EV calculation'
    });
  }

  // Check for missing prop_ref
  const missingPropRef = sampleData.filter(row => !row.prop_ref).length;
  if (missingPropRef > 0) {
    analysis.issues.push({
      severity: 'CRITICAL',
      issue: `${missingPropRef} rows missing prop_ref (foreign key)`,
      impact: 'Cannot link scored props back to market_props',
      recommendation: 'Ensure prop_ref is populated during scoring'
    });
  }
}

function checkRawProps(sampleData: any[], analysis: TableAnalysis) {
  // Check player_name quality
  const playerNames = sampleData.map(row => row.player_name?.toLowerCase() || '');
  const hasOverUnder = playerNames.filter(n => n === 'over' || n === 'under').length;

  if (hasOverUnder > 0) {
    analysis.issues.push({
      severity: 'CRITICAL',
      issue: `player_name contains "Over"/"Under" (${hasOverUnder}/${sampleData.length})`,
      impact: 'Raw data is corrupted from source',
      recommendation: 'Fix player name extraction at ingestion source'
    });
  }

  // Check for duplicate data
  const uniqueKeys = new Set(sampleData.map(row =>
    `${row.external_game_id}-${row.stat_type}-${row.player_name}`
  ));

  if (uniqueKeys.size < sampleData.length) {
    analysis.issues.push({
      severity: 'MEDIUM',
      issue: 'Duplicate rows detected in sample',
      impact: 'Inflated row counts, wasted storage',
      recommendation: 'Add unique constraints or implement deduplication'
    });
  }
}

function checkUsers(sampleData: any[], analysis: TableAnalysis) {
  // Check for missing discord_id
  const missingDiscord = sampleData.filter(row => !row.discord_id).length;
  if (missingDiscord > 0) {
    analysis.issues.push({
      severity: 'HIGH',
      issue: `${missingDiscord}/${sampleData.length} users missing discord_id`,
      impact: 'Cannot link users to Discord',
      recommendation: 'Populate discord_id during user creation'
    });
  }

  // Check for missing username
  const missingUsername = sampleData.filter(row => !row.username).length;
  if (missingUsername > 0) {
    analysis.issues.push({
      severity: 'HIGH',
      issue: `${missingUsername}/${sampleData.length} users missing username`,
      impact: 'Cannot identify users',
      recommendation: 'Enforce username requirement'
    });
  }
}

function checkGames(sampleData: any[], analysis: TableAnalysis) {
  // Check for missing teams
  const missingHomeTeam = sampleData.filter(row => !row.home_team).length;
  const missingAwayTeam = sampleData.filter(row => !row.away_team).length;

  if (missingHomeTeam > 0 || missingAwayTeam > 0) {
    analysis.issues.push({
      severity: 'HIGH',
      issue: `Missing team data: home=${missingHomeTeam}, away=${missingAwayTeam}`,
      impact: 'Cannot display matchups properly',
      recommendation: 'Ensure team data is populated from API'
    });
  }

  // Check for missing commence_time
  const missingTime = sampleData.filter(row => !row.commence_time).length;
  if (missingTime > 0) {
    analysis.issues.push({
      severity: 'HIGH',
      issue: `${missingTime}/${sampleData.length} games missing commence_time`,
      impact: 'Cannot schedule or filter games',
      recommendation: 'Populate commence_time from API'
    });
  }
}

async function generateReport(analyses: TableAnalysis[]) {
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE DATABASE ANALYSIS REPORT');
  console.log('='.repeat(80));

  // Summary statistics
  const totalTables = analyses.length;
  const tablesWithIssues = analyses.filter(a => a.issues.length > 0).length;
  const criticalIssues = analyses.reduce((sum, a) =>
    sum + a.issues.filter(i => i.severity === 'CRITICAL').length, 0
  );
  const highIssues = analyses.reduce((sum, a) =>
    sum + a.issues.filter(i => i.severity === 'HIGH').length, 0
  );

  console.log(`\n📈 SUMMARY:`);
  console.log(`  Total tables analyzed: ${totalTables}`);
  console.log(`  Tables with issues: ${tablesWithIssues}`);
  console.log(`  🚨 CRITICAL issues: ${criticalIssues}`);
  console.log(`  ⚠️  HIGH issues: ${highIssues}`);

  // List all issues by severity
  console.log('\n\n🚨 CRITICAL ISSUES:');
  console.log('-'.repeat(80));
  analyses.forEach(analysis => {
    const critical = analysis.issues.filter(i => i.severity === 'CRITICAL');
    if (critical.length > 0) {
      console.log(`\n${analysis.tableName}:`);
      critical.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue.issue}`);
        console.log(`     Impact: ${issue.impact}`);
        console.log(`     Fix: ${issue.recommendation}`);
      });
    }
  });

  console.log('\n\n⚠️  HIGH PRIORITY ISSUES:');
  console.log('-'.repeat(80));
  analyses.forEach(analysis => {
    const high = analysis.issues.filter(i => i.severity === 'HIGH');
    if (high.length > 0) {
      console.log(`\n${analysis.tableName}:`);
      high.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue.issue}`);
        console.log(`     Fix: ${issue.recommendation}`);
      });
    }
  });

  // Generate remediation plan
  console.log('\n\n' + '='.repeat(80));
  console.log('🔧 SYSTEMATIC REMEDIATION PLAN');
  console.log('='.repeat(80));

  const plan = generateRemediationPlan(analyses);
  plan.forEach((step, i) => {
    console.log(`\n${i + 1}. ${step.title}`);
    console.log(`   Priority: ${step.priority}`);
    console.log(`   Tables: ${step.tables.join(', ')}`);
    console.log(`   Action: ${step.action}`);
    if (step.command) {
      console.log(`   Command: ${step.command}`);
    }
  });

  // Save to file
  const reportPath = path.join(__dirname, '../../out/ops/DB_COMPREHENSIVE_ANALYSIS.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalTables,
      tablesWithIssues,
      criticalIssues,
      highIssues
    },
    analyses,
    remediationPlan: plan
  }, null, 2));

  console.log(`\n\n📄 Full report saved to: ${reportPath}`);
}

function generateRemediationPlan(analyses: TableAnalysis[]) {
  const plan = [];

  // Priority 1: Fix scoring engine
  if (analyses.find(a => a.tableName === 'scored_props')?.issues.some(i =>
    i.issue.includes('identical') || i.issue.includes('hardcoded')
  )) {
    plan.push({
      title: 'FIX SCORING ENGINE (CRITICAL)',
      priority: 'P0',
      tables: ['scored_props'],
      action: 'Implement FeatureStoreIntegration.queryFeatures() method',
      command: null
    });
  }

  // Priority 2: Fix player name extraction
  const tablesWithPlayerNameIssues = analyses.filter(a =>
    a.issues.some(i => i.issue.includes('player_name') && i.issue.includes('Over'))
  ).map(a => a.tableName);

  if (tablesWithPlayerNameIssues.length > 0) {
    plan.push({
      title: 'FIX PLAYER NAME EXTRACTION',
      priority: 'P0',
      tables: tablesWithPlayerNameIssues,
      action: 'Update oddsApi.ts to use outcome.description for player props',
      command: 'Already fixed in commit 11ae674 - need to re-ingest data'
    });
  }

  // Priority 3: Clean up large tables
  const largeTables = analyses.filter(a => a.rowCount && a.rowCount > 1000000);
  if (largeTables.length > 0) {
    plan.push({
      title: 'CLEANUP LARGE TABLES',
      priority: 'P1',
      tables: largeTables.map(t => t.tableName),
      action: 'Implement data retention policy (7 days)',
      command: 'DELETE FROM raw_props WHERE game_date < NOW() - INTERVAL \'7 days\''
    });
  }

  // Priority 4: Fix null values
  const tablesWithNulls = analyses.filter(a =>
    Object.values(a.nullPercentages).some(percent => percent > 50)
  );
  if (tablesWithNulls.length > 0) {
    plan.push({
      title: 'FIX MISSING DATA',
      priority: 'P2',
      tables: tablesWithNulls.map(t => t.tableName),
      action: 'Backfill missing data or update schema to make fields nullable',
      command: null
    });
  }

  // Priority 5: Fix referential integrity
  plan.push({
    title: 'VERIFY REFERENTIAL INTEGRITY',
    priority: 'P2',
    tables: ['scored_props', 'market_props', 'unified_picks'],
    action: 'Check foreign key constraints',
    command: null
  });

  return plan;
}

async function main() {
  console.log('🔍 STARTING COMPREHENSIVE TABLE-BY-TABLE DATABASE ANALYSIS');
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const tables = await getAllTables();
  console.log(`Found ${tables.length} tables to analyze\n`);

  const analyses: TableAnalysis[] = [];

  for (const tableName of tables) {
    try {
      const analysis = await analyzeTable(tableName);
      analyses.push(analysis);
    } catch (error) {
      console.error(`Failed to analyze ${tableName}:`, error);
    }
  }

  await generateReport(analyses);

  console.log('\n' + '='.repeat(80));
  console.log('✅ ANALYSIS COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
