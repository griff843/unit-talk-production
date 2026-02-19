/**
 * SPRINT-SMARTFORM-DATA-CONTRACTS-INVENTORY-SURFACE-059
 *
 * E2E Tests for Smart Form Data Contract Surfaces
 *
 * Tests the full flow: sport → team → player → stat types → props
 * Verifies that all API routes use contract surfaces correctly.
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.SMARTFORM_URL || 'http://localhost:3021';
const CONTRACT_VERSION = '1.0.0';

test.describe('Smart Form Data Contract V1 - API Routes', () => {
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
    test('should return stat types with inventory-first strategy', async ({ request }) => {
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

      // Verify response headers
      const headers = response.headers();
      expect(headers['x-contract-version']).toBe(CONTRACT_VERSION);
      expect(headers['x-inventory-first']).toBe('true');

      // Should have stat types (from taxonomy fallback if no inventory)
      expect(data.stat_types.length).toBeGreaterThan(0);

      // Verify stat type shape
      const statType = data.stat_types[0];
      expect(statType).toHaveProperty('code');
      expect(statType).toHaveProperty('display_name');
      expect(statType).toHaveProperty('category');
      expect(statType).toHaveProperty('source');
      expect(statType).toHaveProperty('has_inventory');
    });

    test('should include NBA standard markets from taxonomy', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/registry/stat-types`, {
        params: { sport: 'NBA' },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      const codes = data.stat_types.map((st: any) => st.code);

      // These should always be present in taxonomy
      expect(codes).toContain('PTS');
      expect(codes).toContain('AST');
      expect(codes).toContain('REB');
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
  });

  test.describe('GET /api/catalog/props', () => {
    test('should return props from inventory_props_for_form_v1', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/catalog/props`, {
        params: { sport: 'NBA' },
      });

      expect(response.status()).toBe(200);

      const data = await response.json();

      // Verify contract structure
      expect(data).toHaveProperty('props');
      expect(data).toHaveProperty('available_markets');
      expect(data).toHaveProperty('meta');
      expect(data.meta.source).toBe('contract_surface');
      expect(data.meta.contract_version).toBe(CONTRACT_VERSION);

      // Verify response headers
      const headers = response.headers();
      expect(headers['x-contract-version']).toBe(CONTRACT_VERSION);
      expect(headers['x-contract-surface']).toBe('inventory_props_for_form_v1');

      // Verify prop shape (if data exists)
      if (data.props.length > 0) {
        const prop = data.props[0];
        expect(prop).toHaveProperty('prop_id');
        expect(prop).toHaveProperty('sport');
        expect(prop).toHaveProperty('player_name');
        expect(prop).toHaveProperty('market_key');
        expect(prop).toHaveProperty('line');
        expect(prop).toHaveProperty('prop_key');
        expect(prop).toHaveProperty('contract_version');
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

    test('HEAD /api/catalog/props should return contract headers', async ({ request }) => {
      const response = await request.head(`${API_BASE}/api/catalog/props`);

      expect([200, 503]).toContain(response.status());

      const headers = response.headers();
      expect(headers['x-contract-version']).toBe(CONTRACT_VERSION);
      expect(headers['x-contract-surface']).toBe('inventory_props_for_form_v1');
    });
  });
});

test.describe('Smart Form Data Contract V1 - Full Flow', () => {
  test('should complete sport → stat_types → props flow', async ({ request }) => {
    // Step 1: Get stat types for NBA
    const statTypesResponse = await request.get(`${API_BASE}/api/registry/stat-types`, {
      params: { sport: 'NBA' },
    });
    expect(statTypesResponse.status()).toBe(200);

    const statTypesData = await statTypesResponse.json();
    expect(statTypesData.stat_types.length).toBeGreaterThan(0);

    // Pick first stat type
    const selectedStatType = statTypesData.stat_types[0].code;

    // Step 2: Get props for that stat type
    const propsResponse = await request.get(`${API_BASE}/api/catalog/props`, {
      params: { sport: 'NBA', market_key: selectedStatType },
    });
    expect(propsResponse.status()).toBe(200);

    const propsData = await propsResponse.json();
    // Props may be empty if no inventory, but request should succeed
    expect(propsData).toHaveProperty('props');
    expect(propsData.meta.market_key).toBe(selectedStatType);
  });

  test('should complete sport → player search → props flow', async ({ request }) => {
    // Step 1: Search for players
    const playersResponse = await request.get(`${API_BASE}/api/catalog/players`, {
      params: { sport: 'NBA', q: 'test' },
    });
    expect(playersResponse.status()).toBe(200);

    const playersData = await playersResponse.json();
    // Players may be empty if no data, but request should succeed
    expect(playersData).toHaveProperty('players');

    // Step 2: Get props (even if no player found, should work)
    const propsResponse = await request.get(`${API_BASE}/api/catalog/props`, {
      params: { sport: 'NBA', player_name: 'test' },
    });
    expect(propsResponse.status()).toBe(200);

    const propsData = await propsResponse.json();
    expect(propsData).toHaveProperty('props');
  });
});

test.describe('Smart Form Data Contract V1 - Error Handling', () => {
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

  test('props route should handle invalid UUID gracefully', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/catalog/props`, {
      params: { sport: 'NBA', game_id: 'not-a-uuid' },
    });

    // Should return 400 for invalid UUID
    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });
});
