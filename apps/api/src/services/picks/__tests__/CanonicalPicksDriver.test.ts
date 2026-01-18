import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanonicalPicksDriver } from '../CanonicalPicksDriver';
import type { PickSubmissionInput } from '../types';

// Mock the pgrest-reload module
vi.mock('../../../lib/pgrest-reload', () => ({
  forcePostgrestReload: vi.fn().mockResolvedValue(undefined),
  isDatabaseConnectionConfigured: vi.fn().mockReturnValue(true),
}));

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
};

// Mock data
const mockTenantId = '00000000-0000-0000-0000-000000000001';
const mockUserId = 'user-123';
const mockPickId = 'pick-123';
const mockIdempotencyKey = 'idem-key-123';

describe('CanonicalPicksDriver', () => {
  let driver: CanonicalPicksDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    driver = new CanonicalPicksDriver(mockSupabase as any);

    // Default mock implementations
    mockSupabase.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: mockPickId,
              tenant_id: mockTenantId,
              user_id: mockUserId,
              selection: 'over',
              odds: -110,
              stake: 1.0,
              status: 'pending',
              created_at: new Date().toISOString(),
              metadata: {},
            },
            error: null,
          }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    mockSupabase.rpc.mockResolvedValue({ error: null });
  });

  describe('insertPick', () => {
    it('should successfully insert a new pick', async () => {
      const input: PickSubmissionInput = {
        tenantId: mockTenantId,
        userId: mockUserId,
        league: 'NBA',
        playerName: 'LeBron James',
        marketType: 'points',
        line: 25.5,
        side: 'over',
        odds: -110,
        stake: 1.0,
        userScore: 8,
      };

      const result = await driver.insertPick(input);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockPickId);
      expect(result.tenantId).toBe(mockTenantId);
      expect(result.userId).toBe(mockUserId);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('set_tenant_context', {
        p_tenant_id: mockTenantId,
        p_user_id: mockUserId,
      });
    });

    it('should return existing pick when idempotency key matches', async () => {
      const existingPick = {
        id: 'existing-pick-id',
        tenant_id: mockTenantId,
        user_id: mockUserId,
        idempotency_key: mockIdempotencyKey,
        selection: 'over',
        odds: -110,
        stake: 1.0,
        status: 'pending',
        created_at: '2025-01-01T00:00:00Z',
        metadata: {},
      };

      // Mock existing pick found
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: existingPick, error: null }),
        }),
      });

      const input: PickSubmissionInput = {
        tenantId: mockTenantId,
        userId: mockUserId,
        league: 'NBA',
        playerName: 'LeBron James',
        marketType: 'points',
        line: 25.5,
        side: 'over',
        idempotencyKey: mockIdempotencyKey,
      };

      const result = await driver.insertPick(input);

      expect(result.id).toBe('existing-pick-id');
      expect(result.idempotencyKey).toBe(mockIdempotencyKey);
    });

    it('should handle bet_slip_id deduplication', async () => {
      const betSlipId = 'bet-slip-123';
      const existingPick = {
        id: 'existing-pick-id',
        tenant_id: mockTenantId,
        user_id: mockUserId,
        bet_slip_id: betSlipId,
        selection: 'over',
        odds: -110,
        stake: 1.0,
        status: 'pending',
        created_at: '2025-01-01T00:00:00Z',
        metadata: {},
      };

      // Mock for idempotency key check (returns nothing)
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn()
          .mockResolvedValueOnce({ data: null, error: null }) // idempotency check
          .mockResolvedValueOnce({ data: existingPick, error: null }), // bet_slip_id check
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });

      const input: PickSubmissionInput = {
        tenantId: mockTenantId,
        userId: mockUserId,
        league: 'NBA',
        playerName: 'LeBron James',
        marketType: 'points',
        line: 25.5,
        side: 'over',
        betSlipId,
      };

      const result = await driver.insertPick(input);

      expect(result.id).toBe('existing-pick-id');
      expect(result.betSlipId).toBe(betSlipId);
    });

    it('should throw error when insert fails', async () => {
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Insert failed' },
            }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const input: PickSubmissionInput = {
        tenantId: mockTenantId,
        userId: mockUserId,
        league: 'NBA',
        playerName: 'LeBron James',
        marketType: 'points',
        line: 25.5,
        side: 'over',
      };

      await expect(driver.insertPick(input)).rejects.toThrow('Failed to insert into picks');
    });

    it('should retry insert after schema reload on "column does not exist" error', async () => {
      const { forcePostgrestReload } = await import('../../../lib/pgrest-reload');

      // First call fails with stale schema error, second call succeeds
      let callCount = 0;
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(async () => {
              callCount++;
              if (callCount === 1) {
                return {
                  data: null,
                  error: { message: 'column "bet_slip_id" does not exist' },
                };
              }
              return {
                data: {
                  id: mockPickId,
                  tenant_id: mockTenantId,
                  user_id: mockUserId,
                  selection: 'over',
                  odds: -110,
                  stake: 1.0,
                  status: 'pending',
                  created_at: new Date().toISOString(),
                  metadata: {},
                },
                error: null,
              };
            }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const input: PickSubmissionInput = {
        tenantId: mockTenantId,
        userId: mockUserId,
        league: 'NBA',
        playerName: 'LeBron James',
        marketType: 'points',
        line: 25.5,
        side: 'over',
      };

      const result = await driver.insertPick(input);

      expect(result.id).toBe(mockPickId);
      expect(forcePostgrestReload).toHaveBeenCalledTimes(1);
      expect(callCount).toBe(2); // First attempt + retry
    });

    it('should retry insert after schema reload on "relation does not exist" error', async () => {
      const { forcePostgrestReload } = await import('../../../lib/pgrest-reload');

      let callCount = 0;
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(async () => {
              callCount++;
              if (callCount === 1) {
                return {
                  data: null,
                  error: { message: 'relation "picks" does not exist' },
                };
              }
              return {
                data: {
                  id: mockPickId,
                  tenant_id: mockTenantId,
                  user_id: mockUserId,
                  selection: 'over',
                  odds: -110,
                  stake: 1.0,
                  status: 'pending',
                  created_at: new Date().toISOString(),
                  metadata: {},
                },
                error: null,
              };
            }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const input: PickSubmissionInput = {
        tenantId: mockTenantId,
        userId: mockUserId,
        league: 'NBA',
        playerName: 'LeBron James',
        marketType: 'points',
        line: 25.5,
        side: 'over',
      };

      const result = await driver.insertPick(input);

      expect(result.id).toBe(mockPickId);
      expect(forcePostgrestReload).toHaveBeenCalledTimes(1);
      expect(callCount).toBe(2);
    });

    it('should not retry on non-schema-related errors', async () => {
      const { forcePostgrestReload } = await import('../../../lib/pgrest-reload');

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Unique constraint violation' },
            }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const input: PickSubmissionInput = {
        tenantId: mockTenantId,
        userId: mockUserId,
        league: 'NBA',
        playerName: 'LeBron James',
        marketType: 'points',
        line: 25.5,
        side: 'over',
      };

      await expect(driver.insertPick(input)).rejects.toThrow('Failed to insert into picks');
      expect(forcePostgrestReload).not.toHaveBeenCalled();
    });
  });

  describe('createPublishRecord', () => {
    it('should create publish record for outbox pattern', async () => {
      const publishData = {
        id: 'publish-123',
        pick_id: mockPickId,
        tenant_id: mockTenantId,
        channel: 'DISCORD',
        status: 'pending',
        thread_id: 'thread-123',
        attempts: 0,
        created_at: new Date().toISOString(),
      };

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: publishData, error: null }),
          }),
        }),
      });

      const result = await driver.createPublishRecord(mockPickId, mockTenantId, {
        channel: 'DISCORD',
        threadId: 'thread-123',
      });

      expect(result.id).toBe('publish-123');
      expect(result.pickId).toBe(mockPickId);
      expect(result.channel).toBe('DISCORD');
      expect(result.status).toBe('pending');
    });
  });

  describe('updatePublishStatus', () => {
    it('should update publish status to sent', async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      await driver.updatePublishStatus('publish-123', 'sent', {
        externalMessageId: 'msg-123',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('pick_publish');
    });

    it('should handle failed status with retry calculation', async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      await driver.updatePublishStatus('publish-123', 'failed', {
        error: 'Discord API error',
        attempts: 1,
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('pick_publish');
    });
  });

  describe('checkTablesExist', () => {
    it('should return true when both tables exist', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await driver.checkTablesExist();

      expect(result).toBe(true);
    });

    it('should return false when picks table is missing', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'picks') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ error: { message: 'Table not found' } }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      });

      const result = await driver.checkTablesExist();

      expect(result).toBe(false);
    });

    it('should return false when pick_publish table is missing', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'pick_publish') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ error: { message: 'Table not found' } }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      });

      const result = await driver.checkTablesExist();

      expect(result).toBe(false);
    });
  });
});
