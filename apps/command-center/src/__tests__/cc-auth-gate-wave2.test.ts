/**
 * Auth-gate enforcement tests for all CC API routes hardened in
 * SPRINT-077-LAYER3-PHASE10-CC-AUTH-GATE-WAVE2.
 *
 * Each test verifies that an unauthenticated request returns 401 Unauthorized
 * before any business logic or database access is executed.
 *
 * Covers 36 tests across 27 newly gated route handlers:
 *  analytics, grading/agents, grading/picks, llm/models, llm/requests,
 *  llm/test, monitoring, monitoring/rollout-status, operations, ops/cappers,
 *  ops/credit-usage, ops/picks/[id]/[action], ops/quarantine-metrics,
 *  ops-confidence, ops-recap, pipeline/promo-backlog, pipeline/recent-promotions,
 *  redis, services, sync, system, system/metrics, temporal/health,
 *  temporal/workflows, ccc/actions, ccc/plays
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Global mocks (must be declared before any route imports) ─────────────────

vi.mock('@/lib/auth', () => ({
  requireOperatorIdentity: vi.fn(),
  getOperatorIdentity: vi.fn(),
  enforcePermission: vi.fn(),
}));

vi.mock('@/lib/supabase', async () => ({
  supabase: new Proxy({}, { get: () => vi.fn() }),
  createClient: vi.fn(() => new Proxy({}, { get: () => vi.fn() })),
  getSupabaseClient: vi.fn(() => new Proxy({}, { get: () => vi.fn() })),
  dbOperations: {
    getUsers: vi.fn().mockResolvedValue([]),
    getUserById: vi.fn().mockResolvedValue(null),
    updateUser: vi.fn().mockResolvedValue(null),
    createSecurityEvent: vi.fn().mockResolvedValue(null),
    getAgents: vi.fn().mockResolvedValue([]),
    getAgentById: vi.fn().mockResolvedValue(null),
    updateAgent: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/lib/redis', () => ({
  redisClient: new Proxy({}, { get: () => vi.fn() }),
  getRedisClient: vi.fn(() => new Proxy({}, { get: () => vi.fn() })),
}));

vi.mock('@/lib/systemMetrics', () => ({
  systemMetrics: {
    collectMetrics: vi.fn().mockResolvedValue({}),
    getSystemHealth: vi.fn().mockResolvedValue({ status: 'healthy', issues: [], metrics: {} }),
    getFormattedMetrics: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/lib/dockerServiceMonitor', () => ({
  dockerServiceMonitor: {
    getCurrentMetrics: vi.fn().mockResolvedValue({ services: [], system: {} }),
    controlService: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  },
}));

vi.mock('@/lib/apiHealthMonitoring', () => ({
  apiHealthMonitor: {
    getStatus: vi.fn().mockResolvedValue({}),
    checkAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/lib/dataIngestionMonitor', () => ({
  dataIngestionMonitor: {
    getStatus: vi.fn().mockResolvedValue({}),
    getLogs: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: vi.fn(() => new Proxy({}, { get: () => vi.fn() })),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({})),
}));

vi.mock('@temporalio/client', () => ({
  Client: vi.fn().mockImplementation(() => ({
    workflow: {
      list: vi.fn().mockReturnValue([]),
      getHandle: vi.fn(),
      start: vi.fn(),
    },
    connection: { close: vi.fn() },
  })),
  Connection: {
    lazy: vi.fn().mockResolvedValue({}),
    connect: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/lib/ccc/rankingEngine', () => ({
  processPlays: vi
    .fn()
    .mockReturnValue({ plays: [], eliminationBanner: { totalRemoved: 0, removedByReason: {} } }),
  DEFAULT_GATE_CONFIG: {
    EDGE_MIN: 0.03,
    U_MAX: 0.12,
    CLV_GATE_ENABLED: false,
    MIN_BOOKS: 3,
  },
  RANKING_VERSION: 'ccc_rank_v1.0.0',
}));

vi.mock('@/app/api/analytics/databaseMetrics', () => ({
  getUserMetrics: vi.fn().mockResolvedValue({}),
  getAgentMetrics: vi.fn().mockResolvedValue({}),
  getSecurityMetrics: vi.fn().mockResolvedValue({}),
  getPickMetrics: vi.fn().mockResolvedValue({}),
  getRevenueMetrics: vi.fn().mockResolvedValue({}),
  getPerformanceMetrics: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/telemetry', () => ({
  UnitTalkTracing: {
    startAgentSpan: vi.fn(() => ({})),
    recordSuccess: vi.fn(),
    recordError: vi.fn(),
    endSpan: vi.fn(),
  },
}));

vi.mock('@/types/analytics', () => ({
  MetricType: {},
}));

// ─── Route imports (after mocks) ──────────────────────────────────────────────

import { GET as analyticsGET } from '@/app/api/analytics/route';
import { GET as cccActionsGET, POST as cccActionsPOST } from '@/app/api/ccc/actions/route';
import { GET as cccPlaysGET } from '@/app/api/ccc/plays/route';
import { GET as gradingAgentsGET } from '@/app/api/grading/agents/route';
import { GET as gradingPicksGET, POST as gradingPicksPOST } from '@/app/api/grading/picks/route';
import { GET as llmModelsGET } from '@/app/api/llm/models/route';
import { GET as llmRequestsGET } from '@/app/api/llm/requests/route';
import { POST as llmTestPOST } from '@/app/api/llm/test/route';
import { GET as monitoringRolloutGET } from '@/app/api/monitoring/rollout-status/route';
import { GET as monitoringGET, POST as monitoringPOST } from '@/app/api/monitoring/route';
import { GET as operationsGET, POST as operationsPOST } from '@/app/api/operations/route';
import { GET as opsCapperGET } from '@/app/api/ops/cappers/route';
import { GET as opsCreditUsageGET } from '@/app/api/ops/credit-usage/route';
import { POST as opsPickActionPOST } from '@/app/api/ops/picks/[id]/[action]/route';
import { GET as opsQuarantineMetricsGET } from '@/app/api/ops/quarantine-metrics/route';
import { GET as opsConfidenceGET } from '@/app/api/ops-confidence/route';
import { POST as opsRecapPOST } from '@/app/api/ops-recap/route';
import { GET as promoBacklogGET } from '@/app/api/pipeline/promo-backlog/route';
import { GET as recentPromotionsGET } from '@/app/api/pipeline/recent-promotions/route';
import { GET as redisGET, POST as redisPOST, DELETE as redisDELETE } from '@/app/api/redis/route';
import { GET as servicesGET, POST as servicesPOST } from '@/app/api/services/route';
import { GET as syncGET } from '@/app/api/sync/route';
import { GET as systemMetricsGET, POST as systemMetricsPOST } from '@/app/api/system/metrics/route';
import { GET as systemGET, POST as systemPOST } from '@/app/api/system/route';
import { GET as temporalHealthGET } from '@/app/api/temporal/health/route';
import {
  GET as temporalWorkflowsGET,
  POST as temporalWorkflowsPOST,
} from '@/app/api/temporal/workflows/route';
import { requireOperatorIdentity } from '@/lib/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockRequireOperatorIdentity = vi.mocked(requireOperatorIdentity);

function setNoAuth() {
  mockRequireOperatorIdentity.mockReturnValue(null);
}

function makeGET(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

function makePOST(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeDELETE(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method: 'DELETE' });
}

async function assert401(res: Response): Promise<void> {
  expect(res.status).toBe(401);
  const body = await res.json();
  expect(body.success).toBe(false);
  expect(body.error).toBe('Unauthorized');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SPRINT-077 CC Auth Gate Wave 2 — 401 enforcement for newly hardened routes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // ── analytics ────────────────────────────────────────────────────────────────

  it('GET /api/analytics → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await analyticsGET(makeGET('/api/analytics')));
  });

  // ── grading ──────────────────────────────────────────────────────────────────

  it('GET /api/grading/agents → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await gradingAgentsGET(makeGET('/api/grading/agents')));
  });

  it('GET /api/grading/picks → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await gradingPicksGET(makeGET('/api/grading/picks')));
  });

  it('POST /api/grading/picks → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await gradingPicksPOST(makePOST('/api/grading/picks')));
  });

  // ── llm ──────────────────────────────────────────────────────────────────────

  it('GET /api/llm/models → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await llmModelsGET(makeGET('/api/llm/models')));
  });

  it('GET /api/llm/requests → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await llmRequestsGET(makeGET('/api/llm/requests')));
  });

  it('POST /api/llm/test → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await llmTestPOST(makePOST('/api/llm/test')));
  });

  // ── monitoring ───────────────────────────────────────────────────────────────

  it('GET /api/monitoring/rollout-status → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await monitoringRolloutGET(makeGET('/api/monitoring/rollout-status')));
  });

  it('GET /api/monitoring → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await monitoringGET(makeGET('/api/monitoring')));
  });

  it('POST /api/monitoring → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await monitoringPOST(makePOST('/api/monitoring')));
  });

  // ── operations ───────────────────────────────────────────────────────────────

  it('GET /api/operations → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await operationsGET(makeGET('/api/operations')));
  });

  it('POST /api/operations → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await operationsPOST(makePOST('/api/operations')));
  });

  // ── ops ──────────────────────────────────────────────────────────────────────

  it('GET /api/ops/cappers → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await opsCapperGET(makeGET('/api/ops/cappers')));
  });

  it('GET /api/ops/credit-usage → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await opsCreditUsageGET(makeGET('/api/ops/credit-usage')));
  });

  it('POST /api/ops/picks/[id]/[action] → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(
      await opsPickActionPOST(makePOST('/api/ops/picks/pick-123/approve'), {
        params: Promise.resolve({ id: 'pick-123', action: 'approve' }),
      })
    );
  });

  it('GET /api/ops/quarantine-metrics → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await opsQuarantineMetricsGET(makeGET('/api/ops/quarantine-metrics')));
  });

  // ── ops-confidence / ops-recap ───────────────────────────────────────────────

  it('GET /api/ops-confidence → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await opsConfidenceGET(makeGET('/api/ops-confidence')));
  });

  it('POST /api/ops-recap → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await opsRecapPOST(makePOST('/api/ops-recap')));
  });

  // ── pipeline ─────────────────────────────────────────────────────────────────

  it('GET /api/pipeline/promo-backlog → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await promoBacklogGET(makeGET('/api/pipeline/promo-backlog')));
  });

  it('GET /api/pipeline/recent-promotions → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await recentPromotionsGET(makeGET('/api/pipeline/recent-promotions')));
  });

  // ── redis ────────────────────────────────────────────────────────────────────

  it('GET /api/redis → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await redisGET(makeGET('/api/redis')));
  });

  it('POST /api/redis → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await redisPOST(makePOST('/api/redis')));
  });

  it('DELETE /api/redis → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await redisDELETE(makeDELETE('/api/redis')));
  });

  // ── services ─────────────────────────────────────────────────────────────────

  it('GET /api/services → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await servicesGET(makeGET('/api/services')));
  });

  it('POST /api/services → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await servicesPOST(makePOST('/api/services')));
  });

  // ── sync ─────────────────────────────────────────────────────────────────────

  it('GET /api/sync → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await syncGET(makeGET('/api/sync')));
  });

  // ── system/metrics ───────────────────────────────────────────────────────────

  it('GET /api/system/metrics → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await systemMetricsGET(makeGET('/api/system/metrics')));
  });

  it('POST /api/system/metrics → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await systemMetricsPOST(makePOST('/api/system/metrics')));
  });

  // ── system ───────────────────────────────────────────────────────────────────

  it('GET /api/system → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await systemGET(makeGET('/api/system')));
  });

  it('POST /api/system → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await systemPOST(makePOST('/api/system')));
  });

  // ── temporal ─────────────────────────────────────────────────────────────────

  it('GET /api/temporal/health → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await temporalHealthGET(makeGET('/api/temporal/health')));
  });

  it('GET /api/temporal/workflows → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await temporalWorkflowsGET(makeGET('/api/temporal/workflows')));
  });

  it('POST /api/temporal/workflows → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await temporalWorkflowsPOST(makePOST('/api/temporal/workflows')));
  });

  // ── ccc ──────────────────────────────────────────────────────────────────────

  it('GET /api/ccc/actions → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await cccActionsGET(makeGET('/api/ccc/actions')));
  });

  it('POST /api/ccc/actions → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await cccActionsPOST(makePOST('/api/ccc/actions')));
  });

  it('GET /api/ccc/plays → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await cccPlaysGET(makeGET('/api/ccc/plays')));
  });
});
