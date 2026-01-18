// Live Multi-League Ingestion Script
// Ingests live odds for all 5 required leagues: NBA, NFL, NCAAF, NCAAB, NHL

import { createClient } from '@supabase/supabase-js';
import { OddsApiClient } from '../src/agents/FeedAgent/oddsApi';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

interface LeagueResult {
  league: string;
  sportKey: string;
  propsFetched: number;
  propsStored: number;
  error: string | null;
}

async function main() {
  console.log('=== LIVE MULTI-LEAGUE INGESTION ===\n');
  console.log('Target Leagues: NBA, NFL, NCAAF, NCAAB, NHL\n');

  const results: LeagueResult[] = [];

  try {
    // Initialize Odds API client
    const oddsApiClient = new OddsApiClient();

    // All 5 required leagues
    const leagues = [
      { name: 'NBA', sportKey: 'basketball_nba' },
      { name: 'NFL', sportKey: 'americanfootball_nfl' },
      { name: 'NCAAF', sportKey: 'americanfootball_ncaaf' },
      { name: 'NCAAB', sportKey: 'basketball_ncaab' },
      { name: 'NHL', sportKey: 'icehockey_nhl' }
    ];

    for (const league of leagues) {
      console.log(`\n[${league.name}] Fetching from Odds API...`);

      try {
        const props = await oddsApiClient.fetchOddsApiProps(
          league.sportKey as any,
          ['h2h', 'spreads', 'totals']
        );

        console.log(`[${league.name}] Fetched ${props.length} props`);

        if (props.length === 0) {
          console.log(`[${league.name}] ⚠️  No games available (off-season or between games)`);
          results.push({
            league: league.name,
            sportKey: league.sportKey,
            propsFetched: 0,
            propsStored: 0,
            error: null
          });
          continue;
        }

        // Insert into database
        const { error: insertError, count } = await supabase
          .from('raw_props')
          .insert(props)
          .select('*', { count: 'exact', head: true });

        if (insertError) {
          console.error(`[${league.name}] ❌ Insert failed:`, insertError.message);
          results.push({
            league: league.name,
            sportKey: league.sportKey,
            propsFetched: props.length,
            propsStored: 0,
            error: insertError.message
          });
        } else {
          console.log(`[${league.name}] ✅ Stored ${count} props`);
          results.push({
            league: league.name,
            sportKey: league.sportKey,
            propsFetched: props.length,
            propsStored: count || 0,
            error: null
          });
        }

      } catch (error: any) {
        console.error(`[${league.name}] ❌ Error:`, error.message);
        results.push({
          league: league.name,
          sportKey: league.sportKey,
          propsFetched: 0,
          propsStored: 0,
          error: error.message
        });
      }
    }

    // Summary
    console.log('\n=== INGESTION SUMMARY ===\n');
    console.log('| League | Props Fetched | Props Stored | Status |');
    console.log('|--------|---------------|--------------|--------|');

    results.forEach(r => {
      const status = r.error ? '❌ FAIL' : r.propsStored > 0 ? '✅ PASS' : '⚠️  NO DATA';
      console.log(`| ${r.league.padEnd(6)} | ${String(r.propsFetched).padStart(13)} | ${String(r.propsStored).padStart(12)} | ${status} |`);
    });

    const totalFetched = results.reduce((sum, r) => sum + r.propsFetched, 0);
    const totalStored = results.reduce((sum, r) => sum + r.propsStored, 0);
    const failures = results.filter(r => r.error !== null).length;

    console.log('\n**Totals**:');
    console.log(`- Props Fetched: ${totalFetched}`);
    console.log(`- Props Stored: ${totalStored}`);
    console.log(`- Failures: ${failures}/5`);

    // Export results as JSON
    console.log('\n**JSON Output**:');
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      totalFetched,
      totalStored,
      failures,
      results
    }, null, 2));

    // Exit code based on success
    if (failures > 0) {
      console.log('\n❌ INGESTION COMPLETED WITH ERRORS');
      process.exit(1);
    } else if (totalStored === 0) {
      console.log('\n⚠️  INGESTION COMPLETED - NO DATA AVAILABLE');
      process.exit(0);
    } else {
      console.log('\n✅ INGESTION SUCCESSFUL');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ INGESTION FAILED:', error);
    process.exit(1);
  }
}

main();
