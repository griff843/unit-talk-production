/**
 * @unit-talk/mcp-state — stdio server entry point
 *
 * Start: node dist/server.js
 *
 * Required env vars:
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (direct table reads)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerStateResources } from './resources/index.js';
import { registerStateTools } from './tools/index.js';

import type { McpStateConfig } from './schemas/index.js';

function getConfig(): McpStateConfig {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl) throw new Error('Missing required env var: SUPABASE_URL');
  if (!supabaseKey) throw new Error('Missing required env var: SUPABASE_SERVICE_ROLE_KEY');

  return { supabaseUrl, supabaseKey };
}

async function main(): Promise<void> {
  const config = getConfig();

  const server = new McpServer({
    name: 'unit-talk-state',
    version: '0.0.1',
  });

  registerStateTools(server, config);
  registerStateResources(server, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('mcp-state server failed to start:', err);
  process.exit(1);
});
