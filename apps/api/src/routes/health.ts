import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireSupabase } from '../utils/supabaseUtils';

// Temporal is optional at build-time; guard the import
let temporalConn: any = null;
async function checkTemporal(): Promise<{ ok: boolean; detail?: string }> {
  try {
    // Prefer env already used in your workers
    const address = process.env.TEMPORAL_ADDRESS || '';
    const namespace = process.env.TEMPORAL_NAMESPACE || '';
    if (!address || !namespace) return { ok: false, detail: 'TEMPORAL env missing' };

    // Lazy import to avoid bundler complaints if not installed in API
    const { Connection, Client } = await import('@temporalio/client');
    const connection = await Connection.connect({ address });
    temporalConn = connection;
    const client = new Client({ connection, namespace });
    // A lightweight call: list workflows (limit 1) or just ensure the client constructed
    await client.workflowService.listNamespaces({}); // succeeds if reachable
    return { ok: true };
  } catch (err: any) {
    return { ok: false, detail: err?.message || String(err) };
  }
}

async function checkSupabase(): Promise<{ ok: boolean; detail?: string }> {
  try {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
    if (!url || !key) return { ok: false, detail: 'SUPABASE env missing' };

    const sb = createClient(url, key, { auth: { persistSession: false } });
    // Use a cheap built-in table; information_schema is not accessible via Supabase RPC, so ping a known table.
    // Fall back to an RPC if you have one, or a trivial select on a tiny table like runtime_config.
    const { data, error } = await sb.from('runtime_config').select('key').limit(1);
    if (error) return { ok: false, detail: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, detail: err?.message || String(err) };
  }
}

const router = Router();

// Liveness: process is up
router.get('/', (_req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});

// Readiness: require DB + Temporal to be reachable
router.get('/ready', async (_req, res) => {
  const [db, temporal] = await Promise.all([checkSupabase(), checkTemporal()]);
  const ok = db.ok && temporal.ok;
  const detail = { db, temporal };
  if (ok) return res.status(200).json({ ok: true, detail });
  return res.status(503).json({ ok: false, detail });
});

// Provider health endpoint (moved from api-server.ts to avoid conflicts)
router.get('/provider', async (_req, res) => {
  try {
    const { getProviderHealth } = await import('../agents/FeedAgent/activities');
    const providerHealth = getProviderHealth();

    // Get data freshness from database
    const supabaseClient = requireSupabase();
      const { data: latestProp } = await supabaseClient
      .from('sports_game_odds')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    const lastIngestion = latestProp?.[0]?.created_at || null;
    const minutesSinceLastIngestion = lastIngestion
      ? Math.floor((Date.now() - new Date(lastIngestion).getTime()) / 60000)
      : null;

    const dataFreshness = {
      status: minutesSinceLastIngestion === null ? 'critical' :
              minutesSinceLastIngestion < 15 ? 'fresh' :
              minutesSinceLastIngestion < 60 ? 'stale' : 'critical',
      lastIngestion,
      minutesSinceLastIngestion,
      statusText: minutesSinceLastIngestion === null ? 'No data ingested' :
                  minutesSinceLastIngestion < 15 ? `Fresh data (${minutesSinceLastIngestion}m ago)` :
                  minutesSinceLastIngestion < 60 ? `Stale data (${minutesSinceLastIngestion}m ago)` :
                  `Critical - No data for ${minutesSinceLastIngestion}m`
    };

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      success: true,
      dataFreshness,
      ...providerHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Provider health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;