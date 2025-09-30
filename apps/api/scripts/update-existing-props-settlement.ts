/**
 * Update Existing Props with Settlement Data
 * Updates the existing 742K props with settlement results from SGO API
 */

import axios from 'axios';
import { Pool } from 'pg';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/unit_talk_dev'
});

const SGO_API_KEY = process.env.SGO_API_KEY;

interface SGOSettlementProp {
  oddID: string;
  statID: string;
  statEntityID: string;
  started: boolean;
  ended: boolean;
  cancelled: boolean;
  score: number; // Actual result
  bookOdds?: string;
  fairOdds?: string;
  bookOverUnder?: string;
  fairOverUnder?: string;
  sideID: string;
  betTypeID: string;
}

async function fetchSGOSettlementData(sport: string, startDate: string, endDate: string) {
  try {
    const response = await axios.get('https://api.sportsgameodds.com/v2/events', {
      params: {
        apiKey: SGO_API_KEY,
        leagueID: sport,
        startsAfter: `${startDate}T07:00:00Z`,
        startsBefore: `${endDate}T06:59:59Z`,
        includeAltLine: true,
        finalized: true
      },
      timeout: 30000
    });

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    return [];
  } catch (error: any) {
    console.error(`❌ Error fetching ${sport} settlement data:`, error.message);
    return [];
  }
}

function determineSettlementResult(prop: SGOSettlementProp): { result: string | null; status: string } {
  if (prop.cancelled) return { result: 'cancelled', status: 'cancelled' };
  if (!prop.ended) return { result: null, status: 'pending' };

  const status = 'completed';

  // For over/under markets
  if (prop.betTypeID === 'ou' && prop.bookOverUnder) {
    const line = parseFloat(prop.bookOverUnder);
    const actualValue = prop.score;

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

  return { result: 'settled', status };
}

async function updatePropsWithSettlementData(events: any[]): Promise<number> {
  const client = await pool.connect();
  let updatedProps = 0;

  try {
    for (const event of events) {
      if (!event.odds) continue;

      for (const [marketKey, prop] of Object.entries(event.odds)) {
        const propData = prop as SGOSettlementProp;

        try {
          const externalId = `${event.eventID}-${marketKey}`.substring(0, 199);

          // Find existing prop
          const existingResult = await client.query(
            'SELECT id FROM raw_props WHERE external_id = $1 AND source = $2',
            [externalId, 'sgo']
          );

          if (existingResult.rows.length > 0) {
            const { result, status } = determineSettlementResult(propData);
            const actualValue = propData.score;
            const settledAt = propData.ended ? new Date().toISOString() : null;

            // Update with settlement data
            await client.query(`
              UPDATE raw_props
              SET
                status = $1,
                result = $2,
                actual_value = $3,
                settled_at = $4,
                updated_at = NOW()
              WHERE id = $5
            `, [
              status,
              result,
              actualValue,
              settledAt,
              existingResult.rows[0].id
            ]);

            updatedProps++;
          }
        } catch (propError: any) {
          // Skip individual prop errors
          console.error(`⚠️ Prop update error: ${propError.message.substring(0, 50)}`);
        }
      }
    }
  } finally {
    client.release();
  }

  return updatedProps;
}

async function updateExistingPropsSettlement() {
  if (!SGO_API_KEY) {
    console.error('❌ SGO_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🔄 UPDATING EXISTING PROPS WITH SETTLEMENT DATA');
  console.log('📊 Processing existing 742K props...');
  console.log('');

  try {
    // Check current settlement status
    const client = await pool.connect();
    const totalResult = await client.query("SELECT COUNT(*) FROM raw_props WHERE source = 'sgo'");
    const settledResult = await client.query("SELECT COUNT(*) FROM raw_props WHERE source = 'sgo' AND result IS NOT NULL");

    console.log(`📊 Total SGO props: ${totalResult.rows[0].count}`);
    console.log(`✅ Currently settled: ${settledResult.rows[0].count}`);
    console.log(`❌ Missing settlement: ${totalResult.rows[0].count - settledResult.rows[0].count}`);
    client.release();

    // Process sports in smaller batches for efficiency
    const sports = ['MLB', 'NBA']; // Start with completed seasons
    let totalUpdated = 0;

    for (const sport of sports) {
      console.log(`\n🏆 Processing ${sport} settlement updates...`);

      let sportStartDate = '2024-03-01';
      let sportEndDate = '2024-12-31';

      if (sport === 'NBA') {
        sportStartDate = '2024-10-01';
        sportEndDate = '2025-02-01';
      }

      // Process in monthly chunks to avoid memory issues
      const currentDate = new Date(sportStartDate);
      const endDate = new Date(sportEndDate);

      while (currentDate <= endDate) {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        const chunkStart = monthStart.toISOString().split('T')[0];
        const chunkEnd = monthEnd.toISOString().split('T')[0];

        console.log(`   📅 Processing ${chunkStart} to ${chunkEnd}...`);

        const events = await fetchSGOSettlementData(sport, chunkStart, chunkEnd);
        if (events.length > 0) {
          const updated = await updatePropsWithSettlementData(events);
          totalUpdated += updated;
          console.log(`   ✅ Updated ${updated} props with settlement data`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting

        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      console.log(`✅ ${sport} complete: ${totalUpdated} total props updated`);
    }

    // Final verification
    const finalClient = await pool.connect();
    const finalTotalResult = await finalClient.query("SELECT COUNT(*) FROM raw_props WHERE source = 'sgo'");
    const finalSettledResult = await finalClient.query("SELECT COUNT(*) FROM raw_props WHERE source = 'sgo' AND result IS NOT NULL");

    console.log(`\n🎯 SETTLEMENT UPDATE COMPLETE:`);
    console.log(`📊 Total props: ${finalTotalResult.rows[0].count}`);
    console.log(`✅ Settled props: ${finalSettledResult.rows[0].count}`);
    console.log(`📈 Settlement rate: ${(finalSettledResult.rows[0].count / finalTotalResult.rows[0].count * 100).toFixed(1)}%`);
    console.log(`🔄 Props updated this run: ${totalUpdated}`);

    if (finalSettledResult.rows[0].count > 0) {
      console.log(`🎉 ALGORITHMS READY: Settlement data successfully populated!`);
    }

    finalClient.release();

  } catch (error: any) {
    console.error('❌ Settlement update failed:', error.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  updateExistingPropsSettlement().catch(error => {
    console.error('Update script failed:', error.message);
    process.exit(1);
  });
}