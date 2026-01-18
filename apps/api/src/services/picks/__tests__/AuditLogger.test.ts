import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogger } from '../AuditLogger';
import type { AuditLogEntry } from '../types';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
};

const mockTenantId = '00000000-0000-0000-0000-000000000001';
const mockUserId = 'user-123';
const mockPickId = 'pick-123';
const mockPublishId = 'publish-123';

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    auditLogger = new AuditLogger(mockSupabase as any);

    // Default mock implementation
    mockSupabase.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  describe('log', () => {
    it('should log audit event successfully', async () => {
      const entry: AuditLogEntry = {
        eventType: 'pick.submitted',
        refType: 'pick',
        refId: mockPickId,
        tenantId: mockTenantId,
        actorId: mockUserId,
        data: {
          marketType: 'points',
          line: 25.5,
          side: 'over',
        },
      };

      await auditLogger.log(entry);

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_events');
      const insertCall = mockSupabase.from().insert;
      expect(insertCall).toHaveBeenCalled();

      const insertedData = insertCall.mock.calls[0][0];
      expect(insertedData.event_type).toBe('pick.submitted');
      expect(insertedData.entity_type).toBe('pick');
      expect(insertedData.entity_id).toBe(mockPickId);
      expect(insertedData.tenant_id).toBe(mockTenantId);
      expect(insertedData.actor_id).toBe(mockUserId);
      expect(insertedData.actor_type).toBe('user');
    });

    it('should use system actor when no actorId provided', async () => {
      const entry: AuditLogEntry = {
        eventType: 'pick.submitted',
        refType: 'pick',
        refId: mockPickId,
        tenantId: mockTenantId,
        data: { test: 'data' },
      };

      await auditLogger.log(entry);

      const insertCall = mockSupabase.from().insert;
      const insertedData = insertCall.mock.calls[0][0];
      expect(insertedData.actor_type).toBe('system');
      expect(insertedData.actor_id).toBeNull();
    });

    it('should handle audit log failures gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          error: { message: 'Insert failed' },
        }),
      });

      const entry: AuditLogEntry = {
        eventType: 'pick.submitted',
        refType: 'pick',
        refId: mockPickId,
        tenantId: mockTenantId,
      };

      // Should not throw
      await expect(auditLogger.log(entry)).resolves.not.toThrow();
    });
  });

  describe('logPickSubmitted', () => {
    it('should log pick submission with correct data', async () => {
      await auditLogger.logPickSubmitted(mockPickId, mockTenantId, mockUserId, {
        marketType: 'points',
        line: 25.5,
        side: 'over',
        odds: -110,
        idempotencyKey: 'idem-123',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_events');
      const insertCall = mockSupabase.from().insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.event_type).toBe('pick.submitted');
      expect(insertedData.entity_type).toBe('pick');
      expect(insertedData.entity_id).toBe(mockPickId);
      expect(insertedData.actor_id).toBe(mockUserId);
      expect(insertedData.metadata.market_type).toBe('points');
      expect(insertedData.metadata.line).toBe(25.5);
      expect(insertedData.metadata.side).toBe('over');
    });
  });

  describe('logDiscordPosted', () => {
    it('should log Discord post event', async () => {
      await auditLogger.logDiscordPosted(mockPublishId, mockTenantId, {
        pickId: mockPickId,
        messageId: 'msg-123',
        threadId: 'thread-123',
        channel: 'DISCORD',
      });

      const insertCall = mockSupabase.from().insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.event_type).toBe('discord.posted');
      expect(insertedData.entity_type).toBe('publish');
      expect(insertedData.entity_id).toBe(mockPublishId);
      expect(insertedData.metadata.pick_id).toBe(mockPickId);
      expect(insertedData.metadata.message_id).toBe('msg-123');
      expect(insertedData.metadata.thread_id).toBe('thread-123');
    });
  });

  describe('logPickStatusChange', () => {
    it('should log pick status change', async () => {
      await auditLogger.logPickStatusChange(mockPickId, mockTenantId, {
        oldStatus: 'pending',
        newStatus: 'won',
        reason: 'Game completed',
      });

      const insertCall = mockSupabase.from().insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.event_type).toBe('pick.status_changed');
      expect(insertedData.entity_type).toBe('pick');
      expect(insertedData.metadata.old_status).toBe('pending');
      expect(insertedData.metadata.new_status).toBe('won');
      expect(insertedData.metadata.reason).toBe('Game completed');
    });
  });

  describe('logWorkflowStageChange', () => {
    it('should log workflow stage change with user actor', async () => {
      await auditLogger.logWorkflowStageChange(mockPickId, mockTenantId, mockUserId, {
        oldStage: 'draft',
        newStage: 'approved',
        reason: 'Passed grading',
      });

      const insertCall = mockSupabase.from().insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.event_type).toBe('pick.workflow_changed');
      expect(insertedData.actor_id).toBe(mockUserId);
      expect(insertedData.metadata.old_stage).toBe('draft');
      expect(insertedData.metadata.new_stage).toBe('approved');
    });

    it('should log workflow stage change without user actor', async () => {
      await auditLogger.logWorkflowStageChange(mockPickId, mockTenantId, undefined, {
        oldStage: 'draft',
        newStage: 'approved',
      });

      const insertCall = mockSupabase.from().insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.event_type).toBe('pick.workflow_changed');
      expect(insertedData.actor_type).toBe('system');
    });
  });

  describe('logPublishFailed', () => {
    it('should log publish failure with error details', async () => {
      await auditLogger.logPublishFailed(mockPublishId, mockTenantId, {
        pickId: mockPickId,
        error: 'Discord API timeout',
        attempts: 2,
      });

      const insertCall = mockSupabase.from().insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.event_type).toBe('publish.failed');
      expect(insertedData.entity_type).toBe('publish');
      expect(insertedData.metadata.error).toBe('Discord API timeout');
      expect(insertedData.metadata.attempts).toBe(2);
    });
  });

  describe('logIdempotentDuplicate', () => {
    it('should log idempotent duplicate detection', async () => {
      const originalCreatedAt = '2025-01-01T00:00:00Z';

      await auditLogger.logIdempotentDuplicate(mockPickId, mockTenantId, {
        idempotencyKey: 'idem-123',
        originalCreatedAt,
      });

      const insertCall = mockSupabase.from().insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.event_type).toBe('pick.idempotent_duplicate');
      expect(insertedData.entity_type).toBe('pick');
      expect(insertedData.metadata.idempotency_key).toBe('idem-123');
      expect(insertedData.metadata.original_created_at).toBe(originalCreatedAt);
    });
  });
});
