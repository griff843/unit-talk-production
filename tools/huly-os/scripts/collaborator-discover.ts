/**
 * collaborator-discover.ts
 *
 * Phase 0 discovery script for the Collaborator Bridge sprint.
 * Inspects MinIO storage to understand how Huly's Collaborator service
 * stores Y.js documents, and checks whether issue descriptions use
 * Collaborator references or plain markdown.
 *
 * Usage: npx tsx scripts/collaborator-discover.ts
 */

import * as path from 'path';
import { fileURLToPath } from 'url';

import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  GetObjectCommand,
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

// ── Huly Auth ──────────────────────────────────────────────────────────

interface RpcResponse {
  result?: Record<string, unknown>;
  error?: { code: string };
}

async function authenticate(): Promise<{ workspaceToken: string; workspaceId: string }> {
  const loginRes = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'login',
      params: { email: HULY_EMAIL, password: HULY_PASSWORD },
    }),
  });
  const loginBody = (await loginRes.json()) as RpcResponse;
  if (loginBody.error) throw new Error(`Login failed: ${loginBody.error.code}`);
  const accountToken = loginBody.result!.token as string;

  const wsRes = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
    body: JSON.stringify({ method: 'selectWorkspace', params: { workspaceUrl: HULY_WORKSPACE } }),
  });
  const wsBody = (await wsRes.json()) as RpcResponse;
  if (wsBody.error) throw new Error(`selectWorkspace failed: ${wsBody.error.code}`);
  const workspaceToken = wsBody.result!.token as string;
  const workspaceId = (wsBody.result!.workspace ??
    wsBody.result!.workspaceId ??
    wsBody.result!.workspaceDataId) as string;

  return { workspaceToken, workspaceId };
}

async function findAll(
  token: string,
  wsId: string,
  cls: string,
  limit = 200
): Promise<Record<string, unknown>[]> {
  const opts = JSON.stringify({ limit });
  const url = `${HULY_URL}/_transactor/api/v1/find-all/${wsId}?class=${encodeURIComponent(cls)}&options=${encodeURIComponent(opts)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`findAll(${cls}) HTTP ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (Array.isArray(body)) return body;
  const b = body as Record<string, unknown>;
  if (Array.isArray(b.result)) return b.result as Record<string, unknown>[];
  if (Array.isArray(b.value)) return b.value as Record<string, unknown>[];
  return [];
}

// ── MinIO Discovery ────────────────────────────────────────────────────

async function discoverMinIO(knownContentRefs: string[]) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  PHASE 0A: MinIO Storage Discovery');
  console.log('═══════════════════════════════════════════════════\n');

  const s3 = new S3Client({
    endpoint: MINIO_ENDPOINT,
    region: 'us-east-1',
    credentials: { accessKeyId: MINIO_ACCESS_KEY, secretAccessKey: MINIO_SECRET_KEY },
    forcePathStyle: true,
  });

  // List all buckets
  const { Buckets } = await s3.send(new ListBucketsCommand({}));
  console.log(`Buckets found: ${Buckets?.length ?? 0}`);
  for (const b of Buckets ?? []) {
    console.log(`  - ${b.Name} (created: ${b.CreationDate?.toISOString()})`);
  }

  // For each bucket, list objects and search for content refs
  for (const bucket of Buckets ?? []) {
    console.log(`\n--- Scanning bucket: ${bucket.Name} ---`);

    let continuationToken: string | undefined;
    let objectCount = 0;
    const matchedKeys: string[] = [];

    do {
      const { Contents, NextContinuationToken, IsTruncated } = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket.Name!,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        })
      );
      continuationToken = IsTruncated ? NextContinuationToken : undefined;
      objectCount += Contents?.length ?? 0;

      for (const obj of Contents ?? []) {
        const key = obj.Key ?? '';
        // Check if any key contains a known content ref
        for (const ref of knownContentRefs) {
          if (key.includes(ref)) {
            matchedKeys.push(key);
          }
        }
        // Also check for generic content-ref pattern
        if (key.match(/[a-f0-9]+-content-\d+/) || key.includes('-content-')) {
          matchedKeys.push(key);
        }
      }
    } while (continuationToken);

    console.log(`  Total objects: ${objectCount}`);
    if (matchedKeys.length > 0) {
      console.log(`  Matched content-ref keys: ${matchedKeys.length}`);
      // Deduplicate
      const unique = [...new Set(matchedKeys)];
      for (const k of unique.slice(0, 20)) {
        console.log(`    -> ${k}`);
      }
      if (unique.length > 20) console.log(`    ... and ${unique.length - 20} more`);
    }

    // If we found matches, decode the first one
    if (matchedKeys.length > 0) {
      const firstKey = [...new Set(matchedKeys)][0];
      console.log(`\n  Decoding Y.Doc from: ${firstKey}`);
      try {
        const { Body, ContentLength } = await s3.send(
          new GetObjectCommand({ Bucket: bucket.Name!, Key: firstKey })
        );
        const binary = new Uint8Array(await Body!.transformToByteArray());
        console.log(`  Binary size: ${ContentLength ?? binary.length} bytes`);

        const yDoc = new Y.Doc();
        Y.applyUpdate(yDoc, binary);

        console.log(`  Y.Doc structure:`);
        for (const [key, value] of yDoc.share) {
          const typeName = value.constructor.name;
          console.log(`    Key "${key}" → ${typeName}`);

          // If it's an XmlFragment, inspect its children
          if (value instanceof Y.XmlFragment) {
            const fragment = value as Y.XmlFragment;
            console.log(`      Children: ${fragment.length}`);
            for (let i = 0; i < Math.min(fragment.length, 10); i++) {
              const child = fragment.get(i);
              if (child instanceof Y.XmlElement) {
                const attrs = child.getAttributes();
                const attrStr =
                  Object.keys(attrs).length > 0 ? ` attrs=${JSON.stringify(attrs)}` : '';
                console.log(
                  `      [${i}] <${child.nodeName}${attrStr}> (${child.length} children)`
                );
                // Show first text content
                if (child.length > 0) {
                  const firstChild = child.get(0);
                  if (firstChild instanceof Y.XmlText) {
                    const text = firstChild.toString();
                    console.log(
                      `           text: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`
                    );
                  }
                }
              } else if (child instanceof Y.XmlText) {
                const text = child.toString();
                console.log(
                  `      [${i}] #text: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`
                );
              }
            }
            if (fragment.length > 10)
              console.log(`      ... and ${fragment.length - 10} more nodes`);
          }

          // If it's a Map, inspect its keys
          if (value instanceof Y.Map) {
            const map = value as Y.Map<unknown>;
            console.log(`      Map keys: ${[...map.keys()].join(', ')}`);
            for (const [mk, mv] of map.entries()) {
              const val = typeof mv === 'string' ? mv.substring(0, 60) : JSON.stringify(mv);
              console.log(`        "${mk}" → ${val}`);
            }
          }
        }

        // Try to decode a second key for comparison
        const secondKey = [...new Set(matchedKeys)].find(k => k !== firstKey);
        if (secondKey) {
          console.log(`\n  Also checking: ${secondKey}`);
          const { Body: body2 } = await s3.send(
            new GetObjectCommand({ Bucket: bucket.Name!, Key: secondKey })
          );
          const bin2 = new Uint8Array(await body2!.transformToByteArray());
          const yDoc2 = new Y.Doc();
          Y.applyUpdate(yDoc2, bin2);
          console.log(`  Y.Doc keys: ${[...yDoc2.share.keys()].join(', ')}`);
          for (const [key, value] of yDoc2.share) {
            console.log(`    Key "${key}" → ${value.constructor.name}`);
          }
        }
      } catch (e) {
        console.error(`  Error decoding Y.Doc: ${(e as Error).message}`);
      }
    }

    // Also list a sample of ALL keys (first 30) to understand the general structure
    if (objectCount > 0) {
      console.log(`\n  Sample of all object keys (first 30):`);
      const { Contents } = await s3.send(
        new ListObjectsV2Command({ Bucket: bucket.Name!, MaxKeys: 30 })
      );
      for (const obj of Contents ?? []) {
        console.log(`    ${obj.Key}  (${obj.Size} bytes)`);
      }
    }
  }
}

// ── Huly Content Analysis ──────────────────────────────────────────────

async function analyzeContent(wt: string, wid: string) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  PHASE 0B: Content Field Analysis');
  console.log('═══════════════════════════════════════════════════\n');

  // Analyze documents
  console.log('--- Documents ---');
  const docs = await findAll(wt, wid, 'document:class:Document', 50);
  const knownContentRefs: string[] = [];

  for (const d of docs) {
    const title = String(d.title ?? '(untitled)');
    const content = String(d.content ?? '');
    const isRef =
      /^[a-f0-9]+-[a-z]+-\d+$/.test(content) || /^[a-f0-9-]+-content-\d+$/.test(content);
    const display = isRef
      ? `REF: ${content}`
      : `MARKDOWN (${content.length} chars): "${content.substring(0, 50)}..."`;
    console.log(`  ${title}`);
    console.log(`    content: ${display}`);
    if (isRef) knownContentRefs.push(content);
  }

  // Analyze issues (sample)
  console.log('\n--- Issues (checking description field) ---');
  const issues = await findAll(wt, wid, 'tracker:class:Issue', 300);

  let issueCollabCount = 0;
  let issueMarkdownCount = 0;
  let issueEmptyCount = 0;

  for (const iss of issues) {
    const identifier = String(iss.identifier ?? '');
    const title = String(iss.title ?? '');
    const desc = String(iss.description ?? '');

    if (!desc || desc === 'undefined' || desc === 'null') {
      issueEmptyCount++;
      continue;
    }

    const isRef = /^[a-f0-9]+-[a-z]+-\d+$/.test(desc) || /^[a-f0-9-]+-content-\d+$/.test(desc);
    if (isRef) {
      issueCollabCount++;
      if (issueCollabCount <= 3) {
        console.log(`  [COLLAB-REF] ${identifier}: ${title}`);
        console.log(`    description: ${desc}`);
        knownContentRefs.push(desc);
      }
    } else {
      issueMarkdownCount++;
      if (issueMarkdownCount <= 3) {
        console.log(`  [MARKDOWN] ${identifier}: ${title}`);
        console.log(`    description (${desc.length} chars): "${desc.substring(0, 60)}..."`);
      }
    }
  }

  console.log(`\n  Summary:`);
  console.log(`    Issues with Collaborator refs: ${issueCollabCount}`);
  console.log(`    Issues with raw markdown: ${issueMarkdownCount}`);
  console.log(`    Issues with empty/no description: ${issueEmptyCount}`);
  console.log(`    Total issues: ${issues.length}`);

  console.log(
    `\n    Documents with Collaborator refs: ${
      docs.filter(d => {
        const c = String(d.content ?? '');
        return /^[a-f0-9]+-[a-z]+-\d+$/.test(c) || /^[a-f0-9-]+-content-\d+$/.test(c);
      }).length
    }`
  );
  console.log(
    `    Documents with raw markdown: ${
      docs.filter(d => {
        const c = String(d.content ?? '');
        return (
          c.length > 0 && !(/^[a-f0-9]+-[a-z]+-\d+$/.test(c) || /^[a-f0-9-]+-content-\d+$/.test(c))
        );
      }).length
    }`
  );
  console.log(`    Total documents: ${docs.length}`);

  return knownContentRefs;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║  Collaborator Protocol Discovery — Phase 0       ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  // Step 1: Authenticate
  console.log('\nAuthenticating...');
  const { workspaceToken, workspaceId } = await authenticate();
  console.log(`  Workspace: ${workspaceId}`);

  // Step 2: Analyze content fields to find known Collaborator refs
  const knownRefs = await analyzeContent(workspaceToken, workspaceId);

  // Step 3: Discover MinIO storage using known refs
  await discoverMinIO(knownRefs);

  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║  Discovery Complete                               ║');
  console.log('╚═══════════════════════════════════════════════════╝');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
