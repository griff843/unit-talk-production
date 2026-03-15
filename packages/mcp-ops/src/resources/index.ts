/**
 * @unit-talk/mcp-ops — resource registrations
 *
 * Resources expose read-only snapshots via URI — useful for Claude Code's
 * ambient context (no explicit tool call required).
 *
 *   unit-talk://ops/agent-health    — current agent heartbeat snapshot
 *   unit-talk://ops/workflows       — workflow registry listing
 *   unit-talk://ops/platform-health — platform health summary
 */


import {
  fetchAgentHealth,
  fetchOperatorWorkflows,
  fetchPlatformHealthSummary,
} from '../adapters/index.js';

import type { McpOpsConfig } from '../schemas/index.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerOpsResources(server: McpServer, config: McpOpsConfig): void {
  server.resource(
    'ops-agent-health',
    'unit-talk://ops/agent-health',
    { mimeType: 'application/json', description: 'Current agent heartbeat snapshot' },
    async () => {
      const result = await fetchAgentHealth(config);
      return {
        contents: [
          {
            uri: 'unit-talk://ops/agent-health',
            mimeType: 'application/json',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.resource(
    'ops-workflows',
    'unit-talk://ops/workflows',
    { mimeType: 'application/json', description: 'Operator workflow registry' },
    async () => {
      const result = await fetchOperatorWorkflows(config);
      return {
        contents: [
          {
            uri: 'unit-talk://ops/workflows',
            mimeType: 'application/json',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.resource(
    'ops-platform-health',
    'unit-talk://ops/platform-health',
    { mimeType: 'application/json', description: 'Platform health summary' },
    async () => {
      const result = await fetchPlatformHealthSummary(config);
      return {
        contents: [
          {
            uri: 'unit-talk://ops/platform-health',
            mimeType: 'application/json',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
