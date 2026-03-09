/**
 * collaborator-probe.ts
 *
 * Empirical probe: try to decode smaller Y.js binaries and test creating
 * a Y.js document that Huly's Collaborator can read.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as Y from 'yjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const HULY_URL = process.env.HULY_URL ?? 'http://localhost:8087';
const HULY_EMAIL = process.env.HULY_EMAIL ?? 'ops@unit-talk.local';
const HULY_PASSWORD = process.env.HULY_PASSWORD ?? 'password';
const HULY_WORKSPACE = process.env.HULY_WORKSPACE ?? 'unit-talk';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? 'http://localhost:9000';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? 'minioadmin';
const BUCKET = '61b570c5-eee6-458c-9458-72108b5f2dff';

const s3 = new S3Client({
  endpoint: MINIO_ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: MINIO_ACCESS_KEY, secretAccessKey: MINIO_SECRET_KEY },
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
  const ld = (await lr.json()) as { result?: Record<string, unknown>; error?: { code: string } };
  if (ld.error) throw new Error(`Login failed: ${ld.error.code}`);
  const token = ld.result!.token as string;

  const wr = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ method: 'selectWorkspace', params: { workspaceUrl: HULY_WORKSPACE } }),
  });
  const wd = (await wr.json()) as { result?: Record<string, unknown>; error?: { code: string } };
  if (wd.error) throw new Error(`selectWorkspace failed: ${wd.error.code}`);
  return {
    token: wd.result!.token as string,
    wsId: (wd.result!.workspace ?? wd.result!.workspaceId) as string,
  };
}

async function findAll(token: string, wsId: string, cls: string, limit = 200) {
  const opts = JSON.stringify({ limit });
  const url = `${HULY_URL}/_transactor/api/v1/find-all/${wsId}?class=${encodeURIComponent(cls)}&options=${encodeURIComponent(opts)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`findAll(${cls}) HTTP ${res.status}`);
  const body = await res.json();
  return Array.isArray(body)
    ? body
    : (((body as Record<string, unknown>).result ?? []) as Record<string, unknown>[]);
}

// ── Probe 1: Try decoding smallest files ────────────────────────────

async function probeSmallFiles() {
  console.log('\n═══ Probe 1: Decode smallest MinIO objects ═══\n');

  // Get all objects sorted by size
  const { Contents } = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, MaxKeys: 100 }));
  const sorted = (Contents ?? []).sort((a, b) => (a.Size ?? 0) - (b.Size ?? 0));

  // Try the 5 smallest
  for (const obj of sorted.slice(0, 8)) {
    const key = obj.Key!;
    const size = obj.Size!;
    console.log(`  ${key} (${size} bytes)`);

    try {
      const { Body } = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      const binary = new Uint8Array(await Body!.transformToByteArray());

      // Print raw hex of first 32 bytes
      const hex = Array.from(binary.slice(0, 32))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      console.log(`    hex: ${hex}`);

      // Try Y.Doc decode
      const yDoc = new Y.Doc();
      Y.applyUpdate(yDoc, binary);
      console.log(`    Y.Doc keys: [${[...yDoc.share.keys()].join(', ')}]`);
      for (const [k, v] of yDoc.share) {
        console.log(`      "${k}" → ${v.constructor.name}`);
        if (v instanceof Y.XmlFragment) {
          console.log(`        children: ${v.length}`);
          if (v.length > 0) {
            const first = v.get(0);
            if (first instanceof Y.XmlElement) {
              console.log(`        first child: <${first.nodeName}>`);
            } else if (first instanceof Y.XmlText) {
              console.log(`        first child: #text = "${first.toString().substring(0, 60)}"`);
            }
          }
        }
        if (v instanceof Y.Text) {
          console.log(`        text: "${v.toString().substring(0, 100)}"`);
        }
      }
      console.log(`    ✅ Decoded OK`);
    } catch (e) {
      console.log(`    ❌ Decode failed: ${(e as Error).message}`);
    }
    console.log('');
  }
}

// ── Probe 2: Try the %description keys (base state) ─────────────────

async function probePercentKeys() {
  console.log('\n═══ Probe 2: Decode %description keys (base state) ═══\n');

  const { Contents } = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, MaxKeys: 100 }));
  const percentKeys = (Contents ?? []).filter(o => o.Key?.includes('%'));

  for (const obj of percentKeys.slice(0, 5)) {
    const key = obj.Key!;
    const size = obj.Size!;
    console.log(`  ${key} (${size} bytes)`);

    try {
      const { Body } = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      const binary = new Uint8Array(await Body!.transformToByteArray());

      const hex = Array.from(binary.slice(0, 32))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      console.log(`    hex: ${hex}`);

      const yDoc = new Y.Doc();
      Y.applyUpdate(yDoc, binary);
      console.log(`    Y.Doc keys: [${[...yDoc.share.keys()].join(', ')}]`);
      for (const [k, v] of yDoc.share) {
        console.log(`      "${k}" → ${v.constructor.name}`);
        if (v instanceof Y.XmlFragment) {
          console.log(`        children: ${v.length}`);
          for (let i = 0; i < Math.min(v.length, 5); i++) {
            const child = v.get(i);
            if (child instanceof Y.XmlElement) {
              console.log(
                `        [${i}] <${child.nodeName}> attrs=${JSON.stringify(child.getAttributes())}`
              );
              for (let j = 0; j < Math.min(child.length, 3); j++) {
                const sub = child.get(j);
                if (sub instanceof Y.XmlText) {
                  console.log(`            text: "${sub.toString().substring(0, 80)}"`);
                } else if (sub instanceof Y.XmlElement) {
                  console.log(`            <${sub.nodeName}>`);
                }
              }
            }
          }
        }
      }
      console.log(`    ✅ Decoded OK`);
    } catch (e) {
      console.log(`    ❌ Decode failed: ${(e as Error).message}`);
    }
    console.log('');
  }
}

// ── Probe 3: Create a test Y.Doc and upload ──────────────────────────

async function probeCreateAndUpload() {
  console.log('\n═══ Probe 3: Create test Y.Doc and upload to MinIO ═══\n');

  // Find a TX-created issue to test with (one of our invariant issues)
  const { token, wsId } = await authenticate();
  const issues = await findAll(token, wsId, 'tracker:class:Issue', 300);

  // Find DEV-19 (INVARIANT-001)
  const target = issues.find(i => String(i.title ?? '').includes('[INVARIANT-001]'));
  if (!target) {
    console.log('  Could not find INVARIANT-001 issue to test with');
    return;
  }

  const objectId = String(target._id ?? '');
  const currentDesc = String(target.description ?? '');
  console.log(`  Target: ${target.identifier} — ${target.title}`);
  console.log(`  ObjectID: ${objectId}`);
  console.log(
    `  Current description (${currentDesc.length} chars): "${currentDesc.substring(0, 80)}..."`
  );

  // Create a Y.Doc with simple content
  const yDoc = new Y.Doc();
  const xmlFragment = yDoc.getXmlFragment('default');

  // Add a heading
  const heading = new Y.XmlElement('heading');
  heading.setAttribute('level', '1');
  const headingText = new Y.XmlText();
  headingText.insert(0, 'INVARIANT-001: Scoring Source');
  heading.insert(0, [headingText]);
  xmlFragment.insert(0, [heading]);

  // Add a paragraph
  const para = new Y.XmlElement('paragraph');
  const paraText = new Y.XmlText();
  paraText.insert(0, 'This is a test description created by the Collaborator bridge probe.');
  para.insert(0, [paraText]);
  xmlFragment.insert(xmlFragment.length, [para]);

  // Encode
  const binary = Y.encodeStateAsUpdate(yDoc);
  console.log(`  Created Y.Doc: ${binary.length} bytes`);
  console.log(`  Y.Doc keys: [${[...yDoc.share.keys()].join(', ')}]`);

  // Upload as %description (base state key)
  const baseKey = `${objectId}%description`;
  console.log(`  Uploading to: ${BUCKET}/${baseKey}`);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: baseKey,
      Body: Buffer.from(binary),
      ContentType: 'application/octet-stream',
    })
  );
  console.log(`  ✅ Uploaded base state`);

  // Also upload as versioned key
  const versionedKey = `${objectId}-description-${Date.now()}`;
  console.log(`  Uploading to: ${BUCKET}/${versionedKey}`);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: versionedKey,
      Body: Buffer.from(binary),
      ContentType: 'application/octet-stream',
    })
  );
  console.log(`  ✅ Uploaded versioned snapshot`);

  console.log(
    `\n  Now open in Huly UI: http://localhost:8087/workbench/unit-talk/tracker/${target.identifier}`
  );
  console.log('  Check if the description renders instead of showing a spinner.');
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║  Collaborator Probe — Empirical Testing           ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  await probeSmallFiles();
  await probePercentKeys();
  await probeCreateAndUpload();

  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║  Probe Complete                                    ║');
  console.log('╚═══════════════════════════════════════════════════╝');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
