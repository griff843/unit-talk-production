/**
 * Backfill Market Props from 3M Raw Props - Large Scale
 *
 * Strategy:
 * 1. Query raw_props for recent, high-quality props
 * 2. Normalize and insert into market_props
 * 3. Handle duplicates via unique constraint
 * 4. Target: 10,000+ props for comprehensive testing
 */

import { supabaseClient } from './src/services/supabaseClient';
import { randomUUID } from 'crypto';

interface RawProp {
  id: string;
  player_name: string;
  sport: string;
  team: string;
  stat_type: string;
  line: number;
  odds: number;
  game_date: string;
  matchup: string;
  over_odds?: number;
  under_odds?: number;
}

async function backfillMarketProps() {
  console.log('🚀 Starting large-scale market_props backfill from 3M raw_props\n');
  console.log('Target: 10,000+ normalized props');
  console.log('Source: raw_props (3,057,034 rows)');
  console.log('=' .repeat(80));

  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  // Check current state
  const { count: currentCount } = await supabaseClient
    .from('market_props')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Current market_props: ${currentCount?.toLocaleString() || 0} rows`);

  // Strategy: Get props from recent dates with good data quality
  console.log('\n🔍 Querying raw_props for high-quality historical props...');

  const { data: rawProps, error } = await supabaseClient
    .from('raw_props')
    .select('id, player_name, sport, team, stat_type, line, odds, game_date, matchup, over_odds, under_odds')
    .not('player_name', 'is', null)
    .not('line', 'is', null)
    .not('game_date', 'is', null)
    .gte('game_date', '2025-08-01') // Recent props from Aug 2025
    .order('game_date', { ascending: false })
    .limit(15000); // Get 15k to account for duplicates

  if (error) {
    throw error;
  }

  console.log(`✅ Retrieved ${rawProps?.length || 0} raw props`);

  if (!rawProps || rawProps.length === 0) {
    console.log('⚠️  No props found - trying broader date range...');

    const { data: rawPropsBackup } = await supabaseClient
      .from('raw_props')
      .select('id, player_name, sport, team, stat_type, line, odds, game_date, matchup, over_odds, under_odds')
      .not('player_name', 'is', null)
      .not('line', 'is', null)
      .not('game_date', 'is', null)
      .gte('game_date', '2025-01-01') // Entire year 2025
      .order('game_date', { ascending: false })
      .limit(15000);

    if (!rawPropsBackup || rawPropsBackup.length === 0) {
      console.log('❌ No props found in entire dataset');
      return;
    }

    console.log(`✅ Retrieved ${rawPropsBackup.length} props from broader range`);
    rawProps.splice(0, rawProps.length, ...rawPropsBackup);
  }

  // Normalize and insert in batches
  const batchSize = 100;
  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  console.log(`\n📦 Processing ${rawProps.length} props in batches of ${batchSize}...`);

  for (let i = 0; i < rawProps.length; i += batchSize) {
    const batch = rawProps.slice(i, i + batchSize);

    const marketProps = batch.map(raw => {
      // Normalize stat_type to market
      let market = raw.stat_type || 'player_prop';

      // Common normalizations
      const marketMap: Record<string, string> = {
        'strikeoutsThrown': 'pitcher_strikeouts',
        'hitsRecorded': 'player_hits',
        'hitsAllowed': 'pitcher_hits_allowed',
        'pointsScored': 'player_points',
        'reboundsRecorded': 'player_rebounds',
        'assistsRecorded': 'player_assists',
        'passingYards': 'player_passing_yards',
        'rushingYards': 'player_rushing_yards',
        'receivingYards': 'player_receiving_yards',
        'goalsScored': 'player_goals'
      };

      if (marketMap[market]) {
        market = marketMap[market];
      }

      // Extract opponent from matchup (e.g., "mil vs pit" → opponent = "pit")
      let opponent = null;
      if (raw.matchup) {
        const parts = raw.matchup.toLowerCase().split(' vs ');
        if (parts.length === 2) {
          // Team is parts[0], opponent is parts[1]
          opponent = parts[1].trim();
        }
      }

      return {
        id: randomUUID(),
        player_name: raw.player_name,
        sport: raw.sport,
        market,
        selection: 'Over', // Default to Over
        line: raw.line,
        odds: raw.odds || -110,
        over_odds: raw.over_odds || null,
        under_odds: raw.under_odds || null,
        game_date: raw.game_date,
        team: raw.team || null,
        opponent: opponent,
        bookmaker_key: 'historical',
        external_prop_id: `raw_${raw.id}`,
        metadata: {
          source: 'raw_props_backfill',
          original_stat_type: raw.stat_type
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    // Insert batch
    const { error: insertError } = await supabaseClient
      .from('market_props')
      .insert(marketProps);

    if (insertError) {
      // Check if duplicate key error (23505)
      if (insertError.code === '23505') {
        duplicates += batch.length;
      } else {
        errors += batch.length;
        console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} error:`, insertError.message);
      }
    } else {
      inserted += batch.length;
    }

    // Progress update every 10 batches
    if ((i / batchSize) % 10 === 0) {
      console.log(`  Progress: ${i + batch.length}/${rawProps.length} | Inserted: ${inserted} | Duplicates: ${duplicates}`);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Final count
  const { count: finalCount } = await supabaseClient
    .from('market_props')
    .select('*', { count: 'exact', head: true });

  console.log('\n' + '='.repeat(80));
  console.log('📊 BACKFILL COMPLETE');
  console.log('='.repeat(80));
  console.log(`\n✅ Results:`);
  console.log(`  Processed: ${rawProps.length.toLocaleString()} props`);
  console.log(`  Inserted: ${inserted.toLocaleString()} new props`);
  console.log(`  Duplicates: ${duplicates.toLocaleString()} (skipped)`);
  console.log(`  Errors: ${errors} props`);
  console.log(`\n📈 market_props totals:`);
  console.log(`  Before: ${currentCount?.toLocaleString() || 0} rows`);
  console.log(`  After: ${finalCount?.toLocaleString() || 0} rows`);
  console.log(`  Growth: +${((finalCount || 0) - (currentCount || 0)).toLocaleString()} rows`);

  if ((finalCount || 0) >= 10000) {
    console.log('\n🎉 SUCCESS! Target of 10,000+ props achieved!');
  } else {
    console.log(`\n⚠️  Below target: ${finalCount?.toLocaleString() || 0} / 10,000`);
  }
}

backfillMarketProps()
  .then(() => {
    console.log('\n✅ Script complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
