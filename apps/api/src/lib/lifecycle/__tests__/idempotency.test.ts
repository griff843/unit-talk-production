/**
 * IDEMPOTENCY REPLAY TESTS
 * Sprint: LIFECYCLE-WRITE-SURFACE-MIGRATION-038
 *
 * These tests verify idempotency guarantees:
 * - Duplicate submissions are detected and rejected
 * - Duplicate posts are detected and skipped
 * - Duplicate settlements are detected and skipped
 * - Atomic claims work correctly under concurrent access
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  checkSubmitIdempotency,
  assertSubmitIdempotency,
  checkPostIdempotency,
  assertPostIdempotency,
  atomicClaimForPost,
  atomicClaimParlayForPost,
  checkSettleIdempotency,
  assertSettleIdempotency,
  atomicClaimForSettle,
  filterDuplicates,
} from '../idempotency';
import { IdempotencyError } from '../errors';

// ============================================================
// MOCK SUPABASE CLIENT
// ============================================================

function createMockSupabase(mockResponse: any = {}): SupabaseClient {
  const mock = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue(mockResponse),
          }),
          single: vi.fn().mockResolvedValue(mockResponse),
        }),
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(mockResponse),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue(mockResponse),
          }),
        }),
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue(mockResponse),
          }),
        }),
      }),
    }),
  };
  return mock as unknown as SupabaseClient;
}

// ============================================================
// SUBMIT IDEMPOTENCY TESTS
// ============================================================

describe('Submit Idempotency', () => {
  describe('checkSubmitIdempotency', () => {
    it('returns isDuplicate:false for new bet slip', async () => {
      const supabase = createMockSupabase({ data: null, error: null });
      const result = await checkSubmitIdempotency(supabase, 'new-bet-slip-001');

      expect(result.isDuplicate).toBe(false);
      expect(result.existingId).toBeUndefined();
    });

    it('returns isDuplicate:true for existing bet slip', async () => {
      const supabase = createMockSupabase({
        data: { id: 'existing-pick-001', status: 'pending', promotion_status: 'not_promoted' },
        error: null,
      });
      const result = await checkSubmitIdempotency(supabase, 'existing-bet-slip-001');

      expect(result.isDuplicate).toBe(true);
      expect(result.existingId).toBe('existing-pick-001');
      expect(result.existingState).toBe('pending');
      expect(result.reason).toContain('existing-bet-slip-001');
    });

    it('returns isDuplicate:false on DB error (fail open)', async () => {
      const supabase = createMockSupabase({
        data: null,
        error: { message: 'Database error' },
      });
      const result = await checkSubmitIdempotency(supabase, 'bet-slip-db-error');

      expect(result.isDuplicate).toBe(false);
    });

    it('returns isDuplicate:false for empty bet slip id', async () => {
      const supabase = createMockSupabase({});
      const result = await checkSubmitIdempotency(supabase, '');

      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('assertSubmitIdempotency', () => {
    it('does not throw for new bet slip', async () => {
      const supabase = createMockSupabase({ data: null, error: null });

      await expect(
        assertSubmitIdempotency(supabase, 'new-bet-slip-002')
      ).resolves.not.toThrow();
    });

    it('throws IdempotencyError for duplicate bet slip', async () => {
      const supabase = createMockSupabase({
        data: { id: 'existing-pick-002', status: 'pending' },
        error: null,
      });

      await expect(
        assertSubmitIdempotency(supabase, 'duplicate-bet-slip-001')
      ).rejects.toThrow(IdempotencyError);
    });
  });
});

// ============================================================
// POST IDEMPOTENCY TESTS
// ============================================================

describe('Post Idempotency', () => {
  describe('checkPostIdempotency', () => {
    it('returns isDuplicate:false for unposted pick', async () => {
      const supabase = createMockSupabase({
        data: { id: 'pick-001', posted_to_discord: false, discord_message_id: null },
        error: null,
      });
      const result = await checkPostIdempotency(supabase, 'pick-001');

      expect(result.isDuplicate).toBe(false);
    });

    it('returns isDuplicate:true for already posted pick', async () => {
      const supabase = createMockSupabase({
        data: { id: 'pick-002', posted_to_discord: true, discord_message_id: 'msg-123' },
        error: null,
      });
      const result = await checkPostIdempotency(supabase, 'pick-002');

      expect(result.isDuplicate).toBe(true);
      // existingId is the discord_message_id, not the pick id
      expect(result.existingId).toBe('msg-123');
      expect(result.reason).toContain('already posted');
    });

    it('returns isDuplicate:false for non-existent pick', async () => {
      const supabase = createMockSupabase({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });
      const result = await checkPostIdempotency(supabase, 'nonexistent-pick');

      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('atomicClaimForPost', () => {
    it('returns claimed:true when claim succeeds', async () => {
      const supabase = createMockSupabase({
        data: [{ id: 'pick-003' }],
        error: null,
      });
      const result = await atomicClaimForPost(supabase, 'pick-003');

      expect(result.claimed).toBe(true);
    });

    it('returns claimed:false when already claimed', async () => {
      const supabase = createMockSupabase({
        data: [],
        error: null,
      });
      const result = await atomicClaimForPost(supabase, 'pick-already-claimed');

      expect(result.claimed).toBe(false);
    });

    it('returns claimed:false on database error', async () => {
      const supabase = createMockSupabase({
        data: null,
        error: { message: 'Database error' },
      });
      const result = await atomicClaimForPost(supabase, 'pick-db-error');

      expect(result.claimed).toBe(false);
    });
  });

  describe('atomicClaimParlayForPost', () => {
    it('returns claimed:true when all legs claimed', async () => {
      const supabase = createMockSupabase({
        data: [{ id: 'leg-1' }, { id: 'leg-2' }, { id: 'leg-3' }],
        error: null,
      });
      const result = await atomicClaimParlayForPost(supabase, ['leg-1', 'leg-2', 'leg-3']);

      expect(result.claimed).toBe(true);
      expect(result.claimedCount).toBe(3);
    });

    it('returns claimed:true with partial claim (some legs already posted)', async () => {
      const supabase = createMockSupabase({
        data: [{ id: 'leg-1' }, { id: 'leg-2' }],
        error: null,
      });
      const result = await atomicClaimParlayForPost(supabase, ['leg-1', 'leg-2', 'leg-3']);

      expect(result.claimed).toBe(true);
      expect(result.claimedCount).toBe(2);
    });

    it('returns claimed:false when all legs already posted', async () => {
      const supabase = createMockSupabase({
        data: [],
        error: null,
      });
      const result = await atomicClaimParlayForPost(supabase, ['leg-1', 'leg-2', 'leg-3']);

      expect(result.claimed).toBe(false);
      expect(result.claimedCount).toBe(0);
    });
  });

  describe('assertPostIdempotency', () => {
    it('returns true for unposted pick', async () => {
      const supabase = createMockSupabase({
        data: { id: 'pick-004', posted_to_discord: false },
        error: null,
      });
      const canPost = await assertPostIdempotency(supabase, 'pick-004');

      expect(canPost).toBe(true);
    });

    it('returns false for already posted pick (silent skip)', async () => {
      const supabase = createMockSupabase({
        data: { id: 'pick-005', posted_to_discord: true, discord_message_id: 'msg-456' },
        error: null,
      });
      const canPost = await assertPostIdempotency(supabase, 'pick-005');

      expect(canPost).toBe(false);
    });
  });
});

// ============================================================
// SETTLE IDEMPOTENCY TESTS
// ============================================================

describe('Settle Idempotency', () => {
  describe('checkSettleIdempotency', () => {
    it('returns isDuplicate:false for unsettled pick', async () => {
      const supabase = createMockSupabase({
        data: { id: 'pick-006', settlement_status: 'pending', settlement_result: null },
        error: null,
      });
      const result = await checkSettleIdempotency(supabase, 'pick-006');

      expect(result.isDuplicate).toBe(false);
    });

    it('returns isDuplicate:true for already settled pick', async () => {
      const supabase = createMockSupabase({
        data: { id: 'pick-007', settlement_status: 'settled', settlement_result: 'win' },
        error: null,
      });
      const result = await checkSettleIdempotency(supabase, 'pick-007');

      expect(result.isDuplicate).toBe(true);
      expect(result.existingId).toBe('pick-007');
      // existingState is settlement_result or 'settled' if no result
      expect(result.existingState).toBe('win');
    });

    it('returns isDuplicate:true for frozen settlement', async () => {
      // Note: 'void' status is not checked by checkSettleIdempotency
      // Only settlement_frozen=true triggers duplicate detection
      const supabase = createMockSupabase({
        data: { id: 'pick-008', settlement_status: 'void', settlement_result: null, settlement_frozen: true },
        error: null,
      });
      const result = await checkSettleIdempotency(supabase, 'pick-008');

      expect(result.isDuplicate).toBe(true);
      expect(result.existingState).toBe('frozen');
    });
  });

  describe('assertSettleIdempotency', () => {
    it('returns true for unsettled pick', async () => {
      const supabase = createMockSupabase({
        data: { id: 'pick-009', settlement_status: 'pending' },
        error: null,
      });
      const canSettle = await assertSettleIdempotency(supabase, 'pick-009');

      expect(canSettle).toBe(true);
    });

    it('returns false for already settled pick', async () => {
      const supabase = createMockSupabase({
        data: { id: 'pick-010', settlement_status: 'settled', settlement_result: 'loss' },
        error: null,
      });
      const canSettle = await assertSettleIdempotency(supabase, 'pick-010');

      expect(canSettle).toBe(false);
    });
  });

  describe('atomicClaimForSettle', () => {
    it('returns claimed:true when claim succeeds', async () => {
      // Create a more specific mock for atomicClaimForSettle
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({
                  data: [{ id: 'pick-011' }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;
      const result = await atomicClaimForSettle(mockSupabase, 'pick-011', {
        settlement_status: 'settled',
        settlement_result: 'win',
      });

      expect(result.claimed).toBe(true);
    });

    it('returns claimed:false when already settled', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;
      const result = await atomicClaimForSettle(mockSupabase, 'pick-already-settled', {
        settlement_status: 'settled',
        settlement_result: 'loss',
      });

      expect(result.claimed).toBe(false);
    });
  });
});

// ============================================================
// FILTER DUPLICATES TESTS
// ============================================================

describe('filterDuplicates', () => {
  it('filters out picks that already exist (submit operation)', async () => {
    // filterDuplicates calls checkSubmitIdempotency for each pick
    // which queries by bet_slip_id
    let callCount = 0;
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => {
                callCount++;
                // First call (slip-100) returns existing pick
                if (callCount === 1) {
                  return Promise.resolve({
                    data: { id: 'existing-pick', status: 'pending' },
                    error: null,
                  });
                }
                // Subsequent calls return null (not found)
                return Promise.resolve({ data: null, error: null });
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const newPicks = [
      { bet_slip_id: 'slip-100', player_name: 'Player A' }, // Duplicate
      { bet_slip_id: 'slip-102', player_name: 'Player B' }, // New
      { bet_slip_id: 'slip-103', player_name: 'Player C' }, // New
    ];

    const filtered = await filterDuplicates(supabase, newPicks as any, 'submit');

    expect(filtered).toHaveLength(2);
    expect(filtered.map((p: any) => p.bet_slip_id)).toEqual(['slip-102', 'slip-103']);
  });

  it('returns all picks when none are duplicates', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const newPicks = [
      { bet_slip_id: 'slip-200', player_name: 'Player X' },
      { bet_slip_id: 'slip-201', player_name: 'Player Y' },
    ];

    const filtered = await filterDuplicates(supabase, newPicks as any, 'submit');

    expect(filtered).toHaveLength(2);
  });

  it('returns empty array when all are duplicates', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'existing', status: 'pending' },
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const newPicks = [
      { bet_slip_id: 'slip-300', player_name: 'Player Z' },
      { bet_slip_id: 'slip-301', player_name: 'Player W' },
    ];

    const filtered = await filterDuplicates(supabase, newPicks as any, 'submit');

    expect(filtered).toHaveLength(0);
  });
});

// ============================================================
// CONCURRENT ACCESS TESTS (Replay Scenarios)
// ============================================================

describe('Concurrent Access (Replay Scenarios)', () => {
  it('prevents double-posting when two processes claim simultaneously', async () => {
    // Simulate race condition: first claim succeeds, second fails
    let claimCount = 0;
    const supabase = createMockSupabase({});
    (supabase.from as any).mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockImplementation(() => {
              claimCount++;
              // First call succeeds, second fails (already claimed)
              return Promise.resolve({
                data: claimCount === 1 ? [{ id: 'race-pick-001' }] : [],
                error: null,
              });
            }),
          }),
        }),
      }),
    });

    // Simulate two concurrent claims
    const [result1, result2] = await Promise.all([
      atomicClaimForPost(supabase, 'race-pick-001'),
      atomicClaimForPost(supabase, 'race-pick-001'),
    ]);

    // Exactly one should succeed
    const successCount = [result1.claimed, result2.claimed].filter(Boolean).length;
    expect(successCount).toBe(1);
  });

  it('handles replay of already-submitted bet slip gracefully', async () => {
    // First submission creates the record
    const supabaseFirstCall = createMockSupabase({ data: null, error: null });
    const firstResult = await checkSubmitIdempotency(supabaseFirstCall, 'replay-slip-001');
    expect(firstResult.isDuplicate).toBe(false);

    // Second submission (replay) should detect duplicate
    const supabaseSecondCall = createMockSupabase({
      data: { id: 'created-pick', status: 'pending' },
      error: null,
    });
    const secondResult = await checkSubmitIdempotency(supabaseSecondCall, 'replay-slip-001');
    expect(secondResult.isDuplicate).toBe(true);
    expect(secondResult.existingId).toBe('created-pick');
  });

  it('handles replay of settlement attempt gracefully', async () => {
    // Pick is already settled
    const supabase = createMockSupabase({
      data: { id: 'settled-pick', settlement_status: 'settled', settlement_result: 'win' },
      error: null,
    });

    const canSettle = await assertSettleIdempotency(supabase, 'settled-pick');
    expect(canSettle).toBe(false);

    // Atomic claim should also fail
    const claimSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;
    const claimResult = await atomicClaimForSettle(claimSupabase, 'settled-pick', {
      settlement_status: 'settled',
      settlement_result: 'win',
    });
    expect(claimResult.claimed).toBe(false);
  });
});
