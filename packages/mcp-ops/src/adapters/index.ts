/**
 * @unit-talk/mcp-ops — adapters
 *
 * Two transport strategies:
 *   1. Direct Supabase queries — agent_health, bridge_outbox (no computed logic needed)
 *   2. HTTP calls — /api/health/summary, /api/slo/status, /ops/workflows
 *
 * NEVER imports from apps/api/src — all HTTP calls go through API_BASE_URL.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type {
  AgentHealthResult,
  AgentHealthRow,
  McpOpsConfig,
  OperatorWorkflowsResult,
  OutboxDepthResult,
  PlatformHealthSummary,
  SloStatusResult,
} from '../schemas/index.js';

// ─── Supabase row shapes (matches DB columns exactly) ─────────────────────────

interface DbAgentHealthRow {
  id: string;
  agent_name: string;
  status: string;
  last_heartbeat_at: string | null;
  metrics_json: Record<string, unknown> | null;
  error_message: string | null;
}

interface DbOutboxRow {
  id: string;
  created_at: string;
}

// ─── Supabase adapter ─────────────────────────────────────────────────────────

function buildSupabaseClient(config: McpOpsConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseKey);
}

export async function fetchAgentHealth(
  config: McpOpsConfig,
  staleThresholdMinutes = 5
): Promise<AgentHealthResult> {
  const supabase = buildSupabaseClient(config);
  const now = new Date();

  const { data, error } = await supabase
    .from('agent_health')
    .select('id, agent_name, status, last_heartbeat_at, metrics_json, error_message')
    .order('agent_name')
    .returns<DbAgentHealthRow[]>();

  if (error) throw new Error(`Supabase query failed: ${error.message}`);

  const agents: AgentHealthRow[] = (data ?? []).map(row => {
    const lastHeartbeat = row.last_heartbeat_at;
    let ageMins: number | null = null;
    let heartbeatStatus: 'healthy' | 'stale' | 'missing' = 'missing';

    if (lastHeartbeat) {
      ageMins = Math.floor((now.getTime() - new Date(lastHeartbeat).getTime()) / 60_000);
      heartbeatStatus = ageMins <= staleThresholdMinutes ? 'healthy' : 'stale';
    }

    return {
      id: row.id,
      agent_name: row.agent_name,
      status: row.status,
      last_heartbeat_at: lastHeartbeat,
      metrics_json: row.metrics_json,
      error_message: row.error_message,
      age_minutes: ageMins,
      heartbeat_status: heartbeatStatus,
    };
  });

  const healthy = agents.filter(a => a.heartbeat_status === 'healthy').length;
  const stale = agents.filter(a => a.heartbeat_status === 'stale').length;
  const missing = agents.filter(a => a.heartbeat_status === 'missing').length;

  return {
    agents,
    total: agents.length,
    healthy,
    stale,
    missing,
    queried_at: now.toISOString(),
  };
}

export async function fetchOutboxDepth(config: McpOpsConfig): Promise<OutboxDepthResult> {
  const supabase = buildSupabaseClient(config);
  const now = new Date();

  const { data: pending, error: e1 } = await supabase
    .from('bridge_outbox')
    .select('id, created_at')
    .eq('status', 'pending')
    .returns<DbOutboxRow[]>();

  const { data: failed, error: e2 } = await supabase
    .from('bridge_outbox')
    .select('id')
    .eq('status', 'failed')
    .returns<{ id: string }[]>();

  if (e1 ?? e2) {
    throw new Error(`Supabase query failed: ${(e1 ?? e2)?.message ?? 'unknown'}`);
  }

  // Find oldest pending record
  let oldestPendingMinutes: number | null = null;
  const pendingRows = pending ?? [];
  if (pendingRows.length > 0) {
    const oldest = pendingRows.reduce((a, b) =>
      new Date(a.created_at) < new Date(b.created_at) ? a : b
    );
    oldestPendingMinutes = Math.floor(
      (now.getTime() - new Date(oldest.created_at).getTime()) / 60_000
    );
  }

  const pendingCount = pendingRows.length;
  // Stale if oldest pending > 10 minutes or > 50 items queued
  const staleAlert =
    (oldestPendingMinutes !== null && oldestPendingMinutes > 10) || pendingCount > 50;

  return {
    bridge_outbox: {
      pending: pendingCount,
      failed: (failed ?? []).length,
      oldest_pending_minutes: oldestPendingMinutes,
      stale_alert: staleAlert,
    },
    queried_at: now.toISOString(),
  };
}

// ─── HTTP adapter ─────────────────────────────────────────────────────────────

function authHeaders(config: McpOpsConfig): Record<string, string> {
  return config.operatorToken ? { Authorization: `Bearer ${config.operatorToken}` } : {};
}

async function httpGet<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...headers } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} from ${url}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchPlatformHealthSummary(
  config: McpOpsConfig
): Promise<PlatformHealthSummary> {
  // /api/health/summary — no auth required
  return httpGet<PlatformHealthSummary>(`${config.apiBaseUrl}/api/health/summary`);
}

export async function fetchOperatorWorkflows(
  config: McpOpsConfig,
  category?: string,
  riskLevel?: string
): Promise<OperatorWorkflowsResult> {
  if (!config.operatorToken) {
    throw new Error(
      'OPERATOR_TOKEN is required to access /ops/workflows. Set it in the MCP server env.'
    );
  }

  const params = new URLSearchParams();
  if (category) params.set('category', category);

  const paramStr = params.toString();
  const url = `${config.apiBaseUrl}/ops/workflows${paramStr ? `?${paramStr}` : ''}`;

  const raw = await httpGet<{
    workflows: OperatorWorkflowsResult['workflows'];
    meta: {
      total: number;
      returned: number;
      categories: string[];
      categoryCounts: Record<string, number>;
    };
  }>(url, authHeaders(config));

  // Apply optional risk_level filter client-side (API doesn't support it natively yet)
  const workflows = riskLevel
    ? raw.workflows.filter(w => w.riskLevel === riskLevel)
    : raw.workflows;

  const filteredBy = category ?? riskLevel;
  return {
    workflows,
    total: raw.meta.total,
    categories: raw.meta.categoryCounts,
    ...(filteredBy !== undefined ? { filtered_by: filteredBy } : {}),
  };
}

export async function fetchSloStatus(config: McpOpsConfig): Promise<SloStatusResult> {
  if (!config.operatorToken) {
    throw new Error(
      'OPERATOR_TOKEN is required to access /api/slo/status. Set it in the MCP server env.'
    );
  }
  return httpGet<SloStatusResult>(`${config.apiBaseUrl}/api/slo/status`, authHeaders(config));
}
