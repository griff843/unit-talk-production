/**
 * @unit-talk/mcp-ops — tool registrations
 *
 * Tools exposed to Claude Code via MCP:
 *   get_agent_health          — snapshot of agent heartbeat status
 *   get_outbox_depth          — bridge_outbox pending/failed counts
 *   get_platform_health       — computed health summary (HEALTHY | DEGRADED | CRITICAL)
 *   get_operator_workflows    — operator workflow registry (requires OPERATOR_TOKEN)
 *   get_slo_status            — SLO attainment per window (requires OPERATOR_TOKEN)
 */

import {
  fetchAgentHealth,
  fetchOperatorWorkflows,
  fetchOutboxDepth,
  fetchPlatformHealthSummary,
  fetchSloStatus,
} from '../adapters/index.js';
import {
  GetAgentHealthInput,
  GetOperatorWorkflowsInput,
  GetOutboxDepthInput,
  GetPipelineStatusInput,
  GetPlatformHealthSummaryInput,
  GetSloStatusInput,
} from '../schemas/index.js';

import type { McpOpsConfig } from '../schemas/index.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerOpsTools(server: McpServer, config: McpOpsConfig): void {
  // ── get_agent_health ──────────────────────────────────────────────────────
  server.tool(
    'get_agent_health',
    'Returns a snapshot of all agent heartbeats from the agent_health table. ' +
      'Use this to check which agents are healthy, stale, or missing.',
    GetAgentHealthInput.shape,
    async ({ stale_threshold_minutes }) => {
      const result = await fetchAgentHealth(config, stale_threshold_minutes ?? 5);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // ── get_outbox_depth ──────────────────────────────────────────────────────
  server.tool(
    'get_outbox_depth',
    'Returns the current bridge_outbox queue depth — pending and failed record counts. ' +
      'stale_alert=true means picks are backed up or stalled.',
    GetOutboxDepthInput.shape,
    async () => {
      const result = await fetchOutboxDepth(config);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // ── get_platform_health ───────────────────────────────────────────────────
  server.tool(
    'get_platform_health',
    'Returns the computed platform health summary: overall status (HEALTHY | DEGRADED | CRITICAL), ' +
      'subsystem statuses, SLO breach/warn counts, and autopilot mode. No auth required.',
    GetPlatformHealthSummaryInput.shape,
    async () => {
      const result = await fetchPlatformHealthSummary(config);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // ── get_operator_workflows ────────────────────────────────────────────────
  server.tool(
    'get_operator_workflows',
    'Returns registered operator workflows from the workflow registry. ' +
      'Optionally filter by category (analysis|backfill|feed|health|settlement|ops) ' +
      'or risk_level (low|medium|high). Requires OPERATOR_TOKEN.',
    GetOperatorWorkflowsInput.shape,
    async ({ category, risk_level }) => {
      const result = await fetchOperatorWorkflows(config, category, risk_level);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // ── get_pipeline_status ───────────────────────────────────────────────────
  // Alias: combines outbox depth + agent health for a single pipeline view
  server.tool(
    'get_pipeline_status',
    'Returns a combined pipeline status: agent health summary + bridge_outbox depth. ' +
      'Use this as the first tool when diagnosing pipeline issues.',
    GetPipelineStatusInput.shape,
    async () => {
      const [health, outbox] = await Promise.all([
        fetchAgentHealth(config),
        fetchOutboxDepth(config),
      ]);
      const pipeline = {
        agents: {
          total: health.total,
          healthy: health.healthy,
          stale: health.stale,
          missing: health.missing,
        },
        outbox: outbox.bridge_outbox,
        queried_at: health.queried_at,
      };
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(pipeline, null, 2),
          },
        ],
      };
    }
  );

  // ── get_slo_status ────────────────────────────────────────────────────────
  server.tool(
    'get_slo_status',
    'Returns current SLO attainment per window. Shows breach/warn counts and per-SLO status. ' +
      'Requires OPERATOR_TOKEN.',
    GetSloStatusInput.shape,
    async () => {
      const result = await fetchSloStatus(config);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
