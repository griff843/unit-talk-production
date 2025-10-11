#!/usr/bin/env tsx
/**
 * Fetch fresh player props from The Odds API with the new fix
 * This will populate raw_props with player props
 */

import { fetchOddsApiProps } from '../agents/FeedAgent/oddsApi';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function fetchFreshPlayerProps() {
  console.log('🎯 Fetching fresh NFL player props from The Odds API\n');

  try {
    // Fetch NFL props with player-props enabled (our fix!)
    console.log('Fetching NFL player props (player_pass_yds, player_rush_yds, player_receptions)...');
    const props = await fetchOddsApiProps(
      'americanfootball_nfl',
      ['player_pass_yds', 'player_rush_yds', 'player_receptions'],
      'us',
      'american',
      'iso',
      1
    );

    console.log(`\n✅ Fetched ${props.length} player props from The Odds API`);

    // Count unique players
    const uniquePlayers = new Set(props.map(p => p.player_name));
    console.log(`📊 Unique players: ${uniquePlayers.size}`);

    // Sample player names
    const samplePlayers = Array.from(uniquePlayers).slice(0, 20);
    console.log(`\n👥 Sample players:\n${samplePlayers.join(', ')}`);

    // Write to raw_props table
    console.log(`\n💾 Writing ${props.length} props to raw_props table...`);

    let inserted = 0;
    let errors = 0;

    for (const prop of props) {
      try {
        const { error } = await supabase
          .from('raw_props')
          .insert(prop);

        if (error) {
          if (error.code !== '23505') { // Ignore duplicates
            errors++;
            if (errors <= 5) {
              console.error(`  Error inserting prop: ${error.message}`);
            }
          }
        } else {
          inserted++;
        }

        if (inserted % 100 === 0) {
          console.log(`  Progress: ${inserted}/${props.length} inserted...`);
        }
      } catch (err) {
        errors++;
      }
    }

    console.log(`\n✅ Inserted ${inserted} new props into raw_props`);
    console.log(`⚠️  Errors: ${errors} (likely duplicates)`);

    // Verify what we inserted
    const { count } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .gte('game_date', new Date().toISOString().split('T')[0]);

    console.log(`\n📊 Total raw_props for today: ${count}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fetchFreshPlayerProps();
