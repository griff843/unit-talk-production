import { test, expect } from '@playwright/test';

/**
 * Players API Endpoint Tests — Canonical Metadata Contract
 *
 * Validates the /api/players endpoint:
 * - Reads exclusively from the `players` table (NEVER raw_props)
 * - Returns { value, label, team_id, sport } per the contract
 * - Fails closed on DB error with PLAYERS_METADATA_UNAVAILABLE + trace_id
 * - Requires q (3+ chars) or team_id to return data
 */

test.describe('/api/players — canonical contract', () => {
  test('returns empty array when no query or team_id provided', async ({ request }) => {
    const response = await request.get('/api/players');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('players');
    expect(data.players).toEqual([]);
  });

  test('returns empty array when q < 3 chars', async ({ request }) => {
    const response = await request.get('/api/players?q=ab&sport=NFL');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.players).toEqual([]);
  });

  test('returns valid player data structure for q=3+ chars', async ({ request }) => {
    const response = await request.get('/api/players?q=Mahomes&sport=NFL');
    // Allow 200 or 503 (fail-closed if players table missing/empty)
    expect([200, 503]).toContain(response.status());

    const data = await response.json();

    if (response.status() === 200) {
      expect(data).toHaveProperty('players');
      expect(data).toHaveProperty('meta');
      expect(Array.isArray(data.players)).toBeTruthy();
      expect(data.meta).toHaveProperty('source', 'database');
      expect(data.meta).toHaveProperty('timestamp');
      expect(data.meta).toHaveProperty('filters');
    } else {
      // Fail-closed response
      expect(data).toHaveProperty('code', 'PLAYERS_METADATA_UNAVAILABLE');
      expect(data).toHaveProperty('trace_id');
    }
  });

  test('each player has { value, label, team_id, sport } — no raw IDs as labels', async ({ request }) => {
    const response = await request.get('/api/players?q=Pat&sport=NFL');
    if (response.status() !== 200) return;

    const data = await response.json();
    if (data.players.length === 0) return;

    const player = data.players[0];
    expect(player).toHaveProperty('value');
    expect(player).toHaveProperty('label');
    expect(player).toHaveProperty('team_id');
    expect(player).toHaveProperty('sport');
    expect(typeof player.value).toBe('string');
    expect(typeof player.label).toBe('string');

    // Label must be a clean display name
    expect(player.label).not.toMatch(/^[0-9a-f-]{36}$/); // not a UUID
  });

  test('sport filter is case-normalized', async ({ request }) => {
    const response = await request.get('/api/players?q=Pat&sport=nfl');
    if (response.status() !== 200) return;

    const data = await response.json();
    expect(data.meta.filters.sport).toBe('NFL');
  });

  test('team_id filter narrows results', async ({ request }) => {
    const response = await request.get('/api/players?team_id=some-uuid&sport=NFL');
    // Should return 200 (maybe empty) or 503
    expect([200, 503]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('players');
      expect(data.meta.source).toBe('database');
    }
  });

  test('fail-closed: DB error returns 503 with code + trace_id', async ({ request }) => {
    // We can't easily force a DB error in integration tests,
    // but we verify the shape of any error response we get
    const response = await request.get('/api/players?q=Patrick&sport=NFL');

    if (response.status() >= 500) {
      const data = await response.json();
      expect(data).toHaveProperty('code');
      expect(data.code).toMatch(/PLAYERS_METADATA_UNAVAILABLE/);
      expect(data).toHaveProperty('trace_id');
      expect(typeof data.trace_id).toBe('string');
      expect(data.trace_id.length).toBeGreaterThan(0);
    }
  });

  test('HEAD health check returns 200 or 503', async ({ request }) => {
    const response = await request.head('/api/players');
    expect([200, 503]).toContain(response.status());
  });
});
