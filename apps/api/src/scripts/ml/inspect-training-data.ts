/**
 * Inspect Database for ML Training Data
 *
 * This script checks what settled props data we have available for ML training.
 * It queries the database for settled picks across all sports and generates a report.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

interface DataReport {
  totalSettled: number;
  bySport: Record<string, number>;
  byResult: Record<string, number>;
  dateRange: { earliest: string; latest: string };
  sampleData: any[];
  tablesChecked: string[];
  dataQuality: {
    hasOutcomes: number;
    hasOdds: number;
    hasPlayerInfo: number;
    hasGameInfo: number;
  };
}

async function checkRawProps(): Promise<any> {
  console.log('\n📊 Checking raw_props table...');

  try {
    // Check if table exists and has settled data
    const { data, error, count } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: false })
      .not('result', 'is', null)
      .limit(10);

    if (error) {
      console.log('❌ raw_props table query error:', error.message);
      return null;
    }

    console.log(`✅ Found ${count} settled props in raw_props`);
    return { count, sample: data };
  } catch (err: any) {
    console.log('❌ raw_props table does not exist or is not accessible');
    return null;
  }
}

async function checkUnifiedPicks(): Promise<any> {
  console.log('\n📊 Checking unified_picks table...');

  try {
    const { data, error, count } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: false })
      .not('result', 'is', null)
      .limit(10);

    if (error) {
      console.log('❌ unified_picks table query error:', error.message);
      return null;
    }

    console.log(`✅ Found ${count} settled props in unified_picks`);
    return { count, sample: data };
  } catch (err: any) {
    console.log('❌ unified_picks table does not exist or is not accessible');
    return null;
  }
}

async function getDetailedStats(tableName: string): Promise<DataReport | null> {
  console.log(`\n📈 Getting detailed statistics from ${tableName}...`);

  try {
    // Get total count
    const { count: totalCount } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .not('result', 'is', null);

    if (!totalCount || totalCount === 0) {
      console.log('❌ No settled data found');
      return null;
    }

    // Get breakdown by sport
    const { data: sportData } = await supabase
      .from(tableName)
      .select('sport, result')
      .not('result', 'is', null);

    const bySport: Record<string, number> = {};
    const byResult: Record<string, number> = {};

    sportData?.forEach((row: any) => {
      bySport[row.sport] = (bySport[row.sport] || 0) + 1;
      byResult[row.result] = (byResult[row.result] || 0) + 1;
    });

    // Get date range
    const { data: dateData } = await supabase
      .from(tableName)
      .select('event_date, start_time')
      .not('result', 'is', null)
      .order('event_date', { ascending: true })
      .limit(1);

    const { data: latestData } = await supabase
      .from(tableName)
      .select('event_date, start_time')
      .not('result', 'is', null)
      .order('event_date', { ascending: false })
      .limit(1);

    // Get sample data for quality check
    const { data: sampleData } = await supabase
      .from(tableName)
      .select('*')
      .not('result', 'is', null)
      .limit(100);

    // Analyze data quality
    const dataQuality = {
      hasOutcomes: sampleData?.filter((d: any) => d.result).length || 0,
      hasOdds: sampleData?.filter((d: any) => d.over_odds || d.under_odds || d.odds).length || 0,
      hasPlayerInfo: sampleData?.filter((d: any) => d.player_name || d.player_id).length || 0,
      hasGameInfo: sampleData?.filter((d: any) => d.game_id || d.event_id).length || 0,
    };

    const report: DataReport = {
      totalSettled: totalCount,
      bySport,
      byResult,
      dateRange: {
        earliest: dateData?.[0]?.event_date || dateData?.[0]?.start_time || 'Unknown',
        latest: latestData?.[0]?.event_date || latestData?.[0]?.start_time || 'Unknown',
      },
      sampleData: sampleData?.slice(0, 5) || [],
      tablesChecked: [tableName],
      dataQuality,
    };

    return report;
  } catch (err: any) {
    console.error('❌ Error getting detailed stats:', err.message);
    return null;
  }
}

async function generateReport() {
  console.log('🔍 UNIT TALK ML TRAINING DATA INSPECTION');
  console.log('==========================================\n');

  // Check both tables
  const rawPropsResult = await checkRawProps();
  const unifiedPicksResult = await checkUnifiedPicks();

  let primaryTable: string | null = null;
  let primaryData: any = null;

  // Determine which table has data
  if (rawPropsResult && rawPropsResult.count > 0) {
    primaryTable = 'raw_props';
    primaryData = rawPropsResult;
  } else if (unifiedPicksResult && unifiedPicksResult.count > 0) {
    primaryTable = 'unified_picks';
    primaryData = unifiedPicksResult;
  }

  if (!primaryTable) {
    console.log('\n❌ NO SETTLED TRAINING DATA FOUND');
    console.log('==========================================');
    console.log('We need to either:');
    console.log('1. Import historical settled props from SGO or other sources');
    console.log('2. Wait for current picks to settle naturally');
    console.log('3. Use a different data source for training');
    console.log('\nCannot proceed with ML training without historical data.');
    process.exit(1);
  }

  console.log(`\n✅ PRIMARY DATA SOURCE: ${primaryTable}`);
  console.log(`   Total Settled Props: ${primaryData.count.toLocaleString()}`);

  // Get detailed statistics
  const report = await getDetailedStats(primaryTable);

  if (!report) {
    console.log('❌ Failed to generate detailed report');
    process.exit(1);
  }

  // Display detailed report
  console.log('\n📊 TRAINING DATA SUMMARY');
  console.log('==========================================');
  console.log(`Total Settled Props: ${report.totalSettled.toLocaleString()}`);
  console.log(`Date Range: ${report.dateRange.earliest} → ${report.dateRange.latest}`);

  console.log('\n🏈 By Sport:');
  Object.entries(report.bySport)
    .sort(([, a], [, b]) => b - a)
    .forEach(([sport, count]) => {
      const percentage = ((count / report.totalSettled) * 100).toFixed(1);
      console.log(`   ${sport.toUpperCase()}: ${count.toLocaleString()} (${percentage}%)`);
    });

  console.log('\n📈 By Result:');
  Object.entries(report.byResult)
    .sort(([, a], [, b]) => b - a)
    .forEach(([result, count]) => {
      const percentage = ((count / report.totalSettled) * 100).toFixed(1);
      console.log(`   ${result}: ${count.toLocaleString()} (${percentage}%)`);
    });

  console.log('\n✅ Data Quality (sample of 100):');
  console.log(`   Has Outcomes: ${report.dataQuality.hasOutcomes}/100`);
  console.log(`   Has Odds: ${report.dataQuality.hasOdds}/100`);
  console.log(`   Has Player Info: ${report.dataQuality.hasPlayerInfo}/100`);
  console.log(`   Has Game Info: ${report.dataQuality.hasGameInfo}/100`);

  console.log('\n📋 Sample Data (first 3 props):');
  report.sampleData.slice(0, 3).forEach((prop, i) => {
    console.log(`\n   ${i + 1}. ${prop.sport?.toUpperCase()} - ${prop.player_name || 'Unknown'}`);
    console.log(`      Market: ${prop.market_type || prop.stat_type || 'Unknown'}`);
    console.log(`      Line: ${prop.line}`);
    console.log(`      Odds: ${prop.over_odds || prop.odds || 'N/A'} / ${prop.under_odds || 'N/A'}`);
    console.log(`      Result: ${prop.result}`);
    console.log(`      Actual: ${prop.actual_value || 'N/A'}`);
  });

  // ML Readiness Assessment
  console.log('\n🤖 ML READINESS ASSESSMENT');
  console.log('==========================================');

  const mlReady = {
    sufficientData: report.totalSettled >= 10000,
    hasMultipleSports: Object.keys(report.bySport).length >= 3,
    hasOutcomes: report.dataQuality.hasOutcomes >= 90,
    hasOdds: report.dataQuality.hasOdds >= 90,
    hasPlayerInfo: report.dataQuality.hasPlayerInfo >= 80,
  };

  const readyChecks = Object.entries(mlReady);
  const passedChecks = readyChecks.filter(([, passed]) => passed).length;

  readyChecks.forEach(([check, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${check}`);
  });

  console.log(`\n   Overall Readiness: ${passedChecks}/${readyChecks.length} checks passed`);

  if (passedChecks === readyChecks.length) {
    console.log('\n🎉 READY FOR ML TRAINING!');
    console.log('==========================================');
    console.log('Next steps:');
    console.log('1. Export training data to CSV/Parquet format');
    console.log('2. Set up Python ML environment in Docker');
    console.log('3. Build feature engineering pipeline');
    console.log('4. Train models per sport');
    console.log('5. Deploy probability models to replace hardcoded 52%');
  } else {
    console.log('\n⚠️  NOT READY FOR ML TRAINING');
    console.log('==========================================');
    console.log('Need to address failing checks before proceeding.');
  }

  // Save report to file
  const reportPath = './ml-training-data-report.json';
  await Bun.write(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Full report saved to: ${reportPath}`);
}

// Run the inspection
generateReport().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
