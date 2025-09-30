#!/usr/bin/env node

/**
 * DEBUG MLB ONLY - Test just the MLB parsing to debug issues
 */

import axios from 'axios';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const SGO_API_KEY = process.env.SGO_API_KEY || process.env.SPORTSGAMEODDS_KEY;

// Direct PostgreSQL connection
const pool = new Pool({
  host: 'unit-talk-postgres',
  port: 5432,
  database: 'unit_talk_dev',
  user: 'postgres',
  password: 'development_password_2024',
});

async function debugMLBOnly() {
  if (!SGO_API_KEY) {
    console.error('❌ SGO_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🔍 DEBUG MLB ONLY');
  console.log('🔑 API Key:', SGO_API_KEY.substring(0, 8) + '...');
  console.log('');

  try {
    const url = 'https://api.sportsgameodds.com/v2/events';

    const params = {
      apiKey: SGO_API_KEY,
      leagueID: 'MLB',
      startsAfter: '2024-03-28T07:00:00Z',
      startsBefore: '2024-09-30T06:59:59Z',
      includeAltLine: true,
      finalized: true,
      limit: 1 // Just one event for debugging
    };

    console.log('📡 Fetching MLB data...');
    const response = await axios.get(url, { params });

    if (response.data?.success && Array.isArray(response.data?.data)) {
      console.log(`✅ Got ${response.data.data.length} events`);

      if (response.data.data.length > 0) {
        const event = response.data.data[0];
        console.log('\n🎮 EVENT:', event.eventID);

        const client = await pool.connect();

        // Check if game exists
        const gameId = event.eventID;
        const gameCheck = await client.query('SELECT id FROM games WHERE game_id = $1', [gameId]);

        let internalGameId;
        if (gameCheck.rows.length === 0) {
          // Insert new game
          const homeTeam = event.teams?.home?.names?.full || 'Unknown';
          const awayTeam = event.teams?.away?.names?.full || 'Unknown';
          const startTime = event.info?.startsAtUTC || new Date().toISOString();

          console.log('🏟️  Creating game:', { gameId, homeTeam, awayTeam });

          const gameInsert = await client.query(`
            INSERT INTO games (id, game_id, sport, home_team, away_team, start_time, status, provider)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
          `, [uuidv4(), gameId, 'MLB', homeTeam, awayTeam, startTime, 'completed', 'sgo']);

          internalGameId = gameInsert.rows[0].id;
          console.log('✅ Game created with internal ID:', internalGameId);
        } else {
          internalGameId = gameCheck.rows[0].id;
          console.log('✅ Using existing game ID:', internalGameId);
        }

        // Process odds/props
        if (event.odds && typeof event.odds === 'object') {
          console.log(`\n💰 Processing ${Object.keys(event.odds).length} odds entries...`);

          let processedCount = 0;
          let playerPropCount = 0;
          let teamPropCount = 0;

          for (const [marketKey, offer] of Object.entries(event.odds)) {
            const prop: any = offer;

            console.log(`\n📊 Processing: ${marketKey}`);
            console.log('  - statID:', prop.statID);
            console.log('  - statEntityID:', prop.statEntityID);
            console.log('  - playerID:', prop.playerID);
            console.log('  - sideID:', prop.sideID);
            console.log('  - bookOverUnder:', prop.bookOverUnder);
            console.log('  - fairOverUnder:', prop.fairOverUnder);
            console.log('  - bookOdds:', prop.bookOdds);
            console.log('  - fairOdds:', prop.fairOdds);

            // Extract prop details - use SGO's structure
            const statType = prop.statID || marketKey;

            // Determine player name based on SGO structure
            let playerName = 'Team';
            let isPlayerProp = false;

            // Check if this is a player prop
            if (prop.statEntityID && !['home', 'away', 'all'].includes(prop.statEntityID)) {
              isPlayerProp = true;
              playerPropCount++;
              if (prop.playerID && event.players && event.players[prop.playerID]) {
                playerName = event.players[prop.playerID].name;
              } else if (event.players && event.players[prop.statEntityID]) {
                playerName = event.players[prop.statEntityID].name;
              } else {
                playerName = prop.statEntityID;
              }
            } else {
              teamPropCount++;
              if (prop.statEntityID === 'home') {
                playerName = event.teams?.home?.names?.short || 'Home Team';
              } else if (prop.statEntityID === 'away') {
                playerName = event.teams?.away?.names?.short || 'Away Team';
              } else {
                playerName = 'Combined Teams';
              }
            }

            const line = parseFloat(prop.bookOverUnder || prop.fairOverUnder || '0');

            // Parse odds
            let overOdds = null;
            let underOdds = null;

            const oddsValue = prop.bookOdds || prop.fairOdds;
            if (oddsValue) {
              const parsedOdds = parseInt(oddsValue.toString().replace('+', ''));
              if (prop.sideID === 'over') {
                overOdds = parsedOdds;
              } else if (prop.sideID === 'under') {
                underOdds = parsedOdds;
              }
            }

            console.log('  - Parsed:', { isPlayerProp, playerName, statType, line, overOdds, underOdds });

            if (overOdds || underOdds) {
              const externalId = `${gameId}-${prop.oddID}`;
              console.log('  - Will insert with external_id:', externalId);

              try {
                await client.query(`
                  INSERT INTO raw_props (
                    id, game_id, external_id, sport, stat_type, player_name,
                    line, over_odds, under_odds, start_time, source, created_at, updated_at
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
                `, [
                  uuidv4(), internalGameId, externalId, 'MLB',
                  statType, playerName, line,
                  overOdds, underOdds, new Date().toISOString(), 'sgo'
                ]);
                processedCount++;
                console.log('  ✅ Inserted successfully');
              } catch (err: any) {
                console.log('  ❌ Insert failed:', err.message);
              }
            } else {
              console.log('  ⚠️  Skipped - no valid odds');
            }

            // Only process first 10 for debugging
            if (processedCount >= 10) break;
          }

          console.log(`\n📊 SUMMARY:`);
          console.log(`  - Player props: ${playerPropCount}`);
          console.log(`  - Team props: ${teamPropCount}`);
          console.log(`  - Successfully inserted: ${processedCount}`);
        }

        client.release();
      }
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  debugMLBOnly().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}