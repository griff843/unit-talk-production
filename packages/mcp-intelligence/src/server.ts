/**
 * @unit-talk/mcp-intelligence — stdio server entry point
 *
 * Start: node dist/server.js
 *
 * Required env vars:
 *   API_BASE_URL              — e.g. http://localhost:3000
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerIntelligenceResources } from './resources/index.js';
import { registerIntelligenceTools } from './tools/index.js';

import type { McpIntelligenceConfig } from './schemas/index.js';

function getConfig(): McpIntelligenceConfig {
  const apiBaseUrl = process.env['API_BASE_URL'];
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!apiBaseUrl) throw new Error('Missing required env var: API_BASE_URL');
  if (!supabaseUrl) throw new Error('Missing required env var: SUPABASE_URL');
  if (!supabaseKey) throw new Error('Missing required env var: SUPABASE_SERVICE_ROLE_KEY');

  return { apiBaseUrl, supabaseUrl, supabaseKey };
}

async function main(): Promise<void> {
  const config = getConfig();

  const server = new McpServer({
    name: 'unit-talk-intelligence',
    version: '0.0.1',
  });

  registerIntelligenceTools(server, config);
  registerIntelligenceResources(server, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('mcp-intelligence server failed to start:', err);
  process.exit(1);
});
