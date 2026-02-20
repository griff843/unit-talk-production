/**
 * SPRINT-SMARTFORM-E2E-DETERMINISTIC-MODES-061B
 *
 * Mock fixtures for contract tests.
 * These mocks allow E2E tests to run without Supabase credentials.
 */

import { Page, Route } from '@playwright/test';

// Contract version for mock responses
export const CONTRACT_VERSION = '1.0.1';

// Mock cappers data
export const MOCK_CAPPERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    display_name: 'Test Capper',
    avatar_url: null,
    is_active: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    display_name: 'Demo Capper',
    avatar_url: null,
    is_active: true,
  },
];

// Mock teams data
export const MOCK_TEAMS = {
  NBA: [
    { team_id: 'lakers', team_name: 'Los Angeles Lakers', abbrev: 'LAL', sport: 'NBA' },
    { team_id: 'celtics', team_name: 'Boston Celtics', abbrev: 'BOS', sport: 'NBA' },
    { team_id: 'heat', team_name: 'Miami Heat', abbrev: 'MIA', sport: 'NBA' },
  ],
  NFL: [
    { team_id: 'chiefs', team_name: 'Kansas City Chiefs', abbrev: 'KC', sport: 'NFL' },
    { team_id: 'eagles', team_name: 'Philadelphia Eagles', abbrev: 'PHI', sport: 'NFL' },
  ],
};

// Mock players data
export const MOCK_PLAYERS = {
  NBA: [
    {
      player_id: 'lebron',
      player_name: 'LeBron James',
      sport: 'NBA',
      team_id: 'lakers',
      contract_version: CONTRACT_VERSION,
    },
    {
      player_id: 'davis',
      player_name: 'Anthony Davis',
      sport: 'NBA',
      team_id: 'lakers',
      contract_version: CONTRACT_VERSION,
    },
    {
      player_id: 'tatum',
      player_name: 'Jayson Tatum',
      sport: 'NBA',
      team_id: 'celtics',
      contract_version: CONTRACT_VERSION,
    },
  ],
  NFL: [
    {
      player_id: 'mahomes',
      player_name: 'Patrick Mahomes',
      sport: 'NFL',
      team_id: 'chiefs',
      contract_version: CONTRACT_VERSION,
    },
  ],
};

// Mock stat types
export const MOCK_STAT_TYPES = {
  NBA: [
    {
      code: 'PTS',
      display_name: 'Points',
      category: 'scoring',
      source: 'taxonomy',
      has_inventory: false,
      usage_count: 0,
    },
    {
      code: 'REB',
      display_name: 'Rebounds',
      category: 'rebounding',
      source: 'taxonomy',
      has_inventory: false,
      usage_count: 0,
    },
    {
      code: 'AST',
      display_name: 'Assists',
      category: 'passing',
      source: 'taxonomy',
      has_inventory: false,
      usage_count: 0,
    },
    {
      code: '3PM',
      display_name: '3-Pointers Made',
      category: 'scoring',
      source: 'taxonomy',
      has_inventory: false,
      usage_count: 0,
    },
    {
      code: 'PRA',
      display_name: 'Points + Rebounds + Assists',
      category: 'combo',
      source: 'taxonomy',
      has_inventory: false,
      usage_count: 0,
    },
    {
      code: 'PR',
      display_name: 'Points + Rebounds',
      category: 'combo',
      source: 'taxonomy',
      has_inventory: false,
      usage_count: 0,
    },
    {
      code: 'PA',
      display_name: 'Points + Assists',
      category: 'combo',
      source: 'taxonomy',
      has_inventory: false,
      usage_count: 0,
    },
    {
      code: 'RA',
      display_name: 'Rebounds + Assists',
      category: 'combo',
      source: 'taxonomy',
      has_inventory: false,
      usage_count: 0,
    },
    {
      code: 'BLK',
      display_name: 'Blocks',
      category: 'defense',
      source: 'taxonomy',
      has_inventory: false,
      usage_count: 0,
    },
    {
      code: 'STL',
      display_name: 'Steals',
      category: 'defense',
      source: 'taxonomy',
      has_inventory: false,
      usage_count: 0,
    },
    {
      code: 'TO',
      display_name: 'Turnovers',
      category: 'misc',
      source: 'taxonomy',
      has_inventory: false,
      usage_count: 0,
    },
  ],
  NFL: [
    {
      code: 'PASS_YDS',
      display_name: 'Passing Yards',
      category: 'passing',
      source: 'taxonomy',
      has_inventory: false,
      usage_count: 0,
    },
    {
      code: 'RUSH_YDS',
      display_name: 'Rushing Yards',
      category: 'rushing',
      source: 'taxonomy',
      has_inventory: false,
      usage_count: 0,
    },
    {
      code: 'REC',
      display_name: 'Receptions',
      category: 'receiving',
      source: 'taxonomy',
      has_inventory: false,
      usage_count: 0,
    },
  ],
};

// Mock props/suggestions (empty for clean tests)
export const MOCK_SUGGESTIONS = {
  suggestions: [],
  available_markets: [],
  meta: {
    source: 'contract_surface',
    contract_version: CONTRACT_VERSION,
    manual_inventory: true,
    sport: 'NBA',
  },
};

/**
 * Setup all API route mocks for a Playwright page.
 * This enables contract tests to run without Supabase.
 */
export async function setupApiMocks(page: Page): Promise<void> {
  // Mock /api/cappers
  await page.route('**/api/cappers**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CAPPERS),
    });
  });

  // Mock /api/catalog/teams
  await page.route('**/api/catalog/teams**', async (route: Route) => {
    const url = new URL(route.request().url());
    const sport = url.searchParams.get('sport') || 'NBA';
    const teams = MOCK_TEAMS[sport as keyof typeof MOCK_TEAMS] || MOCK_TEAMS.NBA;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'x-contract-version': CONTRACT_VERSION,
        'x-contract-surface': 'catalog_teams_v1',
      },
      body: JSON.stringify({
        teams,
        meta: {
          source: 'contract_surface',
          contract_version: CONTRACT_VERSION,
          sport,
        },
      }),
    });
  });

  // Mock /api/catalog/players
  await page.route('**/api/catalog/players**', async (route: Route) => {
    const url = new URL(route.request().url());
    const sport = url.searchParams.get('sport') || 'NBA';
    const query = url.searchParams.get('q') || url.searchParams.get('search') || '';
    let players = MOCK_PLAYERS[sport as keyof typeof MOCK_PLAYERS] || MOCK_PLAYERS.NBA;

    // Filter by query if provided
    if (query) {
      players = players.filter(p => p.player_name.toLowerCase().includes(query.toLowerCase()));
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'x-contract-version': CONTRACT_VERSION,
        'x-contract-surface': 'catalog_players_v1',
      },
      body: JSON.stringify({
        players,
        meta: {
          source: 'contract_surface',
          contract_version: CONTRACT_VERSION,
          sport,
          query: query || undefined,
        },
      }),
    });
  });

  // Mock /api/registry/stat-types
  await page.route('**/api/registry/stat-types**', async (route: Route) => {
    const url = new URL(route.request().url());
    const sport = url.searchParams.get('sport') || 'NBA';
    const betType = url.searchParams.get('bet_type');
    const statTypes = MOCK_STAT_TYPES[sport as keyof typeof MOCK_STAT_TYPES] || MOCK_STAT_TYPES.NBA;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'x-contract-version': CONTRACT_VERSION,
        'x-manual-usage-enabled': 'true',
      },
      body: JSON.stringify({
        stat_types: statTypes,
        meta: {
          source: 'contract_surface',
          contract_version: CONTRACT_VERSION,
          sport,
          bet_type: betType || undefined,
          inventory_first: true,
          manual_usage_enabled: true,
        },
      }),
    });
  });

  // Mock /api/catalog/props (manual inventory suggestions)
  await page.route('**/api/catalog/props**', async (route: Route) => {
    const url = new URL(route.request().url());
    const sport = url.searchParams.get('sport') || 'NBA';
    const playerName = url.searchParams.get('player_name');
    const marketKey = url.searchParams.get('market_key') || url.searchParams.get('stat_type');

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'x-contract-version': CONTRACT_VERSION,
        'x-contract-surface': 'manual_inventory_for_form_v1',
        'x-manual-inventory': 'true',
      },
      body: JSON.stringify({
        suggestions: [],
        available_markets: [],
        meta: {
          source: 'contract_surface',
          contract_version: CONTRACT_VERSION,
          manual_inventory: true,
          sport,
          player_name: playerName || undefined,
          market_key: marketKey || undefined,
        },
      }),
    });
  });

  // Mock /api/normalize
  await page.route('**/api/normalize**', async (route: Route) => {
    const request = route.request();
    let body: { type?: string; query?: string; sport?: string } = {};
    try {
      body = JSON.parse((await request.postData()) || '{}');
    } catch {
      // Ignore parse errors
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        normalized: body.query || 'Normalized Value',
        type: body.type || 'team',
        sport: body.sport || 'NBA',
        confidence: 0.95,
      }),
    });
  });

  // Mock /api/submit-ticket
  await page.route('**/api/submit-ticket**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        ticket_id: 'mock-ticket-123',
        message: 'Ticket submitted successfully (mock)',
      }),
    });
  });

  // Mock /api/catalog/games (if called)
  await page.route('**/api/catalog/games**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        games: [],
        meta: {
          source: 'contract_surface',
          contract_version: CONTRACT_VERSION,
        },
      }),
    });
  });
}

/**
 * Skip test if Supabase env vars are not set.
 * Use this in integration tests that require real database.
 */
export function requireSupabaseEnv(): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return !!(supabaseUrl && supabaseKey);
}
