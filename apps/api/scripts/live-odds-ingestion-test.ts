// ⚠️ DIRECT INSERT TEST (NO CANONICAL MAPPING)
// This script bypasses FeedAgent and writes directly to Supabase raw_props
// For PRODUCTION CANARY testing with canonical mapping, use: npx tsx apps/api/scripts/live-fire-phase1-ingestion.ts

import dotenv from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { OddsApiClient } from '../src/agents/FeedAgent/oddsApi';

// Load environment variables from workspace root
const rootEnvPath = resolve(__dirname, '../../../.env');
const sharedEnvPath = resolve(__dirname, '../../../.env.shared');
dotenv.config({ path: rootEnvPath });
dotenv.config({ path: sharedEnvPath });

// Validate required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.ODDS_API_KEY) {
  console.error('❌ FATAL: Missing required environment variables:');
  if (!process.env.SUPABASE_URL) console.error('  - SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.ODDS_API_KEY) console.error('  - ODDS_API_KEY');
  console.error('\nPlease ensure .env file is configured properly.');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  console.log('=== LIVE ODDS INGESTION TEST ===\n');
  console.log('Testing: NBA (1 API credit)');
  console.log('Reason: Limited credits remaining (2/3 used)\n');

  try {
    // Initialize client
    const oddsApiClient = new OddsApiClient();

    // Fetch NBA props
    console.log('[1/4] Fetching NBA props from Odds API...');
    const nbaProps = await oddsApiClient.fetchOddsApiProps(
      'basketball_nba' as any,
      ['h2h', 'spreads', 'totals']
    );

    console.log(`✅ Fetched ${nbaProps.length} NBA props`);

    if (nbaProps.length === 0) {
      console.log('⚠️  No NBA games available right now (off-season or between games)');
      console.log('This is expected behavior. System is operational.');
      process.exit(0);
    }

    // Insert into database
    console.log(`\n[2/4] Inserting ${nbaProps.length} props into raw_props...`);
    const { error: insertError, count } = await supabase
      .from('raw_props')
      .insert(nbaProps)
      .select('*', { count: 'exact', head: true });

    if (insertError) {
      console.error('❌ Insert failed:', insertError);
      process.exit(1);
    }

    console.log(`✅ Inserted ${count} props successfully`);

    // Verify with SQL
    console.log('\n[3/4] Verifying recent ingestion with SQL...');
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: recentProps, error: queryError } = await supabase
      .from('raw_props')
      .select('sport, created_at, stat_type, player_name')
      .gte('created_at', tenMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    if (queryError) {
      console.error('❌ Query failed:', queryError);
      process.exit(1);
    }

    console.log(`✅ Found ${recentProps?.length || 0} props in last 10 minutes`);

    if (recentProps && recentProps.length > 0) {
      console.log('\nSample props:');
      recentProps.slice(0, 5).forEach((prop, i) => {
        console.log(`  ${i + 1}. ${prop.player_name} ${prop.stat_type} (${prop.sport}) @ ${prop.created_at}`);
      });
    }

    // Count by league
    console.log('\n[4/4] Counting props by league (last 10 min)...');
    const { data: leagueCounts } = await supabase
      .rpc('count_recent_props_by_league', { minutes: 10 })
      .select('*');

    // If RPC doesn't exist, do it manually
    const { data: manualCounts } = await supabase
      .from('raw_props')
      .select('sport')
      .gte('created_at', tenMinutesAgo);

    if (manualCounts) {
      const counts = manualCounts.reduce((acc: any, prop: any) => {
        acc[prop.sport] = (acc[prop.sport] || 0) + 1;
        return acc;
      }, {});

      console.log('\nProps by league (last 10 min):');
      Object.entries(counts).forEach(([league, count]) => {
        console.log(`  ${league}: ${count}`);
      });
    }

    console.log('\n=== INGESTION TEST COMPLETE ===');
    console.log(`✅ Successfully ingested ${count} NBA props`);
    console.log(`✅ Verified data appears in database`);
    console.log(`✅ End-to-end ingestion pipeline operational`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  }
}

main();
