/**
 * @unit-talk/mcp-ops — stdio server entry point
 *
 * Start: node dist/server.js
 *
 * Required env vars:
 *   API_BASE_URL              — e.g. http://localhost:3000
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (direct table access)
 *
 * Optional env vars:
 *   OPERATOR_TOKEN            — JWT for protected endpoints (/ops/workflows, /api/slo/status)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerOpsResources } from './resources/index.js';
import { registerOpsTools } from './tools/index.js';

import type { McpOpsConfig } from './schemas/index.js';

function getConfig(): McpOpsConfig {
  const apiBaseUrl = process.env['API_BASE_URL'];
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!apiBaseUrl) throw new Error('Missing required env var: API_BASE_URL');
  if (!supabaseUrl) throw new Error('Missing required env var: SUPABASE_URL');
  if (!supabaseKey) throw new Error('Missing required env var: SUPABASE_SERVICE_ROLE_KEY');

  const operatorToken = process.env['OPERATOR_TOKEN'];
  return {
    apiBaseUrl,
    supabaseUrl,
    supabaseKey,
    ...(operatorToken !== undefined ? { operatorToken } : {}),
  };
}

async function main(): Promise<void> {
  const config = getConfig();

  const server = new McpServer({
    name: 'unit-talk-ops',
    version: '0.0.1',
  });

  registerOpsTools(server, config);
  registerOpsResources(server, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Keep process alive
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('mcp-ops server failed to start:', err);
  process.exit(1);
});
