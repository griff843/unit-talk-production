/**
 * NFL API Events Inspector
 *
 * Calls the REAL Odds API directly to see exactly what NFL events are available for today.
 * This is used to diagnose why we only have 1 NFL game in the DB when there should be more.
 */

import { OddsApiClient } from '../../src/agents/FeedAgent/oddsApi';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('=== NFL API EVENTS INSPECTOR ===');
  console.log('Date: 2025-11-27 (Thanksgiving)');
  console.log('Target: americanfootball_nfl\n');

  try {
    const oddsApiClient = new OddsApiClient();

    console.log('Calling Odds API for NFL odds...\n');

    // Call the actual API endpoint with the same parameters our ingestion uses
    const games = await oddsApiClient.fetchOdds(
      'americanfootball_nfl',
      ['h2h', 'spreads', 'totals'],  // Same markets as ingestion
      ['us'],                         // Same region as ingestion
      'american'                      // Same odds format as ingestion
    );

    console.log(`✅ API returned ${games.length} NFL games/events\n`);

    // Filter to today only
    const today = new Date().toISOString().split('T')[0]; // 2025-11-27
    const todayGames = games.filter(game => {
      const gameDate = game.commence_time.split('T')[0];
      return gameDate === today;
    });

    console.log(`Filtered to today (${today}): ${todayGames.length} games\n`);

    // Log details of each game
    console.log('=== NFL EVENTS FOR TODAY ===\n');
    todayGames.forEach((game, idx) => {
      console.log(`Game ${idx + 1}:`);
      console.log(`  ID: ${game.id}`);
      console.log(`  Commence Time: ${game.commence_time}`);
      console.log(`  Home Team: ${game.home_team}`);
      console.log(`  Away Team: ${game.away_team}`);
      console.log(`  Sport Key: ${game.sport_key}`);
      console.log(`  Bookmakers: ${game.bookmakers.length}`);
      console.log('');
    });

    // Prepare output
    const output = {
      timestamp: new Date().toISOString(),
      target_date: today,
      api_endpoint: '/v4/sports/americanfootball_nfl/odds',
      parameters: {
        regions: 'us',
        markets: 'h2h,spreads,totals',
        oddsFormat: 'american'
      },
      total_nfl_events: games.length,
      nfl_events_today: todayGames.length,
      events: todayGames.map(game => ({
        id: game.id,
        commence_time: game.commence_time,
        home_team: game.home_team,
        away_team: game.away_team,
        sport_key: game.sport_key,
        sport_title: game.sport_title,
        bookmaker_count: game.bookmakers.length
      }))
    };

    // Save JSON
    const outputDir = path.join(process.cwd(), 'out', 'ops', 'cutover', 'metrics', 'phase15', 'production-validation');
    fs.mkdirSync(outputDir, { recursive: true });

    const jsonPath = path.join(outputDir, 'NFL_API_EVENTS_2025-11-27.json');
    fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));
    console.log(`✅ Saved JSON to: ${jsonPath}\n`);

    // Save Markdown
    let markdown = '# NFL API Events - 2025-11-27 (Thanksgiving)\n\n';
    markdown += '**Generated**: ' + new Date().toISOString() + '\n\n';
    markdown += '## API Request\n\n';
    markdown += '- **Endpoint**: `/v4/sports/americanfootball_nfl/odds`\n';
    markdown += '- **Regions**: `us`\n';
    markdown += '- **Markets**: `h2h, spreads, totals`\n';
    markdown += '- **Odds Format**: `american`\n\n';
    markdown += '## Results\n\n';
    markdown += `- **Total NFL Events (all dates)**: ${games.length}\n`;
    markdown += `- **NFL Events for Today (${today})**: ${todayGames.length}\n\n`;

    if (todayGames.length > 0) {
      markdown += '## Events Detail\n\n';
      markdown += '| # | ID | Commence Time (UTC) | Away Team | Home Team | Bookmakers |\n';
      markdown += '|---|----|--------------------|-----------|-----------|------------|\n';

      todayGames.forEach((game, idx) => {
        markdown += `| ${idx + 1} | ${game.id} | ${game.commence_time} | ${game.away_team} | ${game.home_team} | ${game.bookmakers.length} |\n`;
      });

      markdown += '\n## Full Event Objects\n\n';
      markdown += '```json\n';
      markdown += JSON.stringify(output.events, null, 2);
      markdown += '\n```\n';
    } else {
      markdown += '⚠️ **No NFL events found for today from the API.**\n\n';
      markdown += 'This could mean:\n';
      markdown += '- The API does not have odds available yet for today\'s games\n';
      markdown += '- The time filter or region filter is excluding today\'s games\n';
      markdown += '- Today has no NFL games scheduled\n';
    }

    markdown += '\n## Conclusion\n\n';
    markdown += `**NFL_API_EVENT_COUNT_TODAY = ${todayGames.length}**\n`;

    const mdPath = path.join(outputDir, 'NFL_API_EVENTS_2025-11-27.md');
    fs.writeFileSync(mdPath, markdown);
    console.log(`✅ Saved Markdown to: ${mdPath}\n`);

    // Console summary
    console.log('=== SUMMARY ===');
    console.log(`NFL_API_EVENT_COUNT_TODAY = ${todayGames.length}`);
    console.log('\nEvents:');
    todayGames.forEach((game, idx) => {
      console.log(`  ${idx + 1}. ${game.away_team} @ ${game.home_team} (${game.commence_time})`);
    });

    process.exit(0);

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
