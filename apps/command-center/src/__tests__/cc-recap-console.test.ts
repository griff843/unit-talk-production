/**
 * Tests for ops-recap API route.
 * Sprint: SPRINT-080-LAYER3-PHASE10-CC-RECAP-DASHBOARD
 *
 * Covers:
 *   1.  POST /api/ops-recap → 400 when mode is missing
 *   2.  POST /api/ops-recap → 400 when mode is invalid
 *   3.  POST /api/ops-recap → 200 daily — empty picks → HOLD decision
 *   4.  POST /api/ops-recap → 200 weekly — 5W/0L → PROMOTE decision
 *   5.  POST /api/ops-recap → 200 monthly — 2W/5L → DEMOTE decision
 *   6.  POST /api/ops-recap → 503 when Supabase client unavailable
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Supabase mock ────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { POST } from '@/app/api/ops-recap/route';
import { getSupabaseClient } from '@/lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockGetSupabaseClient = vi.mocked(getSupabaseClient);

/** Build a fluent Supabase chain that resolves to the given rows. */
function makeChain(rows: Array<{ settlement_result: string }>) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gte', 'lte']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.data = rows;
  chain.error = null;
  return chain;
}

function makeClient(rows: Array<{ settlement_result: string }>) {
  const chain = makeChain(rows);
  return { from: vi.fn().mockReturnValue(chain) };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ops-recap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/ops-recap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Missing mode
  it('returns 400 when mode is missing', async () => {
    mockGetSupabaseClient.mockReturnValue(makeClient([]) as ReturnType<typeof getSupabaseClient>);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/mode/i);
  });

  // 2. Invalid mode
  it('returns 400 when mode is invalid', async () => {
    mockGetSupabaseClient.mockReturnValue(makeClient([]) as ReturnType<typeof getSupabaseClient>);
    const res = await POST(makeRequest({ mode: 'yearly' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/mode/i);
  });

  // 3. Daily — empty picks → HOLD
  it('returns 200 for daily mode with no settled picks (HOLD decision)', async () => {
    mockGetSupabaseClient.mockReturnValue(makeClient([]) as ReturnType<typeof getSupabaseClient>);
    const res = await POST(makeRequest({ mode: 'daily' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.mode).toBe('daily');
    expect(body.date_range).toMatchObject({ start: expect.any(String), end: expect.any(String) });
    expect(body.summary.headline.total_settled).toBe(0);
    expect(body.summary.headline.wins).toBe(0);
    expect(body.summary.headline.losses).toBe(0);
    expect(body.summary.headline.win_rate).toBe(0);
    expect(body.summary.decision.decision).toBe('HOLD');
    expect(body.timestamp).toBeDefined();
  });

  // 4. Weekly — 5 wins, 0 losses → win_rate = 1.0 → PROMOTE
  it('returns 200 for weekly mode with high win rate (PROMOTE decision)', async () => {
    const rows = Array.from({ length: 5 }, () => ({ settlement_result: 'win' }));
    mockGetSupabaseClient.mockReturnValue(makeClient(rows) as ReturnType<typeof getSupabaseClient>);
    const res = await POST(makeRequest({ mode: 'weekly' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.mode).toBe('weekly');
    expect(body.summary.headline.wins).toBe(5);
    expect(body.summary.headline.losses).toBe(0);
    expect(body.summary.headline.win_rate).toBe(1);
    expect(body.summary.decision.decision).toBe('PROMOTE');
    expect(body.summary.decision.reasons.length).toBeGreaterThan(0);
  });

  // 5. Monthly — 2 wins, 5 losses → win_rate ≈ 0.286 < 0.45 → DEMOTE
  it('returns 200 for monthly mode with low win rate (DEMOTE decision)', async () => {
    const rows = [
      ...Array.from({ length: 2 }, () => ({ settlement_result: 'win' })),
      ...Array.from({ length: 5 }, () => ({ settlement_result: 'loss' })),
    ];
    mockGetSupabaseClient.mockReturnValue(makeClient(rows) as ReturnType<typeof getSupabaseClient>);
    const res = await POST(makeRequest({ mode: 'monthly' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.mode).toBe('monthly');
    expect(body.summary.headline.wins).toBe(2);
    expect(body.summary.headline.losses).toBe(5);
    expect(body.summary.decision.decision).toBe('DEMOTE');
    expect(body.summary.decision.reasons.length).toBeGreaterThan(0);
  });

  // 6. 503 when Supabase unavailable
  it('returns 503 when Supabase client is unavailable', async () => {
    mockGetSupabaseClient.mockReturnValue(null as ReturnType<typeof getSupabaseClient>);
    const res = await POST(makeRequest({ mode: 'daily' }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/unavailable/i);
  });
});
