#!/usr/bin/env npx tsx
/**
 * Complete Settlement Backfill for All Props
 * Efficiently processes all 742K props to populate settlement data
 */

import axios from 'axios';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/unit_talk_dev'
});

const SGO_API_KEY = process.env.SGO_API_KEY;

// Process in parallel batches for speed
const PARALLEL_BATCH_SIZE = 3;

interface SportConfig {
  sport: string;
  startDate: string;
  endDate: string;
}

const ALL_SPORTS: SportConfig[] = [
  { sport: 'MLB', startDate: '2024-03-28', endDate: '2024-09-30' },
  { sport: 'NBA', startDate: '2024-10-01', endDate: '2025-03-31' },
  { sport: 'NFL', startDate: '2024-09-05', endDate: '2025-02-09' },
  { sport: 'NHL', startDate: '2024-10-04', endDate: '2025-04-30' },
  { sport: 'NCAAF', startDate: '2024-08-24', endDate: '2025-01-20' },
  { sport: 'NCAAB', startDate: '2024-11-04', endDate: '2025-04-07' },
  { sport: 'WNBA', startDate: '2024-05-14', endDate: '2024-10-20' }
];

async function fetchSGOSettlement(sport: string, startDate: string, endDate: string): Promise<any[]> {
  try {
    const response = await axios.get('https://api.sportsgameodds.com/v2/events', {
      params: {
        apiKey: SGO_API_KEY,
        leagueID: sport,
        startsAfter: `${startDate}T00:00:00Z`,
        startsBefore: `${endDate}T23:59:59Z`,
        includeAltLine: true,
        finalized: true
      },
      timeout: 30000
    });

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    return [];
  } catch (error) {
    console.error(`  ⚠️ Error fetching ${sport}: ${error.message}`);
    return [];
  }
}

function determineResult(prop: any): { result: string | null; status: string } {
  if (prop.cancelled) return { result: 'cancelled', status: 'cancelled' };
  if (!prop.ended) return { result: null, status: 'pending' };

  const status = 'completed';

  // For over/under markets
  if (prop.betTypeID === 'ou' && prop.bookOverUnder) {
    const line = parseFloat(prop.bookOverUnder || prop.fairOverUnder || '0');
    const actualValue = prop.score || 0;

    if (prop.sideID === 'over') {
      if (actualValue > line) return { result: 'won', status };
      if (actualValue < line) return { result: 'lost', status };
      return { result: 'push', status };
    } else if (prop.sideID === 'under') {
      if (actualValue < line) return { result: 'won', status };
      if (actualValue > line) return { result: 'lost', status };
      return { result: 'push', status };
    }
  }

  // Default for other markets
  return { result: 'settled', status };
}

async function updatePropsInBatch(events: any[]): Promise<number> {
  let updatedCount = 0;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const event of events) {
      if (!event.odds) continue;

      const updatePromises = [];

      for (const [marketKey, prop] of Object.entries(event.odds)) {
        const externalId = `${event.eventID}-${marketKey}`.substring(0, 199);
        const { result, status } = determineResult(prop);
        const actualValue = prop.score;
        const settledAt = prop.ended ? new Date().toISOString() : null;

        updatePromises.push(
          client.query(`
            UPDATE raw_props
            SET status = $1, result = $2, actual_value = $3, settled_at = $4, updated_at = NOW()
            WHERE external_id = $5 AND source = 'sgo' AND result IS NULL
          `, [status, result, actualValue, settledAt, externalId])
        );
      }

      const results = await Promise.all(updatePromises);
      updatedCount += results.reduce((sum, r) => sum + (r.rowCount || 0), 0);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('  ❌ Batch update error:', error.message);
  } finally {
    client.release();
  }

  return updatedCount;
}

async function processMonth(sport: string, year: number, month: number): Promise<number> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];

  const events = await fetchSGOSettlement(sport, start, end);

  if (events.length > 0) {
    const updated = await updatePropsInBatch(events);
    if (updated > 0) {
      console.log(`    ✅ ${start}: ${updated} props settled`);
    }
    return updated;
  }

  return 0;
}

async function processSportSettlement(config: SportConfig): Promise<number> {
  console.log(`\n🏆 Processing ${config.sport} settlement...`);

  let totalUpdated = 0;
  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);

  const monthPromises = [];

  // Process all months for this sport
  const current = new Date(startDate);
  while (current <= endDate) {
    monthPromises.push({
      year: current.getFullYear(),
      month: current.getMonth() + 1
    });
    current.setMonth(current.getMonth() + 1);
  }

  // Process months in batches
  for (let i = 0; i < monthPromises.length; i += PARALLEL_BATCH_SIZE) {
    const batch = monthPromises.slice(i, i + PARALLEL_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(({ year, month }) => processMonth(config.sport, year, month))
    );
    totalUpdated += results.reduce((sum, count) => sum + count, 0);

    // Rate limiting between batches
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`  📊 ${config.sport} complete: ${totalUpdated} total props settled`);
  return totalUpdated;
}

async function completeSettlementBackfill() {
  if (!SGO_API_KEY) {
    console.error('❌ SGO_API_KEY not set');
    process.exit(1);
  }

  console.log('🚀 COMPLETE SETTLEMENT BACKFILL FOR ALL 742K PROPS');
  console.log('================================================\n');

  try {
    // Check starting status
    const client = await pool.connect();
    const startStatus = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN result IS NOT NULL THEN 1 END) as settled
      FROM raw_props WHERE source = 'sgo'
    `);

    console.log(`📊 Starting Status:`);
    console.log(`  Total props: ${startStatus.rows[0].total}`);
    console.log(`  Already settled: ${startStatus.rows[0].settled}`);
    console.log(`  Remaining: ${startStatus.rows[0].total - startStatus.rows[0].settled}\n`);
    client.release();

    // Process all sports
    let grandTotal = 0;
    for (const sportConfig of ALL_SPORTS) {
      const sportTotal = await processSportSettlement(sportConfig);
      grandTotal += sportTotal;

      // Show running progress
      const progressClient = await pool.connect();
      const progress = await progressClient.query(`
        SELECT COUNT(CASE WHEN result IS NOT NULL THEN 1 END) as settled
        FROM raw_props WHERE source = 'sgo'
      `);
      console.log(`  📈 Running total: ${progress.rows[0].settled} props settled\n`);
      progressClient.release();
    }

    // Final status
    const finalClient = await pool.connect();
    const finalStatus = await finalClient.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN result IS NOT NULL THEN 1 END) as settled,
        COUNT(CASE WHEN result = 'won' THEN 1 END) as won,
        COUNT(CASE WHEN result = 'lost' THEN 1 END) as lost,
        COUNT(CASE WHEN result = 'push' THEN 1 END) as push,
        COUNT(CASE WHEN result = 'cancelled' THEN 1 END) as cancelled
      FROM raw_props WHERE source = 'sgo'
    `);

    console.log('\n' + '='.repeat(50));
    console.log('🎯 FINAL SETTLEMENT RESULTS:');
    console.log(`  Total props: ${finalStatus.rows[0].total}`);
    console.log(`  Settled props: ${finalStatus.rows[0].settled}`);
    console.log(`  Settlement rate: ${(finalStatus.rows[0].settled / finalStatus.rows[0].total * 100).toFixed(1)}%`);
    console.log(`\n  Breakdown:`);
    console.log(`    Won: ${finalStatus.rows[0].won}`);
    console.log(`    Lost: ${finalStatus.rows[0].lost}`);
    console.log(`    Push: ${finalStatus.rows[0].push}`);
    console.log(`    Cancelled: ${finalStatus.rows[0].cancelled}`);
    console.log(`\n  Props updated this run: ${grandTotal}`);

    if (finalStatus.rows[0].settled > 100000) {
      console.log('\n🎉 SUCCESS: Sufficient settlement data for algorithms!');
    }

    finalClient.release();

  } catch (error) {
    console.error('❌ Settlement backfill failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
if (require.main === module) {
  completeSettlementBackfill().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}