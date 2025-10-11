#!/usr/bin/env tsx
/**
 * Populate market_props directly with fresh player props
 * Bypasses raw_props and writes straight to market_props
 */

import { fetchOddsApiProps } from '../agents/FeedAgent/oddsApi';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function populateMarketProps() {
  console.log('🎯 Populating market_props with fresh NFL player props\n');

  try {
    // Fetch NFL props with multiple player prop markets
    console.log('Fetching NFL player props (passing, rushing, receiving)...');
    const props = await fetchOddsApiProps(
      'americanfootball_nfl',
      ['player_pass_yds', 'player_rush_yds', 'player_receptions', 'player_pass_tds', 'player_rush_tds'],
      'us',
      'american',
      'iso',
      1
    );

    console.log(`\n✅ Fetched ${props.length} player props from The Odds API`);

    // Count unique players
    const uniquePlayers = new Set(props.map(p => p.player_name));
    console.log(`📊 Unique players: ${uniquePlayers.size}`);

    // Sample
    const samplePlayers = Array.from(uniquePlayers).slice(0, 15);
    console.log(`\n👥 Sample players:\n${samplePlayers.join(', ')}`);

    // Transform to market_props format and insert
    console.log(`\n💾 Writing ${props.length} props to market_props table...`);

    let inserted = 0;
    let errors = 0;

    for (const prop of props) {
      try {
        const marketProp = {
          id: randomUUID(),
          sport: prop.sport,
          market: prop.stat_type || prop.market_type || 'unknown',
          selection: prop.selection || prop.outcome?.toString() || 'unknown',
          line: prop.line,
          odds: prop.odds || Math.abs(prop.over_odds || prop.under_odds || 0),
          over_odds: prop.over_odds,
          under_odds: prop.under_odds,
          player_name: prop.player_name,
          game_date: prop.game_date,
          team: prop.team,
          opponent: prop.opponent,
          bookmaker_key: prop.book || prop.market || 'unknown',
          external_prop_id: `${prop.external_game_id || prop.event_id}-${prop.stat_type}-${prop.player_name}-${prop.bookmaker_key || 'unknown'}`,
          metadata: {
            home_team: prop.home_team,
            away_team: prop.away_team,
            game_time: prop.game_time,
            source: 'odds-api',
            ingested_at: new Date().toISOString()
          }
        };

        const { error } = await supabase
          .from('market_props')
          .insert(marketProp);

        if (error) {
          if (error.code !== '23505') { // Ignore duplicates
            errors++;
            if (errors <= 5) {
              console.error(`  Error: ${error.message}`);
            }
          }
        } else {
          inserted++;
        }

        if (inserted > 0 && inserted % 100 === 0) {
          console.log(`  Progress: ${inserted}/${props.length} inserted...`);
        }
      } catch (err) {
        errors++;
      }
    }

    console.log(`\n✅ Inserted ${inserted} new props into market_props`);
    console.log(`⚠️  Errors/Duplicates: ${errors}`);

    // Verify
    const { count: todayTotal } = await supabase
      .from('market_props')
      .select('*', { count: 'exact', head: true })
      .gte('game_date', new Date().toISOString().split('T')[0]);

    console.log(`\n📊 Total market_props for today: ${todayTotal}`);

    // Count player props (markets starting with player_)
    const { count: playerPropsCount } = await supabase
      .from('market_props')
      .select('*', { count: 'exact', head: true })
      .gte('game_date', new Date().toISOString().split('T')[0])
      .ilike('market', 'player%');

    console.log(`🎯 Player props today: ${playerPropsCount}`);

    // Verify unique players
    const { data: players } = await supabase
      .from('market_props')
      .select('player_name')
      .gte('game_date', new Date().toISOString().split('T')[0])
      .ilike('market', 'player%');

    const uniqueToday = new Set(players?.map(p => p.player_name));
    console.log(`👥 Unique players in DB: ${uniqueToday.size}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

populateMarketProps();
