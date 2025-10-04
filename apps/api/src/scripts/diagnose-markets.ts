/**
 * Diagnostic script to identify why spreads/totals are missing from NFL core markets
 *
 * Runs three diagnostic scenarios:
 * (a) No bookmakers filter - test if API returns spreads/totals without filter
 * (b) With bookmakers filter - test if specific bookmakers suppress spreads/totals
 * (c) Single event comparison - deep dive into one event's raw response
 *
 * Outputs:
 * - Per-scenario logs in out/ops/run-logs/
 * - Consolidated report in out/ops/DIAG_MARKETS_REPORT.md
 */

import { writeFileSync } from 'fs';
import { fetchAndWriteCoreMarkets, resolveOddsConfig } from '../agents/FeedAgent/oddsApi';

// Configuration for each diagnostic scenario
const scenarios = [
  {
    id: 'a',
    name: 'No bookmakers filter',
    config: {
      markets: ['h2h', 'spreads', 'totals'],
      regions: 'us',
      bookmakers: undefined, // Let Odds API return all bookmakers
      oddsFormat: 'american' as const,
      dateFormat: 'iso' as const,
      daysFrom: 2
    }
  },
  {
    id: 'b',
    name: 'With bookmakers filter',
    config: {
      markets: ['h2h', 'spreads', 'totals'],
      regions: 'us',
      bookmakers: ['draftkings', 'caesars', 'fanduel', 'betmgm'],
      oddsFormat: 'american' as const,
      dateFormat: 'iso' as const,
      daysFrom: 2
    }
  },
  {
    id: 'c',
    name: 'Single event deep dive',
    config: {
      markets: ['h2h', 'spreads', 'totals'],
      regions: 'us',
      bookmakers: ['draftkings', 'caesars', 'fanduel', 'betmgm'],
      oddsFormat: 'american' as const,
      dateFormat: 'iso' as const,
      daysFrom: 2
    }
  }
];

async function runDiagnostics() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportLines: string[] = [];

  reportLines.push('# Markets Diagnostic Report');
  reportLines.push('');
  reportLines.push(`**Generated**: ${new Date().toISOString()}`);
  reportLines.push('');
  reportLines.push('## Summary');
  reportLines.push('');
  reportLines.push('Testing NFL core markets to identify why spreads/totals are missing.');
  reportLines.push('');

  console.log('\n========================================');
  console.log('MARKETS DIAGNOSTIC - NFL Core Markets');
  console.log('========================================\n');

  const results: any[] = [];

  for (const scenario of scenarios) {
    console.log(`\n--- Scenario ${scenario.id.toUpperCase()}: ${scenario.name} ---\n`);

    try {
      const result = await fetchAndWriteCoreMarkets('americanfootball_nfl', scenario.config);

      // Save detailed log
      const logPath = `out/ops/run-logs/diagnostic-${scenario.id}-${timestamp}.json`;
      writeFileSync(logPath, JSON.stringify(result, null, 2));
      console.log(`✅ Scenario ${scenario.id} complete. Log saved to ${logPath}`);

      results.push({
        scenario: scenario.id,
        name: scenario.name,
        result,
        logPath
      });

      // Display summary
      console.log('\nScenario Summary:');
      console.log(`  Events Fetched: ${result.eventsFetched}`);
      console.log(`  Markets Returned: h2h=${result.marketsProcessed.h2h}, spreads=${result.marketsProcessed.spreads}, totals=${result.marketsProcessed.totals}`);
      console.log(`  Transformed Picks: h2h=${result.telemetry?.transformedMarkets.h2h}, spreads=${result.telemetry?.transformedMarkets.spreads}, totals=${result.telemetry?.transformedMarkets.totals}`);
      console.log(`  Write Results: attempted=${result.coreMarketWrites.attemptedWrites}, inserted=${result.coreMarketWrites.inserted}, dedup=${result.coreMarketWrites.skippedDedup}, errors=${result.coreMarketWrites.errors}`);

    } catch (error) {
      console.error(`❌ Scenario ${scenario.id} failed:`, error);
      results.push({
        scenario: scenario.id,
        name: scenario.name,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Delay between scenarios to avoid rate limiting
    if (scenario.id !== 'c') {
      console.log('\nWaiting 3 seconds before next scenario...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Build consolidated report
  reportLines.push('## Diagnostic Results');
  reportLines.push('');

  for (const res of results) {
    reportLines.push(`### Scenario ${res.scenario.toUpperCase()}: ${res.name}`);
    reportLines.push('');

    if (res.error) {
      reportLines.push(`**Status**: ❌ Failed`);
      reportLines.push(`**Error**: ${res.error}`);
    } else {
      const r = res.result;
      reportLines.push(`**Status**: ✅ Success`);
      reportLines.push(`**Log File**: \`${res.logPath}\``);
      reportLines.push('');
      reportLines.push('**Configuration**:');
      reportLines.push(`- Markets Requested: ${scenarios.find(s => s.id === res.scenario)?.config.markets.join(', ')}`);
      reportLines.push(`- Regions: ${scenarios.find(s => s.id === res.scenario)?.config.regions}`);
      reportLines.push(`- Bookmakers: ${scenarios.find(s => s.id === res.scenario)?.config.bookmakers?.join(', ') || 'all'}`);
      reportLines.push('');
      reportLines.push('**Results**:');
      reportLines.push(`- Events Fetched: ${r.eventsFetched}`);
      reportLines.push(`- Markets Returned by API: h2h=${r.marketsProcessed.h2h}, spreads=${r.marketsProcessed.spreads}, totals=${r.marketsProcessed.totals}`);
      reportLines.push(`- Picks Transformed: h2h=${r.telemetry?.transformedMarkets.h2h}, spreads=${r.telemetry?.transformedMarkets.spreads}, totals=${r.telemetry?.transformedMarkets.totals}`);
      reportLines.push(`- Attempted Writes: ${r.coreMarketWrites.attemptedWrites}`);
      reportLines.push(`- Inserted: ${r.coreMarketWrites.inserted}`);
      reportLines.push(`- Skipped (Dedup): ${r.coreMarketWrites.skippedDedup}`);
      reportLines.push(`- Errors: ${r.coreMarketWrites.errors}`);

      if (r.telemetry?.firstEventSample) {
        reportLines.push('');
        reportLines.push('**First Event Sample**:');
        reportLines.push('```json');
        reportLines.push(JSON.stringify(r.telemetry.firstEventSample, null, 2));
        reportLines.push('```');
      }
    }

    reportLines.push('');
  }

  // Analysis section
  reportLines.push('## Analysis');
  reportLines.push('');

  const scenarioA = results.find(r => r.scenario === 'a')?.result;
  const scenarioB = results.find(r => r.scenario === 'b')?.result;

  if (scenarioA && scenarioB) {
    reportLines.push('### Comparison: No Filter vs. With Filter');
    reportLines.push('');
    reportLines.push('| Metric | Scenario A (No Filter) | Scenario B (With Filter) | Difference |');
    reportLines.push('|--------|------------------------|--------------------------|------------|');
    reportLines.push(`| H2H Markets | ${scenarioA.marketsProcessed.h2h} | ${scenarioB.marketsProcessed.h2h} | ${scenarioB.marketsProcessed.h2h - scenarioA.marketsProcessed.h2h} |`);
    reportLines.push(`| Spreads Markets | ${scenarioA.marketsProcessed.spreads} | ${scenarioB.marketsProcessed.spreads} | ${scenarioB.marketsProcessed.spreads - scenarioA.marketsProcessed.spreads} |`);
    reportLines.push(`| Totals Markets | ${scenarioA.marketsProcessed.totals} | ${scenarioB.marketsProcessed.totals} | ${scenarioB.marketsProcessed.totals - scenarioA.marketsProcessed.totals} |`);
    reportLines.push('');

    // Identify issue
    if (scenarioA.marketsProcessed.spreads === 0 && scenarioB.marketsProcessed.spreads === 0) {
      reportLines.push('**🔴 ROOT CAUSE**: Odds API is not returning spreads for NFL events (both scenarios show 0)');
      reportLines.push('');
      reportLines.push('**Possible reasons**:');
      reportLines.push('1. Spreads may not be available for these specific events yet');
      reportLines.push('2. NFL season timing - check if events are far enough in the future');
      reportLines.push('3. API configuration issue - verify Odds API account has access to spreads');
      reportLines.push('4. Sport key mismatch - verify `americanfootball_nfl` is correct');
    } else if (scenarioA.marketsProcessed.spreads > 0 && scenarioB.marketsProcessed.spreads === 0) {
      reportLines.push('**🟡 ROOT CAUSE**: Specific bookmakers filter is suppressing spreads/totals');
      reportLines.push('');
      reportLines.push('**Action**: Remove or adjust bookmakers filter to include bookmakers that offer spreads');
    } else if (scenarioA.marketsProcessed.spreads > 0 && scenarioB.marketsProcessed.spreads > 0) {
      reportLines.push('**🟢 STATUS**: Spreads/totals ARE being returned by the API');
      reportLines.push('');
      reportLines.push('**Investigation needed**: If picks still show 0 spreads, issue is in transform or write pipeline');
    }
  }

  reportLines.push('');
  reportLines.push('---');
  reportLines.push(`*Generated by \`diagnose-markets.ts\` on ${new Date().toISOString()}*`);

  // Write consolidated report
  const reportPath = 'out/ops/DIAG_MARKETS_REPORT.md';
  writeFileSync(reportPath, reportLines.join('\n'));

  console.log('\n========================================');
  console.log('Diagnostics Complete!');
  console.log('========================================\n');
  console.log(`Consolidated report: ${reportPath}`);
  console.log(`Individual logs: out/ops/run-logs/diagnostic-{a,b,c}-${timestamp}.json`);
  console.log('');
}

// Run diagnostics
runDiagnostics().catch(error => {
  console.error('Fatal error running diagnostics:', error);
  process.exit(1);
});
