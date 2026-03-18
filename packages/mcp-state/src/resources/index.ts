/**
 * @unit-talk/mcp-state — resource registrations
 *
 *   unit-talk://state/picks/recent   — last 20 picks across all statuses
 *   unit-talk://state/pipeline       — pending/approved/posted counts (pipeline snapshot)
 */

import { queryPicks } from '../adapters/index.js';

import type { McpStateConfig } from '../schemas/index.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerStateResources(server: McpServer, config: McpStateConfig): void {
  server.resource(
    'state-picks-recent',
    'unit-talk://state/picks/recent',
    { mimeType: 'application/json', description: 'Last 20 picks across all statuses' },
    async () => {
      const result = await queryPicks(config, { limit: 20 });
      return {
        contents: [
          {
            uri: 'unit-talk://state/picks/recent',
            mimeType: 'application/json',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.resource(
    'state-pipeline-snapshot',
    'unit-talk://state/pipeline',
    {
      mimeType: 'application/json',
      description: 'Pipeline snapshot: pending/approved/posted counts',
    },
    async () => {
      const [pending, approved, posted] = await Promise.all([
        queryPicks(config, { status: 'pending', limit: 1 }),
        queryPicks(config, { status: 'approved', limit: 1 }),
        queryPicks(config, { posted_to_discord: true, limit: 1 }),
      ]);
      const snapshot = {
        pending_count: pending.total,
        approved_count: approved.total,
        posted_to_discord_count: posted.total,
        queried_at: new Date().toISOString(),
      };
      return {
        contents: [
          {
            uri: 'unit-talk://state/pipeline',
            mimeType: 'application/json',
            text: JSON.stringify(snapshot, null, 2),
          },
        ],
      };
    }
  );
}
