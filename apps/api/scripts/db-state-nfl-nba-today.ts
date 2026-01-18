/**
 * Section 2: Database State Query for Today's NFL + NBA
 * Queries the local database to check what games and props exist for today
 */

import pg from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DB_URL = 'postgresql://postgres:postgres@host.docker.internal:5432/unit_talk_dev';

interface DbQueryResult {
  timestamp: string;
  target_date: string;
  games: {
    nfl: any[];
    nba: any[];
  };
  props: {
    nfl: any[];
    nba: any[];
  };
  summary: {
    nfl_game_count_today: number;
    nba_game_count_today: number;
    nfl_prop_count_today: number;
    nba_prop_count_today: number;
  };
}

async function queryDatabase() {
  const client = new pg.Client(DB_URL);

  try {
    await client.connect();
    console.log('✓ Connected to database');

    const targetDate = '2025-11-28'; // Today's date from Section 0

    console.log('\n========================================');
    console.log('SECTION 2: DATABASE STATE QUERY');
    console.log('========================================');
    console.log(`Target Date: ${targetDate}`);

    // Query 1: Games summary by league and date
    console.log('\n=== Query 1: Games Summary by League and Date ===');
    const gamesSummaryQuery = `
      SELECT
        league,
        DATE(start_time) AS game_date,
        COUNT(*)         AS game_count
      FROM games
      WHERE league IN ('NFL', 'NBA')
      GROUP BY league, DATE(start_time)
      ORDER BY league, game_date;
    `;
    const gamesSummaryResult = await client.query(gamesSummaryQuery);
    console.log('Games Summary:', gamesSummaryResult.rows);

    // Query 2: NFL games for today
    console.log('\n=== Query 2: NFL Games for Today ===');
    const nflGamesQuery = `
      SELECT
        id,
        league,
        start_time,
        home_team,
        away_team
      FROM games
      WHERE league = 'NFL'
        AND DATE(start_time) = $1
      ORDER BY start_time;
    `;
    const nflGamesResult = await client.query(nflGamesQuery, [targetDate]);
    console.log(`Found ${nflGamesResult.rows.length} NFL games for ${targetDate}:`);
    nflGamesResult.rows.forEach(row => {
      console.log(`  - ${row.away_team} @ ${row.home_team} at ${row.start_time}`);
    });

    // Query 3: NBA games for today
    console.log('\n=== Query 3: NBA Games for Today ===');
    const nbaGamesQuery = `
      SELECT
        id,
        league,
        start_time,
        home_team,
        away_team
      FROM games
      WHERE league = 'NBA'
        AND DATE(start_time) = $1
      ORDER BY start_time;
    `;
    const nbaGamesResult = await client.query(nbaGamesQuery, [targetDate]);
    console.log(`Found ${nbaGamesResult.rows.length} NBA games for ${targetDate}:`);
    nbaGamesResult.rows.forEach(row => {
      console.log(`  - ${row.away_team} @ ${row.home_team} at ${row.start_time}`);
    });

    // Query 4: Props summary by league and date
    console.log('\n=== Query 4: Props Summary by League and Date ===');
    const propsSummaryQuery = `
      SELECT
        league,
        DATE(event_time) AS game_date,
        COUNT(*)         AS props_count
      FROM raw_props
      WHERE league IN ('NFL', 'NBA')
      GROUP BY league, DATE(event_time)
      ORDER BY league, game_date;
    `;
    const propsSummaryResult = await client.query(propsSummaryQuery);
    console.log('Props Summary:', propsSummaryResult.rows);

    // Query 5: NFL props for today
    console.log('\n=== Query 5: NFL Props for Today ===');
    const nflPropsQuery = `
      SELECT COUNT(*) AS prop_count
      FROM raw_props
      WHERE league = 'NFL'
        AND DATE(event_time) = $1;
    `;
    const nflPropsResult = await client.query(nflPropsQuery, [targetDate]);
    console.log(`Found ${nflPropsResult.rows[0].prop_count} NFL props for ${targetDate}`);

    // Query 6: NBA props for today
    console.log('\n=== Query 6: NBA Props for Today ===');
    const nbaPropsQuery = `
      SELECT COUNT(*) AS prop_count
      FROM raw_props
      WHERE league = 'NBA'
        AND DATE(event_time) = $1;
    `;
    const nbaPropsResult = await client.query(nbaPropsQuery, [targetDate]);
    console.log(`Found ${nbaPropsResult.rows[0].prop_count} NBA props for ${targetDate}`);

    // Build result object
    const result: DbQueryResult = {
      timestamp: new Date().toISOString(),
      target_date: targetDate,
      games: {
        nfl: nflGamesResult.rows,
        nba: nbaGamesResult.rows
      },
      props: {
        nfl: nflPropsResult.rows,
        nba: nbaPropsResult.rows
      },
      summary: {
        nfl_game_count_today: nflGamesResult.rows.length,
        nba_game_count_today: nbaGamesResult.rows.length,
        nfl_prop_count_today: parseInt(nflPropsResult.rows[0].prop_count),
        nba_prop_count_today: parseInt(nbaPropsResult.rows[0].prop_count)
      }
    };

    // Generate markdown report
    const markdown = generateMarkdownReport(result, gamesSummaryResult.rows, propsSummaryResult.rows);

    // Save outputs
    const outputDir = join(process.cwd(), '../../out/ops/cutover/metrics/phase15/live-validation');
    mkdirSync(outputDir, { recursive: true });

    const mdPath = join(outputDir, 'NFL_NBA_DB_STATE_TODAY.md');
    writeFileSync(mdPath, markdown);
    console.log(`\n✓ Saved markdown report to: ${mdPath}`);

    // Print summary
    console.log('\n========================================');
    console.log('DATABASE STATE SUMMARY');
    console.log('========================================');
    console.log(`NFL_DB_GAME_COUNT_TODAY = ${result.summary.nfl_game_count_today}`);
    console.log(`NBA_DB_GAME_COUNT_TODAY = ${result.summary.nba_game_count_today}`);
    console.log(`NFL_DB_PROP_COUNT_TODAY = ${result.summary.nfl_prop_count_today}`);
    console.log(`NBA_DB_PROP_COUNT_TODAY = ${result.summary.nba_prop_count_today}`);
    console.log('========================================');

    return result;

  } catch (error) {
    console.error('✗ Database query failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

function generateMarkdownReport(
  result: DbQueryResult,
  gamesSummary: any[],
  propsSummary: any[]
): string {
  return `# Section 2: Database State for Today's NFL + NBA

## Query Timestamp
${result.timestamp}

## Target Date
${result.target_date}

## Games Summary (All Dates)

| League | Game Date | Count |
|--------|-----------|-------|
${gamesSummary.map(r => `| ${r.league} | ${r.game_date.toISOString().split('T')[0]} | ${r.game_count} |`).join('\n')}

## Props Summary (All Dates)

| League | Game Date | Count |
|--------|-----------|-------|
${propsSummary.map(r => `| ${r.league} | ${r.game_date.toISOString().split('T')[0]} | ${r.props_count} |`).join('\n')}

## NFL Games for ${result.target_date}

**Count**: ${result.summary.nfl_game_count_today}

${result.games.nfl.map((g, i) => `
### Game ${i + 1}
- **ID**: ${g.id}
- **Matchup**: ${g.away_team} @ ${g.home_team}
- **Event Time**: ${g.event_time}
`).join('\n')}

## NBA Games for ${result.target_date}

**Count**: ${result.summary.nba_game_count_today}

${result.games.nba.map((g, i) => `
### Game ${i + 1}
- **ID**: ${g.id}
- **Matchup**: ${g.away_team} @ ${g.home_team}
- **Event Time**: ${g.event_time}
`).join('\n')}

## Database State Summary

\`\`\`
NFL_DB_GAME_COUNT_TODAY = ${result.summary.nfl_game_count_today}
NBA_DB_GAME_COUNT_TODAY = ${result.summary.nba_game_count_today}
NFL_DB_PROP_COUNT_TODAY = ${result.summary.nfl_prop_count_today}
NBA_DB_PROP_COUNT_TODAY = ${result.summary.nba_prop_count_today}
\`\`\`

## Raw SQL Queries Used

### Games Summary
\`\`\`sql
SELECT
  league,
  DATE(event_time) AS game_date,
  COUNT(*) AS game_count
FROM games
WHERE league IN ('NFL', 'NBA')
GROUP BY league, DATE(event_time)
ORDER BY league, game_date;
\`\`\`

### NFL Games Today
\`\`\`sql
SELECT id, league, start_time, home_team, away_team
FROM games
WHERE league = 'NFL' AND DATE(start_time) = '${result.target_date}'
ORDER BY start_time;
\`\`\`

### NBA Games Today
\`\`\`sql
SELECT id, league, start_time, home_team, away_team
FROM games
WHERE league = 'NBA' AND DATE(start_time) = '${result.target_date}'
ORDER BY start_time;
\`\`\`

### Props Summary
\`\`\`sql
SELECT
  league,
  DATE(event_time) AS game_date,
  COUNT(*) AS props_count
FROM raw_props
WHERE league IN ('NFL', 'NBA')
GROUP BY league, DATE(event_time)
ORDER BY league, game_date;
\`\`\`
`;
}

// Run queries
queryDatabase()
  .then(() => {
    console.log('\n✓ Section 2 complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Section 2 failed:', error);
    process.exit(1);
  });
