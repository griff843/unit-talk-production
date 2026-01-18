/**
 * STRICT NO-FABRICATION MODE
 * Generate comprehensive report for all games on 2025-11-29 (NBA games date)
 * Runs against local Postgres database (unit_talk_dev)
 */

import pg from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DB_URL = 'postgresql://postgres:postgres@host.docker.internal:5432/unit_talk_dev';
const TARGET_DATE = '2025-11-29';

interface Game {
  id: string;
  league: string;
  event_time: Date;
  home_team: string;
  away_team: string;
}

interface LeagueGameCount {
  league: string;
  game_count: string;
}

interface GamePropsCount {
  game_id: string;
  league: string;
  home_team: string;
  away_team: string;
  game_date: Date;
  props_count: string;
}

interface LeaguePropsCount {
  league: string;
  game_date: Date;
  props_count: string;
}

async function generateReport() {
  const client = new pg.Client(DB_URL);

  try {
    await client.connect();
    console.log('✓ Connected to database unit_talk_dev');
    console.log(`Target Date: ${TARGET_DATE}\n`);

    // SQL #1: All games for tomorrow
    console.log('Running SQL #1: All games for tomorrow...');
    const query1 = `
      SELECT
        id,
        league,
        start_time AS event_time,
        home_team,
        away_team
      FROM games
      WHERE DATE(start_time AT TIME ZONE 'UTC') = DATE '${TARGET_DATE}'
      ORDER BY league, start_time;
    `;

    const games = await client.query<Game>(query1);
    console.log(`Found ${games.rows.length} games for ${TARGET_DATE}`);

    // SQL #2: Per-league game counts
    console.log('Running SQL #2: Per-league game counts...');
    const query2 = `
      SELECT
        league,
        COUNT(*) AS game_count
      FROM games
      WHERE DATE(start_time AT TIME ZONE 'UTC') = DATE '${TARGET_DATE}'
      GROUP BY league
      ORDER BY league;
    `;

    const leagueGameCounts = await client.query<LeagueGameCount>(query2);
    console.log(`Found ${leagueGameCounts.rows.length} leagues with games`);

    // SQL #3: Props per game (joined to games)
    console.log('Running SQL #3: Props per game...');
    const query3 = `
      SELECT
        g.id AS game_id,
        g.league,
        g.home_team,
        g.away_team,
        DATE(g.start_time AT TIME ZONE 'UTC') AS game_date,
        COUNT(r.id) AS props_count
      FROM games g
      LEFT JOIN raw_props r
        ON r.game_id = g.id
      WHERE DATE(g.start_time AT TIME ZONE 'UTC') = DATE '${TARGET_DATE}'
      GROUP BY g.id, g.league, g.home_team, g.away_team, DATE(g.start_time AT TIME ZONE 'UTC')
      ORDER BY g.league, game_date, g.start_time;
    `;

    const gamePropsCount = await client.query<GamePropsCount>(query3);
    console.log(`Joined ${gamePropsCount.rows.length} games with props counts`);

    // SQL #4: Per-league props counts for tomorrow
    console.log('Running SQL #4: Per-league props counts...');
    const query4 = `
      SELECT
        league,
        DATE(event_time AT TIME ZONE 'UTC') AS game_date,
        COUNT(*) AS props_count
      FROM raw_props
      WHERE DATE(event_time AT TIME ZONE 'UTC') = DATE '${TARGET_DATE}'
      GROUP BY league, DATE(event_time AT TIME ZONE 'UTC')
      ORDER BY league, game_date;
    `;

    const leaguePropsCount = await client.query<LeaguePropsCount>(query4);
    console.log(`Found ${leaguePropsCount.rows.length} leagues with props`);

    // Generate markdown report
    const markdown = generateMarkdown({
      targetDate: TARGET_DATE,
      games: games.rows,
      leagueGameCounts: leagueGameCounts.rows,
      gamePropsCount: gamePropsCount.rows,
      leaguePropsCount: leaguePropsCount.rows,
      queries: { query1, query2, query3, query4 }
    });

    // Save report
    const outputDir = join(process.cwd(), '../../out/ops/cutover/metrics/phase15/live-validation');
    mkdirSync(outputDir, { recursive: true });

    const reportPath = join(outputDir, 'TOMORROWS_GAMES_ACROSS_ALL_SPORTS.md');
    writeFileSync(reportPath, markdown);

    console.log(`\n✓ Report saved to: ${reportPath}`);
    console.log('\nDB_TOMORROWS_GAMES_REPORT_COMPLETE for 2025-11-29');

  } catch (error) {
    console.error('✗ Report generation failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

function generateMarkdown(data: {
  targetDate: string;
  games: Game[];
  leagueGameCounts: LeagueGameCount[];
  gamePropsCount: GamePropsCount[];
  leaguePropsCount: LeaguePropsCount[];
  queries: {
    query1: string;
    query2: string;
    query3: string;
    query4: string;
  };
}): string {
  const totalGames = data.games.length;

  return `# Tomorrow's Games Across All Sports (2025-11-29)

## Report Metadata

**Target Date**: ${data.targetDate}
**Database**: unit_talk_dev
**Report Generated**: ${new Date().toISOString()}
**Mode**: STRICT NO-FABRICATION (results only from SQL queries)

---

## Summary

### Total Games Tomorrow

**TOTAL_GAMES_TOMORROW = ${totalGames}**

### Games Per League

${data.leagueGameCounts.length === 0
  ? '**No games found for any league on this date.**\n'
  : `| League | Game Count |
|--------|------------|
${data.leagueGameCounts.map(row => `| ${row.league} | ${row.game_count} |`).join('\n')}
`}

### Props Per League

${data.leaguePropsCount.length === 0
  ? '**No props found for any league on this date.**\n'
  : `| League | Game Date | Props Count |
|--------|-----------|-------------|
${data.leaguePropsCount.map(row => `| ${row.league} | ${row.game_date.toISOString().split('T')[0]} | ${row.props_count} |`).join('\n')}
`}

---

## Detailed Game Listings

${totalGames === 0
  ? '**No games found for 2025-11-29.**\n'
  : data.gamePropsCount.map((game, index) => `
### Game ${index + 1}: ${game.league}

- **League**: ${game.league}
- **Matchup**: ${game.away_team} @ ${game.home_team}
- **Game ID**: ${game.game_id}
- **Game Date**: ${game.game_date.toISOString().split('T')[0]}
- **Props Count**: ${game.props_count}
`).join('\n')}

---

## Raw Data

### All Games (SQL #1 Results)

${data.games.length === 0
  ? '**No games found.**\n'
  : `| Game ID | League | Event Time | Home Team | Away Team |
|---------|--------|------------|-----------|-----------|
${data.games.map(g => `| ${g.id} | ${g.league} | ${g.event_time.toISOString()} | ${g.home_team} | ${g.away_team} |`).join('\n')}
`}

---

## SQL Queries Used

### Query #1: All Games for Tomorrow

\`\`\`sql
${data.queries.query1.trim()}
\`\`\`

**Results**: ${data.games.length} rows

### Query #2: Per-League Game Counts

\`\`\`sql
${data.queries.query2.trim()}
\`\`\`

**Results**: ${data.leagueGameCounts.length} rows

### Query #3: Props Per Game

\`\`\`sql
${data.queries.query3.trim()}
\`\`\`

**Results**: ${data.gamePropsCount.length} rows

### Query #4: Per-League Props Counts

\`\`\`sql
${data.queries.query4.trim()}
\`\`\`

**Results**: ${data.leaguePropsCount.length} rows

---

## Explicit Findings

${generateExplicitFindings(data)}

---

**Report Completion Status**: ✅ COMPLETE
**Fabrication Level**: ZERO (all data from direct SQL queries)
**Date Stability**: Fixed to DATE '2025-11-29' for consistency
`;
}

function generateExplicitFindings(data: {
  games: Game[];
  leagueGameCounts: LeagueGameCount[];
  leaguePropsCount: LeaguePropsCount[];
}): string {
  const findings: string[] = [];

  // Total games finding
  if (data.games.length === 0) {
    findings.push('- **ZERO games** found in the database for 2025-11-29');
  } else {
    findings.push(`- **${data.games.length} total games** found for 2025-11-29`);
  }

  // Per-league findings
  if (data.leagueGameCounts.length === 0) {
    findings.push('- **No leagues** have games on this date');
  } else {
    findings.push('- **Leagues with games**:');
    data.leagueGameCounts.forEach(league => {
      findings.push(`  - ${league.league}: ${league.game_count} game(s)`);
    });
  }

  // Props findings
  if (data.leaguePropsCount.length === 0) {
    findings.push('- **ZERO props** found for 2025-11-29');
  } else {
    findings.push('- **Leagues with props**:');
    data.leaguePropsCount.forEach(league => {
      findings.push(`  - ${league.league}: ${league.props_count} prop(s) on ${league.game_date.toISOString().split('T')[0]}`);
    });
  }

  // Missing data warning
  const leaguesWithGames = new Set(data.leagueGameCounts.map(l => l.league));
  const leaguesWithProps = new Set(data.leaguePropsCount.map(l => l.league));

  leaguesWithGames.forEach(league => {
    if (!leaguesWithProps.has(league)) {
      findings.push(`- ⚠️ **${league}** has games but ZERO props`);
    }
  });

  return findings.join('\n');
}

// Run report generation
generateReport()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
