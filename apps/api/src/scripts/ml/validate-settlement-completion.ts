/**
 * Settlement Validation Script
 *
 * Validates settlement completion and identifies issues
 * Produces actionable report on settlement quality
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface ValidationReport {
  overall: {
    totalProps: number;
    settledProps: number;
    unsettledProps: number;
    settlementRate: number;
    passesTarget: boolean;
  };
  bySport: Record<string, {
    total: number;
    settled: number;
    settlementRate: number;
  }>;
  byStatType: Record<string, {
    total: number;
    settled: number;
    settlementRate: number;
  }>;
  unsettledReasons: Array<{
    sport: string;
    statType: string;
    count: number;
    pctOfUnsettled: number;
    samplePropId: string;
  }>;
  settlementQuality: {
    outcomeDistribution: Record<string, number>;
    avgActualValue: number;
    nullActualValues: number;
  };
  recommendations: string[];
}

async function validateSettlement(): Promise<ValidationReport> {
  console.log('🔍 SETTLEMENT VALIDATION');
  console.log('='.repeat(80), '\n');

  const report: ValidationReport = {
    overall: {
      totalProps: 0,
      settledProps: 0,
      unsettledProps: 0,
      settlementRate: 0,
      passesTarget: false
    },
    bySport: {},
    byStatType: {},
    unsettledReasons: [],
    settlementQuality: {
      outcomeDistribution: {},
      avgActualValue: 0,
      nullActualValues: 0
    },
    recommendations: []
  };

  // Overall stats
  console.log('📊 Overall Statistics...');

  const { count: totalProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true });

  const { count: settledProps } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .not('settled_at', 'is', null);

  report.overall.totalProps = totalProps || 0;
  report.overall.settledProps = settledProps || 0;
  report.overall.unsettledProps = (totalProps || 0) - (settledProps || 0);
  report.overall.settlementRate = ((settledProps || 0) / (totalProps || 1)) * 100;
  report.overall.passesTarget = report.overall.settlementRate >= 95;

  console.log(`   Total Props: ${report.overall.totalProps.toLocaleString()}`);
  console.log(`   Settled: ${report.overall.settledProps.toLocaleString()}`);
  console.log(`   Unsettled: ${report.overall.unsettledProps.toLocaleString()}`);
  console.log(`   Settlement Rate: ${report.overall.settlementRate.toFixed(2)}%`);
  console.log(`   Passes >95% Target: ${report.overall.passesTarget ? '✅ YES' : '❌ NO'}\n`);

  // By sport
  console.log('🏈 Settlement by Sport...');

  const { data: sportStats } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        rp.sport,
        COUNT(*) as total,
        COUNT(up.settled_at) as settled,
        ROUND(COUNT(up.settled_at)::NUMERIC / COUNT(*) * 100, 2) as settlement_rate
      FROM raw_props rp
      LEFT JOIN unified_picks up ON rp.id::TEXT = up.external_prop_id
      WHERE rp.sport IS NOT NULL
      GROUP BY rp.sport
      ORDER BY total DESC;
    `
  });

  if (sportStats) {
    sportStats.forEach((row: any) => {
      report.bySport[row.sport] = {
        total: parseInt(row.total),
        settled: parseInt(row.settled),
        settlementRate: parseFloat(row.settlement_rate)
      };

      console.log(`   ${row.sport}: ${row.settled}/${row.total} (${row.settlement_rate}%)`);
    });
  }

  console.log('');

  // By stat type (top 20 unsettled)
  console.log('📈 Settlement by Stat Type (Top 20 Unsettled)...');

  const { data: statTypeStats } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        rp.stat_type,
        COUNT(*) as total,
        COUNT(up.settled_at) as settled,
        ROUND(COUNT(up.settled_at)::NUMERIC / COUNT(*) * 100, 2) as settlement_rate
      FROM raw_props rp
      LEFT JOIN unified_picks up ON rp.id::TEXT = up.external_prop_id
      WHERE rp.stat_type IS NOT NULL
      GROUP BY rp.stat_type
      ORDER BY (COUNT(*) - COUNT(up.settled_at)) DESC
      LIMIT 20;
    `
  });

  if (statTypeStats) {
    statTypeStats.forEach((row: any) => {
      report.byStatType[row.stat_type] = {
        total: parseInt(row.total),
        settled: parseInt(row.settled),
        settlementRate: parseFloat(row.settlement_rate)
      };

      const unsettled = parseInt(row.total) - parseInt(row.settled);
      console.log(`   ${row.stat_type}: ${row.settled}/${row.total} (${row.settlement_rate}%) - ${unsettled} unsettled`);
    });
  }

  console.log('');

  // Unsettled reasons analysis
  console.log('🔍 Top Unsettled Combinations (Sport + StatType)...');

  const { data: unsettledReasons } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        rp.sport,
        rp.stat_type,
        COUNT(*) as count,
        MIN(rp.id) as sample_prop_id
      FROM raw_props rp
      LEFT JOIN unified_picks up ON rp.id::TEXT = up.external_prop_id
      WHERE up.settled_at IS NULL
      GROUP BY rp.sport, rp.stat_type
      ORDER BY count DESC
      LIMIT 20;
    `
  });

  if (unsettledReasons) {
    const totalUnsettled = report.overall.unsettledProps;

    unsettledReasons.forEach((row: any) => {
      const count = parseInt(row.count);
      const pctOfUnsettled = (count / totalUnsettled) * 100;

      report.unsettledReasons.push({
        sport: row.sport,
        statType: row.stat_type,
        count,
        pctOfUnsettled,
        samplePropId: row.sample_prop_id
      });

      console.log(`   ${row.sport} - ${row.stat_type}: ${count} (${pctOfUnsettled.toFixed(1)}% of unsettled)`);
    });
  }

  console.log('');

  // Settlement quality
  console.log('✅ Settlement Quality...');

  const { data: outcomes } = await supabase
    .from('unified_picks')
    .select('outcome, actual_value')
    .not('settled_at', 'is', null);

  if (outcomes) {
    const outcomeDistribution: Record<string, number> = {};
    let totalActual = 0;
    let nullActual = 0;

    outcomes.forEach((row: any) => {
      // Outcome distribution
      const outcome = row.outcome || 'unknown';
      outcomeDistribution[outcome] = (outcomeDistribution[outcome] || 0) + 1;

      // Actual value quality
      if (row.actual_value !== null && row.actual_value !== undefined) {
        totalActual += parseFloat(row.actual_value);
      } else {
        nullActual++;
      }
    });

    report.settlementQuality.outcomeDistribution = outcomeDistribution;
    report.settlementQuality.avgActualValue = totalActual / (outcomes.length - nullActual);
    report.settlementQuality.nullActualValues = nullActual;

    console.log('   Outcome Distribution:');
    Object.entries(outcomeDistribution).forEach(([outcome, count]) => {
      const pct = (count / outcomes.length) * 100;
      console.log(`     ${outcome}: ${count} (${pct.toFixed(1)}%)`);
    });

    console.log(`   Avg Actual Value: ${report.settlementQuality.avgActualValue.toFixed(2)}`);
    console.log(`   NULL Actual Values: ${nullActual} (${(nullActual / outcomes.length * 100).toFixed(2)}%)`);
  }

  console.log('');

  // Recommendations
  console.log('💡 Recommendations...');

  if (!report.overall.passesTarget) {
    report.recommendations.push(
      `Settlement rate ${report.overall.settlementRate.toFixed(2)}% is below 95% target. ` +
      `Need to settle ${Math.ceil((0.95 * report.overall.totalProps) - report.overall.settledProps)} more props.`
    );
  }

  // Check for sports with low settlement
  Object.entries(report.bySport).forEach(([sport, stats]) => {
    if (stats.settlementRate < 90) {
      report.recommendations.push(
        `${sport} has low settlement rate (${stats.settlementRate.toFixed(2)}%). ` +
        `Check player_stats availability for this sport.`
      );
    }
  });

  // Check for stat types with no settlements
  Object.entries(report.byStatType).forEach(([statType, stats]) => {
    if (stats.settlementRate < 50) {
      report.recommendations.push(
        `Stat type "${statType}" has very low settlement (${stats.settlementRate.toFixed(2)}%). ` +
        `May need to add stat mapping for this market type.`
      );
    }
  });

  // Check for NULL actual values
  if (report.settlementQuality.nullActualValues > 0) {
    const pct = (report.settlementQuality.nullActualValues / report.overall.settledProps) * 100;
    if (pct > 1) {
      report.recommendations.push(
        `${report.settlementQuality.nullActualValues} settled props have NULL actual_value (${pct.toFixed(2)}%). ` +
        `This indicates incomplete settlement data.`
      );
    }
  }

  if (report.recommendations.length === 0) {
    report.recommendations.push('✅ Settlement looks good! No issues detected.');
  }

  report.recommendations.forEach(rec => {
    console.log(`   - ${rec}`);
  });

  console.log('');

  // Final verdict
  console.log('='.repeat(80));

  if (report.overall.passesTarget) {
    console.log('🎉 SETTLEMENT VALIDATION PASSED!');
    console.log(`   Settlement rate ${report.overall.settlementRate.toFixed(2)}% exceeds 95% target.`);
  } else {
    console.log('⚠️  SETTLEMENT VALIDATION NEEDS ATTENTION');
    console.log(`   Settlement rate ${report.overall.settlementRate.toFixed(2)}% is below 95% target.`);
    console.log(`   See recommendations above for next steps.`);
  }

  console.log('='.repeat(80), '\n');

  // Write report to file
  const reportPath = 'apps/api/out/ops/settlement-ultra/validation-report.json';
  const fs = require('fs');
  const path = require('path');

  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Full report saved to: ${reportPath}\n`);

  return report;
}

async function main() {
  try {
    const report = await validateSettlement();
    process.exit(report.overall.passesTarget ? 0 : 1);
  } catch (error: any) {
    console.error('❌ Validation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
