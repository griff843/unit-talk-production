/**
 * Test Line Movement Alerts (Phase 7)
 *
 * This script simulates line changes by inserting props with modified line values
 * to verify the AlertAgent's real-time line movement detection and alerting system.
 *
 * Usage:
 *   npx tsx src/scripts/test-line-movement-alerts.ts
 */

import { requireSupabase } from '../utils/supabaseUtils';
import { makeLogger } from '../utils/logger';
import { randomUUID } from 'crypto';

const logger = makeLogger('LineMovementTest');

interface TestProp {
  playerName: string;
  sport: string;
  market: string;
  line: number;
  odds: number;
  bookmaker: string;
  team: string;
  opponent: string;
}

// Test scenarios for line movement detection
const TEST_SCENARIOS = [
  {
    name: 'Small Line Movement (Below Threshold)',
    description: 'Line moves 1.5 points - should NOT trigger alert',
    initialLine: 25.5,
    newLine: 27.0,
    expectedAlert: false,
  },
  {
    name: 'Medium Line Movement',
    description: 'Line moves 3.0 points - should trigger MEDIUM priority alert',
    initialLine: 25.5,
    newLine: 28.5,
    expectedAlert: true,
    expectedPriority: 'medium',
  },
  {
    name: 'Large Line Movement',
    description: 'Line moves 5.5 points - should trigger CRITICAL priority alert',
    initialLine: 25.5,
    newLine: 31.0,
    expectedAlert: true,
    expectedPriority: 'critical',
  },
  {
    name: 'High Velocity Movement',
    description: 'Line moves 3.0 points in 2 minutes - high velocity alert',
    initialLine: 25.5,
    newLine: 28.5,
    delaySeconds: 120, // 2 minutes
    expectedAlert: true,
    expectedPriority: 'high',
  },
];

const TEST_PROPS: TestProp[] = [
  {
    playerName: 'LeBron James',
    sport: 'basketball_nba',
    market: 'player_points',
    line: 25.5,
    odds: -110,
    bookmaker: 'fanduel',
    team: 'Los Angeles Lakers',
    opponent: 'Golden State Warriors',
  },
  {
    playerName: 'Patrick Mahomes',
    sport: 'americanfootball_nfl',
    market: 'player_pass_yds',
    line: 285.5,
    odds: -115,
    bookmaker: 'draftkings',
    team: 'Kansas City Chiefs',
    opponent: 'Buffalo Bills',
  },
  {
    playerName: 'Shohei Ohtani',
    sport: 'baseball_mlb',
    market: 'player_hits',
    line: 1.5,
    odds: -120,
    bookmaker: 'bet365',
    team: 'Los Angeles Dodgers',
    opponent: 'New York Yankees',
  },
];

/**
 * Insert a test prop into raw_props table
 */
async function insertTestProp(
  prop: TestProp,
  line: number,
  isInitial: boolean = false
): Promise<string> {
  const supabase = requireSupabase();
  const now = new Date().toISOString();
  const gameDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Tomorrow

  const propData = {
    id: randomUUID(),
    sport: prop.sport,
    sport_key: prop.sport,
    player_name: prop.playerName,
    stat_type: prop.market,
    line: line,
    odds: prop.odds,
    over_odds: prop.odds,
    under_odds: prop.odds * -1,
    game_date: gameDate,
    game_time: gameDate,
    matchup: `${prop.team} vs ${prop.opponent}`,
    team: prop.team,
    opponent: prop.opponent,
    bookmaker_key: prop.bookmaker,
    bookmaker_title: prop.bookmaker.charAt(0).toUpperCase() + prop.bookmaker.slice(1),
    external_game_id: `test-game-${Date.now()}`,
    external_prop_id: `test-${prop.playerName.replace(/\s/g, '_')}_${prop.market}_${prop.bookmaker}`,
    scraped_at: now,
    created_at: now,
    updated_at: now,
    metadata: {
      source: 'line_movement_test',
      alert_mode: true,
      test_scenario: isInitial ? 'initial_prop' : 'line_change',
      test_timestamp: now,
    },
  };

  const { data, error } = await supabase.from('raw_props').insert(propData).select().single();

  if (error) {
    throw new Error(`Failed to insert prop: ${error.message}`);
  }

  logger.info(`✅ Inserted ${isInitial ? 'initial' : 'updated'} prop`, {
    playerName: prop.playerName,
    line: line,
    propId: data.id,
  });

  return data.id;
}

/**
 * Run a test scenario
 */
async function runTestScenario(scenario: (typeof TEST_SCENARIOS)[0], prop: TestProp) {
  logger.info('━'.repeat(80));
  logger.info(`🧪 TEST SCENARIO: ${scenario.name}`);
  logger.info(`   ${scenario.description}`);
  logger.info('━'.repeat(80));

  try {
    // Step 1: Insert initial prop
    logger.info('Step 1: Inserting initial prop...');
    const initialPropId = await insertTestProp(prop, scenario.initialLine, true);

    // Step 2: Wait for specified delay (or default 5 seconds)
    const delayMs = (scenario.delaySeconds || 5) * 1000;
    logger.info(`Step 2: Waiting ${delayMs / 1000} seconds before line change...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Step 3: Insert prop with changed line
    logger.info('Step 3: Inserting prop with changed line...');
    const updatedPropId = await insertTestProp(prop, scenario.newLine, false);

    // Step 4: Wait for AlertAgent to process
    logger.info('Step 4: Waiting 10 seconds for AlertAgent to process...');
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Step 5: Query for line movement detection
    const supabase = requireSupabase();
    const { data: lineMovements, error: lineError } = await supabase
      .from('line_movements')
      .select('*')
      .eq('player_name', prop.playerName)
      .order('detected_at', { ascending: false })
      .limit(1);

    if (lineError) {
      throw new Error(`Failed to query line movements: ${lineError.message}`);
    }

    // Step 6: Verify results
    if (scenario.expectedAlert) {
      if (lineMovements && lineMovements.length > 0) {
        const movement = lineMovements[0];
        logger.info('✅ Line movement detected successfully!', {
          oldLine: movement.old_line,
          newLine: movement.new_line,
          lineChange: movement.line_change,
          alertPriority: movement.alert_priority,
          lineVelocity: movement.line_velocity,
        });

        // Verify priority if specified
        if (
          scenario.expectedPriority &&
          movement.alert_priority !== scenario.expectedPriority
        ) {
          logger.warn('⚠️ Alert priority mismatch', {
            expected: scenario.expectedPriority,
            actual: movement.alert_priority,
          });
        } else {
          logger.info('✅ Alert priority matches expected');
        }
      } else {
        logger.error('❌ FAILED: Expected alert but none was detected');
      }
    } else {
      if (lineMovements && lineMovements.length > 0) {
        logger.error('❌ FAILED: Alert was triggered but none was expected');
      } else {
        logger.info('✅ Correctly did not trigger alert (below threshold)');
      }
    }

    // Step 7: Check for Discord alert events
    const { data: alertEvents, error: alertError } = await supabase
      .from('events')
      .select('*')
      .eq('event_type', 'alert.line_movement.detected.v1')
      .eq('event_data->>player_name', prop.playerName)
      .order('created_at', { ascending: false })
      .limit(1);

    if (alertError) {
      logger.warn('Failed to query alert events', { error: alertError.message });
    } else if (alertEvents && alertEvents.length > 0) {
      logger.info('✅ Alert event emitted to events table', {
        eventId: alertEvents[0].id,
        eventType: alertEvents[0].event_type,
      });
    }

    logger.info('━'.repeat(80));
    logger.info('✅ Test scenario complete\n');
  } catch (error) {
    logger.error('❌ Test scenario failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    logger.info('━'.repeat(80));
  }
}

/**
 * Test hedge opportunity detection
 */
async function testHedgeOpportunities() {
  logger.info('━'.repeat(80));
  logger.info('🧪 TEST: Hedge Opportunity Detection');
  logger.info('━'.repeat(80));

  const prop = TEST_PROPS[0]; // LeBron James
  const gameDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  try {
    // Insert props with different lines from different bookmakers
    logger.info('Inserting props from multiple bookmakers with line discrepancies...');

    // Bookmaker A: FanDuel - Line 25.5 at -110
    await insertTestPropWithBookmaker(
      prop,
      25.5,
      -110,
      'fanduel',
      'FanDuel',
      gameDate,
      'BookmakerA'
    );

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Bookmaker B: DraftKings - Line 29.5 at -110 (4 point discrepancy - should trigger alert)
    await insertTestPropWithBookmaker(
      prop,
      29.5,
      -110,
      'draftkings',
      'DraftKings',
      gameDate,
      'BookmakerB'
    );

    // Wait for processing
    logger.info('Waiting 10 seconds for hedge detection...');
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Query for hedge opportunities
    const supabase = requireSupabase();
    const { data: hedgeOpps, error: hedgeError } = await supabase
      .from('hedge_opportunities')
      .select('*')
      .eq('player_name', prop.playerName)
      .order('detected_at', { ascending: false })
      .limit(1);

    if (hedgeError) {
      throw new Error(`Failed to query hedge opportunities: ${hedgeError.message}`);
    }

    if (hedgeOpps && hedgeOpps.length > 0) {
      const hedge = hedgeOpps[0];
      logger.info('✅ Hedge opportunity detected successfully!', {
        type: hedge.type,
        lineA: hedge.line_a,
        lineB: hedge.line_b,
        lineDiscrepancy: hedge.line_discrepancy,
        arbitragePercentage: hedge.arbitrage_percentage,
        profitPotential: hedge.profit_potential,
        alertPriority: hedge.alert_priority,
      });
    } else {
      logger.warn('⚠️ No hedge opportunity detected (may be below threshold)');
    }

    logger.info('━'.repeat(80));
    logger.info('✅ Hedge opportunity test complete\n');
  } catch (error) {
    logger.error('❌ Hedge opportunity test failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Helper to insert prop with specific bookmaker
 */
async function insertTestPropWithBookmaker(
  prop: TestProp,
  line: number,
  odds: number,
  bookmakerKey: string,
  bookmakerTitle: string,
  gameDate: string,
  testLabel: string
) {
  const supabase = requireSupabase();
  const now = new Date().toISOString();

  const propData = {
    id: randomUUID(),
    sport: prop.sport,
    sport_key: prop.sport,
    player_name: prop.playerName,
    stat_type: prop.market,
    line: line,
    odds: odds,
    over_odds: odds,
    under_odds: odds * -1,
    game_date: gameDate,
    game_time: gameDate,
    matchup: `${prop.team} vs ${prop.opponent}`,
    team: prop.team,
    opponent: prop.opponent,
    bookmaker_key: bookmakerKey,
    bookmaker_title: bookmakerTitle,
    external_game_id: `test-game-${Date.now()}`,
    external_prop_id: `test-${prop.playerName.replace(/\s/g, '_')}_${prop.market}_${bookmakerKey}`,
    scraped_at: now,
    created_at: now,
    updated_at: now,
    metadata: {
      source: 'hedge_opportunity_test',
      alert_mode: true,
      test_label: testLabel,
      test_timestamp: now,
    },
  };

  const { data, error } = await supabase.from('raw_props').insert(propData).select().single();

  if (error) {
    throw new Error(`Failed to insert prop: ${error.message}`);
  }

  logger.info(`✅ Inserted prop for ${bookmakerTitle}`, {
    line: line,
    odds: odds,
    propId: data.id,
  });

  return data.id;
}

/**
 * Main test runner
 */
async function main() {
  logger.info('🚀 Starting Line Movement Alert Tests (Phase 7)');
  logger.info('');

  try {
    // Run line movement tests
    for (const scenario of TEST_SCENARIOS) {
      const testProp = TEST_PROPS[0]; // Use LeBron James for line movement tests
      await runTestScenario(scenario, testProp);

      // Wait between scenarios
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Run hedge opportunity test
    await testHedgeOpportunities();

    logger.info('━'.repeat(80));
    logger.info('🎉 All tests complete!');
    logger.info('');
    logger.info('Next steps:');
    logger.info('1. Check Discord for line movement alerts');
    logger.info('2. Query line_movements table for detections');
    logger.info('3. Query hedge_opportunities table for arbitrage/middle opportunities');
    logger.info('4. Query events table for alert events');
    logger.info('');
    logger.info('Verification queries:');
    logger.info('  SELECT * FROM line_movements ORDER BY detected_at DESC LIMIT 10;');
    logger.info('  SELECT * FROM hedge_opportunities ORDER BY detected_at DESC LIMIT 10;');
    logger.info("  SELECT * FROM events WHERE event_type LIKE 'alert.%' ORDER BY created_at DESC LIMIT 10;");
    logger.info('━'.repeat(80));

    process.exit(0);
  } catch (error) {
    logger.error('❌ Test suite failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Run tests
main();
