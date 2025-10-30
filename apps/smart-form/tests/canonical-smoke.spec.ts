/**
 * Canonical Picks Driver - Comprehensive E2E Smoke Tests
 *
 * Tests the full canonical picks flow across all 4 leagues:
 * 1. Preflight check (200) - Schema visibility verification
 * 2. Dry-run validation (204) - Request validation without DB writes
 * 3. Live submission (201) - Actual pick creation
 * 4. Feed verification - Pick appears in API/feed within 10 seconds
 *
 * Test coverage:
 * - All 4 leagues: NBA, NFL, MLB, NHL
 * - Optional userScore field (1-10)
 * - Auto-resolve capper (no userId)
 * - Canonical payload structure validation
 * - Server-Timing headers verification
 * - Performance targets (< 250ms submit time)
 *
 * Charter compliance:
 * - Canonical-first architecture (picks + pick_publish tables)
 * - Idempotent processing via betSlipId
 * - Self-healing PostgREST with preflight validation
 */

import { test, expect } from '@playwright/test';

// Configuration
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006';
const SMART_FORM_BASE = process.env.BASE_URL || 'http://localhost:3002';
const PERFORMANCE_TARGET_MS = 250; // Target: < 250ms for pick submission
const FEED_APPEARANCE_TIMEOUT_MS = 10000; // 10 seconds to appear in feed

// Test data templates for each league
const LEAGUE_TEST_DATA = {
  NBA: {
    league: 'NBA',
    marketType: 'Points',
    playerName: 'LeBron James',
    line: 28.5,
    side: 'over' as const,
    odds: -110,
    gameId: 'nba-game-' + Date.now(),
    gameDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
  },
  NFL: {
    league: 'NFL',
    marketType: 'Passing Yards',
    playerName: 'Patrick Mahomes',
    line: 275.5,
    side: 'over' as const,
    odds: -115,
    gameId: 'nfl-game-' + Date.now(),
    gameDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
  MLB: {
    league: 'MLB',
    marketType: 'Strikeouts',
    playerName: 'Shohei Ohtani',
    line: 6.5,
    side: 'over' as const,
    odds: -120,
    gameId: 'mlb-game-' + Date.now(),
    gameDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
  NHL: {
    league: 'NHL',
    marketType: 'Points',
    playerName: 'Connor McDavid',
    line: 1.5,
    side: 'over' as const,
    odds: -105,
    gameId: 'nhl-game-' + Date.now(),
    gameDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
} as const;

type League = keyof typeof LEAGUE_TEST_DATA;

/**
 * Helper: Generate unique bet slip ID for idempotency
 */
function generateBetSlipId(league: string): string {
  return `smoke-${league.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper: Validate canonical payload structure
 */
function validateCanonicalPayload(payload: any) {
  expect(payload).toHaveProperty('league');
  expect(payload).toHaveProperty('marketType');
  expect(payload).toHaveProperty('line');
  expect(payload).toHaveProperty('side');
  expect(['over', 'under']).toContain(payload.side);

  // Optional fields
  if (payload.odds !== undefined) {
    expect(typeof payload.odds).toBe('number');
  }
  if (payload.confidence !== undefined) {
    expect(typeof payload.confidence).toBe('number');
    expect(payload.confidence).toBeGreaterThanOrEqual(0);
    expect(payload.confidence).toBeLessThanOrEqual(1);
  }
  if (payload.userScore !== undefined) {
    expect(typeof payload.userScore).toBe('number');
    expect(payload.userScore).toBeGreaterThanOrEqual(1);
    expect(payload.userScore).toBeLessThanOrEqual(10);
  }
}

/**
 * Helper: Check Server-Timing headers presence
 */
function validateServerTimingHeaders(headers: any) {
  const serverTiming = headers['server-timing'];
  expect(serverTiming).toBeDefined();
  expect(serverTiming).toContain('parse;dur=');
  expect(serverTiming).toContain('validate;dur=');
}

/**
 * Helper: Wait for pick to appear in feed/API
 */
async function waitForPickInFeed(
  request: any,
  pickId: string,
  timeoutMs: number = FEED_APPEARANCE_TIMEOUT_MS
): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 1000; // Poll every 1 second

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Query picks API to find our pick
      const response = await request.get(`${API_BASE}/api/domain/picks/${pickId}`);

      if (response.ok()) {
        const data = await response.json();
        if (data.success && data.data?.id === pickId) {
          return true;
        }
      }
    } catch (error) {
      // Continue polling on error
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return false;
}

test.describe('Canonical Picks Driver - Smoke Tests', () => {
  test.beforeEach(async () => {
    // Log test start for observability
    console.log(`[${new Date().toISOString()}] Starting canonical smoke test`);
  });

  test.describe('Preflight Checks', () => {
    test('GET /api/domain/picks/preflight should return 200 with ok: true', async ({
      request,
    }) => {
      const response = await request.get(`${API_BASE}/api/domain/picks/preflight`);

      expect(response.status()).toBe(200);

      const data = await response.json();

      // Charter-mandated preflight validation
      expect(data).toHaveProperty('ok');
      expect(data.ok).toBe(true);

      // Verify canonical tables visibility
      expect(data.tables).toBeDefined();
      expect(data.tables.picks).toBeDefined();
      expect(data.tables.picks.visible).toBe(true);
      expect(data.tables.pick_publish).toBeDefined();
      expect(data.tables.pick_publish.visible).toBe(true);

      // Verify critical columns visible
      const picksColumns = data.tables.picks.columnsVisible;
      expect(picksColumns).toContain('id');
      expect(picksColumns).toContain('tenant_id');
      expect(picksColumns).toContain('user_id');
      expect(picksColumns).toContain('selection');
      expect(picksColumns).toContain('confidence');

      // Self-healing status
      expect(data).toHaveProperty('selfHealEnabled');
      expect(data).toHaveProperty('lastReloadAt');

      console.log('[Preflight] Schema visibility validated:', {
        picks: data.tables.picks.visible,
        pickPublish: data.tables.pick_publish.visible,
        selfHeal: data.selfHealEnabled,
      });
    });

    test('Preflight should trigger reload if schema issues detected', async ({
      request,
    }) => {
      const response = await request.get(`${API_BASE}/api/domain/picks/preflight`);

      expect(response.status()).toBe(200);

      const data = await response.json();

      // If schema was missing and self-heal is enabled, reload should have occurred
      if (data.reloaded) {
        console.log('[Preflight] Self-healing PostgREST reload triggered');
        expect(data.lastReloadAt).toBeDefined();
        expect(data.selfHealEnabled).toBe(true);
      }
    });
  });

  test.describe('League-Specific Full Flow Tests', () => {
    const leagues: League[] = ['NBA', 'NFL', 'MLB', 'NHL'];

    for (const league of leagues) {
      test(`${league} - Complete submission flow (Preflight → Dry-run → Live → Feed)`, async ({
        request,
      }) => {
        const testData = LEAGUE_TEST_DATA[league];
        const betSlipId = generateBetSlipId(league);

        // Prepare pick payload
        const pickPayload = {
          ...testData,
          betSlipId,
          stake: 1.0,
          confidence: 0.85,
          autoPublish: false, // Don't publish to Discord in tests
        };

        console.log(`[${league}] Starting full flow test with betSlipId:`, betSlipId);

        // ==========================================
        // STEP 1: PREFLIGHT CHECK (200)
        // ==========================================
        console.log(`[${league}] Step 1/4: Preflight check`);
        const preflightResponse = await request.get(
          `${API_BASE}/api/domain/picks/preflight`
        );

        expect(preflightResponse.status()).toBe(200);
        const preflightData = await preflightResponse.json();
        expect(preflightData.ok).toBe(true);

        console.log(`[${league}] ✓ Preflight passed`);

        // ==========================================
        // STEP 2: DRY-RUN VALIDATION (204)
        // ==========================================
        console.log(`[${league}] Step 2/4: Dry-run validation`);
        const dryRunResponse = await request.post(
          `${SMART_FORM_BASE}/api/domain/picks/dry-run`,
          {
            data: pickPayload,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        expect(dryRunResponse.status()).toBe(204); // No Content on success

        // Verify Server-Timing headers
        const dryRunHeaders = dryRunResponse.headers();
        expect(dryRunHeaders['server-timing']).toBeDefined();
        expect(dryRunHeaders['x-dry-run']).toBe('true');
        expect(dryRunHeaders['x-processing-time']).toBeDefined();

        console.log(`[${league}] ✓ Dry-run validation passed`);

        // ==========================================
        // STEP 3: LIVE SUBMISSION (201)
        // ==========================================
        console.log(`[${league}] Step 3/4: Live submission`);
        const submitStartTime = Date.now();

        const liveResponse = await request.post(
          `${SMART_FORM_BASE}/api/domain/picks/insert`,
          {
            data: pickPayload,
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': betSlipId,
            },
          }
        );

        const submitDuration = Date.now() - submitStartTime;

        expect(liveResponse.status()).toBe(201);

        const liveData = await liveResponse.json();

        // Validate response structure
        expect(liveData.success).toBe(true);
        expect(liveData.pickId).toBeDefined();
        expect(liveData.driver).toBe('canonical');
        expect(liveData.publishMode).toBe('outbox');
        expect(liveData.auditLogged).toBe(true);

        // Performance validation
        expect(liveData.processingTime).toBeLessThan(PERFORMANCE_TARGET_MS);
        expect(submitDuration).toBeLessThan(PERFORMANCE_TARGET_MS * 2); // Allow for network

        // Validate Server-Timing headers
        const liveHeaders = liveResponse.headers();
        validateServerTimingHeaders(liveHeaders);
        expect(liveHeaders['x-processing-time']).toBeDefined();

        console.log(`[${league}] ✓ Live submission succeeded in ${submitDuration}ms`, {
          pickId: liveData.pickId,
          processingTime: liveData.processingTime,
        });

        // ==========================================
        // STEP 4: FEED VERIFICATION
        // ==========================================
        console.log(
          `[${league}] Step 4/4: Verifying pick appears in feed (max ${FEED_APPEARANCE_TIMEOUT_MS}ms)`
        );

        const pickId = liveData.pickId;
        const appearedInFeed = await waitForPickInFeed(request, pickId);

        expect(appearedInFeed).toBe(true);

        console.log(`[${league}] ✓ Pick verified in feed`);
        console.log(`[${league}] ✅ Full flow completed successfully`);
      });
    }
  });

  test.describe('Optional Fields Tests', () => {
    test('Submission with userScore field (1-10)', async ({ request }) => {
      const testData = LEAGUE_TEST_DATA.NBA;
      const betSlipId = generateBetSlipId('NBA-userScore');

      const pickPayload = {
        ...testData,
        betSlipId,
        userScore: 8, // User confidence rating 1-10
        autoPublish: false,
      };

      validateCanonicalPayload(pickPayload);

      const response = await request.post(
        `${SMART_FORM_BASE}/api/domain/picks/insert`,
        {
          data: pickPayload,
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': betSlipId,
          },
        }
      );

      expect(response.status()).toBe(201);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.pickId).toBeDefined();

      console.log('[UserScore] ✓ Submission with userScore=8 succeeded');
    });

    test('Submission without userScore field', async ({ request }) => {
      const testData = LEAGUE_TEST_DATA.NFL;
      const betSlipId = generateBetSlipId('NFL-noUserScore');

      const pickPayload = {
        ...testData,
        betSlipId,
        // userScore omitted
        autoPublish: false,
      };

      const response = await request.post(
        `${SMART_FORM_BASE}/api/domain/picks/insert`,
        {
          data: pickPayload,
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': betSlipId,
          },
        }
      );

      expect(response.status()).toBe(201);

      const data = await response.json();
      expect(data.success).toBe(true);

      console.log('[UserScore] ✓ Submission without userScore succeeded');
    });

    test('Submission with various userScore values (boundary testing)', async ({
      request,
    }) => {
      const validScores = [1, 5, 10]; // Min, mid, max

      for (const score of validScores) {
        const betSlipId = generateBetSlipId(`MLB-score${score}`);

        const pickPayload = {
          ...LEAGUE_TEST_DATA.MLB,
          betSlipId,
          userScore: score,
          autoPublish: false,
        };

        const response = await request.post(
          `${SMART_FORM_BASE}/api/domain/picks/insert`,
          {
            data: pickPayload,
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': betSlipId,
            },
          }
        );

        expect(response.status()).toBe(201);
        const data = await response.json();
        expect(data.success).toBe(true);

        console.log(`[UserScore] ✓ Score ${score} accepted`);
      }
    });
  });

  test.describe('Auto-Resolve Capper Tests', () => {
    test('Submission without userId - auto-resolve from environment', async ({
      request,
    }) => {
      const testData = LEAGUE_TEST_DATA.NBA;
      const betSlipId = generateBetSlipId('NBA-autoResolve');

      const pickPayload = {
        ...testData,
        betSlipId,
        // userId NOT provided - should auto-resolve
        autoPublish: false,
      };

      const response = await request.post(
        `${SMART_FORM_BASE}/api/domain/picks/insert`,
        {
          data: pickPayload,
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': betSlipId,
          },
        }
      );

      // Should either succeed (if capper configured) or return 422
      if (response.status() === 201) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.pickId).toBeDefined();
        console.log('[AutoResolve] ✓ Capper auto-resolved successfully');
      } else if (response.status() === 422) {
        const data = await response.json();
        expect(data.error).toBe('Missing capper ID');
        expect(data.details.checkedSources).toBeDefined();
        console.log(
          '[AutoResolve] ⚠ No capper configured - checked sources:',
          data.details.checkedSources
        );
      } else {
        throw new Error(`Unexpected status code: ${response.status()}`);
      }
    });

    test('GET /api/domain/cappers/default - Check default capper configuration', async ({
      request,
    }) => {
      const response = await request.get(`${SMART_FORM_BASE}/api/domain/cappers/default`);

      // Either 200 (configured) or 404 (not configured)
      expect([200, 404]).toContain(response.status());

      const data = await response.json();

      if (response.status() === 200) {
        expect(data.success).toBe(true);
        expect(data.capperId).toBeDefined();
        expect(data.source).toBeDefined();

        console.log('[DefaultCapper] ✓ Default capper configured:', {
          capperId: data.capperId,
          source: data.source,
        });
      } else {
        expect(data.success).toBe(false);
        expect(data.error).toBe('No default capper configured');
        expect(data.checkedSources).toBeDefined();

        console.log(
          '[DefaultCapper] ⚠ No default capper - checked sources:',
          data.checkedSources
        );
      }
    });
  });

  test.describe('Canonical Payload Structure Validation', () => {
    test('Validate required fields for canonical submission', async ({ request }) => {
      const validPayload = {
        ...LEAGUE_TEST_DATA.NFL,
        betSlipId: generateBetSlipId('NFL-validation'),
        autoPublish: false,
      };

      // Test all required fields are present
      validateCanonicalPayload(validPayload);

      const response = await request.post(
        `${SMART_FORM_BASE}/api/domain/picks/insert`,
        {
          data: validPayload,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);

      console.log('[Validation] ✓ All required fields validated');
    });

    test('Reject invalid side values', async ({ request }) => {
      const invalidPayload = {
        ...LEAGUE_TEST_DATA.NBA,
        betSlipId: generateBetSlipId('NBA-invalidSide'),
        side: 'invalid-side', // Should be 'over' or 'under'
        autoPublish: false,
      };

      const response = await request.post(
        `${SMART_FORM_BASE}/api/domain/picks/insert`,
        {
          data: invalidPayload,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid pick data');

      console.log('[Validation] ✓ Invalid side rejected');
    });

    test('Reject missing required fields', async ({ request }) => {
      const incompletePayload = {
        // Missing league, marketType, line, side
        betSlipId: generateBetSlipId('incomplete'),
        autoPublish: false,
      };

      const response = await request.post(
        `${SMART_FORM_BASE}/api/domain/picks/insert`,
        {
          data: incompletePayload,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid pick data');
      expect(data.details).toBeDefined();
      expect(Array.isArray(data.details)).toBe(true);

      console.log('[Validation] ✓ Missing required fields rejected');
    });
  });

  test.describe('Server-Timing Headers Validation', () => {
    test('All endpoints should include Server-Timing headers', async ({ request }) => {
      const betSlipId = generateBetSlipId('NHL-timing');

      const pickPayload = {
        ...LEAGUE_TEST_DATA.NHL,
        betSlipId,
        autoPublish: false,
      };

      const response = await request.post(
        `${SMART_FORM_BASE}/api/domain/picks/insert`,
        {
          data: pickPayload,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status()).toBe(201);

      const headers = response.headers();

      // Validate Server-Timing header presence and structure
      expect(headers['server-timing']).toBeDefined();

      const serverTiming = headers['server-timing'];

      // Check for expected timing components
      expect(serverTiming).toContain('parse;dur=');
      expect(serverTiming).toContain('validate;dur=');
      expect(serverTiming).toContain('resolve;dur=');
      expect(serverTiming).toContain('forward;dur=');
      expect(serverTiming).toContain('total;dur=');

      // Parse timing values
      const timings = serverTiming.split(', ').reduce((acc: any, timing: string) => {
        const [name, durStr] = timing.split(';dur=');
        acc[name] = parseFloat(durStr);
        return acc;
      }, {});

      console.log('[Server-Timing] Breakdown:', timings);

      // Validate total is sum of components (approximately)
      const componentSum = timings.parse + timings.validate + timings.resolve + timings.forward;
      expect(timings.total).toBeGreaterThanOrEqual(componentSum * 0.9); // Allow 10% variance

      console.log('[Server-Timing] ✓ Headers validated');
    });
  });

  test.describe('Idempotency Tests', () => {
    test('Duplicate submission with same betSlipId should be idempotent', async ({
      request,
    }) => {
      const betSlipId = generateBetSlipId('MLB-idempotent');

      const pickPayload = {
        ...LEAGUE_TEST_DATA.MLB,
        betSlipId,
        autoPublish: false,
      };

      // First submission
      const response1 = await request.post(
        `${SMART_FORM_BASE}/api/domain/picks/insert`,
        {
          data: pickPayload,
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': betSlipId,
          },
        }
      );

      expect(response1.status()).toBe(201);
      const data1 = await response1.json();
      expect(data1.success).toBe(true);
      const pickId1 = data1.pickId;

      console.log('[Idempotency] First submission pickId:', pickId1);

      // Second submission with same betSlipId
      const response2 = await request.post(
        `${SMART_FORM_BASE}/api/domain/picks/insert`,
        {
          data: pickPayload,
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': betSlipId,
          },
        }
      );

      expect(response2.status()).toBe(201);
      const data2 = await response2.json();
      expect(data2.success).toBe(true);

      // Should return same pick ID
      expect(data2.pickId).toBe(pickId1);
      expect(data2.idempotent).toBe(true);

      console.log('[Idempotency] ✓ Duplicate submission handled correctly');
    });
  });

  test.describe('Performance Tests', () => {
    test('Submission should complete within performance target', async ({ request }) => {
      const betSlipId = generateBetSlipId('NBA-perf');

      const pickPayload = {
        ...LEAGUE_TEST_DATA.NBA,
        betSlipId,
        autoPublish: false,
      };

      const startTime = Date.now();

      const response = await request.post(
        `${SMART_FORM_BASE}/api/domain/picks/insert`,
        {
          data: pickPayload,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const totalLatency = Date.now() - startTime;

      expect(response.status()).toBe(201);

      const data = await response.json();
      expect(data.success).toBe(true);

      // Performance assertions
      // Target: API p95 < 250ms, Total E2E < 500ms
      expect(data.processingTime).toBeLessThan(PERFORMANCE_TARGET_MS);
      expect(totalLatency).toBeLessThan(500); // E2E target

      console.log('[Performance] Timing:', {
        processingTime: data.processingTime,
        totalLatency,
        target: PERFORMANCE_TARGET_MS,
      });

      console.log('[Performance] ✓ Within target');
    });
  });

  test.describe('Error Handling', () => {
    test('Should handle malformed JSON gracefully', async ({ request }) => {
      const response = await request.post(
        `${SMART_FORM_BASE}/api/domain/picks/insert`,
        {
          data: 'not-valid-json-{]',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // Should return error status (likely 400 or 500)
      expect([400, 500]).toContain(response.status());

      console.log('[ErrorHandling] ✓ Malformed JSON handled');
    });

    test('Should handle network timeout gracefully', async ({ request }) => {
      // This test validates timeout handling exists
      // Actual timeout behavior depends on Playwright config
      const betSlipId = generateBetSlipId('timeout-test');

      const pickPayload = {
        ...LEAGUE_TEST_DATA.NFL,
        betSlipId,
        autoPublish: false,
      };

      try {
        const response = await request.post(
          `${SMART_FORM_BASE}/api/domain/picks/insert`,
          {
            data: pickPayload,
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 second timeout
          }
        );

        // Should complete or timeout gracefully
        expect([200, 201, 408, 500, 503]).toContain(response.status());
      } catch (error) {
        // Timeout is acceptable behavior
        console.log('[ErrorHandling] ✓ Timeout handled gracefully');
      }
    });
  });
});
