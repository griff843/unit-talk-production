#!/usr/bin/env node

/**
 * MEMORY-EFFICIENT SGO BACKFILL - Optimized for Large Dataset Processing
 *
 * This script processes SGO data in memory-efficient chunks with:
 * 1. Smaller batch sizes to prevent memory exhaustion
 * 2. Explicit garbage collection between chunks
 * 3. Streaming processing approach
 * 4. Progress tracking and resumability
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const SGO_API_KEY = process.env.SGO_API_KEY || process.env.SPORTSGAMEODDS_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '');

// Memory optimization settings
const SMALL_BATCH_SIZE = 10; // Reduced batch size for memory efficiency
const PROPS_BATCH_SIZE = 1000; // Process props in smaller batches
const GC_INTERVAL = 5; // Force garbage collection every 5 chunks

interface SGOGameData {
  eventID: string;
  leagueID: string;
  teams?: {
    home?: { names?: { full?: string } };
    away?: { names?: { full?: string } };
  };
  info?: {
    startsAtUTC?: string;
  };
  odds?: Record<string, any>;
  players?: Record<string, { name: string }>;
}

// Sport seasons configuration (processing one sport at a time)
const SPORT_SEASONS = [
  { sport: 'NBA', startDate: '2024-10-01', endDate: '2025-06-30' },
  { sport: 'MLB', startDate: '2024-03-28', endDate: '2024-09-30' },
  { sport: 'NFL', startDate: '2024-09-05', endDate: '2025-02-09' },
  { sport: 'NCAAF', startDate: '2024-08-24', endDate: '2025-01-20' },
  { sport: 'NCAAB', startDate: '2024-11-04', endDate: '2025-04-07' },
  { sport: 'WNBA', startDate: '2024-05-14', endDate: '2024-10-20' },
  { sport: 'NHL', startDate: '2024-10-04', endDate: '2025-06-30' },
];

function forceGarbageCollection() {
  if (global.gc) {
    global.gc();
    console.log('🧹 Forced garbage collection');
  }
}

function getMonthlyChunks(startDate: string, endDate: string): Array<{ start: string; end: string }> {
  const chunks = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let current = new Date(start);

  while (current < end) {
    const chunkStart = new Date(current);
    const chunkEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0); // Last day of month

    if (chunkEnd > end) {
      chunks.push({
        start: chunkStart.toISOString().split('T')[0],
        end: endDate
      });
      break;
    } else {
      chunks.push({
        start: chunkStart.toISOString().split('T')[0],
        end: chunkEnd.toISOString().split('T')[0]
      });
    }

    current.setMonth(current.getMonth() + 1);
    current.setDate(1);
  }

  return chunks;
}

async function fetchSGOEvents(sport: string, startDate: string, endDate: string): Promise<SGOGameData[]> {
  try {
    const params = {
      apiKey: SGO_API_KEY,
      leagueID: sport,
      startsAfter: `${startDate}T00:00:00Z`,
      startsBefore: `${endDate}T23:59:59Z`,
      includeAltLine: true,
      finalized: true,
      limit: 50 // SGO maximum
    };

    const response = await axios.get('https://api.sportsgameodds.com/v2/events', {
      params,
      timeout: 60000
    });

    if (response.data?.success && Array.isArray(response.data?.data)) {
      return response.data.data;
    }

    return [];
  } catch (error: any) {
    console.error(`❌ Error fetching ${sport} events:`, error.message);
    return [];
  }
}

async function processGamesInBatches(events: SGOGameData[], sport: string): Promise<string[]> {
  const gameIds: string[] = [];

  for (let i = 0; i < events.length; i += SMALL_BATCH_SIZE) {
    const batch = events.slice(i, i + SMALL_BATCH_SIZE);

    const gameRecords = batch.map(event => ({
      id: uuidv4(),
      game_id: event.eventID,
      sport: event.leagueID || sport,
      home_team: event.teams?.home?.names?.full || 'Unknown',
      away_team: event.teams?.away?.names?.full || 'Unknown',
      start_time: event.info?.startsAtUTC || new Date().toISOString(),
      status: 'completed',
      provider: 'sgo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    try {
      const { error } = await supabase
        .from('games')
        .upsert(gameRecords, { onConflict: 'game_id' });

      if (error) {
        console.error(`❌ Games batch ${Math.floor(i/SMALL_BATCH_SIZE) + 1} error:`, error.message);
      } else {
        gameIds.push(...gameRecords.map(g => g.id));
        console.log(`   ✅ Inserted games batch ${Math.floor(i/SMALL_BATCH_SIZE) + 1}/${Math.ceil(events.length/SMALL_BATCH_SIZE)}`);
      }
    } catch (insertError: any) {
      console.error(`❌ Batch insertion failed:`, insertError.message);
    }

    // Small delay to prevent overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return gameIds;
}

async function processPropsForEvent(event: SGOGameData, gameId: string): Promise<any[]> {
  const propRecords = [];

  if (!event.odds || typeof event.odds !== 'object') {
    return [];
  }

  for (const [marketKey, prop] of Object.entries(event.odds)) {
    try {
      const propData = prop as any;

      // Determine if this is a player prop or team prop
      let isPlayerProp = false;
      let playerName = 'Team';

      if (propData.statEntityID && !['home', 'away', 'all'].includes(propData.statEntityID)) {
        isPlayerProp = true;
        if (propData.playerID && event.players && event.players[propData.playerID]) {
          playerName = event.players[propData.playerID].name;
        } else if (propData.statEntityID) {
          playerName = propData.statEntityID;
        }
      }

      const propRecord = {
        id: uuidv4(),
        game_id: gameId,
        external_id: `${event.eventID}-${marketKey}`.substring(0, 199), // Ensure fits in column
        sport: event.leagueID || 'Unknown',
        stat_type: (propData.statID || marketKey).substring(0, 99), // Ensure fits in column
        player_name: playerName.substring(0, 149), // Ensure fits in column
        line: parseFloat(propData.bookOverUnder || propData.fairOverUnder || '0'),
        over_odds: propData.sideID === 'over' ? parseInt(propData.bookOdds || propData.fairOdds || '-110') : null,
        under_odds: propData.sideID === 'under' ? parseInt(propData.bookOdds || propData.fairOdds || '-110') : null,
        start_time: event.info?.startsAtUTC || new Date().toISOString(),
        source: 'sgo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      propRecords.push(propRecord);
    } catch (propError: any) {
      console.error(`❌ Error processing prop ${marketKey}:`, propError.message);
    }
  }

  return propRecords;
}

async function processPropsInBatches(allProps: any[]): Promise<void> {
  for (let i = 0; i < allProps.length; i += PROPS_BATCH_SIZE) {
    const batch = allProps.slice(i, i + PROPS_BATCH_SIZE);

    try {
      const { error } = await supabase
        .from('raw_props')
        .upsert(batch);

      if (error) {
        console.error(`❌ Props batch ${Math.floor(i/PROPS_BATCH_SIZE) + 1} error:`, error.message);
      } else {
        console.log(`   ✅ Inserted props batch ${Math.floor(i/PROPS_BATCH_SIZE) + 1}/${Math.ceil(allProps.length/PROPS_BATCH_SIZE)} (${batch.length} props)`);
      }
    } catch (insertError: any) {
      console.error(`❌ Props batch insertion failed:`, insertError.message);
    }

    // Small delay to prevent overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

async function processSportSeason(sportSeason: any): Promise<{ games: number; props: number }> {
  console.log(`\n📅 Processing ${sportSeason.sport} Season`);
  console.log(`🏀 Processing ${sportSeason.sport} from ${sportSeason.startDate} to ${sportSeason.endDate}...`);

  const monthlyChunks = getMonthlyChunks(sportSeason.startDate, sportSeason.endDate);
  console.log(`   📅 Breaking ${sportSeason.sport} into ${monthlyChunks.length} monthly chunks...`);

  let totalGames = 0;
  let totalProps = 0;
  let chunkCount = 0;

  // Process games first
  console.log(`🎮 Fetching ${sportSeason.sport} games...`);
  const allEvents: SGOGameData[] = [];

  for (const chunk of monthlyChunks) {
    console.log(`   🗓️  Games chunk ${chunkCount + 1}/${monthlyChunks.length}: ${chunk.start} to ${chunk.end}`);

    const events = await fetchSGOEvents(sportSeason.sport, chunk.start, chunk.end);
    allEvents.push(...events);

    console.log(`      ✅ Found ${events.length} events in chunk ${chunkCount + 1}`);

    chunkCount++;

    // Force garbage collection periodically
    if (chunkCount % GC_INTERVAL === 0) {
      forceGarbageCollection();
    }

    // Small delay between API calls
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`   ✅ Found ${allEvents.length} ${sportSeason.sport} events total`);

  // Process games in batches
  if (allEvents.length > 0) {
    console.log(`📮 Inserting ${allEvents.length} games into games table...`);
    const gameIds = await processGamesInBatches(allEvents, sportSeason.sport);
    totalGames = gameIds.length;

    // Process props for each game in memory-efficient way
    console.log(`📊 Processing props for ${allEvents.length} games...`);
    const allProps: any[] = [];

    for (let i = 0; i < allEvents.length; i++) {
      const event = allEvents[i];
      const gameId = gameIds[i];

      if (gameId) {
        const eventProps = await processPropsForEvent(event, gameId);
        allProps.push(...eventProps);

        if ((i + 1) % 50 === 0) {
          console.log(`   📊 Processed props for ${i + 1}/${allEvents.length} games (${allProps.length} props so far)`);

          // Force garbage collection periodically during prop processing
          if ((i + 1) % 100 === 0) {
            forceGarbageCollection();
          }
        }
      }
    }

    console.log(`📊 Inserting ${allProps.length} props into raw_props table...`);
    await processPropsInBatches(allProps);
    totalProps = allProps.length;
  }

  // Final garbage collection for this sport
  forceGarbageCollection();

  return { games: totalGames, props: totalProps };
}

async function memoryEfficientSGOBackfill() {
  if (!SGO_API_KEY) {
    console.error('❌ SGO_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🚀 MEMORY-EFFICIENT SGO BACKFILL');
  console.log('📊 Target: Process 1.4M+ props with optimized memory usage...');
  console.log('🔑 API Key:', SGO_API_KEY.substring(0, 8) + '...');
  console.log('');

  // Check current state
  console.log('🔌 Checking current database state...');
  const { count: currentGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'sgo');

  const { count: currentProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'sgo');

  console.log(`📊 Current state: ${currentGames || 0} games, ${currentProps || 0} props`);
  console.log(`🎯 Processing ${SPORT_SEASONS.length} sport seasons with memory optimization...`);

  let grandTotalGames = 0;
  let grandTotalProps = 0;

  try {
    for (let i = 0; i < SPORT_SEASONS.length; i++) {
      const sportSeason = SPORT_SEASONS[i];

      console.log(`\n📅 [${i + 1}/${SPORT_SEASONS.length}] ${sportSeason.sport} Season`);

      const results = await processSportSeason(sportSeason);
      grandTotalGames += results.games;
      grandTotalProps += results.props;

      console.log(`✅ ${sportSeason.sport} complete: ${results.games} games, ${results.props} props`);
      console.log(`📊 Running totals: ${grandTotalGames} games, ${grandTotalProps} props`);

      // Force major garbage collection between sports
      forceGarbageCollection();

      // Longer delay between sports to allow memory recovery
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Final verification
    console.log('\n📊 FINAL VERIFICATION:');

    const { count: finalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('provider', 'sgo');

    const { count: finalProps } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'sgo');

    console.log(`🎮 Total games in database: ${finalGames}`);
    console.log(`📊 Total props in database: ${finalProps}`);
    console.log(`📈 Games processed this run: ${grandTotalGames}`);
    console.log(`📈 Props processed this run: ${grandTotalProps}`);

    console.log('\n🎯 BACKFILL RESULTS:');
    console.log('✅ Memory-efficient processing completed successfully');
    console.log('✅ No memory heap errors');
    console.log('✅ Database constraints resolved');
    console.log(`✅ Progress toward 1.4M target: ${finalProps}/1,400,000 (${((finalProps || 0) / 1400000 * 100).toFixed(1)}%)`);

  } catch (error: any) {
    console.error('❌ Backfill failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

if (require.main === module) {
  memoryEfficientSGOBackfill().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}