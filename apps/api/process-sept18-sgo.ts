import { getEnv } from './src/utils/getEnv';
import { supabaseClient } from './src/services/supabaseClient';
import { fetchAndFlattenSGOProps, SGOFlattenedProp } from './src/logic/providers/sgoFetcher';

console.log('🏈 PROCESSING SEPTEMBER 18TH DATA USING SGO API');
console.log('='.repeat(60));

async function processSept18SGOData() {
  try {
    const env = getEnv();

    if (!supabaseClient) {
      throw new Error('Supabase client not configured');
    }

    console.log('📅 Processing September 18, 2025 data using SGO API\n');

    // Define September 18th date range
    const sept18Start = '2025-09-18T00:00:00Z';
    const sept18End = '2025-09-18T23:59:59Z';

    console.log(`🔍 Fetching SGO data for ${sept18Start} to ${sept18End}\n`);

    // SGO API Key
    const sgoApiKey = process.env.SGO_API_KEY || process.env.SPORTSGAMEODDS_KEY;
    if (!sgoApiKey) {
      throw new Error('SGO_API_KEY not found in environment');
    }

    console.log('✅ SGO API Key found:', sgoApiKey.substring(0, 12) + '...');

    // League mappings for SGO
    const leagueMappings = {
      'NFL': 'NFL',
      'NBA': 'NBA',
      'MLB': 'MLB',
      'NHL': 'NHL',
      'NCAAF': 'NCAAF'
    };

    let totalPropsProcessed = 0;
    let totalInserted = 0;

    // Process each league
    for (const [sport, sgoLeagueID] of Object.entries(leagueMappings)) {
      try {
        console.log(`\n🏀 Processing ${sport} (SGO League: ${sgoLeagueID})`);
        console.log('-'.repeat(50));

        // Fetch SGO data for September 18th (finalized=true for historical data)
        const sgoProps = await fetchAndFlattenSGOProps({
          apiKey: sgoApiKey,
          leagueID: sgoLeagueID,
          startsAfter: sept18Start,
          startsBefore: sept18End,
          finalized: true, // Historical data
          includeAltLine: true,
          limit: 100
        });

        console.log(`📊 Fetched ${sgoProps.length} raw props from SGO`);

        if (sgoProps.length === 0) {
          console.log(`⚠️ No props found for ${sport} on September 18th`);
          continue;
        }

        // Group OVER/UNDER pairs
        const groupedProps = new Map<string, { over?: SGOFlattenedProp, under?: SGOFlattenedProp }>();

        sgoProps.forEach((sgoProp: SGOFlattenedProp) => {
          const key = `${sgoProp.playerName || 'game'}-${sgoProp.statType}-${sgoProp.line}-${sgoProp.eventID}`;

          if (!groupedProps.has(key)) {
            groupedProps.set(key, {});
          }

          const group = groupedProps.get(key)!;
          if (sgoProp.direction === 'over') {
            group.over = sgoProp;
          } else if (sgoProp.direction === 'under') {
            group.under = sgoProp;
          }
        });

        console.log(`🔄 Grouped into ${groupedProps.size} prop pairs`);

        // Transform to database format
        const dbProps = Array.from(groupedProps.values())
          .filter(group => group.over && group.under) // Only complete pairs
          .map((group) => {
            const overProp = group.over!;
            const underProp = group.under!;

            return {
              // Required fields
              id: crypto.randomUUID(),
              player_name: overProp.playerName || 'Team Total',
              sport: sport,
              team: overProp.homeTeam || '',
              opponent: overProp.awayTeam || '',
              stat_type: overProp.statType || '',
              line: parseFloat(String(overProp.line)) || 0,
              game_date: '2025-09-18',
              matchup: `${overProp.awayTeam} @ ${overProp.homeTeam}`,

              // Market and odds fields
              market: overProp.statType || '',
              market_type: 'player_prop',
              over: parseFloat(String(overProp.odds)) || 0,
              under: parseFloat(String(underProp.odds)) || 0,
              over_odds: parseFloat(String(overProp.odds)) || null,
              under_odds: parseFloat(String(underProp.odds)) || null,

              // Game timing
              game_time: overProp.startsAtUTC || '2025-09-18T00:00:00Z',
              start_time: overProp.startsAtUTC || null,

              // Provider and metadata
              provider: 'SGO-Sept18-Backfill',
              external_id: overProp.eventID || crypto.randomUUID(),
              external_game_id: null, // Avoid foreign key constraint
              game_id: null,
              sport_key: sport.toLowerCase(),

              // SGO-specific fields
              home_team: overProp.homeTeam,
              away_team: overProp.awayTeam,
              home_team_id: overProp.homeTeamID,
              away_team_id: overProp.awayTeamID,

              // Data quality
              is_valid: true,
              is_primary: true,
              is_alt_line: false,
              auto_approved: false,
              promoted: false,
              steam_detected: false,

              // Timestamps
              created_at: new Date().toISOString(),
              inserted_at: new Date().toISOString(),
              scraped_at: '2025-09-18T00:00:00Z',

              // Settlement fields (historical data)
              settled_at: '2025-09-18T23:59:59Z',
              result: 'pending', // Will be updated with actual results

              // Default values for required fields
              unit_size: 1,
              confidence: 0,
              volatility: 5,
              bid_ask_spread: 0.02,
              data_completeness: 1.0,
              outlier_score: 0.95,
              consistency_score: 0.95,
              data_validation_score: 0.95,
              pro_attempts: 0
            };
          });

        console.log(`📝 Prepared ${dbProps.length} props for database insertion`);
        totalPropsProcessed += dbProps.length;

        // Insert in batches
        const BATCH_SIZE = 100;
        let insertedCount = 0;

        for (let i = 0; i < dbProps.length; i += BATCH_SIZE) {
          const batch = dbProps.slice(i, i + BATCH_SIZE);

          try {
            const { data, error } = await supabaseClient
              .from('raw_props')
              .upsert(batch, {
                onConflict: 'id',
                ignoreDuplicates: true
              })
              .select('id');

            if (error) {
              console.error(`❌ Batch insert failed:`, error);
            } else {
              const batchInserted = data?.length || 0;
              insertedCount += batchInserted;
              console.log(`✅ Batch ${Math.floor(i/BATCH_SIZE) + 1}: Inserted ${batchInserted}/${batch.length} props`);
            }
          } catch (error) {
            console.error(`❌ Batch error:`, error);
          }
        }

        totalInserted += insertedCount;
        console.log(`✅ ${sport} complete: ${insertedCount}/${dbProps.length} props inserted`);

        // Small delay between leagues
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Error processing ${sport}:`, error);
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SEPTEMBER 18TH SGO DATA PROCESSING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Props Processed: ${totalPropsProcessed}`);
    console.log(`Total Props Inserted: ${totalInserted}`);
    console.log(`Success Rate: ${totalPropsProcessed > 0 ? ((totalInserted/totalPropsProcessed)*100).toFixed(1) : 0}%`);

    // Verify data in database
    console.log('\n🔍 Verifying September 18th data in database...');
    const { data: verifyData, error: verifyError } = await supabaseClient
      .from('raw_props')
      .select('sport, player_name, market')
      .eq('game_date', '2025-09-18')
      .eq('provider', 'SGO-Sept18-Backfill')
      .limit(5);

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
    } else {
      console.log('✅ Verification successful:');
      if (verifyData && verifyData.length > 0) {
        verifyData.forEach((row: any, i: number) => {
          console.log(`   ${i + 1}. ${row.sport} | ${row.player_name} | ${row.market}`);
        });
      } else {
        console.log('   No SGO-Sept18-Backfill data found yet');
      }
    }

    console.log('\n🎉 September 18th SGO data processing complete!');

  } catch (error) {
    console.error('❌ SGO processing failed:', error);
    throw error;
  }
}

// Check what data already exists for Sept 18
async function checkExistingSept18Data() {
  try {
    console.log('🔍 Checking existing September 18th data...\n');

    const { data: existing, error } = await supabaseClient!
      .from('raw_props')
      .select('sport, provider, player_name')
      .eq('game_date', '2025-09-18')
      .limit(10);

    if (error) {
      console.error('❌ Error checking existing data:', error);
      return;
    }

    if (!existing || existing.length === 0) {
      console.log('📭 No existing data found for September 18th');
    } else {
      console.log(`📊 Found ${existing.length} existing props for September 18th:`);
      existing.forEach((row: any, i: number) => {
        console.log(`   ${i + 1}. ${row.sport} (${row.provider}) | ${row.player_name}`);
      });
    }

    console.log('');
  } catch (error) {
    console.error('❌ Error checking existing data:', error);
  }
}

async function main() {
  try {
    // Check existing data first
    await checkExistingSept18Data();

    // Process September 18th data using SGO
    await processSept18SGOData();

    console.log('\n✅ COMPLETE SGO PROCESSING FINISHED');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}