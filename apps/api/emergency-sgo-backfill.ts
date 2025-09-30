#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const SGO_API_KEY = process.env.SGO_API_KEY || process.env.ODDS_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Use local postgres directly
const POSTGRES_HOST = 'postgres';
const POSTGRES_PORT = 5432;
const POSTGRES_USER = 'postgres';
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'development_password_2024';
const POSTGRES_DB = 'postgres';

import pkg from 'pg';
const { Client } = pkg;

async function fetchSGOProps(sport: string, date: string) {
  const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds`;

  try {
    const response = await axios.get(url, {
      params: {
        apiKey: SGO_API_KEY,
        regions: 'us',
        markets: 'player_props',
        oddsFormat: 'american',
        date: date
      }
    });

    return response.data || [];
  } catch (error: any) {
    console.error(`Failed to fetch SGO props for ${sport}:`, error.message);
    return [];
  }
}

async function backfillSGOData() {
  console.log('🚀 Starting emergency SGO backfill...');

  // Connect directly to local postgres
  const pgClient = new Client({
    host: POSTGRES_HOST,
    port: POSTGRES_PORT,
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    database: POSTGRES_DB
  });

  try {
    await pgClient.connect();
    console.log('✅ Connected to local PostgreSQL');

    const sports = [
      { name: 'NBA', sgo_id: 'basketball_nba' },
      { name: 'NFL', sgo_id: 'americanfootball_nfl' },
      { name: 'MLB', sgo_id: 'baseball_mlb' },
      { name: 'NHL', sgo_id: 'icehockey_nhl' },
      { name: 'NCAAF', sgo_id: 'americanfootball_ncaaf' },
      { name: 'NCAAB', sgo_id: 'basketball_ncaab' }
    ];

    let totalProps = 0;

    for (const sport of sports) {
      console.log(`\n📊 Fetching ${sport.name} props...`);

      // Fetch props from SGO
      const sgoData = await fetchSGOProps(sport.sgo_id, new Date().toISOString().split('T')[0]);

      if (!sgoData || sgoData.length === 0) {
        console.log(`  No data found for ${sport.name}`);
        continue;
      }

      // Process each game
      for (const game of sgoData) {
        if (!game.bookmakers || game.bookmakers.length === 0) continue;

        for (const bookmaker of game.bookmakers) {
          if (!bookmaker.markets) continue;

          for (const market of bookmaker.markets) {
            if (market.key.includes('player')) {
              for (const outcome of market.outcomes) {
                const prop = {
                  sport: sport.name,
                  stat_type: market.key,
                  player_name: outcome.description || outcome.name || 'Unknown',
                  line: outcome.point || 0,
                  over_odds: outcome.price || 0,
                  under_odds: 0,
                  game_id: game.id,
                  game_start: game.commence_time,
                  home_team: game.home_team,
                  away_team: game.away_team,
                  source: 'SGO',
                  bookmaker: bookmaker.key
                };

                try {
                  const query = `
                    INSERT INTO raw_props (
                      sport, stat_type, player_name, line,
                      over_odds, under_odds, game_id, game_start,
                      home_team, away_team, source, bookmaker
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT DO NOTHING
                  `;

                  await pgClient.query(query, [
                    prop.sport, prop.stat_type, prop.player_name, prop.line,
                    prop.over_odds, prop.under_odds, prop.game_id, prop.game_start,
                    prop.home_team, prop.away_team, prop.source, prop.bookmaker
                  ]);

                  totalProps++;
                } catch (insertError) {
                  // Skip individual insert errors
                }
              }
            }
          }
        }
      }

      console.log(`  ✅ Processed ${sport.name} props`);
    }

    // Get final count
    const result = await pgClient.query('SELECT COUNT(*) as total FROM raw_props');
    const finalCount = result.rows[0].total;

    console.log(`\n✅ Backfill complete!`);
    console.log(`   Total props inserted: ${totalProps}`);
    console.log(`   Total props in database: ${finalCount}`);

  } catch (error) {
    console.error('❌ Backfill failed:', error);
  } finally {
    await pgClient.end();
  }
}

// Run the backfill
backfillSGOData();