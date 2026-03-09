/**
 * Test document class namespaces and compare UI-created vs TX-created docs.
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

type Rec = Record<string, unknown>;

async function main(): Promise<void> {
  const loginRes = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'login',
      params: { email: HULY_EMAIL, password: HULY_PASSWORD },
    }),
  });
  const login = (await loginRes.json()) as { result?: Rec };
  const accountToken = login.result!.token as string;

  const wsRes = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
    body: JSON.stringify({ method: 'selectWorkspace', params: { workspaceUrl: HULY_WORKSPACE } }),
  });
  const ws = (await wsRes.json()) as { result?: Rec };
  const wt = ws.result!.token as string;
  const wid = ws.result!.workspace as string;

  async function findAll(cls: string): Promise<Rec[]> {
    const opts = JSON.stringify({ limit: 100 });
    const url = `${HULY_URL}/_transactor/api/v1/find-all/${wid}?class=${encodeURIComponent(cls)}&options=${encodeURIComponent(opts)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${wt}` } });
    const body = await res.json();
    if (Array.isArray(body)) return body as Rec[];
    const b = body as Rec;
    if (Array.isArray(b?.result)) return b.result as Rec[];
    if (Array.isArray(b?.value)) return b.value as Rec[];
    if (Array.isArray(b?.docs)) return b.docs as Rec[];
    return [];
  }

  // Test multiple namespaces
  const namespaces = [
    'document:class:Document',
    'documents:class:Document',
    'document:class:Teamspace',
    'documents:class:Teamspace',
    'documents:class:DocumentSpace',
    'documents:class:OrgSpace',
  ];

  console.log('=== NAMESPACE QUERY RESULTS ===\n');
  for (const cls of namespaces) {
    const docs = await findAll(cls);
    console.log(`${cls}: ${docs.length} results`);
    if (docs.length > 0 && docs.length <= 5) {
      for (const d of docs) {
        console.log(`  - ${d.title || d.name || d._id}`);
      }
    }
  }

  // Full field comparison
  const allDocs = await findAll('document:class:Document');

  // Find a UI-created doc (space starts with 69a6)
  const uiDoc = allDocs.find(d => String(d.space).startsWith('69a6'));
  const txDoc = allDocs.find(d => String(d._id).startsWith('doc-'));

  if (uiDoc) {
    console.log('\n=== UI-CREATED DOC (full fields) ===');
    console.log(JSON.stringify(uiDoc, null, 2));
  }

  if (txDoc) {
    console.log('\n=== TX-CREATED DOC (full fields) ===');
    console.log(JSON.stringify(txDoc, null, 2));
  }

  // Compare field keys
  if (uiDoc && txDoc) {
    const uiKeys = new Set(Object.keys(uiDoc));
    const txKeys = new Set(Object.keys(txDoc));
    const onlyUI = [...uiKeys].filter(k => !txKeys.has(k));
    const onlyTX = [...txKeys].filter(k => !uiKeys.has(k));
    console.log('\n=== FIELD DIFF ===');
    console.log('Fields ONLY in UI doc:', onlyUI.join(', ') || '(none)');
    console.log('Fields ONLY in TX doc:', onlyTX.join(', ') || '(none)');
    console.log('\nContent comparison:');
    console.log(
      `  UI content type: ${typeof uiDoc.content}, value: "${String(uiDoc.content).substring(0, 100)}"`
    );
    console.log(
      `  TX content type: ${typeof txDoc.content}, value: "${String(txDoc.content).substring(0, 100)}"`
    );
  }
}

main().catch(console.error);
