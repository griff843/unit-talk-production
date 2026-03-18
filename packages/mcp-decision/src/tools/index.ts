/**
 * @unit-talk/mcp-decision — tool registrations
 */

import {
  getFindingBacklog,
  getLifecycleStatus,
  getRoutingDecision,
  getSprintGateStatus,
} from '../adapters/index.js';
import {
  GetFindingBacklogInput,
  GetLifecycleStatusInput,
  GetRoutingDecisionInput,
  GetSprintGateStatusInput,
} from '../schemas/index.js';

import type { McpDecisionConfig } from '../schemas/index.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerDecisionTools(server: McpServer, config: McpDecisionConfig): void {
  // ── get_llm_routing_decision ───────────────────────────────────────────────
  server.tool(
    'get_llm_routing_decision',
    'Read the LLM_ROUTING_DECISION.md for a sprint. Shows which model was chosen (Opus/Sonnet/Haiku) ' +
      'and the rationale. Omit sprint_id to get the most recent decision.',
    GetRoutingDecisionInput.shape,
    async ({ sprint_id }) => {
      const result = getRoutingDecision(config, sprint_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_sprint_gate_status ─────────────────────────────────────────────────
  server.tool(
    'get_sprint_gate_status',
    'Run the sprint gate check (tools/governance/sprint-gate.js) and return pass/fail. ' +
      'Validates sprint order compliance. Optionally check a specific sprint ID.',
    GetSprintGateStatusInput.shape,
    async ({ sprint_id }) => {
      const result = getSprintGateStatus(config, sprint_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_finding_backlog ────────────────────────────────────────────────────
  server.tool(
    'get_finding_backlog',
    'Return triaged findings from the Claude OS finding backlog. ' +
      'Findings are TypeScript errors, ESLint violations, and CI failures. ' +
      'Optionally filter by severity (critical|high|medium|low).',
    GetFindingBacklogInput.shape,
    async ({ severity, limit }) => {
      const result = getFindingBacklog(config, severity, limit ?? 20);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_lifecycle_status ───────────────────────────────────────────────────
  server.tool(
    'get_lifecycle_status',
    'Run the lifecycle single-writer gate (apps/api: npm run lifecycle:single-writer -- --strict). ' +
      'Returns pass/fail, violations count, and files scanned.',
    GetLifecycleStatusInput.shape,
    async () => {
      const result = getLifecycleStatus(config);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
