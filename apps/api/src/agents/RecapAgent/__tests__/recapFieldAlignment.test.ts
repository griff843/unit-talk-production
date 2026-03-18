/**
 * Recap Field Alignment Tests — SPRINT-RECAP-FIELD-ALIGNMENT
 *
 * Proves:
 *   1. getDailyRecapData queries settlement_status/settlement_result (not play_status/outcome)
 *   2. getWeeklyRecapData queries settlement_status/settlement_result
 *   3. getMonthlyRecapData queries settlement_status/settlement_result
 *   4. getParlayGroups queries settlement_status (not play_status)
 *   5. mapRawPickToUnifiedPick maps settlement_result → outcome
 *   6. mapRawPickToUnifiedPick maps settlement_status → play_status
 *   7. Micro-recap trigger uses settlement_status/settlement_result
 *   8. Outcome filtering works with settlement_result values (win/loss/push)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock tracking ─────────────────────────────────────────────────────────────

interface QueryCall {
  table: string;
  method: string;
  args: any[];
}

const queryCalls: QueryCall[] = [];
let mockResolvedData: any = { data: [], error: null };

function buildTrackingChain(table: string) {
  const chain: any = {};

  const track = (method: string) =>
    vi.fn((...args: any[]) => {
      queryCalls.push({ table, method, args });
      return chain;
    });

  chain.select = track('select');
  chain.eq = track('eq');
  chain.in = track('in');
  chain.not = track('not');
  chain.is = track('is');
  chain.gte = track('gte');
  chain.lt = track('lt');
  chain.lte = track('lte');
  chain.order = track('order');
  chain.limit = track('limit');
  chain.then = (resolve: any) => resolve(mockResolvedData);
  return chain;
}

const mockFrom = vi.fn((table: string) => buildTrackingChain(table));
const mockSupabase = { from: mockFrom };

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// ─── Import after mocks ────────────────────────────────────────────────────────

import { RecapService } from '../recapService';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function createService(): RecapService {
  return new RecapService({
    legendFooter: false,
    microRecap: true,
    clvDelta: false,
    streakSparkline: false,
    notionSync: false,
  });
}

function settledPick(overrides: Record<string, any> = {}) {
  return {
    id: 'pick-1',
    player_name: 'Test Player',
    team_name: 'Test Team',
    market_type: 'points',
    line: 22.5,
    odds: -110,
    tier: 'A',
    edge_score: 12,
    is_sharp_fade: false,
    tags: [],
    created_at: '2026-03-18T12:00:00Z',
    updated_at: '2026-03-18T12:00:00Z',
    settlement_status: 'settled',
    settlement_result: 'win',
    units: 1,
    profit_loss: 0.91,
    capper: 'TestCapper',
    matchup: 'Team A vs Team B',
    parlay_id: null,
    closing_line: null,
    closing_odds: null,
    settled_at: '2026-03-18T20:00:00Z',
    opening_line: null,
    opening_odds: null,
    clv_delta: null,
    grade_timestamp: null,
    sport: 'NBA',
    league: 'NBA',
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  queryCalls.length = 0;
  mockResolvedData = { data: [], error: null };
  mockFrom.mockImplementation((table: string) => buildTrackingChain(table));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RecapService field alignment', () => {
  describe('getDailyRecapData', () => {
    it('queries settlement_status = settled (not play_status)', async () => {
      const service = createService();
      await service.getDailyRecapData('2026-03-18');

      const eqCalls = queryCalls.filter(c => c.table === 'unified_picks' && c.method === 'eq');
      expect(eqCalls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ args: ['settlement_status', 'settled'] }),
        ])
      );

      // Must NOT use play_status
      const inCalls = queryCalls.filter(c => c.table === 'unified_picks' && c.method === 'in');
      const playStatusIn = inCalls.filter(c => c.args[0] === 'play_status');
      expect(playStatusIn).toHaveLength(0);
    });

    it('queries settlement_result not null (not outcome)', async () => {
      const service = createService();
      await service.getDailyRecapData('2026-03-18');

      const notCalls = queryCalls.filter(c => c.table === 'unified_picks' && c.method === 'not');
      expect(notCalls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ args: ['settlement_result', 'is', null] }),
        ])
      );

      // Must NOT use outcome column in query
      const outcomeNot = notCalls.filter(c => c.args[0] === 'outcome');
      expect(outcomeNot).toHaveLength(0);
    });
  });

  describe('getWeeklyRecapData', () => {
    it('queries settlement_status = settled', async () => {
      const service = createService();
      await service.getWeeklyRecapData('2026-03-11', '2026-03-18');

      const eqCalls = queryCalls.filter(c => c.table === 'unified_picks' && c.method === 'eq');
      expect(eqCalls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ args: ['settlement_status', 'settled'] }),
        ])
      );
    });

    it('queries settlement_result not null', async () => {
      const service = createService();
      await service.getWeeklyRecapData('2026-03-11', '2026-03-18');

      const notCalls = queryCalls.filter(c => c.table === 'unified_picks' && c.method === 'not');
      expect(notCalls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ args: ['settlement_result', 'is', null] }),
        ])
      );
    });
  });

  describe('getMonthlyRecapData', () => {
    it('queries settlement_status = settled', async () => {
      const service = createService();
      await service.getMonthlyRecapData('2026-03-01', '2026-03-31');

      const eqCalls = queryCalls.filter(c => c.table === 'unified_picks' && c.method === 'eq');
      expect(eqCalls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ args: ['settlement_status', 'settled'] }),
        ])
      );
    });
  });

  describe('getParlayGroups', () => {
    it('queries settlement_status = settled (not play_status)', async () => {
      const service = createService();
      await service.getParlayGroups('2026-03-18');

      const eqCalls = queryCalls.filter(c => c.table === 'unified_picks' && c.method === 'eq');
      expect(eqCalls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ args: ['settlement_status', 'settled'] }),
        ])
      );

      const inCalls = queryCalls.filter(c => c.table === 'unified_picks' && c.method === 'in');
      const playStatusIn = inCalls.filter(c => c.args[0] === 'play_status');
      expect(playStatusIn).toHaveLength(0);
    });
  });

  describe('mapRawPickToUnifiedPick', () => {
    it('maps settlement_result to outcome field', async () => {
      mockResolvedData = {
        data: [settledPick({ settlement_result: 'loss' })],
        error: null,
      };
      const service = createService();
      const result = await service.getDailyRecapData('2026-03-18');

      expect(result).toBeTruthy();
      expect(result!.losses).toBe(1);
      expect(result!.wins).toBe(0);
    });

    it('maps settlement_status to play_status field', async () => {
      mockResolvedData = {
        data: [settledPick({ settlement_status: 'settled', settlement_result: 'win' })],
        error: null,
      };
      const service = createService();
      const result = await service.getDailyRecapData('2026-03-18');

      expect(result).toBeTruthy();
      expect(result!.wins).toBe(1);
    });

    it('falls back to raw outcome if settlement_result is absent', async () => {
      mockResolvedData = {
        data: [
          settledPick({
            settlement_result: undefined,
            outcome: 'push',
            settlement_status: 'settled',
          }),
        ],
        error: null,
      };
      const service = createService();
      const result = await service.getDailyRecapData('2026-03-18');

      expect(result).toBeTruthy();
      expect(result!.pushes).toBe(1);
    });
  });

  describe('outcome filtering', () => {
    it('counts wins, losses, pushes from settlement_result values', async () => {
      mockResolvedData = {
        data: [
          settledPick({ id: 'p1', settlement_result: 'win' }),
          settledPick({ id: 'p2', settlement_result: 'win' }),
          settledPick({ id: 'p3', settlement_result: 'loss' }),
          settledPick({ id: 'p4', settlement_result: 'push' }),
        ],
        error: null,
      };
      const service = createService();
      const result = await service.getDailyRecapData('2026-03-18');

      expect(result).toBeTruthy();
      expect(result!.wins).toBe(2);
      expect(result!.losses).toBe(1);
      expect(result!.pushes).toBe(1);
      expect(result!.totalPicks).toBe(4);
    });
  });

  describe('micro-recap trigger', () => {
    it('detects all picks settled via settlement_status field', async () => {
      mockResolvedData = {
        data: [
          settledPick({ settlement_status: 'settled', settlement_result: 'win' }),
          settledPick({
            id: 'p2',
            settlement_status: 'settled',
            settlement_result: 'loss',
          }),
        ],
        error: null,
      };
      const service = createService();
      const result = await service.checkLastPickGraded();

      // When all picks are settled and the mock returns data for getDailyRecapData too,
      // we should get a non-null micro-recap result
      expect(result).toBeTruthy();
    });

    it('returns null when picks are not yet settled', async () => {
      mockResolvedData = {
        data: [settledPick({ settlement_status: null, settlement_result: null })],
        error: null,
      };
      const service = createService();
      const result = await service.checkLastPickGraded();

      // Should be null because there are pending (unsettled) picks
      expect(result).toBeNull();
    });
  });
});

describe('RecapService never queries play_status or outcome columns', () => {
  it('no query uses play_status as a DB filter', async () => {
    const service = createService();

    await service.getDailyRecapData('2026-03-18');
    await service.getWeeklyRecapData('2026-03-11', '2026-03-18');
    await service.getMonthlyRecapData('2026-03-01', '2026-03-31');
    await service.getParlayGroups('2026-03-18');

    const playStatusQueries = queryCalls.filter(
      c =>
        c.table === 'unified_picks' &&
        (c.method === 'eq' || c.method === 'in') &&
        c.args[0] === 'play_status'
    );
    expect(playStatusQueries).toHaveLength(0);
  });

  it('no query uses outcome as a DB filter', async () => {
    const service = createService();

    await service.getDailyRecapData('2026-03-18');
    await service.getWeeklyRecapData('2026-03-11', '2026-03-18');
    await service.getMonthlyRecapData('2026-03-01', '2026-03-31');

    const outcomeQueries = queryCalls.filter(
      c => c.table === 'unified_picks' && c.method === 'not' && c.args[0] === 'outcome'
    );
    expect(outcomeQueries).toHaveLength(0);
  });
});
