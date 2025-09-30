import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env['SUPABASE_URL'] || '',
  process.env['SUPABASE_ANON_KEY'] || ''
);

export interface SGOEvent {
  id: string;
  sport: string;
  date: string;
  teams: {
    home: { name: string; id?: string };
    away: { name: string; id?: string };
  };
  startTime: string;
  status: string;
  odds?: any[];
  props?: any[];
}

/**
 * Fetch SGO events for a specific sport and date using validated v1 endpoint
 *
 * Uses ONLY the validated endpoint format:
 * GET https://api.sportsgameodds.com/v1/{sport}/events
 *     ?startDate=YYYY-MM-DD
 *     &endDate=YYYY-MM-DD
 *     &includeOdds=true
 *     &includeProps=true
 *     &apiKey=SPORTSGAMEODDS_KEY
 */
export async function fetchSGOEventsForDay({
  sport,
  date,
  apiKey
}: {
  sport: string;
  date: string;
  apiKey: string;
}): Promise<SGOEvent[]> {
  if (!apiKey) {
    throw new Error('SPORTSGAMEODDS_KEY environment variable not set');
  }

  try {
    // Use the ONLY validated SGO v1 endpoint format
    const url = `https://api.sportsgameodds.com/v1/${sport}/events`;

    const params = {
      startDate: date,
      endDate: date, // Same day for daily processing
      includeOdds: 'true',
      includeProps: 'true',
      apiKey
    };

    console.log(`📡 Fetching SGO data: ${url}`, { sport, date, params });

    const response = await axios.get(url, {
      params,
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'UnitTalk-Backfill/1.0'
      }
    });

    if (!response.data) {
      throw new Error(`No data returned from SGO API for ${sport} ${date}`);
    }

    // Handle different SGO response formats
    let events = [];
    if (Array.isArray(response.data)) {
      events = response.data;
    } else if (response.data.events && Array.isArray(response.data.events)) {
      events = response.data.events;
    } else if (response.data.data && Array.isArray(response.data.data)) {
      events = response.data.data;
    } else {
      console.warn(`⚠️  Unexpected SGO response format for ${sport} ${date}`, {
        responseKeys: Object.keys(response.data)
      });
      return [];
    }

    console.log(`✅ SGO API returned ${events.length} events for ${sport} ${date}`);

    // Transform to our standard format
    const transformedEvents: SGOEvent[] = events.map((event: any) => ({
      id: event.id || event.eventId || event.gameId || uuidv4(),
      sport: sport.toUpperCase(),
      date,
      teams: {
        home: {
          name: event.homeTeam?.name || event.teams?.home?.name || event.home_team || 'Unknown Home',
          id: event.homeTeam?.id || event.teams?.home?.id || event.home_team_id
        },
        away: {
          name: event.awayTeam?.name || event.teams?.away?.name || event.away_team || 'Unknown Away',
          id: event.awayTeam?.id || event.teams?.away?.id || event.away_team_id
        }
      },
      startTime: event.startTime || event.gameTime || event.start_time || new Date().toISOString(),
      status: event.status || 'scheduled',
      odds: event.odds || [],
      props: event.props || event.playerProps || []
    }));

    return transformedEvents;

  } catch (error: any) {
    console.error(`❌ Error fetching SGO data for ${sport} ${date}:`, {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    // Don't throw on API errors - return empty array to continue processing
    if (error.response?.status === 404 || error.response?.status === 400) {
      console.warn(`⚠️  No data available for ${sport} ${date} (${error.response.status})`);
      return [];
    }

    throw error;
  }
}

/**
 * Check if data already exists for idempotent processing
 */
export async function checkExistingData({
  sport,
  date
}: {
  sport: string;
  date: string;
}): Promise<{ gamesExist: boolean; propsExist: boolean }> {
  try {
    // Check games table
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('id')
      .eq('sport', sport.toUpperCase())
      .eq('game_date', date)
      .eq('backfill', true)
      .limit(1);

    if (gamesError) {
      console.error('Error checking existing games:', gamesError);
      return { gamesExist: false, propsExist: false };
    }

    // Check raw_props table
    const { data: propsData, error: propsError } = await supabase
      .from('raw_props')
      .select('id')
      .eq('sport', sport.toUpperCase())
      .eq('game_date', date)
      .eq('source', 'sgo')
      .eq('backfill', true)
      .limit(1);

    if (propsError) {
      console.error('Error checking existing props:', propsError);
      return { gamesExist: false, propsExist: false };
    }

    return {
      gamesExist: (gamesData?.length || 0) > 0,
      propsExist: (propsData?.length || 0) > 0
    };

  } catch (error: any) {
    console.error('Error in checkExistingData:', error.message);
    return { gamesExist: false, propsExist: false };
  }
}

/**
 * Insert games from SGO events into games table
 */
export async function insertGamesFromEvents({
  events,
  sport,
  date
}: {
  events: SGOEvent[];
  sport: string;
  date: string;
}): Promise<number> {
  if (!events || events.length === 0) {
    return 0;
  }

  try {
    const gameRecords = events.map(event => ({
      id: uuidv4(),
      external_game_id: event.id,
      sport: sport.toUpperCase(),
      game_date: date,
      game_time: event.startTime,
      home_team: event.teams.home.name,
      away_team: event.teams.away.name,
      matchup: `${event.teams.away.name} @ ${event.teams.home.name}`,
      status: event.status,
      backfill: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    console.log(`📮 Inserting ${gameRecords.length} games for ${sport} ${date}`);

    const { error } = await supabase
      .from('games')
      .upsert(gameRecords, {
        onConflict: 'external_game_id,sport,game_date',
        ignoreDuplicates: true
      });

    if (error) {
      console.error(`❌ Error inserting games for ${sport} ${date}:`, error);
      throw new Error(`Failed to insert games: ${error.message}`);
    }

    console.log(`✅ Successfully inserted ${gameRecords.length} games for ${sport} ${date}`);
    return gameRecords.length;

  } catch (error: any) {
    console.error(`❌ Error in insertGamesFromEvents for ${sport} ${date}:`, error.message);
    throw error;
  }
}

/**
 * Insert props from SGO events into raw_props table
 */
export async function insertPropsFromEvents({
  events,
  sport,
  date
}: {
  events: SGOEvent[];
  sport: string;
  date: string;
}): Promise<number> {
  if (!events || events.length === 0) {
    return 0;
  }

  try {
    const propRecords: any[] = [];

    // Extract props from each event
    for (const event of events) {
      const eventProps = event.props || [];
      const eventOdds = event.odds || [];

      // Process props
      for (const prop of eventProps) {
        propRecords.push({
          id: uuidv4(),
          external_game_id: event.id,
          sport: sport.toUpperCase(),
          game_date: date,
          prop_type: prop.type || prop.market || 'unknown',
          player_name: prop.player || prop.playerName || 'Team',
          name: prop.name || prop.description || '',
          line: parseFloat(prop.line || prop.value || '0'),
          over_odds: prop.overOdds ? parseInt(prop.overOdds) : null,
          under_odds: prop.underOdds ? parseInt(prop.underOdds) : null,
          league: sport.toUpperCase(),
          source: 'sgo',
          backfill: true,
          inserted_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      // Process odds as props if no dedicated props
      if (eventProps.length === 0 && eventOdds.length > 0) {
        for (const odds of eventOdds) {
          propRecords.push({
            id: uuidv4(),
            external_game_id: event.id,
            sport: sport.toUpperCase(),
            game_date: date,
            prop_type: odds.type || odds.market || 'spread',
            player_name: 'Team',
            name: odds.name || odds.description || '',
            line: parseFloat(odds.line || odds.spread || '0'),
            over_odds: odds.homeOdds ? parseInt(odds.homeOdds) : null,
            under_odds: odds.awayOdds ? parseInt(odds.awayOdds) : null,
            league: sport.toUpperCase(),
            source: 'sgo',
            backfill: true,
            inserted_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }
    }

    if (propRecords.length === 0) {
      console.log(`📋 No props to insert for ${sport} ${date}`);
      return 0;
    }

    console.log(`📦 Inserting ${propRecords.length} props for ${sport} ${date}`);

    // Insert in batches of 500 to avoid Supabase limits
    const batchSize = 500;
    let totalInserted = 0;

    for (let i = 0; i < propRecords.length; i += batchSize) {
      const batch = propRecords.slice(i, i + batchSize);

      const { error } = await supabase
        .from('raw_props')
        .upsert(batch, {
          onConflict: 'external_game_id,prop_type,player_name,source',
          ignoreDuplicates: true
        });

      if (error) {
        console.error(`❌ Error inserting props batch for ${sport} ${date}:`, error);
        throw new Error(`Failed to insert props: ${error.message}`);
      }

      totalInserted += batch.length;
      console.log(`   📊 Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} props inserted`);
    }

    console.log(`✅ Successfully inserted ${totalInserted} props for ${sport} ${date}`);
    return totalInserted;

  } catch (error: any) {
    console.error(`❌ Error in insertPropsFromEvents for ${sport} ${date}:`, error.message);
    throw error;
  }
}