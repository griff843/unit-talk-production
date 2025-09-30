#!/usr/bin/env tsx

/*
  Export current credit usage state from Supabase REST using service role key from env.
  Writes:
    - out/ops/current-state.json (summary by provider)
*/

import * as fs from 'fs';
import * as path from 'path';

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const baseUrl = url.replace(/\/$/, '');
  const endpointOpsProfile = baseUrl + '/rest/v1/credit_usage?select=provider,credits,calls,bucket_hour&order=bucket_hour.desc&limit=1000';
  const endpointQualified = baseUrl + '/rest/v1/ops.credit_usage?select=provider,credits,calls,bucket_hour&order=bucket_hour.desc&limit=1000';

  let rows: Array<{ provider: string; credits: number; calls: number; bucket_hour?: string }> = [];

  // Attempt 1: Accept-Profile: ops
  let res = await fetch(endpointOpsProfile, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      Prefer: 'count=none',
      'Accept-Profile': 'ops',
    },
  });

  if (res.ok) {
    rows = (await res.json()) as Array<{ provider: string; credits: number; calls: number; bucket_hour: string }>;
  } else {
    // Attempt 2: qualified table name (requires ops in exposed schemas)
    res = await fetch(endpointQualified, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        Prefer: 'count=none',
      },
    });
    if (res.ok) {
      rows = (await res.json()) as Array<{ provider: string; credits: number; calls: number; bucket_hour: string }>;
    } else {
      // Attempt 3: public.get_credit_usage_summary RPC (recommended production exposure)
      const summaryRpc = baseUrl + '/rest/v1/rpc/get_credit_usage_summary';
      let rpcRes = await fetch(summaryRpc, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (rpcRes.ok) {
        rows = (await rpcRes.json()) as Array<{ provider: string; credits: number; calls: number }>;
      } else {
        // Attempt 4: Fallback via exec_sql RPC when ops schema isn't exposed via REST
        const execSqlRpc = baseUrl + '/rest/v1/rpc/exec_sql';
        const sql = 'select provider, sum(credits)::int as credits, sum(calls)::int as calls from ops.credit_usage group by provider order by 1';
        rpcRes = await fetch(execSqlRpc, {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sql }),
        });
        if (!rpcRes.ok) {
          console.error('Supabase REST (Accept-Profile) failed:', res.status, res.statusText);
          const text = await res.text();
          console.error(text);
          console.error('RPC get_credit_usage_summary failed:', rpcRes.status, rpcRes.statusText);
          const text2 = await rpcRes.text();
          console.error(text2);
          process.exit(1);
        }
        const rpcRows = (await rpcRes.json()) as Array<{ provider: string; credits: number; calls: number } | { rows: Array<{ provider: string; credits: number; calls: number }> }>;
        // Some exec_sql handlers return { rows: [...] }
        const parsed = Array.isArray(rpcRows) ? rpcRows : ((rpcRows as any).rows || []);
        rows = parsed as any[];
      }
    }
  }

  const summary: Record<string, { credits: number; calls: number }> = {};
  for (const r of rows) {
    const p = r.provider || 'unknown';
    if (!summary[p]) summary[p] = { credits: 0, calls: 0 };
    summary[p].credits += Number(r.credits || 0);
    summary[p].calls += Number(r.calls || 0);
  }

  const outDir = path.resolve(process.cwd(), 'out', 'ops');
  ensureDir(outDir);
  fs.writeFileSync(path.join(outDir, 'current-state.json'), JSON.stringify({ generatedAt: new Date().toISOString(), byProvider: summary }, null, 2));

  const dbDir = path.resolve(process.cwd(), 'out', 'db');
  ensureDir(dbDir);
  const sql = 'select provider, sum(credits) as credits, sum(calls) as calls from ops.credit_usage group by provider;\n';
  fs.writeFileSync(path.join(dbDir, 'credit_usage_snapshot.sql'), sql);

  console.log('Wrote:');
  console.log(' - out/ops/current-state.json');
  console.log(' - out/db/credit_usage_snapshot.sql');
}

main().catch((e) => {
  console.error('export-credit-usage failed:', e?.message || String(e));
  process.exit(1);
});

