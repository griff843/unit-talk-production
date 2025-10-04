#!/usr/bin/env tsx
import axios from 'axios';

async function testAPI() {
  const apiKey = process.env.ODDS_API_KEY;
  const eventId = 'c4b72eabb3d557e73022ec730d8e3944'; // 49ers vs Rams

  // Request ALL NFL player prop markets
  const allNFLProps = [
    'player_pass_yds', 'player_pass_tds', 'player_pass_attempts', 'player_pass_completions',
    'player_pass_interceptions', 'player_pass_longest_completion', 'player_pass_yds_q1',
    'player_rush_yds', 'player_rush_tds', 'player_rush_attempts', 'player_rush_longest',
    'player_receptions', 'player_reception_longest', 'player_reception_tds', 'player_reception_yds',
    'player_anytime_td', 'player_1st_td', 'player_last_td', 'player_tds_over',
    'player_pass_rush_yds', 'player_pass_rush_reception_tds', 'player_pass_rush_reception_yds',
    'player_rush_reception_tds', 'player_rush_reception_yds',
    'player_field_goals', 'player_kicking_points', 'player_pats',
    'player_assists', 'player_defensive_interceptions', 'player_sacks',
    'player_solo_tackles', 'player_tackles_assists'
  ];

  console.log('\n════════════════════════════════════════════════════════');
  console.log('  TESTING ODDS API - ALL 32 NFL PROP MARKETS');
  console.log('════════════════════════════════════════════════════════\n');
  console.log('Endpoint: /sports/americanfootball_nfl/events/{eventId}/odds');
  console.log(`Markets requested: ${allNFLProps.length} markets\n`);

  const url = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events/${eventId}/odds`;

  try {
    const response = await axios.get(url, {
      params: {
        apiKey,
        regions: 'us',
        markets: allNFLProps.join(','),
        bookmakers: 'draftkings,fanduel,betmgm,caesars',
        oddsFormat: 'american',
        dateFormat: 'iso'
      }
    });

    const game = response.data;
    console.log('✅ API Response received');
    console.log(`Game: ${game.away_team} @ ${game.home_team}`);
    console.log(`Bookmakers returned: ${game.bookmakers?.length || 0}`);

    let totalProps = 0;
    const marketCounts: Record<string, number> = {};

    game.bookmakers?.forEach((book: any) => {
      console.log(`\n${book.key}:`);
      book.markets?.forEach((market: any) => {
        const count = market.outcomes.length;
        marketCounts[market.key] = (marketCounts[market.key] || 0) + count;
        totalProps += count;
        console.log(`  ${market.key}: ${count} outcomes`);
      });
    });

    console.log('\n════════════════════════════════════════════════════════');
    console.log(`TOTAL PROP OUTCOMES: ${totalProps}`);
    console.log('════════════════════════════════════════════════════════\n');

    console.log('Aggregated by market (all bookmakers combined):');
    Object.entries(marketCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([market, count]) => {
        console.log(`  ${market}: ${count} total outcomes`);
      });

    console.log('\n════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testAPI();
