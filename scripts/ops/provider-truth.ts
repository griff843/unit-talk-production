import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Provider truth (live):
// - Reads runtime_config for active provider
// - Verifies worker usage/quota flags are present

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

async function main() {
  const outDir = path.resolve(process.cwd(), 'out', 'ops');
  ensureDir(outDir);

  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result: any = {
    ok: false,
    activeProvider: null,
    quota: null,
    checkApiQuota: false,
    workerObservedProvider: null,
    timestamp: new Date().toISOString(),
  };

  try {
    if (!url || !service) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    const db = createClient(url, service);

    const { data: rc, error: rcErr } = await db
      .from('runtime_config')
      .select('key, value')
      .in('key', ['active_provider', 'provider_quota', 'checkApiQuota'])
      .order('key', { ascending: true });

    if (rcErr) throw rcErr;

    const map = new Map<string, any>();
    (rc || []).forEach(r => map.set(r.key, r.value));

    result.activeProvider = map.get('active_provider') || null;
    result.quota = map.get('provider_quota') || null;
    result.checkApiQuota = map.get('checkApiQuota') === true || map.get('checkApiQuota') === 'true';

    // Infer worker provider usage from agent_health last record
    const { data: ah } = await db
      .from('agent_health')
      .select('agent_name, metadata')
      .order('created_at', { ascending: false })
      .limit(1);
    result.workerObservedProvider = ah?.[0]?.metadata?.provider || null;

    result.ok = Boolean(result.activeProvider) && result.checkApiQuota === true;
  } catch (e: any) {
    result.error = e?.message || String(e);
  }

  fs.writeFileSync(path.join(outDir, 'provider-truth.json'), JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
  console.log('Provider truth written');
}

main().catch(err => { console.error(err); process.exitCode = 1; });
