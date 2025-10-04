/**
 * E2E FeedAgent Runner
 *
 * Runs FeedAgent with comprehensive telemetry for E2E audit
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import { getSupabaseClient } from '../../config/db';
import { fetchAndWriteCoreMarkets } from '../../agents/FeedAgent/oddsApi';

interface E2ETelemetry {
  timestamp: string;
  sport: string;
  duration: number;
  result: {
    success: boolean;
    eventsFetched: number;
    marketsProcessed: {
      h2h: number;
      spreads: number;
      totals: number;
    };
    picksTransformed: number;
    writtenToDb: {
      inserted: number;
      skippedDedup: number;
      errors: number;
    };
    creditsUsed: number;
  };
  telemetry?: any;
  error?: string;
}

export async function runFeedAgentE2E(sport: string = 'americanfootball_nfl'): Promise<E2ETelemetry> {
  const start = Date.now();

  console.log('\n' + '='.repeat(80));
  console.log('E2E FEEDAGENT TEST');
  console.log('='.repeat(80));
  console.log(`Sport: ${sport}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  const telemetry: E2ETelemetry = {
    timestamp: new Date().toISOString(),
    sport,
    duration: 0,
    result: {
      success: false,
      eventsFetched: 0,
      marketsProcessed: { h2h: 0, spreads: 0, totals: 0 },
      picksTransformed: 0,
      writtenToDb: { inserted: 0, skippedDedup: 0, errors: 0 },
      creditsUsed: 0
    }
  };

  try {
    // Run FeedAgent
    console.log('Fetching and writing core markets...\n');

    const result = await fetchAndWriteCoreMarkets(sport);

    telemetry.result.success = true;
    telemetry.result.eventsFetched = result.eventsFetched || 0;
    telemetry.result.marketsProcessed = result.marketsProcessed || { h2h: 0, spreads: 0, totals: 0 };
    telemetry.result.picksTransformed = result.coreMarketWrites?.attemptedWrites || 0;
    telemetry.result.writtenToDb = {
      inserted: result.coreMarketWrites?.inserted || 0,
      skippedDedup: result.coreMarketWrites?.skippedDedup || 0,
      errors: result.coreMarketWrites?.errors || 0
    };
    telemetry.result.creditsUsed = result.creditsUsed || 0;
    telemetry.telemetry = result.telemetry;

    // Display results
    console.log('-'.repeat(80));
    console.log('RESULTS:');
    console.log(`  ✅ Events Fetched: ${telemetry.result.eventsFetched}`);
    console.log(`  ✅ Markets Processed:`);
    console.log(`     - H2H: ${telemetry.result.marketsProcessed.h2h}`);
    console.log(`     - Spreads: ${telemetry.result.marketsProcessed.spreads}`);
    console.log(`     - Totals: ${telemetry.result.marketsProcessed.totals}`);
    console.log(`  ✅ Picks Transformed: ${telemetry.result.picksTransformed}`);
    console.log(`  ✅ Written to Database:`);
    console.log(`     - Inserted: ${telemetry.result.writtenToDb.inserted}`);
    console.log(`     - Skipped (Dedup): ${telemetry.result.writtenToDb.skippedDedup}`);
    console.log(`     - Errors: ${telemetry.result.writtenToDb.errors}`);
    console.log(`  💰 Credits Used: ${telemetry.result.creditsUsed}`);

  } catch (error) {
    telemetry.result.success = false;
    telemetry.error = error instanceof Error ? error.message : String(error);

    console.log('\n❌ ERROR:');
    console.log(telemetry.error);
  }

  telemetry.duration = Date.now() - start;

  console.log(`\n⏱️  Duration: ${telemetry.duration}ms`);
  console.log('='.repeat(80) + '\n');

  return telemetry;
}

async function main() {
  const sport = process.argv[2] || 'americanfootball_nfl';
  const result = await runFeedAgentE2E(sport);

  // Save telemetry to file
  const fs = await import('fs/promises');
  const outPath = path.join(__dirname, '../../../out/ops/e2e-feedagent.json');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(result, null, 2));

  console.log(`📊 Telemetry saved to: ${outPath}`);

  process.exit(result.result.success ? 0 : 1);
}

if (require.main === module) {
  main();
}
