#!/usr/bin/env tsx
import axios from 'axios';

async function testAPI() {
  const apiKey = process.env.ODDS_API_KEY;
  const eventId = 'c4b72eabb3d557e73022ec730d8e3944'; // 49ers vs Rams

  // ALL NFL player prop markets including ALTERNATES
  const allNFLPropsWithAlternates = [
    // Standard markets (32)
    'player_pass_yds', 'player_pass_tds', 'player_pass_attempts', 'player_pass_completions',
    'player_pass_interceptions', 'player_pass_longest_completion', 'player_pass_yds_q1',
    'player_rush_yds', 'player_rush_tds', 'player_rush_attempts', 'player_rush_longest',
    'player_receptions', 'player_reception_longest', 'player_reception_tds', 'player_reception_yds',
    'player_anytime_td', 'player_1st_td', 'player_last_td', 'player_tds_over',
    'player_pass_rush_yds', 'player_pass_rush_reception_tds', 'player_pass_rush_reception_yds',
    'player_rush_reception_tds', 'player_rush_reception_yds',
    'player_field_goals', 'player_kicking_points', 'player_pats',
    'player_assists', 'player_defensive_interceptions', 'player_sacks',
    'player_solo_tackles', 'player_tackles_assists',

    // Alternate markets (add _alternate suffix)
    'player_pass_yds_alternate', 'player_pass_tds_alternate', 'player_pass_attempts_alternate',
    'player_pass_completions_alternate', 'player_pass_interceptions_alternate',
    'player_pass_longest_completion_alternate', 'player_pass_rush_yds_alternate',
    'player_rush_yds_alternate', 'player_rush_tds_alternate', 'player_rush_attempts_alternate',
    'player_rush_longest_alternate', 'player_receptions_alternate',
    'player_reception_longest_alternate', 'player_reception_tds_alternate',
    'player_reception_yds_alternate', 'player_pass_rush_reception_tds_alternate',
    'player_pass_rush_reception_yds_alternate', 'player_rush_reception_tds_alternate',
    'player_rush_reception_yds_alternate', 'player_field_goals_alternate',
    'player_kicking_points_alternate', 'player_pats_alternate', 'player_assists_alternate',
    'player_defensive_interceptions_alternate', 'player_sacks_alternate',
    'player_solo_tackles_alternate', 'player_tackles_assists_alternate'
  ];

  console.log('\n════════════════════════════════════════════════════════');
  console.log('  TESTING ODDS API - ALL NFL PROPS + ALTERNATES');
  console.log('════════════════════════════════════════════════════════\n');
  console.log(`Markets requested: ${allNFLPropsWithAlternates.length} markets`);
  console.log('(32 standard + 26 alternates)\n');

  const url = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events/${eventId}/odds`;

  try {
    const response = await axios.get(url, {
      params: {
        apiKey,
        regions: 'us',
        markets: allNFLPropsWithAlternates.join(','),
        bookmakers: 'draftkings,fanduel,betmgm,caesars',
        oddsFormat: 'american',
        dateFormat: 'iso'
      }
    });

    const game = response.data;
    console.log('✅ API Response received');
    console.log(`Game: ${game.away_team} @ ${game.home_team}`);
    console.log(`Bookmakers returned: ${game.bookmakers?.length || 0}\n`);

    let totalProps = 0;
    const marketCounts: Record<string, number> = {};

    game.bookmakers?.forEach((book: any) => {
      book.markets?.forEach((market: any) => {
        const count = market.outcomes.length;
        marketCounts[market.key] = (marketCounts[market.key] || 0) + count;
        totalProps += count;
      });
    });

    console.log('════════════════════════════════════════════════════════');
    console.log(`TOTAL PROP OUTCOMES: ${totalProps}`);
    console.log('════════════════════════════════════════════════════════\n');

    console.log('Markets returned (sorted by count):');
    Object.entries(marketCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([market, count]) => {
        const isAlternate = market.includes('_alternate');
        const prefix = isAlternate ? '  [ALT]' : '  [STD]';
        console.log(`${prefix} ${market}: ${count}`);
      });

    const standardCount = Object.entries(marketCounts).filter(([k]) => !k.includes('_alternate')).reduce((sum, [, v]) => sum + v, 0);
    const alternateCount = Object.entries(marketCounts).filter(([k]) => k.includes('_alternate')).reduce((sum, [, v]) => sum + v, 0);

    console.log(`\n════════════════════════════════════════════════════════`);
    console.log(`Standard markets: ${standardCount} props`);
    console.log(`Alternate markets: ${alternateCount} props`);
    console.log(`TOTAL: ${totalProps} props`);
    console.log(`════════════════════════════════════════════════════════\n`);

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testAPI();
