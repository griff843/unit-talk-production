/**
 * collaborator-test-upload.ts
 *
 * Targeted test: upload ProseMirror JSON + Y.js binary for a single
 * TX-created issue (DEV-19 INVARIANT-001) and see if the UI renders it.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as Y from 'yjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const HULY_URL = process.env.HULY_URL ?? 'http://localhost:8087';
const HULY_EMAIL = process.env.HULY_EMAIL ?? 'ops@unit-talk.local';
const HULY_PASSWORD = process.env.HULY_PASSWORD ?? 'password';
const HULY_WORKSPACE = process.env.HULY_WORKSPACE ?? 'unit-talk';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? 'http://localhost:9000';
const BUCKET = '61b570c5-eee6-458c-9458-72108b5f2dff';

const s3 = new S3Client({
  endpoint: MINIO_ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' },
  forcePathStyle: true,
});

// ── Huly Auth ──────────────────────────────────────────────────────────

async function authenticate() {
  const lr = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'login',
      params: { email: HULY_EMAIL, password: HULY_PASSWORD },
    }),
  });
  const ld = (await lr.json()) as { result?: Record<string, unknown> };
  const token = ld.result!.token as string;

  const wr = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ method: 'selectWorkspace', params: { workspaceUrl: HULY_WORKSPACE } }),
  });
  const wd = (await wr.json()) as { result?: Record<string, unknown> };
  return {
    token: wd.result!.token as string,
    wsId: (wd.result!.workspace ?? wd.result!.workspaceId) as string,
  };
}

async function findAll(token: string, wsId: string, cls: string, limit = 300) {
  const opts = JSON.stringify({ limit });
  const url = `${HULY_URL}/_transactor/api/v1/find-all/${wsId}?class=${encodeURIComponent(cls)}&options=${encodeURIComponent(opts)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`findAll HTTP ${res.status}`);
  const body = await res.json();
  const b = body as Record<string, unknown>;
  return (b.value ?? b.result ?? (Array.isArray(body) ? body : [])) as Record<string, unknown>[];
}

// ── ProseMirror JSON for test content ─────────────────────────────────

function buildProseMirrorJSON(): string {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'INVARIANT-001: Scoring Source of Truth' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Rule: ' },
          {
            type: 'text',
            text: 'Scoring must read canonical offers from provider_offers table. Never from raw_props or cached data.',
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Enforcement' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'ShadowScoringService reads from ' },
                  { type: 'text', marks: [{ type: 'code' }], text: 'provider_offers' },
                  { type: 'text', text: ' only' },
                ],
              },
            ],
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'CI gate: grep for raw_props usage in scoring paths' },
                ],
              },
            ],
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Violation = sprint blocker (fail-closed)' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Code Surfaces' }],
      },
      {
        type: 'codeBlock',
        attrs: { language: 'typescript' },
        content: [
          {
            type: 'text',
            text: "// apps/api/src/services/ShadowScoringService.ts\nconst offers = await supabase\n  .from('provider_offers')\n  .select('*')\n  .eq('event_id', eventId);",
          },
        ],
      },
    ],
  };
  return JSON.stringify(doc);
}

// ── Y.js binary for the same content ──────────────────────────────────

function buildYDoc(keyName: string): Uint8Array {
  const yDoc = new Y.Doc();
  const frag = yDoc.getXmlFragment(keyName);

  // heading
  const h = new Y.XmlElement('heading');
  h.setAttribute('level', '2');
  const ht = new Y.XmlText();
  ht.insert(0, 'INVARIANT-001: Scoring Source of Truth');
  h.insert(0, [ht]);
  frag.insert(frag.length, [h]);

  // paragraph with bold
  const p = new Y.XmlElement('paragraph');
  const boldText = new Y.XmlText();
  boldText.insert(0, 'Rule: ', { bold: true });
  const normalText = new Y.XmlText();
  normalText.insert(
    0,
    'Scoring must read canonical offers from provider_offers table. Never from raw_props or cached data.'
  );
  p.insert(0, [boldText, normalText]);
  frag.insert(frag.length, [p]);

  // heading 3
  const h3 = new Y.XmlElement('heading');
  h3.setAttribute('level', '3');
  const h3t = new Y.XmlText();
  h3t.insert(0, 'Enforcement');
  h3.insert(0, [h3t]);
  frag.insert(frag.length, [h3]);

  // bullet list
  const ul = new Y.XmlElement('bulletList');
  for (const text of [
    'ShadowScoringService reads from provider_offers only',
    'CI gate: grep for raw_props usage in scoring paths',
    'Violation = sprint blocker (fail-closed)',
  ]) {
    const li = new Y.XmlElement('listItem');
    const lip = new Y.XmlElement('paragraph');
    const lit = new Y.XmlText();
    lit.insert(0, text);
    lip.insert(0, [lit]);
    li.insert(0, [lip]);
    ul.insert(ul.length, [li]);
  }
  frag.insert(frag.length, [ul]);

  // heading 3
  const h3b = new Y.XmlElement('heading');
  h3b.setAttribute('level', '3');
  const h3bt = new Y.XmlText();
  h3bt.insert(0, 'Code Surfaces');
  h3b.insert(0, [h3bt]);
  frag.insert(frag.length, [h3b]);

  // code block
  const cb = new Y.XmlElement('codeBlock');
  cb.setAttribute('language', 'typescript');
  const cbt = new Y.XmlText();
  cbt.insert(
    0,
    "// apps/api/src/services/ShadowScoringService.ts\nconst offers = await supabase\n  .from('provider_offers')\n  .select('*')\n  .eq('event_id', eventId);"
  );
  cb.insert(0, [cbt]);
  frag.insert(frag.length, [cb]);

  return Y.encodeStateAsUpdate(yDoc);
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Collaborator Test Upload                        ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const { token, wsId } = await authenticate();
  console.log(`Workspace: ${wsId}`);

  // Find DEV-19 (INVARIANT-001) by identifier
  const issues = await findAll(token, wsId, 'tracker:class:Issue', 300);
  const target = issues.find(
    i =>
      String(i.identifier ?? '') === 'DEV-19' || String(i.title ?? '').includes('[INVARIANT-001]')
  );
  if (!target) {
    console.error('Could not find DEV-19 / INVARIANT-001');
    // List some issue identifiers for debugging
    for (const i of issues.slice(0, 10)) {
      console.log(`  ${i.identifier}: ${i.title} (_id: ${String(i._id).substring(0, 30)})`);
    }
    return;
  }

  const objectId = String(target._id ?? '');
  console.log(`\nTarget: ${target.identifier} — ${target.title}`);
  console.log(`ObjectID: ${objectId}`);
  console.log(`Description field (${String(target.description ?? '').length} chars)`);

  // --- Strategy A: Upload ProseMirror JSON as versioned snapshot ---
  const pmJson = buildProseMirrorJSON();
  const jsonKey = `${objectId}-description-${Date.now()}`;
  console.log(`\n[A] Uploading ProseMirror JSON (${pmJson.length} bytes) → ${jsonKey}`);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: jsonKey,
      Body: Buffer.from(pmJson, 'utf-8'),
      ContentType: 'application/json',
    })
  );
  console.log('  ✅ Done');

  // --- Strategy B: Upload Y.js binary as base state ---
  const yBinary = buildYDoc('description');
  const baseKey = `${objectId}%description`;
  console.log(`\n[B] Uploading Y.js binary (${yBinary.length} bytes) → ${baseKey}`);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: baseKey,
      Body: Buffer.from(yBinary),
      ContentType: 'application/octet-stream',
    })
  );
  console.log('  ✅ Done');

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`Test URL: http://localhost:8087/workbench/unit-talk/tracker/${target.identifier}`);
  console.log(`Open this in the browser and check if the description renders.`);
  console.log(`If it still shows a spinner, try restarting the Collaborator:`);
  console.log(`  docker compose restart collaborator`);
  console.log(`═══════════════════════════════════════════════════`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
