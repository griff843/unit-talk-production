// 2025-11-23: One-off PostgREST schema reload helper for Phase 15 real ingestion
// Uses the production-grade forcePostgrestReload helper inside apps/api.

import { forcePostgrestReload } from '../apps/api/src/lib/pgrest-reload';

async function main() {
  console.log('[Phase15] Triggering PostgREST schema reload via pg_notify …');

  try {
    const result = await forcePostgrestReload({
      reason: 'phase15-real-ingestion-processed_by-column',
      timeoutMs: 5000,
      maxRetries: 2,
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

