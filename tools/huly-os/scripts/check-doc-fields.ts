/**
 * Check which documents have the required UI visibility fields.
 */
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { config as dotenvConfig } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '..', '.env') });

const HULY_URL = process.env.HULY_URL ?? 'http://localhost:8087';
const HULY_EMAIL = process.env.HULY_EMAIL ?? '';
const HULY_PASSWORD = process.env.HULY_PASSWORD ?? '';
const HULY_WORKSPACE = process.env.HULY_WORKSPACE ?? 'unit-talk';

async function main(): Promise<void> {
  // Login + workspace
  const loginRes = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'login',
      params: { email: HULY_EMAIL, password: HULY_PASSWORD },
    }),
  });
  const login = (await loginRes.json()) as { result?: Record<string, unknown> };
  const accountToken = login.result!.token as string;

  const wsRes = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
    body: JSON.stringify({ method: 'selectWorkspace', params: { workspaceUrl: HULY_WORKSPACE } }),
  });
  const ws = (await wsRes.json()) as { result?: Record<string, unknown> };
  const workspaceToken = ws.result!.token as string;
  const workspaceId = ws.result!.workspace as string;

  // Find all docs
  const opts = JSON.stringify({ limit: 200 });
  const url = `${HULY_URL}/_transactor/api/v1/find-all/${workspaceId}?class=${encodeURIComponent('document:class:Document')}&options=${encodeURIComponent(opts)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${workspaceToken}` } });
  const body = await res.json();
  let docs: Record<string, unknown>[];
  if (Array.isArray(body)) docs = body;
  else if (Array.isArray((body as Record<string, unknown>)?.result))
    docs = (body as Record<string, unknown>).result as Record<string, unknown>[];
  else if (Array.isArray((body as Record<string, unknown>)?.value))
    docs = (body as Record<string, unknown>).value as Record<string, unknown>[];
  else if (Array.isArray((body as Record<string, unknown>)?.docs))
    docs = (body as Record<string, unknown>).docs as Record<string, unknown>[];
  else {
    console.log('Unexpected response:', JSON.stringify(body).substring(0, 500));
    docs = [];
  }

  console.log(`Total documents: ${(docs as Array<Record<string, unknown>>).length}\n`);
  console.log('=== Document Field Analysis ===\n');

  for (const doc of docs as Array<Record<string, unknown>>) {
    const hasParent = doc.parent !== undefined;
    const hasRank = doc.rank !== undefined;
    const visible = hasParent && hasRank;
    const icon = visible ? 'VISIBLE' : 'INVISIBLE';
    console.log(`[${icon}] "${doc.title}" (${doc._id})`);
    console.log(`  space: ${doc.space}`);
    console.log(`  parent: ${doc.parent ?? 'MISSING'}`);
    console.log(`  rank: ${doc.rank ?? 'MISSING'}`);
    console.log(
      `  comments: ${doc.comments ?? 'MISSING'}, attachments: ${doc.attachments ?? 'MISSING'}`
    );
    console.log('');
  }
}

main().catch(console.error);
