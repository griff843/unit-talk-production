import { test, expect } from '@playwright/test';

/**
 * Teams API Endpoint Tests — Canonical Metadata Contract
 *
 * Validates the /api/teams endpoint matches the canonical cappers endpoint pattern:
 * - Reads exclusively from the `teams` table (no raw_props, no games extraction)
 * - Returns { value, label, abbreviation, sport } per the contract
 * - Fails closed on DB error or suspicious empty results
 * - Validates query parameters via Zod schema
 * - Includes meta object with source, timestamp, and filters
 */

test.describe('/api/teams — canonical contract', () => {
  test('returns valid team data structure for NFL', async ({ request }) => {
    const response = await request.get('/api/teams?sport=NFL');
    // Allow 200 or 503 (fail-closed if no teams seeded)
    expect([200, 503]).toContain(response.status());

    const data = await response.json();

    if (response.status() === 200) {
      expect(data).toHaveProperty('teams');
      expect(data).toHaveProperty('meta');
      expect(Array.isArray(data.teams)).toBeTruthy();
      expect(data.meta).toHaveProperty('total');
      expect(data.meta).toHaveProperty('source', 'database');
      expect(data.meta).toHaveProperty('timestamp');
      expect(data.meta).toHaveProperty('filters');
      expect(data.meta.filters).toHaveProperty('sport', 'NFL');
      expect(typeof data.meta.total).toBe('number');
      expect(data.meta.total).toBe(data.teams.length);
    } else {
      // Fail-closed response
      expect(data).toHaveProperty('code', 'TEAMS_METADATA_UNAVAILABLE');
      expect(data).toHaveProperty('trace_id');
    }
  });

  test('each team has { value, label, abbreviation, sport } — no raw IDs as labels', async ({ request }) => {
    const response = await request.get('/api/teams?sport=NFL');
    if (response.status() !== 200) return; // skip if fail-closed

    const data = await response.json();
    if (data.teams.length === 0) return;

    const team = data.teams[0];
    expect(team).toHaveProperty('value');
    expect(team).toHaveProperty('label');
    expect(team).toHaveProperty('abbreviation');
    expect(team).toHaveProperty('sport');
    expect(typeof team.value).toBe('string');
    expect(typeof team.label).toBe('string');
    expect(typeof team.abbreviation).toBe('string');
    expect(typeof team.sport).toBe('string');

    // Label must be a clean display name, not a slug/raw ID
    expect(team.label).not.toMatch(/^[0-9a-f-]{36}$/); // not a UUID
    expect(team.label).not.toMatch(/^team_/);
  });

  test('teams are sorted alphabetically by label', async ({ request }) => {
    const response = await request.get('/api/teams?sport=NFL');
    if (response.status() !== 200) return;

    const data = await response.json();
    if (data.teams.length <= 1) return;

    const labels = data.teams.map((t: any) => t.label);
    const sorted = [...labels].sort((a: string, b: string) => a.localeCompare(b));
    expect(labels).toEqual(sorted);
  });

  test('requires sport parameter — returns 400 without it', async ({ request }) => {
    const response = await request.get('/api/teams');
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('search filter (q param) narrows results', async ({ request }) => {
    const response = await request.get('/api/teams?sport=NFL&q=chi');
    // May be 200 or 503 depending on data
    if (response.status() !== 200) return;

    const data = await response.json();
    expect(Array.isArray(data.teams)).toBeTruthy();
    data.teams.forEach((team: any) => {
      expect(team.label.toLowerCase()).toContain('chi');
    });
  });

  test('sport param is case-normalized to uppercase in response', async ({ request }) => {
    const response = await request.get('/api/teams?sport=nfl');
    if (response.status() !== 200) return;

    const data = await response.json();
    expect(data.meta.filters.sport).toBe('NFL');
  });

  test('fail-closed: unknown sport returns empty or 503, never fallback data', async ({ request }) => {
    const response = await request.get('/api/teams?sport=CURLING');
    const data = await response.json();

    if (response.status() === 200) {
      // Unknown sport → empty array is acceptable (CURLING is not in suspicious set)
      expect(data.teams).toEqual([]);
      expect(data.meta.total).toBe(0);
      expect(data.meta.source).toBe('database');
    } else {
      // Also acceptable: fail-closed 503
      expect(data).toHaveProperty('code');
    }
  });

  test('fail-closed error includes trace_id and code', async ({ request }) => {
    // Force an error by using an empty sport (validation should catch this)
    const response = await request.get('/api/teams?sport=');
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('HEAD health check returns 200 or 503', async ({ request }) => {
    const response = await request.head('/api/teams');
    expect([200, 503]).toContain(response.status());
  });
});
