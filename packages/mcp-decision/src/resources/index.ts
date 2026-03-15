/**
 * @unit-talk/mcp-decision — resource registrations
 *
 *   unit-talk://decision/routing-decision   most recent LLM routing decision
 *   unit-talk://decision/lifecycle-status   lifecycle gate status snapshot
 */


import { getLifecycleStatus, getRoutingDecision } from '../adapters/index.js';

import type { McpDecisionConfig } from '../schemas/index.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerDecisionResources(server: McpServer, config: McpDecisionConfig): void {
  server.resource(
    'decision-routing-decision',
    'unit-talk://decision/routing-decision',
    { mimeType: 'application/json', description: 'Most recent LLM routing decision' },
    async () => {
      const result = getRoutingDecision(config);
      return {
        contents: [
          {
            uri: 'unit-talk://decision/routing-decision',
            mimeType: 'application/json',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.resource(
    'decision-lifecycle-status',
    'unit-talk://decision/lifecycle-status',
    { mimeType: 'application/json', description: 'Lifecycle single-writer gate status' },
    async () => {
      const result = getLifecycleStatus(config);
      return {
        contents: [
          {
            uri: 'unit-talk://decision/lifecycle-status',
            mimeType: 'application/json',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
