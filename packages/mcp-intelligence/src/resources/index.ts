/**
 * @unit-talk/mcp-intelligence — resource registrations
 *
 *   unit-talk://intelligence/shadow-divergence   7-day shadow divergence snapshot
 */


import { fetchShadowDivergence } from '../adapters/index.js';

import type { McpIntelligenceConfig } from '../schemas/index.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerIntelligenceResources(
  server: McpServer,
  config: McpIntelligenceConfig
): void {
  server.resource(
    'intelligence-shadow-divergence',
    'unit-talk://intelligence/shadow-divergence',
    {
      mimeType: 'application/json',
      description: '7-day shadow scoring divergence snapshot',
    },
    async () => {
      const result = await fetchShadowDivergence(config, 7);
      return {
        contents: [
          {
            uri: 'unit-talk://intelligence/shadow-divergence',
            mimeType: 'application/json',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
