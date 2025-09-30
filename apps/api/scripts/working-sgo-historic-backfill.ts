#!/usr/bin/env node

/**
 * WORKING SGO HISTORIC BACKFILL
 * Using the correct API endpoint format for historic data
 *
 * Endpoint format:
 * https://api.sportsgameodds.com/v2/events?apiKey=YOUR_API_KEY&leagueID=NBA&startsAfter=2024-03-28T07:00:00Z&startsBefore=2024-09-30T06:59:59Z&includeAltLine=true&finalized=true
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

interface SportSchedule {
  sport: string;
  startDate: string;
  endDate: string;
  season: string;
}

async function fetchHistoricSGOData(sport: string, startDate: string, endDate: string): Promise<any> {
  const url = 'https://api.sportsgameodds.com/v2/events';

  const params = {
    apiKey: SGO_API_KEY,
    leagueID: sport,
    startsAfter: startDate,
    startsBefore: endDate,
    includeAltLine: true,
    finalized: true, // Historic data should be finalized
    limit: 50 // SGO maximum limit is 50
  };

  try {
    console.log(`   📡 Fetching ${sport} data from ${startDate.split('T')[0]} to ${endDate.split('T')[0]}...`);
    const response = await axios.get(url, { params });

    if (response.data?.success && Array.isArray(response.data?.data)) {
      console.log(`   ✅ Got ${response.data.data.length} events for ${sport}`);
      return response.data.data;
    }

    console.log(`   ⚠️  No data returned for ${sport}`);
    return [];

  } catch (error: any) {
    if (error.response?.status === 429) {
      console.log(`   ⏱️  Rate limited, waiting 60 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 60000));
      return fetchHistoricSGOData(sport, startDate, endDate); // Retry
    }

    console.error(`   ❌ API Error for ${sport}:`, error.response?.status, error.response?.data || error.message);
    return [];
  }
}

async function processAndInsertData(events: any[], sport: string): Promise<{ games: number, props: number }> {
  if (!events || events.length === 0) {
    return { games: 0, props: 0 };
  }

  let gamesInserted = 0;
  let propsInserted = 0;

  const client = await pool.connect();

  try {
    for (const event of events) {
      // Insert game if not exists
      const gameId = event.eventID || event.id;
      const homeTeam = event.teams?.home?.names?.full || event.teams?.home?.teamID || 'Unknown';
      const awayTeam = event.teams?.away?.names?.full || event.teams?.away?.teamID || 'Unknown';
      const startTime = event.info?.startsAtUTC || event.startsAt || new Date().toISOString();

      // Check if game exists
      const gameCheck = await client.query(
        'SELECT id FROM games WHERE game_id = $1',
        [gameId]
      );

      let internalGameId;

      if (gameCheck.rows.length === 0) {
        // Insert new game
        const gameInsert = await client.query(`
          INSERT INTO games (id, game_id, sport, home_team, away_team, start_time, status, provider)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (game_id) DO UPDATE SET updated_at = NOW()
          RETURNING id
        `, [uuidv4(), gameId, sport, homeTeam, awayTeam, startTime, event.status || 'completed', 'sgo']);

        internalGameId = gameInsert.rows[0].id;
        gamesInserted++;
      } else {
        internalGameId = gameCheck.rows[0].id;
      }

      // Process odds/props from the event
      if (event.odds && typeof event.odds === 'object') {
        const propsToInsert = [];

        for (const [marketKey, offer] of Object.entries(event.odds)) {
          const prop: any = offer;

          // Extract prop details - use SGO's structure
          const statType = prop.statID || marketKey;

          // Determine player name based on SGO structure
          let playerName = 'Team';
          let isPlayerProp = false;

          // Check if this is a player prop (statEntityID is a player ID, not "home", "away", "all")
          if (prop.statEntityID && !['home', 'away', 'all'].includes(prop.statEntityID)) {
            isPlayerProp = true;
            // Use playerID first, then statEntityID, then lookup in players
            if (prop.playerID && event.players && event.players[prop.playerID]) {
              playerName = event.players[prop.playerID].name;
            } else if (event.players && event.players[prop.statEntityID]) {
              playerName = event.players[prop.statEntityID].name;
            } else {
              playerName = prop.statEntityID; // Fallback to ID
            }
          } else {
            // Team prop - use team name
            if (prop.statEntityID === 'home') {
              playerName = event.teams?.home?.names?.short || 'Home Team';
            } else if (prop.statEntityID === 'away') {
              playerName = event.teams?.away?.names?.short || 'Away Team';
            } else {
              playerName = 'Combined Teams';
            }
          }

          // Get line from SGO structure - prefer bookOverUnder, fallback to fairOverUnder
          const line = parseFloat(prop.bookOverUnder || prop.fairOverUnder || '0');

          // Parse odds based on SGO structure
          let overOdds = null;
          let underOdds = null;

          // Prefer bookOdds, fallback to fairOdds
          const oddsValue = prop.bookOdds || prop.fairOdds;
          if (oddsValue) {
            const parsedOdds = parseInt(oddsValue.toString().replace('+', ''));
            if (prop.sideID === 'over') {
              overOdds = parsedOdds;
            } else if (prop.sideID === 'under') {
              underOdds = parsedOdds;
            }
          }

          // Skip if no valid odds found
          if (!overOdds && !underOdds) {
            continue;
          }

          const propId = uuidv4();
          const externalId = `${gameId}-${prop.oddID}`;

          propsToInsert.push({
            id: propId,
            game_id: internalGameId,
            external_id: externalId,
            sport,
            stat_type: statType,
            player_name: playerName,
            line,
            over_odds: overOdds,
            under_odds: underOdds,
            start_time: startTime,
            source: 'sgo'
          });
        }

        // SGO odds structure contains all the props we need - no need to process results

        // Batch insert props
        if (propsToInsert.length > 0) {
          console.log(`      📝 Processing ${propsToInsert.length} props for game ${gameId}`);

          // Count different sources for debugging
          const sources = propsToInsert.reduce((acc, prop) => {
            acc[prop.source] = (acc[prop.source] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          console.log(`      📊 Props by source:`, sources);

          // Debug first few props to see what data we're inserting
          console.log(`      🔍 Sample props:`, propsToInsert.slice(0, 3).map(p => ({
            stat_type: p.stat_type,
            player_name: p.player_name,
            line: p.line,
            external_id: p.external_id?.substring(0, 50) + '...'
          })));

          for (const prop of propsToInsert) {
            try {
              await client.query(`
                INSERT INTO raw_props (
                  id, game_id, external_id, sport, stat_type, player_name,
                  line, over_odds, under_odds, start_time, source, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
              `, [
                prop.id, prop.game_id, prop.external_id, prop.sport,
                prop.stat_type, prop.player_name, prop.line,
                prop.over_odds, prop.under_odds, prop.start_time, prop.source
              ]);
              propsInserted++;
            } catch (err: any) {
              console.warn(`      ⚠️  Failed to insert prop: ${err.message}`);
            }
          }
        } else {
          console.log(`      📭 No props found for game ${gameId}`);
        }
      }
    }

  } catch (error: any) {
    console.error('   ❌ Processing error:', error.message);
  } finally {
    client.release();
  }

  return { games: gamesInserted, props: propsInserted };
}

async function runHistoricBackfill() {
  if (!SGO_API_KEY) {
    console.error('❌ SGO_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🚀 SGO HISTORIC DATA BACKFILL');
  console.log('📊 Using correct endpoint format for historic data');
  console.log('🔑 API Key:', SGO_API_KEY.substring(0, 8) + '...');
  console.log('');

  try {
    // Check current state
    const client = await pool.connect();
    const gamesCount = await client.query('SELECT COUNT(*) FROM games WHERE provider = $1', ['sgo']);
    const propsCount = await client.query('SELECT COUNT(*) FROM raw_props WHERE source = $1', ['sgo']);
    console.log(`📊 Starting state: ${gamesCount.rows[0].count} games, ${propsCount.rows[0].count} props`);
    client.release();

    let totalGames = 0;
    let totalProps = 0;

    // Define comprehensive schedules for massive parallel backfill
    // Use smaller date ranges to maximize events (50 per request)
    const schedules: SportSchedule[] = [];

    // MLB 2024 - Break into monthly chunks (known to work)
    const mlb2024Months = [
      { start: '2024-03-28T07:00:00Z', end: '2024-04-30T23:59:59Z', month: 'March-April' },
      { start: '2024-05-01T00:00:00Z', end: '2024-05-31T23:59:59Z', month: 'May' },
      { start: '2024-06-01T00:00:00Z', end: '2024-06-30T23:59:59Z', month: 'June' },
      { start: '2024-07-01T00:00:00Z', end: '2024-07-31T23:59:59Z', month: 'July' },
      { start: '2024-08-01T00:00:00Z', end: '2024-08-31T23:59:59Z', month: 'August' },
      { start: '2024-09-01T00:00:00Z', end: '2024-09-30T06:59:59Z', month: 'September' },
    ];

    mlb2024Months.forEach(period => {
      schedules.push({
        sport: 'MLB',
        startDate: period.start,
        endDate: period.end,
        season: `2024 ${period.month}`
      });
    });

    // NBA 2024 - Break into monthly chunks
    const nba2024Months = [
      { start: '2024-10-01T00:00:00Z', end: '2024-10-31T23:59:59Z', month: 'Oct 2024' },
      { start: '2024-11-01T00:00:00Z', end: '2024-11-30T23:59:59Z', month: 'Nov 2024' },
      { start: '2024-12-01T00:00:00Z', end: '2024-12-31T23:59:59Z', month: 'Dec 2024' },
      { start: '2024-01-01T00:00:00Z', end: '2024-01-31T23:59:59Z', month: 'Jan 2024' },
      { start: '2024-02-01T00:00:00Z', end: '2024-02-29T23:59:59Z', month: 'Feb 2024' },
      { start: '2024-03-01T00:00:00Z', end: '2024-03-31T23:59:59Z', month: 'Mar 2024' },
      { start: '2024-04-01T00:00:00Z', end: '2024-04-30T23:59:59Z', month: 'Apr 2024' },
      { start: '2024-05-01T00:00:00Z', end: '2024-05-31T23:59:59Z', month: 'May 2024' },
      { start: '2024-06-01T00:00:00Z', end: '2024-06-30T23:59:59Z', month: 'Jun 2024' },
    ];

    nba2024Months.forEach(period => {
      schedules.push({
        sport: 'NBA',
        startDate: period.start,
        endDate: period.end,
        season: `2024 ${period.month}`
      });
    });

    // NFL 2024 - Break into monthly chunks
    const nfl2024Months = [
      { start: '2024-09-01T00:00:00Z', end: '2024-09-30T23:59:59Z', month: 'Sep 2024' },
      { start: '2024-10-01T00:00:00Z', end: '2024-10-31T23:59:59Z', month: 'Oct 2024' },
      { start: '2024-11-01T00:00:00Z', end: '2024-11-30T23:59:59Z', month: 'Nov 2024' },
      { start: '2024-12-01T00:00:00Z', end: '2024-12-31T23:59:59Z', month: 'Dec 2024' },
      { start: '2024-01-01T00:00:00Z', end: '2024-01-31T23:59:59Z', month: 'Jan 2024' },
      { start: '2024-02-01T00:00:00Z', end: '2024-02-28T23:59:59Z', month: 'Feb 2024' },
    ];

    nfl2024Months.forEach(period => {
      schedules.push({
        sport: 'NFL',
        startDate: period.start,
        endDate: period.end,
        season: `2024 ${period.month}`
      });
    });

    // Add other sports with smaller date ranges for maximum coverage
    schedules.push(
      { sport: 'NHL', startDate: '2024-10-01T00:00:00Z', endDate: '2024-10-31T23:59:59Z', season: '2024 Oct' },
      { sport: 'NHL', startDate: '2024-11-01T00:00:00Z', endDate: '2024-11-30T23:59:59Z', season: '2024 Nov' },
      { sport: 'NHL', startDate: '2024-12-01T00:00:00Z', endDate: '2024-12-31T23:59:59Z', season: '2024 Dec' },
      { sport: 'NCAAF', startDate: '2024-09-01T00:00:00Z', endDate: '2024-09-30T23:59:59Z', season: '2024 Sep' },
      { sport: 'NCAAF', startDate: '2024-10-01T00:00:00Z', endDate: '2024-10-31T23:59:59Z', season: '2024 Oct' },
      { sport: 'NCAAF', startDate: '2024-11-01T00:00:00Z', endDate: '2024-11-30T23:59:59Z', season: '2024 Nov' },
      { sport: 'NCAAB', startDate: '2024-11-01T00:00:00Z', endDate: '2024-11-30T23:59:59Z', season: '2024 Nov' },
      { sport: 'NCAAB', startDate: '2024-12-01T00:00:00Z', endDate: '2024-12-31T23:59:59Z', season: '2024 Dec' },
    );

    console.log(`📅 Processing ${schedules.length} sport seasons...\n`);

    for (let i = 0; i < schedules.length; i++) {
      const schedule = schedules[i];
      console.log(`[${i + 1}/${schedules.length}] ${schedule.sport} ${schedule.season}`);

      const events = await fetchHistoricSGOData(schedule.sport, schedule.startDate, schedule.endDate);

      if (events.length > 0) {
        console.log(`   🎮 Processing ${events.length} events...`);
        const result = await processAndInsertData(events, schedule.sport);

        totalGames += result.games;
        totalProps += result.props;

        console.log(`   ✅ Inserted: ${result.games} games, ${result.props} props`);
        console.log(`   📊 Running total: ${totalGames} games, ${totalProps} props\n`);
      } else {
        console.log(`   ⚠️  No events found for this period\n`);
      }

      // Rate limiting between requests
      if (i < schedules.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Final verification
    const finalClient = await pool.connect();
    const finalGames = await finalClient.query('SELECT COUNT(*) FROM games WHERE provider = $1', ['sgo']);
    const finalProps = await finalClient.query('SELECT COUNT(*) FROM raw_props WHERE source = $1', ['sgo']);
    finalClient.release();

    console.log('🎯 HISTORIC BACKFILL COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   🎮 Total games in DB: ${finalGames.rows[0].count}`);
    console.log(`   📊 Total props in DB: ${finalProps.rows[0].count}`);
    console.log(`   ✨ New games added: ${totalGames}`);
    console.log(`   ✨ New props added: ${totalProps}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runHistoricBackfill().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}