/**
 * Tests for ClosingSnapshotService
 * Sprint: SPRINT-025-CLV-CLOSING-SNAPSHOT
 */

import { describe, it, expect } from 'vitest';

import { ClosingSnapshotService } from '../ClosingSnapshotService';

import type { BookOffer } from '../../lib/probability/devigConsensus';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOffer(
  provider: string,
  overOdds: number,
  underOdds: number,
  snapshotAt: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: `offer-${provider}-${snapshotAt}`,
    event_id: 'event-1',
    market_type_id: 2,
    participant_id: 'player-1',
    provider,
    provider_id: null,
    line: 25.5,
    over_odds: overOdds,
    under_odds: underOdds,
    home_odds: null,
    away_odds: null,
    yes_odds: null,
    no_odds: null,
    snapshot_at: snapshotAt,
    ...overrides,
  };
}

function makeMockEvent(scheduledAt: string) {
  return { id: 'event-1', scheduled_at: scheduledAt };
}

// Minimal mock SupabaseClient - not used for unit tests of computeSnapshot
const mockSupabase = {} as import('@supabase/supabase-js').SupabaseClient;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClosingSnapshotService', () => {
  describe('computeSnapshot', () => {
    const service = new ClosingSnapshotService(mockSupabase);
    const event = makeMockEvent('2026-03-04T19:00:00Z');
    const windowStart = new Date('2026-03-04T18:30:00Z');
    const windowEnd = new Date('2026-03-04T19:00:00Z');

    it('computes consensus from valid offers (3+ books)', () => {
      const offers = [
        makeOffer('fanduel', -110, -110, '2026-03-04T18:45:00Z'),
        makeOffer('draftkings', -115, -105, '2026-03-04T18:50:00Z'),
        makeOffer('betmgm', -108, -112, '2026-03-04T18:55:00Z'),
      ];

      const result = service.computeSnapshot(
        event,
        'event-1|2|player-1',
        {
          market_type_id: 2,
          participant_id: 'player-1',
          offers: offers as any,
        },
        windowStart,
        windowEnd
      );

      expect(result).not.toBeNull();
      expect(result!.book_count).toBe(3);
      expect(result!.p_close_over).toBeGreaterThan(0);
      expect(result!.p_close_over).toBeLessThan(1);
      expect(result!.p_close_under).toBeGreaterThan(0);
      expect(result!.p_close_under).toBeLessThan(1);
      expect(result!.p_close_over + result!.p_close_under).toBeCloseTo(1, 2);
      expect(result!.devig_method).toBe('proportional');
      expect(result!.market_key).toBe('event-1|2|player-1');
      expect(result!.event_id).toBe('event-1');
    });

    it('returns null when fewer than 3 books', () => {
      const offers = [
        makeOffer('fanduel', -110, -110, '2026-03-04T18:45:00Z'),
        makeOffer('draftkings', -115, -105, '2026-03-04T18:50:00Z'),
      ];

      const result = service.computeSnapshot(
        event,
        'event-1|2|player-1',
        {
          market_type_id: 2,
          participant_id: 'player-1',
          offers: offers as any,
        },
        windowStart,
        windowEnd
      );

      expect(result).toBeNull();
    });

    it('dedupes to latest offer per provider', () => {
      const offers = [
        makeOffer('fanduel', -110, -110, '2026-03-04T18:40:00Z'),
        makeOffer('fanduel', -120, -100, '2026-03-04T18:55:00Z'), // Latest
        makeOffer('draftkings', -115, -105, '2026-03-04T18:50:00Z'),
        makeOffer('betmgm', -108, -112, '2026-03-04T18:55:00Z'),
      ];

      const result = service.computeSnapshot(
        event,
        'event-1|2|player-1',
        {
          market_type_id: 2,
          participant_id: 'player-1',
          offers: offers as any,
        },
        windowStart,
        windowEnd
      );

      expect(result).not.toBeNull();
      // Should use 3 books (fanduel deduped to latest)
      expect(result!.book_count).toBe(3);
    });

    it('skips offers without valid odds pairs', () => {
      const offers = [
        makeOffer('fanduel', -110, -110, '2026-03-04T18:45:00Z'),
        makeOffer('draftkings', -115, -105, '2026-03-04T18:50:00Z'),
        // Null odds — should be skipped
        makeOffer('betmgm', -108, -112, '2026-03-04T18:55:00Z', {
          over_odds: null,
          under_odds: null,
        }),
      ];

      const result = service.computeSnapshot(
        event,
        'event-1|2|player-1',
        {
          market_type_id: 2,
          participant_id: 'player-1',
          offers: offers as any,
        },
        windowStart,
        windowEnd
      );

      // Only 2 valid books — fail-closed
      expect(result).toBeNull();
    });

    it('handles moneyline markets (home/away odds)', () => {
      const offers = [
        makeOffer('fanduel', 0, 0, '2026-03-04T18:45:00Z', {
          over_odds: null,
          under_odds: null,
          home_odds: -150,
          away_odds: 130,
        }),
        makeOffer('draftkings', 0, 0, '2026-03-04T18:50:00Z', {
          over_odds: null,
          under_odds: null,
          home_odds: -145,
          away_odds: 125,
        }),
        makeOffer('betmgm', 0, 0, '2026-03-04T18:55:00Z', {
          over_odds: null,
          under_odds: null,
          home_odds: -155,
          away_odds: 135,
        }),
      ];

      const result = service.computeSnapshot(
        event,
        'event-1|1|null',
        {
          market_type_id: 1,
          participant_id: null,
          offers: offers as any,
        },
        windowStart,
        windowEnd
      );

      expect(result).not.toBeNull();
      expect(result!.book_count).toBe(3);
      expect(result!.p_close_over).toBeGreaterThan(0.5); // Home favorite
    });

    it('includes books_json audit trail', () => {
      const offers = [
        makeOffer('fanduel', -110, -110, '2026-03-04T18:45:00Z'),
        makeOffer('draftkings', -115, -105, '2026-03-04T18:50:00Z'),
        makeOffer('pinnacle', -112, -108, '2026-03-04T18:55:00Z'),
      ];

      const result = service.computeSnapshot(
        event,
        'event-1|2|player-1',
        {
          market_type_id: 2,
          participant_id: 'player-1',
          offers: offers as any,
        },
        windowStart,
        windowEnd
      );

      expect(result).not.toBeNull();
      const booksJson = result!.books_json as Array<{
        bookId: string;
        bookName: string;
        overFair: number;
        underFair: number;
        weight: number;
      }>;
      expect(booksJson).toHaveLength(3);
      expect(booksJson[0]).toHaveProperty('bookName');
      expect(booksJson[0]).toHaveProperty('overFair');
      expect(booksJson[0]).toHaveProperty('weight');
    });

    it('sets correct model_version and timestamps', () => {
      const offers = [
        makeOffer('fanduel', -110, -110, '2026-03-04T18:45:00Z'),
        makeOffer('draftkings', -115, -105, '2026-03-04T18:50:00Z'),
        makeOffer('betmgm', -108, -112, '2026-03-04T18:55:00Z'),
      ];

      const result = service.computeSnapshot(
        event,
        'event-1|2|player-1',
        {
          market_type_id: 2,
          participant_id: 'player-1',
          offers: offers as any,
        },
        windowStart,
        windowEnd
      );

      expect(result).not.toBeNull();
      expect(result!.model_version).toBe('prob_v2.0.0_syndicate_layered');
      expect(result!.game_start_time).toBe('2026-03-04T19:00:00Z');
      expect(result!.close_window_start).toBe(windowStart.toISOString());
      expect(result!.close_window_end).toBe(windowEnd.toISOString());
    });
  });
});
