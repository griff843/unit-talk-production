/**
 * Tests for the replay API route handler.
 * SPRINT-054-LAYER3-PHASE10-REPLAY-ENDPOINT
 *
 * Covers:
 *   1. Feature gate disabled → 503
 *   2. Auth required → 401 when no identity
 *   3. Reason validation → 400 when reason < 10 chars
 *   4. Invalid action → 400
 *   5. Preview action → 200 with event count
 *   6. Grading replay → startWorkflow called with actorId from auth context
 *   7. Alert reemission → startWorkflow called with actorId from auth context
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks (must be before imports that use them) ─────────────────────────

vi.mock('@/lib/auth', () => ({
  requireOperatorIdentity: vi.fn(),
  getOperatorIdentity: vi.fn(),
}));

vi.mock('@/lib/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rbac')>('@/lib/rbac');
  return {
    ...actual,
    RBACService: {
      requirePermission: vi.fn().mockResolvedValue(undefined),
      logAudit: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock('@/lib/telemetry', () => ({
  UnitTalkTracing: {
    startTemporalSpan: vi.fn().mockReturnValue({ end: vi.fn() }),
  },
}));

// Chainable Supabase query builder that resolves to { data, error }
function makeQueryBuilder(data: unknown[] = [], error: null | { message: string } = null) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnThis(),
    // Makes `await queryBuilder` resolve to { data, error }
    then: (resolve: (value: { data: unknown[]; error: null | { message: string } }) => void) =>
      resolve({ data, error }),
  };
  return chain;
}

const mockTemporalService = {
  startWorkflow: vi.fn().mockResolvedValue({ workflowId: 'test-wf-id', runId: 'test-run-id' }),
};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/temporal', () => ({
  temporalService: mockTemporalService,
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────

import { POST } from '@/app/api/replay/route';
import { requireOperatorIdentity } from '@/lib/auth';
import { RBACService } from '@/lib/rbac';
import { supabase } from '@/lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────

function mockRequest(body: unknown, headers: Record<string, string> = {}) {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
    json: vi.fn().mockResolvedValue(body),
  } as unknown as import('next/server').NextRequest;
}

const VALID_CRITERIA = {
  timeRange: '1h',
  reason: 'Testing replay functionality in CI',
  dryRun: false,
  batchSize: 5,
  priority: 'normal',
};

// ─── Test setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ENABLE_REPLAY;

  // Default: authenticated operator
  vi.mocked(requireOperatorIdentity).mockReturnValue({
    userId: 'test-operator',
    source: 'header',
  });

  // Default: RBAC passes
  vi.mocked(RBACService.requirePermission).mockResolvedValue(undefined);

  // Default: empty events table
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'events' || table === 'workflow_executions') {
      return makeQueryBuilder() as ReturnType<typeof supabase.from>;
    }
    return makeQueryBuilder() as ReturnType<typeof supabase.from>;
  });
});

afterEach(() => {
  delete process.env.ENABLE_REPLAY;
});

// ─── Tests ────────────────────────────────────────────────────────────────

describe('POST /api/replay', () => {
  // -------------------------------------------------------------------------
  // 1. Feature gate
  // -------------------------------------------------------------------------
  describe('feature gate', () => {
    it('returns 503 when ENABLE_REPLAY is not set', async () => {
      const req = mockRequest({ action: 'preview', criteria: VALID_CRITERIA });
      const response = await POST(req);

      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.code).toBe('FEATURE_NOT_ENABLED');
    });

    it('returns 503 when ENABLE_REPLAY is "false"', async () => {
      process.env.ENABLE_REPLAY = 'false';
      const req = mockRequest({ action: 'preview', criteria: VALID_CRITERIA });
      const response = await POST(req);

      expect(response.status).toBe(503);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Auth check
  // -------------------------------------------------------------------------
  describe('authentication', () => {
    it('returns 401 when requireOperatorIdentity returns null', async () => {
      process.env.ENABLE_REPLAY = 'true';
      vi.mocked(requireOperatorIdentity).mockReturnValue(
        null as unknown as ReturnType<typeof requireOperatorIdentity>
      );

      const req = mockRequest({ action: 'preview', criteria: VALID_CRITERIA });
      const response = await POST(req);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.code).toBe('AUTH_REQUIRED');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Reason validation
  // -------------------------------------------------------------------------
  describe('reason validation', () => {
    it('returns 400 when reason is too short', async () => {
      process.env.ENABLE_REPLAY = 'true';

      const req = mockRequest({
        action: 'preview',
        criteria: { ...VALID_CRITERIA, reason: 'too short' },
      });
      const response = await POST(req);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('INVALID_REASON');
    });

    it('returns 400 when reason is exactly 9 chars', async () => {
      process.env.ENABLE_REPLAY = 'true';

      const req = mockRequest({
        action: 'preview',
        criteria: { ...VALID_CRITERIA, reason: '123456789' },
      });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });

    it('accepts reason with exactly 10 characters', async () => {
      process.env.ENABLE_REPLAY = 'true';

      const req = mockRequest({
        action: 'preview',
        criteria: { ...VALID_CRITERIA, reason: '1234567890' },
      });
      const response = await POST(req);

      // Should not be 400 for reason validation (may succeed or fail for other reasons)
      const body = await response.json();
      expect(body.code).not.toBe('INVALID_REASON');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Invalid action
  // -------------------------------------------------------------------------
  describe('action validation', () => {
    it('returns 400 for unknown action', async () => {
      process.env.ENABLE_REPLAY = 'true';

      const req = mockRequest({ action: 'unknown-action', criteria: VALID_CRITERIA });
      const response = await POST(req);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('INVALID_ACTION');
    });

    it('returns 400 for missing action', async () => {
      process.env.ENABLE_REPLAY = 'true';

      const req = mockRequest({ criteria: VALID_CRITERIA });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Preview action
  // -------------------------------------------------------------------------
  describe('preview action', () => {
    it('returns 200 with event count for preview', async () => {
      process.env.ENABLE_REPLAY = 'true';

      // Return 3 mock events from the query
      vi.mocked(supabase.from).mockImplementation(() => {
        return makeQueryBuilder([
          { id: 'e1', event_type: 'grading.completed.v1', aggregate_id: 'a1' },
          { id: 'e2', event_type: 'grading.completed.v1', aggregate_id: 'a2' },
          { id: 'e3', event_type: 'ticket.submitted.v1', aggregate_id: 'a3' },
        ]) as ReturnType<typeof supabase.from>;
      });

      const req = mockRequest({ action: 'preview', criteria: VALID_CRITERIA });
      const response = await POST(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.eventCount).toBe(3);
      expect(body.success).toBe(true);
      expect(body.replayId).toMatch(/^preview-/);
    });

    it('does not call startWorkflow for preview action', async () => {
      process.env.ENABLE_REPLAY = 'true';

      vi.mocked(supabase.from).mockImplementation(
        () => makeQueryBuilder([]) as ReturnType<typeof supabase.from>
      );

      const req = mockRequest({ action: 'preview', criteria: VALID_CRITERIA });
      await POST(req);

      expect(mockTemporalService.startWorkflow).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 6. Grading replay — actor identity
  // -------------------------------------------------------------------------
  describe('rerun-grading action', () => {
    it('returns success: false when no events found', async () => {
      process.env.ENABLE_REPLAY = 'true';

      vi.mocked(supabase.from).mockImplementation(
        () => makeQueryBuilder([]) as ReturnType<typeof supabase.from>
      );

      const req = mockRequest({ action: 'rerun-grading', criteria: VALID_CRITERIA });
      const response = await POST(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.eventCount).toBe(0);
    });

    it('calls startWorkflow with actorId from auth context when events found', async () => {
      process.env.ENABLE_REPLAY = 'true';

      const mockEvents = [
        {
          id: 'e1',
          event_type: 'ticket.submitted.v1',
          aggregate_id: 'a1',
          aggregate_type: 'pick',
          event_data: {},
          metadata: {},
        },
        {
          id: 'e2',
          event_type: 'grading.completed.v1',
          aggregate_id: 'a2',
          aggregate_type: 'pick',
          event_data: {},
          metadata: {},
        },
      ];

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'events') {
          callCount++;
          // First call: fetchEventsForCriteria → return events
          // Second call: insert replay events → success
          if (callCount === 1) {
            return makeQueryBuilder(mockEvents) as ReturnType<typeof supabase.from>;
          }
          return makeQueryBuilder() as ReturnType<typeof supabase.from>;
        }
        // workflow_executions insert
        return makeQueryBuilder() as ReturnType<typeof supabase.from>;
      });

      const req = mockRequest({ action: 'rerun-grading', criteria: VALID_CRITERIA });
      await POST(req);

      expect(mockTemporalService.startWorkflow).toHaveBeenCalledWith(
        'replayGradingWorkflow',
        expect.stringMatching(/^grading-replay-/),
        [
          expect.objectContaining({
            actorId: 'test-operator',
            replayReason: VALID_CRITERIA.reason,
          }),
        ]
      );
    });

    it('actor identity in workflow args matches auth context userId', async () => {
      process.env.ENABLE_REPLAY = 'true';

      // Override identity for this test
      vi.mocked(requireOperatorIdentity).mockReturnValue({
        userId: 'specific-operator-42',
        source: 'header',
      });

      const mockEvents = [
        {
          id: 'e1',
          event_type: 'ticket.submitted.v1',
          aggregate_id: 'a1',
          aggregate_type: 'pick',
          event_data: {},
          metadata: {},
        },
      ];

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'events') {
          callCount++;
          if (callCount === 1) {
            return makeQueryBuilder(mockEvents) as ReturnType<typeof supabase.from>;
          }
          return makeQueryBuilder() as ReturnType<typeof supabase.from>;
        }
        return makeQueryBuilder() as ReturnType<typeof supabase.from>;
      });

      await POST(mockRequest({ action: 'rerun-grading', criteria: VALID_CRITERIA }));

      const [, , [workflowInput]] = mockTemporalService.startWorkflow.mock.calls[0];
      expect((workflowInput as { actorId: string }).actorId).toBe('specific-operator-42');
    });
  });

  // -------------------------------------------------------------------------
  // 7. Alert reemission — actor identity
  // -------------------------------------------------------------------------
  describe('reemit-alerts action', () => {
    it('calls startWorkflow with actorId from auth context', async () => {
      process.env.ENABLE_REPLAY = 'true';

      const mockGradingEvents = [
        {
          id: 'g1',
          event_type: 'grading.completed.v1',
          aggregate_id: 'a1',
          aggregate_type: 'pick',
          event_data: {},
          metadata: {},
        },
      ];

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'events') {
          callCount++;
          if (callCount === 1) {
            return makeQueryBuilder(mockGradingEvents) as ReturnType<typeof supabase.from>;
          }
          return makeQueryBuilder() as ReturnType<typeof supabase.from>;
        }
        return makeQueryBuilder() as ReturnType<typeof supabase.from>;
      });

      await POST(mockRequest({ action: 'reemit-alerts', criteria: VALID_CRITERIA }));

      expect(mockTemporalService.startWorkflow).toHaveBeenCalledWith(
        'alertReemissionWorkflow',
        expect.stringMatching(/^alert-reemit-/),
        [
          expect.objectContaining({
            actorId: 'test-operator',
            reemissionReason: VALID_CRITERIA.reason,
          }),
        ]
      );
    });
  });
});
