/**
 * @unit-talk/mcp-state — tool registrations
 *
 * Tools:
 *   query_picks         — filtered unified_picks query
 *   get_pick            — single pick detail by UUID
 *   get_lifecycle_stage — derived lifecycle stage for a pick
 *   get_settlement_records — prop_settlements query
 */

import { getLifecycleStage, getPick, getSettlementRecords, queryPicks } from '../adapters/index.js';
import {
  GetLifecycleStageInput,
  GetPickInput,
  GetSettlementRecordsInput,
  QueryPicksInput,
} from '../schemas/index.js';

import type { McpStateConfig } from '../schemas/index.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerStateTools(server: McpServer, config: McpStateConfig): void {
  // ── query_picks ───────────────────────────────────────────────────────────
  server.tool(
    'query_picks',
    'Query unified_picks with optional filters (status, promotion_band, date, posted_to_discord). ' +
      'Returns pick summaries sorted by created_at desc. Max 200 rows.',
    QueryPicksInput.shape,
    async ({ status, promotion_band, date, limit, posted_to_discord }) => {
      const result = await queryPicks(config, {
        ...(status !== undefined ? { status } : {}),
        ...(promotion_band !== undefined ? { promotion_band } : {}),
        ...(date !== undefined ? { date } : {}),
        ...(limit !== undefined ? { limit } : {}),
        ...(posted_to_discord !== undefined ? { posted_to_discord } : {}),
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_pick ──────────────────────────────────────────────────────────────
  server.tool(
    'get_pick',
    'Get the full detail for a single pick by UUID, including derived lifecycle stage and all timestamps.',
    GetPickInput.shape,
    async ({ id }) => {
      const result = await getPick(config, id);
      if (!result) {
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify({ error: 'Pick not found', id }) },
          ],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_lifecycle_stage ────────────────────────────────────────────────────
  server.tool(
    'get_lifecycle_stage',
    'Get the current derived lifecycle stage for a pick (SUBMITTED, QUEUED, APPROVED, POSTED, SETTLED, VOID, BLOCKED, FAILED, etc.).',
    GetLifecycleStageInput.shape,
    async ({ id }) => {
      const result = await getLifecycleStage(config, id);
      if (!result) {
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify({ error: 'Pick not found', id }) },
          ],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_settlement_records ────────────────────────────────────────────────
  server.tool(
    'get_settlement_records',
    'Query prop_settlements — optionally filtered by pick_id or settled_at date (YYYY-MM-DD).',
    GetSettlementRecordsInput.shape,
    async ({ pick_id, date, limit }) => {
      const result = await getSettlementRecords(config, {
        ...(pick_id !== undefined ? { pick_id } : {}),
        ...(date !== undefined ? { date } : {}),
        ...(limit !== undefined ? { limit } : {}),
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
