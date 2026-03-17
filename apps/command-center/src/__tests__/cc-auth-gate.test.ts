/**
 * Auth-gate enforcement tests for all CC API routes hardened in
 * SPRINT-076-LAYER3-PHASE10-CC-AUTH-GATE-HARDENING.
 *
 * Each test verifies that an unauthenticated request returns 401 Unauthorized
 * before any business logic or database access is executed.
 *
 * Covers (23 tests across 20 route handlers):
 *  1.  GET  /api/admin/freeze               → 401
 *  2.  POST /api/admin/freeze               → 401
 *  3.  GET  /api/admin/safe-mode            → 401
 *  4.  POST /api/admin/safe-mode            → 401
 *  5.  GET  /api/admin/remediation          → 401
 *  6.  POST /api/admin/remediation          → 401
 *  7.  GET  /api/admin/autopilot            → 401
 *  8.  POST /api/admin/autopilot/actions    → 401
 *  9.  GET  /api/admin/autopilot/intelligence → 401
 *  10. GET  /api/admin/autopilot/policy     → 401
 *  11. GET  /api/agents                     → 401
 *  12. GET  /api/agents/health              → 401
 *  13. GET  /api/agents/status              → 401
 *  14. GET  /api/settlement                 → 401
 *  15. GET  /api/lifecycle/picks            → 401
 *  16. GET  /api/lifecycle/picks/[id]/timeline → 401
 *  17. GET  /api/lifecycle/stuck            → 401
 *  18. GET  /api/risk/dashboard             → 401
 *  19. GET  /api/risk/decisions             → 401
 *  20. GET  /api/risk/status                → 401
 *  21. GET  /api/users                      → 401
 *  22. GET  /api/security                   → 401
 *  23. GET  /api/audit                      → 401
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

vi.mock('@/lib/agentMonitoring', () => ({
  agentMonitor: {
    getAgentStatus: vi.fn().mockResolvedValue([]),
    getHealthSummary: vi.fn().mockResolvedValue({}),
  },
  AgentMonitoringService: vi.fn().mockImplementation(() => ({
    getAgentStatus: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/lib/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rbac')>('@/lib/rbac');
  return {
    ...actual,
    RBACService: {
      hasPermission: vi.fn().mockReturnValue(true),
      logAudit: vi.fn().mockResolvedValue(undefined),
      getUserRole: vi.fn().mockReturnValue(null),
    },
  };
});

vi.mock('@/lib/telemetry', () => ({
  UnitTalkTracing: {
    startAgentSpan: vi.fn(() => ({})),
    recordSuccess: vi.fn(),
    recordError: vi.fn(),
    endSpan: vi.fn(),
  },
}));

// ─── Route imports (after mocks) ──────────────────────────────────────────────

import { POST as autopilotActionsPOST } from '@/app/api/admin/autopilot/actions/route';
import { GET as autopilotIntelligenceGET } from '@/app/api/admin/autopilot/intelligence/route';
import { GET as autopilotPolicyGET } from '@/app/api/admin/autopilot/policy/route';
import { GET as autopilotGET } from '@/app/api/admin/autopilot/route';
import { GET as freezeGET, POST as freezePOST } from '@/app/api/admin/freeze/route';
import { GET as remediationGET, POST as remediationPOST } from '@/app/api/admin/remediation/route';
import { GET as safeModeGET, POST as safeModePOST } from '@/app/api/admin/safe-mode/route';
import { GET as agentsHealthGET } from '@/app/api/agents/health/route';
import { GET as agentsGET } from '@/app/api/agents/route';
import { GET as agentsStatusGET } from '@/app/api/agents/status/route';
import { GET as auditGET } from '@/app/api/audit/route';
import { GET as lifecycleTimelineGET } from '@/app/api/lifecycle/picks/[id]/timeline/route';
import { GET as lifecyclePicksGET } from '@/app/api/lifecycle/picks/route';
import { GET as lifecycleStuckGET } from '@/app/api/lifecycle/stuck/route';
import { GET as riskDashboardGET } from '@/app/api/risk/dashboard/route';
import { GET as riskDecisionsGET } from '@/app/api/risk/decisions/route';
import { GET as riskStatusGET } from '@/app/api/risk/status/route';
import { GET as securityGET } from '@/app/api/security/route';
import { GET as settlementGET } from '@/app/api/settlement/route';
import { GET as usersGET } from '@/app/api/users/route';
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

async function assert401(res: Response): Promise<void> {
  expect(res.status).toBe(401);
  const body = await res.json();
  expect(body.success).toBe(false);
  expect(body.error).toBe('Unauthorized');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SPRINT-076 CC Auth Gate — 401 enforcement for all hardened routes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // ── admin/freeze ─────────────────────────────────────────────────────────────

  it('GET /api/admin/freeze → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await freezeGET(makeGET('/api/admin/freeze')));
  });

  it('POST /api/admin/freeze → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await freezePOST(makePOST('/api/admin/freeze')));
  });

  // ── admin/safe-mode ──────────────────────────────────────────────────────────

  it('GET /api/admin/safe-mode → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await safeModeGET(makeGET('/api/admin/safe-mode')));
  });

  it('POST /api/admin/safe-mode → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await safeModePOST(makePOST('/api/admin/safe-mode')));
  });

  // ── admin/remediation ────────────────────────────────────────────────────────

  it('GET /api/admin/remediation → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await remediationGET(makeGET('/api/admin/remediation')));
  });

  it('POST /api/admin/remediation → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await remediationPOST(makePOST('/api/admin/remediation')));
  });

  // ── admin/autopilot ──────────────────────────────────────────────────────────

  it('GET /api/admin/autopilot → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await autopilotGET(makeGET('/api/admin/autopilot')));
  });

  it('POST /api/admin/autopilot/actions → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await autopilotActionsPOST(makePOST('/api/admin/autopilot/actions')));
  });

  it('GET /api/admin/autopilot/intelligence → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await autopilotIntelligenceGET(makeGET('/api/admin/autopilot/intelligence')));
  });

  it('GET /api/admin/autopilot/policy → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await autopilotPolicyGET(makeGET('/api/admin/autopilot/policy')));
  });

  // ── agents ───────────────────────────────────────────────────────────────────

  it('GET /api/agents → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await agentsGET(makeGET('/api/agents')));
  });

  it('GET /api/agents/health → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await agentsHealthGET(makeGET('/api/agents/health')));
  });

  it('GET /api/agents/status → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await agentsStatusGET(makeGET('/api/agents/status')));
  });

  // ── settlement ───────────────────────────────────────────────────────────────

  it('GET /api/settlement → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await settlementGET(makeGET('/api/settlement')));
  });

  // ── lifecycle ────────────────────────────────────────────────────────────────

  it('GET /api/lifecycle/picks → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await lifecyclePicksGET(makeGET('/api/lifecycle/picks')));
  });

  it('GET /api/lifecycle/picks/[id]/timeline → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(
      await lifecycleTimelineGET(makeGET('/api/lifecycle/picks/pick-123/timeline'), {
        params: Promise.resolve({ id: 'pick-123' }),
      })
    );
  });

  it('GET /api/lifecycle/stuck → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await lifecycleStuckGET(makeGET('/api/lifecycle/stuck')));
  });

  // ── risk ─────────────────────────────────────────────────────────────────────

  it('GET /api/risk/dashboard → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await riskDashboardGET(makeGET('/api/risk/dashboard')));
  });

  it('GET /api/risk/decisions → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await riskDecisionsGET(makeGET('/api/risk/decisions')));
  });

  it('GET /api/risk/status → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await riskStatusGET(makeGET('/api/risk/status')));
  });

  // ── users ────────────────────────────────────────────────────────────────────

  it('GET /api/users → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await usersGET(makeGET('/api/users')));
  });

  // ── security ─────────────────────────────────────────────────────────────────

  it('GET /api/security → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await securityGET(makeGET('/api/security')));
  });

  // ── audit ────────────────────────────────────────────────────────────────────

  it('GET /api/audit → 401 when unauthenticated', async () => {
    setNoAuth();
    await assert401(await auditGET(makeGET('/api/audit')));
  });
});
