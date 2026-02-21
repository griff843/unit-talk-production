#!/usr/bin/env tsx
/* eslint-disable no-console, max-lines-per-function, complexity */
/**
 * Regression Test: provider_offers Closing Line Immutability
 * Sprint: SPRINT-CLOSING-LINE-IMMUTABILITY-096
 * Date: 2026-02-21
 *
 * Tests:
 * a) INSERT with is_closing=TRUE succeeds
 * b) UPDATE on is_closing=TRUE row fails
 * c) DELETE on is_closing=TRUE row fails
 * d) Toggle is_closing FALSE->TRUE via UPDATE fails
 * e) UPDATE on is_closing=FALSE row succeeds
 * f) DELETE on is_closing=FALSE row succeeds
 *
 * Usage: npx tsx apps/api/src/scripts/test-closing-line-immutability.ts
 *
 * Note: For CI/CD, prefer the psql-based test which runs inside the database.
 */

import { Client } from 'pg';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return getErrorMessage(error);
  return String(error);
}

const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  'postgresql://postgres:postgres@localhost:54322/postgres';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

async function runTests(): Promise<void> {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 30000,
  });

  const results: TestResult[] = [];
  let testEventId: string | null = null;
  let testMarketId: string | null = null;
  let closingOfferId: string | null = null;
  let nonClosingOfferId: string | null = null;

  console.log('='.repeat(70));
  console.log('CLOSING LINE IMMUTABILITY REGRESSION TEST');
  console.log('Sprint: SPRINT-CLOSING-LINE-IMMUTABILITY-096');
  console.log('='.repeat(70));
  console.log('');

  try {
    await client.connect();
    console.log('[SETUP] Connected to database');

    // Get a valid event_id and market_id for FK constraints
    const eventResult = await client.query(`
      SELECT id FROM events LIMIT 1
    `);

    if (eventResult.rows.length === 0) {
      // Create a test event if none exist
      const createEvent = await client.query(`
        INSERT INTO events (sport, event_type, scheduled_at, status)
        VALUES ('NBA', 'game', NOW() + interval '1 day', 'scheduled')
        RETURNING id
      `);
      testEventId = createEvent.rows[0].id;
    } else {
      testEventId = eventResult.rows[0].id;
    }

    const marketResult = await client.query(`
      SELECT id FROM markets LIMIT 1
    `);

    if (marketResult.rows.length === 0) {
      // Create a test market if none exist
      const createMarket = await client.query(`
        INSERT INTO markets (canonical_key, display_name, category, bet_structure)
        VALUES ('test_points_ou', 'Test Points O/U', 'player_prop', 'over_under')
        RETURNING id
      `);
      testMarketId = createMarket.rows[0].id;
    } else {
      testMarketId = marketResult.rows[0].id;
    }

    console.log(`[SETUP] Using event_id: ${testEventId}`);
    console.log(`[SETUP] Using market_id: ${testMarketId}`);
    console.log('');

    // =========================================================================
    // TEST A: INSERT with is_closing=TRUE should succeed
    // =========================================================================
    console.log('[TEST A] INSERT with is_closing=TRUE...');
    try {
      const insertClosing = await client.query(
        `
        INSERT INTO provider_offers (
          event_id, market_id, provider, line, over_odds, snapshot_at, is_closing
        ) VALUES ($1, $2, 'test_provider_closing', 25.5, -110, NOW(), TRUE)
        RETURNING id
      `,
        [testEventId, testMarketId]
      );
      closingOfferId = insertClosing.rows[0].id;
      results.push({
        name: 'INSERT with is_closing=TRUE',
        passed: true,
        message: `Created offer id=${closingOfferId}`,
      });
      console.log(`  PASS: Created closing offer id=${closingOfferId}`);
    } catch (error: unknown) {
      results.push({
        name: 'INSERT with is_closing=TRUE',
        passed: false,
        message: getErrorMessage(error),
      });
      console.log(`  FAIL: ${getErrorMessage(error)}`);
    }

    // =========================================================================
    // TEST B: UPDATE on is_closing=TRUE row should FAIL
    // =========================================================================
    console.log('\n[TEST B] UPDATE on is_closing=TRUE row (should fail)...');
    try {
      await client.query(
        `
        UPDATE provider_offers SET line = 26.5 WHERE id = $1
      `,
        [closingOfferId]
      );
      results.push({
        name: 'UPDATE on is_closing=TRUE blocked',
        passed: false,
        message: 'UPDATE should have been blocked but succeeded',
      });
      console.log('  FAIL: UPDATE succeeded but should have been blocked!');
    } catch (error: unknown) {
      if (getErrorMessage(error).includes('IMMUTABILITY_VIOLATION')) {
        results.push({
          name: 'UPDATE on is_closing=TRUE blocked',
          passed: true,
          message: 'Trigger correctly blocked UPDATE',
        });
        console.log('  PASS: Trigger blocked UPDATE as expected');
        console.log(`        Error: ${getErrorMessage(error)}`);
      } else {
        results.push({
          name: 'UPDATE on is_closing=TRUE blocked',
          passed: false,
          message: `Unexpected error: ${getErrorMessage(error)}`,
        });
        console.log(`  FAIL: Unexpected error: ${getErrorMessage(error)}`);
      }
    }

    // =========================================================================
    // TEST C: DELETE on is_closing=TRUE row should FAIL
    // =========================================================================
    console.log('\n[TEST C] DELETE on is_closing=TRUE row (should fail)...');
    try {
      await client.query(
        `
        DELETE FROM provider_offers WHERE id = $1
      `,
        [closingOfferId]
      );
      results.push({
        name: 'DELETE on is_closing=TRUE blocked',
        passed: false,
        message: 'DELETE should have been blocked but succeeded',
      });
      console.log('  FAIL: DELETE succeeded but should have been blocked!');
    } catch (error: unknown) {
      if (getErrorMessage(error).includes('IMMUTABILITY_VIOLATION')) {
        results.push({
          name: 'DELETE on is_closing=TRUE blocked',
          passed: true,
          message: 'Trigger correctly blocked DELETE',
        });
        console.log('  PASS: Trigger blocked DELETE as expected');
        console.log(`        Error: ${getErrorMessage(error)}`);
      } else {
        results.push({
          name: 'DELETE on is_closing=TRUE blocked',
          passed: false,
          message: `Unexpected error: ${getErrorMessage(error)}`,
        });
        console.log(`  FAIL: Unexpected error: ${getErrorMessage(error)}`);
      }
    }

    // =========================================================================
    // TEST D: Toggle is_closing FALSE->TRUE via UPDATE should FAIL
    // =========================================================================
    console.log('\n[TEST D] INSERT non-closing row, then toggle FALSE->TRUE...');

    // First insert a non-closing row
    const insertNonClosing = await client.query(
      `
      INSERT INTO provider_offers (
        event_id, market_id, provider, line, over_odds, snapshot_at, is_closing
      ) VALUES ($1, $2, 'test_provider_non_closing', 24.5, -115, NOW(), FALSE)
      RETURNING id
    `,
      [testEventId, testMarketId]
    );
    nonClosingOfferId = insertNonClosing.rows[0].id;
    console.log(`  Created non-closing offer id=${nonClosingOfferId}`);

    // Now try to toggle is_closing from FALSE to TRUE
    try {
      await client.query(
        `
        UPDATE provider_offers SET is_closing = TRUE WHERE id = $1
      `,
        [nonClosingOfferId]
      );
      results.push({
        name: 'Toggle is_closing FALSE->TRUE blocked',
        passed: false,
        message: 'Toggle should have been blocked but succeeded',
      });
      console.log('  FAIL: Toggle succeeded but should have been blocked!');
    } catch (error: unknown) {
      if (getErrorMessage(error).includes('IMMUTABILITY_VIOLATION')) {
        results.push({
          name: 'Toggle is_closing FALSE->TRUE blocked',
          passed: true,
          message: 'Trigger correctly blocked toggle',
        });
        console.log('  PASS: Trigger blocked toggle as expected');
        console.log(`        Error: ${getErrorMessage(error)}`);
      } else {
        results.push({
          name: 'Toggle is_closing FALSE->TRUE blocked',
          passed: false,
          message: `Unexpected error: ${getErrorMessage(error)}`,
        });
        console.log(`  FAIL: Unexpected error: ${getErrorMessage(error)}`);
      }
    }

    // =========================================================================
    // TEST E: UPDATE on is_closing=FALSE row should SUCCEED
    // =========================================================================
    console.log('\n[TEST E] UPDATE on is_closing=FALSE row (should succeed)...');
    try {
      await client.query(
        `
        UPDATE provider_offers SET line = 25.0, over_odds = -112 WHERE id = $1
      `,
        [nonClosingOfferId]
      );
      results.push({
        name: 'UPDATE on is_closing=FALSE allowed',
        passed: true,
        message: 'UPDATE succeeded as expected',
      });
      console.log('  PASS: UPDATE on non-closing row succeeded');
    } catch (error: unknown) {
      results.push({
        name: 'UPDATE on is_closing=FALSE allowed',
        passed: false,
        message: getErrorMessage(error),
      });
      console.log(`  FAIL: ${getErrorMessage(error)}`);
    }

    // =========================================================================
    // TEST F: DELETE on is_closing=FALSE row should SUCCEED
    // =========================================================================
    console.log('\n[TEST F] DELETE on is_closing=FALSE row (should succeed)...');
    try {
      await client.query(
        `
        DELETE FROM provider_offers WHERE id = $1
      `,
        [nonClosingOfferId]
      );
      results.push({
        name: 'DELETE on is_closing=FALSE allowed',
        passed: true,
        message: 'DELETE succeeded as expected',
      });
      console.log('  PASS: DELETE on non-closing row succeeded');
      nonClosingOfferId = null; // Already deleted
    } catch (error: unknown) {
      results.push({
        name: 'DELETE on is_closing=FALSE allowed',
        passed: false,
        message: getErrorMessage(error),
      });
      console.log(`  FAIL: ${getErrorMessage(error)}`);
    }

    // =========================================================================
    // CLEANUP: Remove test data (closing row will remain as test artifact)
    // =========================================================================
    console.log('\n[CLEANUP] Cleaning up test data...');

    // We can't delete the closing offer (by design!), so we leave it
    // In a real test suite, you'd have a cleanup mechanism or use transactions
    console.log(`  Note: Closing offer id=${closingOfferId} remains (immutable by design)`);

    if (nonClosingOfferId) {
      await client.query(`DELETE FROM provider_offers WHERE id = $1`, [nonClosingOfferId]);
      console.log(`  Deleted non-closing offer id=${nonClosingOfferId}`);
    }

    // Clean up test provider rows (non-closing only, closing are immutable)
    await client.query(`
      DELETE FROM provider_offers
      WHERE provider LIKE 'test_provider%'
      AND is_closing = FALSE
    `);
    console.log('  Cleaned up remaining test provider offers');
  } catch (error: unknown) {
    console.error('\n[ERROR] Test setup failed:', getErrorMessage(error));
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n[CLEANUP] Database connection closed');
  }

  // =========================================================================
  // RESULTS SUMMARY
  // =========================================================================
  console.log('\n' + '='.repeat(70));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => {
    const status = r.passed ? 'PASS' : 'FAIL';
    console.log(`  [${status}] ${r.name}`);
    if (!r.passed) {
      console.log(`         ${r.message}`);
    }
  });

  console.log('');
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(70));

  if (failed > 0) {
    console.log('\nRESULT: FAIL - Some tests did not pass');
    process.exit(1);
  } else {
    console.log('\nRESULT: PASS - All immutability constraints enforced correctly');
    process.exit(0);
  }
}

runTests().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
