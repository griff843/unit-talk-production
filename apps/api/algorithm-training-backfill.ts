import { fetchAndFlattenSGOProps } from './src/logic/providers/sgoFetcher';
import { supabaseClient } from './src/services/supabaseClient';

const SGO_API_KEY = process.env.SPORTSGAMEODDS_KEY;

// All major sports for algorithm training
const ALGORITHM_SPORTS = [
  { league: 'NFL', start: '2024-09-01T00:00:00Z', end: '2024-12-31T23:59:59Z' },
  { league: 'NBA', start: '2023-10-01T00:00:00Z', end: '2024-06-30T23:59:59Z' },
  { league: 'MLB', start: '2024-03-01T00:00:00Z', end: '2024-11-30T23:59:59Z' },
  { league: 'NHL', start: '2023-10-01T00:00:00Z', end: '2024-06-30T23:59:59Z' },
  { league: 'NCAAF', start: '2024-08-01T00:00:00Z', end: '2024-12-31T23:59:59Z' }
];

async function processComprehensiveSport(sport: any) {
  console.log(`🏈 PROCESSING ${sport.league}: ${sport.start} to ${sport.end}`);

  try {
    // Get finalized data for algorithm training
    const sgoData = await fetchAndFlattenSGOProps({
      apiKey: SGO_API_KEY!,
      leagueID: sport.league,
      startsAfter: sport.start,
      startsBefore: sport.end,
      includeAltLine: true,
      finalized: true
    });

    console.log(`   ✅ Fetched ${sgoData.length} finalized ${sport.league} props`);

    if (sgoData.length === 0) {
      return { props: 0, games: 0 };
    }

    // Process comprehensive games data
    const gamesMap = new Map();
    sgoData.forEach(prop => {
      if (prop.eventID) {
        const gameKey = prop.eventID;
        const existing = gamesMap.get(gameKey) || {};

        gamesMap.set(gameKey, {
          external_id: prop.eventID,
          sport: sport.league,
          home_team: prop.homeTeam || existing.home_team || 'Home',
          away_team: prop.awayTeam || existing.away_team || 'Away',
          game_date: prop.startsAtUTC,
          status: 'completed',

          // Team scores for DVP analysis
          home_score: prop.homeScore || existing.home_score || null,
          away_score: prop.awayScore || existing.away_score || null,

          // Betting lines for algorithm training
          spread: prop.spread || existing.spread || null,
          total: prop.total || existing.total || null,
          moneyline_home: prop.homeML || existing.moneyline_home || null,
          moneyline_away: prop.awayML || existing.moneyline_away || null,

          // Metadata
          source: 'sportsgameodds',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    });

    let gamesInserted = 0;
    const games = Array.from(gamesMap.values());

    if (games.length > 0) {
      console.log(`   🎯 Processing ${games.length} games with comprehensive data`);

      const { data: gameData, error: gameError } = await supabaseClient
        .from('games')
        .insert(games)
        .select('id');

      if (!gameError || gameError.code === '23505') {
        gamesInserted = gameData?.length || 0;
        console.log(`   ✅ Added ${gamesInserted} comprehensive games for ${sport.league}`);
      } else {
        console.error(`   ❌ Games error: ${gameError.message}`);
      }
    }

    // Process props for algorithm training
    const timestamp = Date.now();
    const algorithmProps = sgoData.map((prop: any, index: number) => ({
      sport: sport.league,
      stat_type: prop.statType || 'unknown',
      player_name: prop.playerName || 'Team Prop',
      team: prop.team || prop.homeTeam || prop.awayTeam || null,
      line: parseFloat(prop.line?.toString() || '0'),
      source: 'sgo',
      over_odds: prop.odds ? parseInt(prop.odds.toString()) : null,
      under_odds: prop.odds ? parseInt(prop.odds.toString()) : null,
      external_id: `algo_${sport.league}_${timestamp}_${index}`,
      event_id: prop.eventID,
      start_time: prop.startsAtUTC,

      // Algorithm training data
      outcome: prop.result || prop.outcome || 'settled',
      confidence: 0.9, // High confidence for training data
      is_valid: true,
      provider: 'sportsgameodds',

      // Matchup context for DVP
      opponent: prop.opponent || null,
      matchup: `${prop.homeTeam || 'Home'} vs ${prop.awayTeam || 'Away'}`,

      created_at: new Date().toISOString(),
      processed_at: new Date().toISOString()
    }));

    let propsInserted = 0;
    const batchSize = 100;

    console.log(`   📊 Processing ${algorithmProps.length} props for algorithm training`);

    for (let i = 0; i < algorithmProps.length; i += batchSize) {
      const batch = algorithmProps.slice(i, i + batchSize);

      const { data, error } = await supabaseClient
        .from('raw_props')
        .insert(batch)
        .select('id');

      if (!error || error.code === '23505') {
        propsInserted += data?.length || 0;
      } else if (error.code !== '23505') {
        console.error(`     ❌ Props batch error: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`   ✅ ${sport.league} COMPLETE: ${propsInserted} props, ${gamesInserted} games`);
    return { props: propsInserted, games: gamesInserted };

  } catch (error: any) {
    console.error(`   ❌ ${sport.league} failed:`, error.message);
    return { props: 0, games: 0 };
  }
}

async function runAlgorithmTrainingBackfill() {
  console.log('🚀 ALGORITHM TRAINING BACKFILL - Complete Sports Data');
  console.log('🎯 Target: DVP, Team Analytics, Matchup History');
  console.log('📊 Sports: NFL, NBA, MLB, NHL, NCAAF');
  console.log('='.repeat(60));

  if (!SGO_API_KEY) {
    console.error('❌ SGO API key missing');
    return;
  }

  let totalProps = 0;
  let totalGames = 0;

  for (let i = 0; i < ALGORITHM_SPORTS.length; i++) {
    const sport = ALGORITHM_SPORTS[i];
    console.log(`\n📦 SPORT ${i+1}/${ALGORITHM_SPORTS.length}: ${sport.league}`);

    const result = await processComprehensiveSport(sport);
    totalProps += result.props;
    totalGames += result.games;

    console.log(`\n   📊 Progress: ${i+1}/${ALGORITHM_SPORTS.length} sports completed`);
    console.log(`   💾 Total Algorithm Props: ${totalProps.toLocaleString()}`);
    console.log(`   🏈 Total Games w/ Metadata: ${totalGames.toLocaleString()}`);

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Final algorithm readiness check
  try {
    const { count: finalGames } = await supabaseClient
      .from('games')
      .select('*', { count: 'exact' });

    const { count: settledProps } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact' })
      .not('outcome', 'is', null);

    console.log('\n🎯 ALGORITHM TRAINING BACKFILL COMPLETE!');
    console.log('='.repeat(60));
    console.log(`   💾 New Training Props: ${totalProps.toLocaleString()}`);
    console.log(`   🏈 New Games w/ Metadata: ${totalGames.toLocaleString()}`);
    console.log(`   ✅ Total Games: ${finalGames?.toLocaleString() || '0'}`);
    console.log(`   ✅ Total Settled Props: ${settledProps?.toLocaleString() || '0'}`);

    console.log('\n🧠 ALGORITHM READINESS:');
    if (settledProps && settledProps > 5000) {
      console.log('🟢 READY: Sufficient data for DVP and team analytics');
    } else if (settledProps && settledProps > 1000) {
      console.log('🔶 PARTIAL: Good start, may need more data');
    } else {
      console.log('❌ INSUFFICIENT: Need more settled props');
    }

  } catch (error: any) {
    console.log('❌ Final verification failed:', error.message);
  }
}

runAlgorithmTrainingBackfill().catch(console.error);