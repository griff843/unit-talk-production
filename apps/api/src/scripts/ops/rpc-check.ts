import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.cwd(), 'out', 'ops');
fs.mkdirSync(OUT, { recursive: true });

function client(kind: 'anon' | 'service') {
  const url = process.env.SUPABASE_URL!;
  const key = kind === 'anon' ? process.env.SUPABASE_ANON_KEY! : process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

(async () => {
  const stamp = Date.now();
  const results: Record<string, any> = {};

  for (const k of ['anon', 'service'] as const) {
    const supa = client(k);
    const { data, error } = await supa.rpc('get_credit_usage_summary');
    results[k] = { ok: !error, error: error ?? null, data: data ?? [] };
  }

  const file = path.join(OUT, `rpc-credit-usage-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({
    ts: new Date().toISOString(),
    url: process.env.SUPABASE_URL,
    results
  }, null, 2));

  console.log(file);

  // Exit with non-zero if either client failed
  if (!results.anon.ok || !results.service.ok) {
    console.error('RPC check failed:', results);
    process.exit(1);
  }
})();