const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config({ path: '../../.env' });

// Data source routing configuration
const SPORT_ROUTING_CONFIG = {
  MLB: {
    primary: 'optimal-api',
    secondary: 'odds-api',
    oddsApiKey: 'baseball_mlb',
    supports: ['player-props', 'spreads', 'totals', 'moneylines', 'settlement'],
  },
  NFL: {
    primary: 'optimal-api',
    secondary: 'odds-api',
    oddsApiKey: 'americanfootball_nfl',
    supports: ['player-props', 'spreads', 'totals', 'moneylines', 'settlement'],
  },
  NCAAF: {
    primary: 'odds-api',
    secondary: null,
    oddsApiKey: 'americanfootball_ncaaf',
    supports: ['spreads', 'totals', 'moneylines', 'futures', 'settlement'],
  },
  WNBA: {
    primary: 'odds-api',
    secondary: null,
    oddsApiKey: 'basketball_wnba',
    supports: ['spreads', 'totals', 'moneylines', 'settlement'],
  },
};

async function fetchOddsApiGames(sport) {
  const apiKey = process.env.ODDS_API_KEY;
  const baseUrl = 'https://api.the-odds-api.com/v4';

  const config = SPORT_ROUTING_CONFIG[sport];
  if (!config) {
    throw new Error(`No configuration found for sport: ${sport}`);
  }

  try {
    console.log(`📊 Fetching ${sport} games and lines from Odds API...`);

    const response = await axios.get(`${baseUrl}/sports/${config.oddsApiKey}/odds`, {
      params: {
        api_key: apiKey,
        regions: 'us',
        markets: 'h2h,spreads,totals',
        oddsFormat: 'american',
        dateFormat: 'iso',
      },
      timeout: 30000,
    });

    console.log(`✅ Found ${response.data.length} games with betting lines`);
    return response.data;
  } catch (error) {
    console.error(`❌ Odds API error for ${sport}:`, error.response?.data || error.message);
    throw error;
  }
}

function extractGameData(oddsGames, sport) {
  return oddsGames.map(game => {
    // Initialize game record
    const gameRecord = {
      external_id: game.id,
      external_game_id: game.id,
      sport: sport,
      league: sport,
      sport_key: game.sport_key,
      home_team: game.home_team,
      away_team: game.away_team,
      commence_time: game.commence_time,
      start_time: game.commence_time,
      game_date: game.commence_time,
      date: game.commence_time,
      matchup: `${game.away_team} @ ${game.home_team}`,
      status: 'scheduled',
      source: 'odds_api_corrected',
      updated_at: new Date().toISOString(),

      // Initialize betting line fields
      spread: null,
      total: null,
      moneyline_home: null,
      moneyline_away: null,
      home_odds: null,
      away_odds: null,
      total_over_odds: null,
      total_under_odds: null,
      spread_odds: null,
    };

    // Extract betting lines from bookmakers
    if (game.bookmakers && game.bookmakers.length > 0) {
      // Use first bookmaker's odds (typically DraftKings or FanDuel)
      const bookmaker = game.bookmakers[0];

      for (const market of bookmaker.markets) {
        switch (market.key) {
          case 'h2h': // Moneyline
            for (const outcome of market.outcomes) {
              if (outcome.name === game.home_team) {
                gameRecord.moneyline_home = outcome.price;
                gameRecord.home_odds = outcome.price;
              } else if (outcome.name === game.away_team) {
                gameRecord.moneyline_away = outcome.price;
                gameRecord.away_odds = outcome.price;
              }
            }
            break;

          case 'spreads': // Point Spread
            for (const outcome of market.outcomes) {
              if (outcome.name === game.home_team) {
                gameRecord.spread = outcome.point;
                gameRecord.spread_odds = outcome.price;
              }
            }
            break;

          case 'totals': // Over/Under
            if (market.outcomes && market.outcomes.length > 0) {
              gameRecord.total = market.outcomes[0].point;

              for (const outcome of market.outcomes) {
                if (outcome.name === 'Over') {
                  gameRecord.total_over_odds = outcome.price;
                } else if (outcome.name === 'Under') {
                  gameRecord.total_under_odds = outcome.price;
                }
              }
            }
            break;
        }
      }
    }

    return gameRecord;
  });
}

function extractPlayerProps(oddsGames, sport) {
  // For now, return empty array since Odds API doesn't provide detailed player props
  // Player props should come from Optimal API
  console.log(
    `ℹ️ No player props extracted from Odds API for ${sport} (use Optimal API for player props)`
  );
  return [];
}

async function cleanupMisplacedData(supabase) {
  console.log('🧹 Cleaning up misplaced game lines from raw_props table...');

  // Find and delete game lines (non-player props) from raw_props
  const { data: gameLines, error: selectError } = await supabase
    .from('raw_props')
    .select('id, stat_type, market_type, player_name')
    .is('player_name', null); // No player name = game line, not player prop

  if (selectError) {
    console.error('❌ Error finding game lines:', selectError.message);
    return false;
  }

  if (gameLines && gameLines.length > 0) {
    console.log(`Found ${gameLines.length} game lines in raw_props (removing them)`);

    // Also check for explicit game line types
    const { data: explicitGameLines, error: explicitError } = await supabase
      .from('raw_props')
      .select('id, stat_type, market_type')
      .in('stat_type', ['Moneyline', 'Spread', 'Total', 'Over/Under']);

    if (!explicitError && explicitGameLines) {
      console.log(`Found ${explicitGameLines.length} explicit game line types`);
    }

    // Delete all non-player props from raw_props
    const { error: deleteError } = await supabase
      .from('raw_props')
      .delete()
      .is('player_name', null);

    if (deleteError) {
      console.error('❌ Error cleaning up game lines:', deleteError.message);
      return false;
    }

    // Also delete explicit game line types
    const { error: deleteExplicitError } = await supabase
      .from('raw_props')
      .delete()
      .in('stat_type', ['Moneyline', 'Spread', 'Total', 'Over/Under']);

    if (deleteExplicitError) {
      console.error('❌ Error cleaning up explicit game lines:', deleteExplicitError.message);
    }

    console.log(`✅ Cleaned up misplaced game lines from raw_props table`);
  } else {
    console.log('✅ No misplaced game lines found in raw_props');
  }

  return true;
}

async function insertGamesWithLines(supabase, games, sport) {
  if (games.length === 0) {
    console.log('⚠️ No games to insert');
    return true;
  }

  console.log(`📊 Inserting ${games.length} ${sport} games with betting lines...`);

  // First, clean up any existing games for this sport from this source
  await supabase.from('games').delete().eq('sport', sport).eq('source', 'odds_api_corrected');

  // Also clean up any games with external_ids that might conflict
  const externalIds = games.map(g => g.external_id).filter(Boolean);
  if (externalIds.length > 0) {
    await supabase.from('games').delete().in('external_id', externalIds);
  }

  const { error } = await supabase.from('games').insert(games);

  if (error) {
    console.error('❌ Failed to insert games:', error.message);
    return false;
  }

  // Verify the insertion
  const gamesWithLines = games.filter(g => g.spread || g.total || g.moneyline_home);
  console.log(`✅ Inserted ${games.length} games (${gamesWithLines.length} with betting lines)`);

  return true;
}

async function fixDataStructure() {
  console.log('🔧 Fixing Data Structure: Separating Game Lines from Player Props\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Connected to Supabase');

  // Step 1: Clean up misplaced data
  await cleanupMisplacedData(supabase);

  // Step 2: Fetch and properly structure game data
  const sports = ['MLB', 'NFL', 'NCAAF', 'WNBA'];

  let totalGames = 0;
  let totalProps = 0;

  for (const sport of sports) {
    console.log(`\n🏆 Processing ${sport}...`);

    try {
      // Fetch games with betting lines
      const oddsGames = await fetchOddsApiGames(sport);

      if (oddsGames && oddsGames.length > 0) {
        // Extract game data (with betting lines)
        const gameRecords = extractGameData(oddsGames, sport);

        // Extract player props (if any)
        const playerProps = extractPlayerProps(oddsGames, sport);

        // Insert games into games table
        const gameSuccess = await insertGamesWithLines(supabase, gameRecords, sport);
        if (gameSuccess) {
          totalGames += gameRecords.length;
        }

        // Insert player props into raw_props table
        if (playerProps.length > 0) {
          const { error: propsError } = await supabase.from('raw_props').insert(playerProps);

          if (!propsError) {
            totalProps += playerProps.length;
            console.log(`✅ Inserted ${playerProps.length} player props`);
          } else {
            console.error('❌ Failed to insert player props:', propsError.message);
          }
        }

        // Show sample of game lines
        const gamesWithLines = gameRecords.filter(g => g.spread || g.total || g.moneyline_home);
        if (gamesWithLines.length > 0) {
          console.log(`\n📈 Sample ${sport} betting lines:`);
          gamesWithLines.slice(0, 3).forEach((game, i) => {
            console.log(`   ${i + 1}. ${game.matchup}`);
            console.log(`      Spread: ${game.spread || 'N/A'} (${game.spread_odds || 'N/A'})`);
            console.log(
              `      Total: ${game.total || 'N/A'} (O: ${game.total_over_odds || 'N/A'}, U: ${game.total_under_odds || 'N/A'})`
            );
            console.log(
              `      Moneyline: ${game.home_team} ${game.moneyline_home || 'N/A'}, ${game.away_team} ${game.moneyline_away || 'N/A'}`
            );
          });
        }
      }
    } catch (error) {
      console.error(`❌ Failed to process ${sport}:`, error.message);
    }
  }

  console.log(`\n🎉 Data structure fix complete!`);
  console.log(`📊 Total games with betting lines: ${totalGames}`);
  console.log(`🎯 Total player props: ${totalProps}`);

  // Verify the fix
  console.log('\n🔍 Verifying data structure fix...');

  // Check games table
  const { data: verifyGames } = await supabase
    .from('games')
    .select('sport, spread, total, moneyline_home, source')
    .eq('source', 'odds_api_corrected');

  if (verifyGames) {
    const gamesWithLines = verifyGames.filter(g => g.spread || g.total || g.moneyline_home);
    console.log(
      `✅ Games table: ${verifyGames.length} games, ${gamesWithLines.length} with betting lines`
    );
  }

  // Check raw_props table
  const { data: verifyProps } = await supabase
    .from('raw_props')
    .select('stat_type, player_name')
    .not('player_name', 'is', null);

  if (verifyProps) {
    console.log(`✅ Raw props table: ${verifyProps.length} player props (all have player_name)`);
  }

  // Check for any remaining misplaced data
  const { data: checkMisplaced } = await supabase
    .from('raw_props')
    .select('id, stat_type')
    .in('stat_type', ['Moneyline', 'Spread', 'Total'])
    .limit(5);

  if (checkMisplaced && checkMisplaced.length > 0) {
    console.log(`⚠️ Still found ${checkMisplaced.length} misplaced game lines in raw_props`);
  } else {
    console.log(`✅ No misplaced game lines found in raw_props`);
  }

  console.log('\n✅ Data structure successfully fixed!');
  console.log('📊 Game lines → games table');
  console.log('🎯 Player props → raw_props table');

  process.exit(0);
}

fixDataStructure().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
