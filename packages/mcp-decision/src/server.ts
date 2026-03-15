/**
 * @unit-talk/mcp-decision — stdio server entry point
 *
 * Start: node dist/server.js
 *
 * Required env vars:
 *   REPO_ROOT   — absolute path to unit-talk-production root (e.g. /app or C:/dev/unit-talk-production)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerDecisionResources } from './resources/index.js';
import { registerDecisionTools } from './tools/index.js';

import type { McpDecisionConfig } from './schemas/index.js';

function getConfig(): McpDecisionConfig {
  const repoRoot = process.env['REPO_ROOT'];
  if (!repoRoot) throw new Error('Missing required env var: REPO_ROOT');
  return { repoRoot };
}

async function main(): Promise<void> {
  const config = getConfig();

  const server = new McpServer({
    name: 'unit-talk-decision',
    version: '0.0.1',
  });

  registerDecisionTools(server, config);
  registerDecisionResources(server, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('mcp-decision server failed to start:', err);
  process.exit(1);
});
