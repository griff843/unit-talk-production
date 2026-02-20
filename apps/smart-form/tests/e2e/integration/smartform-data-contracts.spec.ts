/**
 * SPRINT-SMARTFORM-DATA-CONTRACTS-MANUAL-INVENTORY-059
 * SPRINT-SMARTFORM-E2E-DETERMINISTIC-MODES-061B
 *
 * INTEGRATION TESTS - Require Supabase credentials
 *
 * E2E Tests for Smart Form Data Contract Surfaces
 *
 * Tests the full flow: sport → team → player → stat types → manual suggestions
 * Verifies that all API routes use contract surfaces correctly.
 *
 * Key changes in V1.0.1:
 * - stat-types: Uses market_usage_stats_v1 for sorting by manual usage
 * - props: Uses manual_inventory_for_form_v1 for suggestions (no live feed dependency)
 *
 * @tag integration
 */

import { test, expect } from '@playwright/test';
import { requireSupabaseEnv } from '../fixtures/mocks';

const API_BASE = process.env.SMARTFORM_URL || 'http://127.0.0.1:3021';
const CONTRACT_VERSION = '1.0.1';

// Skip entire file if Supabase env vars are not set
const hasSupabase = requireSupabaseEnv();
test.skip(!hasSupabase, 'Skipping integration tests: Supabase credentials not configured');

test.describe('Smart Form Data Contract V1.0.1 - API Routes', () => {
  test.describe('GET /api/catalog/players', () => {
    test('should return players from catalog_players_v1', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/catalog/players`, {
        params: { sport: 'NBA' },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();

      // Verify contract structure
      expect(data).toHaveProperty('players');
      expect(data).toHaveProperty('meta');
      expect(data.meta.source).toBe('contract_surface');
      expect(data.meta.contract_version).toBe(CONTRACT_VERSION);
      expect(data.meta.sport).toBe('NBA');

      // Verify response headers
      const headers = response.headers();
      expect(headers['x-contract-version']).toBe(CONTRACT_VERSION);
      expect(headers['x-contract-surface']).toBe('catalog_players_v1');

      // Verify player shape (if data exists)
      if (data.players.length > 0) {
        const player = data.players[0];
        expect(player).toHaveProperty('player_id');
        expect(player).toHaveProperty('player_name');
        expect(player).toHaveProperty('sport');
        expect(player).toHaveProperty('team_id');
        expect(player).toHaveProperty('contract_version');
      }
    });

    test('should support player search with q parameter', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/catalog/players`, {
        params: { sport: 'NBA', q: 'brown' },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.meta.query).toBe('brown');
    });

    test('should return 400 for missing sport parameter', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/catalog/players`);

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.code).toBe('INVALID_PARAMS');
    });
  });

  test.describe('GET /api/registry/stat-types', () => {
    test('should return stat types with manual-usage-first strategy', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/registry/stat-types`, {
        params: { sport: 'NBA' },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();

      // Verify contract structure
      expect(data).toHaveProperty('stat_types');
      expect(data).toHaveProperty('meta');
      expect(data.meta.source).toBe('contract_surface');
      expect(data.meta.contract_version).toBe(CONTRACT_VERSION);
      expect(data.meta.inventory_first).toBe(true);
      expect(data.meta.manual_usage_enabled).toBe(true);

      // Verify response headers
      const headers = response.headers();
      expect(headers['x-contract-version']).toBe(CONTRACT_VERSION);
      expect(headers['x-manual-usage-enabled']).toBe('true');

      // Should have stat types (from taxonomy fallback if no manual usage)
      expect(data.stat_types.length).toBeGreaterThan(0);

      // Verify stat type shape
      const statType = data.stat_types[0];
      expect(statType).toHaveProperty('code');
      expect(statType).toHaveProperty('display_name');
      expect(statType).toHaveProperty('category');
      expect(statType).toHaveProperty('source');
      expect(statType).toHaveProperty('has_inventory');
    });

    test('should include all required NBA markets from taxonomy', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/registry/stat-types`, {
        params: { sport: 'NBA' },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      const codes = data.stat_types.map((st: any) => st.code);

      // Required NBA markets per sprint spec
      expect(codes).toContain('PTS');
      expect(codes).toContain('REB');
      expect(codes).toContain('AST');
      expect(codes).toContain('3PM');
      expect(codes).toContain('PRA');
      expect(codes).toContain('PR');
      expect(codes).toContain('PA');
      expect(codes).toContain('RA');
      expect(codes).toContain('BLK');
      expect(codes).toContain('STL');
      expect(codes).toContain('TO');
    });

    test('should include NFL standard markets from taxonomy', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/registry/stat-types`, {
        params: { sport: 'NFL' },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      const codes = data.stat_types.map((st: any) => st.code);

      // These should always be present in taxonomy
      expect(codes).toContain('PASS_YDS');
      expect(codes).toContain('RUSH_YDS');
      expect(codes).toContain('REC');
    });

    test('should filter by bet_type when provided', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/registry/stat-types`, {
        params: { sport: 'NBA', bet_type: 'player_prop' },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.meta.bet_type).toBe('player_prop');
    });

    test('should include usage_count for markets with manual usage', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/registry/stat-types`, {
        params: { sport: 'NBA' },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();

      // All stat types should have usage_count field (0 if no usage)
      for (const statType of data.stat_types) {
        expect(statType).toHaveProperty('usage_count');
        expect(typeof statType.usage_count).toBe('number');
      }
    });
  });

  test.describe('GET /api/catalog/props (Manual Inventory)', () => {
    test('should return suggestions from manual_inventory_for_form_v1', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/catalog/props`, {
        params: { sport: 'NBA' },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();

      // Verify contract structure - now returns suggestions, not props
      expect(data).toHaveProperty('suggestions');
      expect(data).toHaveProperty('available_markets');
      expect(data).toHaveProperty('meta');
      expect(data.meta.source).toBe('contract_surface');
      expect(data.meta.contract_version).toBe(CONTRACT_VERSION);
      expect(data.meta.manual_inventory).toBe(true);

      // Verify response headers
      const headers = response.headers();
      expect(headers['x-contract-version']).toBe(CONTRACT_VERSION);
      expect(headers['x-contract-surface']).toBe('manual_inventory_for_form_v1');
      expect(headers['x-manual-inventory']).toBe('true');

      // Verify suggestion shape (if data exists)
      if (data.suggestions.length > 0) {
        const suggestion = data.suggestions[0];
        expect(suggestion).toHaveProperty('sport');
        expect(suggestion).toHaveProperty('player_name');
        expect(suggestion).toHaveProperty('market_key');
        expect(suggestion).toHaveProperty('avg_line');
        expect(suggestion).toHaveProperty('count_recent');
        expect(suggestion).toHaveProperty('last_seen_at');
        expect(suggestion).toHaveProperty('contract_version');
      }
    });

    test('should support player_name filter', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/catalog/props`, {
        params: { sport: 'NBA', player_name: 'brown' },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.meta.player_name).toBe('brown');
    });

    test('should support market_key filter', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/catalog/props`, {
        params: { sport: 'NBA', market_key: 'PTS' },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.meta.market_key).toBe('PTS');
    });

    test('should accept stat_type as alias for market_key', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/catalog/props`, {
        params: { sport: 'NBA', stat_type: 'AST' },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.meta.market_key).toBe('AST');
    });

    test('should return empty suggestions array when no manual data', async ({ request }) => {
      // Query for a sport/player combo that likely has no manual submissions
      const response = await request.get(`${API_BASE}/api/catalog/props`, {
        params: { sport: 'NBA', player_name: 'nonexistentplayer123xyz' },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.suggestions).toEqual([]);
      expect(data.available_markets).toEqual([]);
    });
  });

  test.describe('Health Checks', () => {
    test('HEAD /api/catalog/players should return contract headers', async ({ request }) => {
      const response = await request.head(`${API_BASE}/api/catalog/players`);

      // May be 200 or 503 depending on DB state
      expect([200, 503]).toContain(response.status());

      const headers = response.headers();
      expect(headers['x-contract-version']).toBe(CONTRACT_VERSION);
      expect(headers['x-contract-surface']).toBe('catalog_players_v1');
    });

    test('HEAD /api/registry/stat-types should return contract headers', async ({ request }) => {
      const response = await request.head(`${API_BASE}/api/registry/stat-types`);

      expect([200, 503]).toContain(response.status());

      const headers = response.headers();
      expect(headers['x-contract-version']).toBe(CONTRACT_VERSION);
    });

    test('HEAD /api/catalog/props should return manual inventory headers', async ({ request }) => {
      const response = await request.head(`${API_BASE}/api/catalog/props`);

      expect([200, 503]).toContain(response.status());

      const headers = response.headers();
      expect(headers['x-contract-version']).toBe(CONTRACT_VERSION);
      expect(headers['x-contract-surface']).toBe('manual_inventory_for_form_v1');
      expect(headers['x-manual-inventory']).toBe('true');
    });
  });
});

test.describe('Smart Form Data Contract V1.0.1 - Full Manual Flow', () => {
  test('should complete sport → stat_types → manual suggestions flow', async ({ request }) => {
    // Step 1: Get stat types for NBA
    const statTypesResponse = await request.get(`${API_BASE}/api/registry/stat-types`, {
      params: { sport: 'NBA' },
    });
    expect(statTypesResponse.status()).toBe(200);

    const statTypesData = await statTypesResponse.json();
    expect(statTypesData.stat_types.length).toBeGreaterThan(0);

    // All required NBA markets should be present
    const codes = statTypesData.stat_types.map((st: any) => st.code);
    expect(codes).toContain('PTS');
    expect(codes).toContain('AST');
    expect(codes).toContain('REB');

    // Pick first stat type
    const selectedStatType = statTypesData.stat_types[0].code;

    // Step 2: Get manual suggestions for that stat type
    const suggestionsResponse = await request.get(`${API_BASE}/api/catalog/props`, {
      params: { sport: 'NBA', market_key: selectedStatType },
    });
    expect(suggestionsResponse.status()).toBe(200);

    const suggestionsData = await suggestionsResponse.json();
    // Suggestions may be empty if no manual submissions, but request should succeed
    expect(suggestionsData).toHaveProperty('suggestions');
    expect(suggestionsData.meta.market_key).toBe(selectedStatType);
    expect(suggestionsData.meta.manual_inventory).toBe(true);
  });

  test('should complete sport → player search → manual suggestions flow', async ({ request }) => {
    // Step 1: Search for players
    const playersResponse = await request.get(`${API_BASE}/api/catalog/players`, {
      params: { sport: 'NBA', q: 'test' },
    });
    expect(playersResponse.status()).toBe(200);

    const playersData = await playersResponse.json();
    // Players may be empty if no data, but request should succeed
    expect(playersData).toHaveProperty('players');

    // Step 2: Get manual suggestions (even if no player found, should work)
    const suggestionsResponse = await request.get(`${API_BASE}/api/catalog/props`, {
      params: { sport: 'NBA', player_name: 'test' },
    });
    expect(suggestionsResponse.status()).toBe(200);

    const suggestionsData = await suggestionsResponse.json();
    expect(suggestionsData).toHaveProperty('suggestions');
    expect(suggestionsData.meta.manual_inventory).toBe(true);
  });

  test('manual flow should work without live prop feed dependency', async ({ request }) => {
    // This test verifies the form works even without inventory_props_for_form_v1 having data

    // Step 1: Get stat types - should return taxonomy markets
    const statTypesResponse = await request.get(`${API_BASE}/api/registry/stat-types`, {
      params: { sport: 'NBA' },
    });
    expect(statTypesResponse.status()).toBe(200);

    const statTypesData = await statTypesResponse.json();
    // Taxonomy fallback should always provide markets
    expect(statTypesData.stat_types.length).toBeGreaterThanOrEqual(11); // Required NBA markets

    // Step 2: Get manual suggestions - may be empty but should not error
    const suggestionsResponse = await request.get(`${API_BASE}/api/catalog/props`, {
      params: { sport: 'NBA' },
    });
    expect(suggestionsResponse.status()).toBe(200);

    const suggestionsData = await suggestionsResponse.json();
    expect(suggestionsData).toHaveProperty('suggestions');
    expect(suggestionsData).toHaveProperty('available_markets');
    // Should succeed regardless of whether there are manual submissions
  });
});

test.describe('Smart Form Data Contract V1.0.1 - Error Handling', () => {
  test('should return contract-compliant error for invalid params', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/catalog/players`, {
      params: { sport: '' }, // Empty sport
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data).toHaveProperty('code');
    expect(data).toHaveProperty('contract_version');
    expect(data.contract_version).toBe(CONTRACT_VERSION);
  });

  test('props route should handle invalid player_id gracefully', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/catalog/props`, {
      params: { sport: 'NBA', player_id: 'not-a-uuid' },
    });

    // Should return 400 for invalid UUID
    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.contract_version).toBe(CONTRACT_VERSION);
  });

  test('stat-types route should return 400 for missing sport', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/registry/stat-types`);

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.code).toBe('INVALID_PARAMS');
    expect(data.contract_version).toBe(CONTRACT_VERSION);
  });
});
