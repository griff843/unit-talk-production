// 2025-11-23: One-off PostgREST schema reload helper for Phase 15 real ingestion
// Container-local copy wired for /app/apps/api working directory.
// Source of truth: scripts/ops/reload_postgrest_schema.ts

import { rpcReload } from '../../src/lib/rpc-reload';

async function main() {
  console.log('[Phase15] Triggering PostgREST schema reload via pgrst_reload RPC …');

  try {
    const result = await rpcReload({
      triggeredBy: 'phase15-real-ingestion',
      reason: 'phase15-real-ingestion-processed_by-column',
      maxRetries: 3,
      retryDelayMs: 1000,
    });

    console.log('[Phase15] PostgREST reload result:', result);

    if (!result.success) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('[Phase15] PostgREST reload failed:', error);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[Phase15] Unexpected error in reload_postgrest_schema:', err);
  process.exitCode = 1;
});

