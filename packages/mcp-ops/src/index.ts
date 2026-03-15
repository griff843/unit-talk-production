/**
 * @unit-talk/mcp-ops — public API
 *
 * Exports config type and all output types for consumers
 * that want to embed or extend the ops MCP server.
 */

export { registerOpsResources } from './resources/index.js';
export type {
  AgentHealthResult,
  AgentHealthRow,
  McpOpsConfig,
  OperatorWorkflowsResult,
  OutboxDepthResult,
  PlatformHealthSummary,
  SloEntry,
  SloStatusResult,
  WorkflowEntry,
} from './schemas/index.js';
export { registerOpsTools } from './tools/index.js';
