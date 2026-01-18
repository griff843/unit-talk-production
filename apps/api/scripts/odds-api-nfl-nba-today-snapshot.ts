/**
 * Section 1: Odds API Ground Truth Snapshot
 * Fetches today's NFL and NBA events directly from the Odds API
 * to establish baseline expectations for database validation
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fetchOdds, OddsApiClient } from '../src/agents/FeedAgent/oddsApi';

interface EventSummary {
  sport_key: string;
  event_id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmaker_count: number;
  markets: string[];
  total_outcomes: number;
  prop_outcomes: number;
}

interface SportSnapshot {
  sport: string;
  sport_key: string;
  fetch_timestamp: string;
  event_count: number;
  total_props: number;
  events: EventSummary[];
}

interface ValidationSnapshot {
  timestamp: string;
  date: string;
  nfl: SportSnapshot;
  nba: SportSnapshot;
  summary: {
    nfl_event_count: number;
    nba_event_count: number;
    nfl_total_props: number;
    nba_total_props: number;
  };
}

async function fetchSportSnapshot(
  sportKey: 'americanfootball_nfl' | 'basketball_nba',
  sportName: string
): Promise<SportSnapshot> {
  console.log(`\n=== Fetching ${sportName} from Odds API ===`);

  try {
    // Fetch odds with ALL markets including player props
    const games = await fetchOdds(
      sportKey,
      ['h2h', 'spreads', 'totals'],  // Standard markets
      ['us'],                         // US region
      'american'                      // American odds format
    );

    console.log(`✓ Fetched ${games.length} ${sportName} events`);

    const events: EventSummary[] = [];
    let totalOutcomes = 0;
    let totalPropOutcomes = 0;

    for (const game of games) {
      const markets = new Set<string>();
      let eventOutcomes = 0;
      let eventPropOutcomes = 0;

      for (const bookmaker of game.bookmakers) {
        for (const market of bookmaker.markets) {
          markets.add(market.key);
          eventOutcomes += market.outcomes.length;

          // Count player props (not team-based markets)
          if (market.key !== 'h2h' && market.key !== 'spreads' && market.key !== 'totals') {
            eventPropOutcomes += market.outcomes.length;
          }
        }
      }

      totalOutcomes += eventOutcomes;
      totalPropOutcomes += eventPropOutcomes;

      events.push({
        sport_key: game.sport_key,
        event_id: game.id,
        commence_time: game.commence_time,
        home_team: game.home_team,
        away_team: game.away_team,
        bookmaker_count: game.bookmakers.length,
        markets: Array.from(markets),
        total_outcomes: eventOutcomes,
        prop_outcomes: eventPropOutcomes
      });

      console.log(`  - ${game.away_team} @ ${game.home_team}`);
      console.log(`    Commence: ${game.commence_time}`);
      console.log(`    Bookmakers: ${game.bookmakers.length}, Markets: ${markets.size}, Outcomes: ${eventOutcomes}`);
    }

    return {
      sport: sportName,
      sport_key: sportKey,
      fetch_timestamp: new Date().toISOString(),
      event_count: games.length,
      total_props: totalOutcomes,
      events
    };

  } catch (error) {
    console.error(`✗ Failed to fetch ${sportName}:`, error);
    throw error;
  }
}

async function runValidation() {
  console.log('========================================');
  console.log('SECTION 1: ODDS API GROUND TRUTH SNAPSHOT');
  console.log('========================================');
  console.log(`Validation Date: ${new Date().toISOString()}`);
  console.log(`Target Date: ${new Date().toISOString().split('T')[0]}`);

  try {
    // Fetch NFL and NBA snapshots
    const nfl = await fetchSportSnapshot('americanfootball_nfl', 'NFL');
    const nba = await fetchSportSnapshot('basketball_nba', 'NBA');

    // Build validation snapshot
    const snapshot: ValidationSnapshot = {
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      nfl,
      nba,
      summary: {
        nfl_event_count: nfl.event_count,
        nba_event_count: nba.event_count,
        nfl_total_props: nfl.total_props,
        nba_total_props: nba.total_props
      }
    };

    // Create output directory if it doesn't exist
    const outputDir = join(process.cwd(), '../../out/ops/cutover/metrics/phase15/live-validation');
    mkdirSync(outputDir, { recursive: true });

    // Save JSON snapshot
    const jsonPath = join(outputDir, 'NFL_NBA_API_EVENTS_TODAY.json');
    writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2));
    console.log(`\n✓ Saved JSON snapshot to: ${jsonPath}`);

    // Generate markdown summary
    const markdown = generateMarkdownSummary(snapshot);
    const mdPath = join(outputDir, 'NFL_NBA_API_EVENTS_TODAY.md');
    writeFileSync(mdPath, markdown);
    console.log(`✓ Saved markdown summary to: ${mdPath}`);

    // Print summary
    console.log('\n========================================');
    console.log('ODDS API GROUND TRUTH SUMMARY');
    console.log('========================================');
    console.log(`NFL_API_EVENT_COUNT_TODAY = ${snapshot.summary.nfl_event_count}`);
    console.log(`NBA_API_EVENT_COUNT_TODAY = ${snapshot.summary.nba_event_count}`);
    console.log(`NFL_API_TOTAL_PROPS_TODAY = ${snapshot.summary.nfl_total_props}`);
    console.log(`NBA_API_TOTAL_PROPS_TODAY = ${snapshot.summary.nba_total_props}`);
    console.log('========================================');

    // Compare to expectations
    console.log('\n=== Comparison to Expected Reality ===');
    console.log(`Expected NFL Events: 1 (Eagles vs Bears)`);
    console.log(`Actual NFL Events: ${snapshot.summary.nfl_event_count}`);
    console.log(`Match: ${snapshot.summary.nfl_event_count === 1 ? '✓ YES' : '✗ NO - DISCREPANCY DETECTED'}`);

    console.log(`\nExpected NBA Events: 11`);
    console.log(`Actual NBA Events: ${snapshot.summary.nba_event_count}`);
    console.log(`Match: ${snapshot.summary.nba_event_count === 11 ? '✓ YES' : '✗ NO - DISCREPANCY DETECTED'}`);

    if (snapshot.summary.nfl_event_count !== 1 || snapshot.summary.nba_event_count !== 11) {
      console.log('\n⚠️ WARNING: API reality does not match user expectations!');
      console.log('This indicates either:');
      console.log('  1. User expectations are based on outdated schedule');
      console.log('  2. Odds API is not showing all events');
      console.log('  3. API query parameters are too restrictive');
    }

    return snapshot;

  } catch (error) {
    console.error('\n✗ VALIDATION FAILED:', error);
    throw error;
  }
}

function generateMarkdownSummary(snapshot: ValidationSnapshot): string {
  return `# Section 1: Odds API Ground Truth Snapshot

## Validation Timestamp
${snapshot.timestamp}

## Target Date
${snapshot.date}

## NFL Events (${snapshot.nfl.event_count})

### Summary
- **Sport Key**: ${snapshot.nfl.sport_key}
- **Event Count**: ${snapshot.nfl.event_count}
- **Total Props/Outcomes**: ${snapshot.nfl.total_props}
- **Fetch Time**: ${snapshot.nfl.fetch_timestamp}

### Events Detail
${snapshot.nfl.events.map((e, i) => `
#### Event ${i + 1}
- **ID**: ${e.event_id}
- **Matchup**: ${e.away_team} @ ${e.home_team}
- **Commence**: ${e.commence_time}
- **Bookmakers**: ${e.bookmaker_count}
- **Markets**: ${e.markets.join(', ')}
- **Total Outcomes**: ${e.total_outcomes}
- **Player Props**: ${e.prop_outcomes}
`).join('\n')}

## NBA Events (${snapshot.nba.event_count})

### Summary
- **Sport Key**: ${snapshot.nba.sport_key}
- **Event Count**: ${snapshot.nba.event_count}
- **Total Props/Outcomes**: ${snapshot.nba.total_props}
- **Fetch Time**: ${snapshot.nba.fetch_timestamp}

### Events Detail
${snapshot.nba.events.map((e, i) => `
#### Event ${i + 1}
- **ID**: ${e.event_id}
- **Matchup**: ${e.away_team} @ ${e.home_team}
- **Commence**: ${e.commence_time}
- **Bookmakers**: ${e.bookmaker_count}
- **Markets**: ${e.markets.join(', ')}
- **Total Outcomes**: ${e.total_outcomes}
- **Player Props**: ${e.prop_outcomes}
`).join('\n')}

## Ground Truth Summary

\`\`\`
NFL_API_EVENT_COUNT_TODAY = ${snapshot.summary.nfl_event_count}
NBA_API_EVENT_COUNT_TODAY = ${snapshot.summary.nba_event_count}
NFL_API_TOTAL_PROPS_TODAY = ${snapshot.summary.nfl_total_props}
NBA_API_TOTAL_PROPS_TODAY = ${snapshot.summary.nba_total_props}
\`\`\`

## Expected vs Actual

| Metric | Expected | Actual | Status |
|--------|----------|--------|--------|
| NFL Events | 1 (Eagles vs Bears) | ${snapshot.summary.nfl_event_count} | ${snapshot.summary.nfl_event_count === 1 ? '✓' : '✗ MISMATCH'} |
| NBA Events | 11 | ${snapshot.summary.nba_event_count} | ${snapshot.summary.nba_event_count === 11 ? '✓' : '✗ MISMATCH'} |

## Verdict

${snapshot.summary.nfl_event_count === 1 && snapshot.summary.nba_event_count === 11
  ? '✅ **API REALITY MATCHES EXPECTATIONS**: Ground truth established'
  : '⚠️ **DISCREPANCY DETECTED**: API reality does not match user expectations'}

${snapshot.summary.nfl_event_count === 1 && snapshot.summary.nba_event_count === 11
  ? ''
  : `
**Possible Causes**:
1. User expectations based on outdated/incorrect schedule
2. Odds API filtering out some events (date/time restrictions)
3. API query parameters too restrictive
4. Events not yet available in the API

**Next Steps**: Use API reality as the baseline for database validation.
`}
`;
}

// Run validation
runValidation()
  .then(() => {
    console.log('\n✓ Section 1 complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Section 1 failed:', error);
    process.exit(1);
  });
