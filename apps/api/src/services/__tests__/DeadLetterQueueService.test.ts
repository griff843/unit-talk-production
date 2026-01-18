/**
 * Dead Letter Queue Service Tests
 *
 * Phase 1 Modernization - DLQ Support
 */

import { DeadLetterQueueService } from '../DeadLetterQueueService';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('DeadLetterQueueService', () => {
  let service: DeadLetterQueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeadLetterQueueService(mockSupabase as any, mockLogger as any);
  });

  describe('addToDLQ', () => {
    it('should successfully add an entry to the DLQ', async () => {
      const mockId = 'dlq-id-12345';
      mockSupabase.single.mockResolvedValue({
        data: { id: mockId },
        error: null,
      });

      const result = await service.addToDLQ({
        source: 'bridge_worker',
        original_event_id: 'event-123',
        original_table: 'bridge_outbox',
        payload: { bet_slip_id: 'slip-456' },
        error_message: 'Test error',
        retry_count: 3,
        max_retries_attempted: 3,
      });

      expect(result).toBe(mockId);
      expect(mockSupabase.from).toHaveBeenCalledWith('dead_letter_queue');
      expect(mockSupabase.insert).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Event added to DLQ',
        expect.objectContaining({
          dlq_id: mockId,
          source: 'bridge_worker',
        })
      );
    });

    it('should handle errors when adding to DLQ', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await service.addToDLQ({
        source: 'bridge_worker',
        payload: { test: 'data' },
        error_message: 'Test error',
      });

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to add event to DLQ',
        expect.any(Object)
      );
    });
  });

  describe('getBySource', () => {
    it('should retrieve entries by source', async () => {
      const mockEntries = [
        { id: '1', source: 'bridge_worker', error_message: 'Error 1' },
        { id: '2', source: 'bridge_worker', error_message: 'Error 2' },
      ];

      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.is.mockReturnThis();
      mockSupabase.order.mockReturnThis();
      mockSupabase.limit.mockResolvedValue({
        data: mockEntries,
        error: null,
      });

      const result = await service.getBySource('bridge_worker');

      expect(result).toEqual(mockEntries);
      expect(mockSupabase.from).toHaveBeenCalledWith('dead_letter_queue');
      expect(mockSupabase.eq).toHaveBeenCalledWith('source', 'bridge_worker');
    });

    it('should return empty array on error', async () => {
      mockSupabase.limit.mockResolvedValue({
        data: null,
        error: { message: 'Query error' },
      });

      const result = await service.getBySource('bridge_worker');

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('should retrieve a specific DLQ entry', async () => {
      const mockEntry = {
        id: 'dlq-123',
        source: 'bridge_worker',
        error_message: 'Test error',
        payload: { test: 'data' },
      };

      mockSupabase.single.mockResolvedValue({
        data: mockEntry,
        error: null,
      });

      const result = await service.getById('dlq-123');

      expect(result).toEqual(mockEntry);
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'dlq-123');
    });

    it('should return null if entry not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await service.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('markForReplay', () => {
    it('should mark an entry for replay', async () => {
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockResolvedValue({
        error: null,
      });

      const result = await service.markForReplay('dlq-123', {
        requeued_by: 'test-user',
        notes: 'Manual replay',
      });

      expect(result).toBe(true);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          requeued_by: 'test-user',
          replay_status: 'pending',
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'DLQ entry marked for replay',
        expect.any(Object)
      );
    });

    it('should return false on error', async () => {
      mockSupabase.eq.mockResolvedValue({
        error: { message: 'Update failed' },
      });

      const result = await service.markForReplay('dlq-123', {
        requeued_by: 'test-user',
      });

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('updateReplayStatus', () => {
    it('should update replay status to succeeded', async () => {
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockResolvedValue({
        error: null,
      });

      const result = await service.updateReplayStatus('dlq-123', 'succeeded');

      expect(result).toBe(true);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          replay_status: 'succeeded',
        })
      );
    });

    it('should update replay status to failed with error message', async () => {
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockResolvedValue({
        error: null,
      });

      const result = await service.updateReplayStatus(
        'dlq-123',
        'failed',
        'Replay processing error'
      );

      expect(result).toBe(true);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          replay_status: 'failed',
          replay_error: 'Replay processing error',
        })
      );
    });
  });

  describe('getSummary', () => {
    it('should retrieve DLQ summary statistics', async () => {
      const mockSummary = [
        {
          source: 'bridge_worker',
          total_events: 10,
          pending_events: 8,
          replayed_successfully: 2,
          replay_failed: 0,
        },
      ];

      mockSupabase.select.mockResolvedValue({
        data: mockSummary,
        error: null,
      });

      const result = await service.getSummary();

      expect(result).toEqual(mockSummary);
      expect(mockSupabase.from).toHaveBeenCalledWith('vw_dlq_summary');
    });
  });

  describe('getRecent', () => {
    it('should retrieve recent DLQ events', async () => {
      const mockRecent = [
        { id: '1', created_at: '2025-01-30T10:00:00Z' },
        { id: '2', created_at: '2025-01-30T09:00:00Z' },
      ];

      mockSupabase.limit.mockResolvedValue({
        data: mockRecent,
        error: null,
      });

      const result = await service.getRecent(50);

      expect(result).toEqual(mockRecent);
      expect(mockSupabase.from).toHaveBeenCalledWith('vw_dlq_recent');
      expect(mockSupabase.limit).toHaveBeenCalledWith(50);
    });
  });
});
