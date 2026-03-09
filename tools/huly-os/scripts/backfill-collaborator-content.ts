/**
 * backfill-collaborator-content.ts
 *
 * Backfills Y.js collaborative content for all TX-created issues and documents
 * so their descriptions/content render in Huly's Collaborator UI.
 *
 * Usage:
 *   npx tsx scripts/backfill-collaborator-content.ts              # dry-run
 *   npx tsx scripts/backfill-collaborator-content.ts --live        # live run
 *   npx tsx scripts/backfill-collaborator-content.ts --live --restart  # + restart collaborator
 */

import * as path from 'path';
import { fileURLToPath } from 'url';

import * as dotenv from 'dotenv';

import { CollaboratorBridge } from '../daemon/collaborator-bridge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const HULY_URL = process.env.HULY_URL ?? 'http://localhost:8087';
const HULY_EMAIL = process.env.HULY_EMAIL ?? 'ops@unit-talk.local';
const HULY_PASSWORD = process.env.HULY_PASSWORD ?? 'password';
const HULY_WORKSPACE = process.env.HULY_WORKSPACE ?? 'unit-talk';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? 'http://localhost:9000';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? 'minioadmin';

// Workspace UUID = MinIO bucket
const BUCKET = process.env.HULY_WORKSPACE_ID ?? '61b570c5-eee6-458c-9458-72108b5f2dff';

const DRY_RUN = !process.argv.includes('--live');
const RESTART_COLLAB = process.argv.includes('--restart');

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

async function findAll(token: string, wsId: string, cls: string, limit = 500) {
  const opts = JSON.stringify({ limit });
  const url = `${HULY_URL}/_transactor/api/v1/find-all/${wsId}?class=${encodeURIComponent(cls)}&options=${encodeURIComponent(opts)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`findAll(${cls}) HTTP ${res.status}`);
  const body = await res.json();
  const b = body as Record<string, unknown>;
  return (b.value ?? b.result ?? (Array.isArray(body) ? body : [])) as Record<string, unknown>[];
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log(
    `║  Collaborator Content Backfill  ${DRY_RUN ? '[DRY RUN]' : '[LIVE]'}             ║`
  );
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  const { token, wsId } = await authenticate();
  console.log(`Workspace: ${wsId}\n`);

  const bridge = new CollaboratorBridge({
    minioEndpoint: MINIO_ENDPOINT,
    minioAccessKey: MINIO_ACCESS_KEY,
    minioSecretKey: MINIO_SECRET_KEY,
    bucket: BUCKET,
  });

  // ── Issues ──────────────────────────────────────────────────────────

  console.log('═══ Issues (description → Y.js) ═══\n');
  const issues = await findAll(token, wsId, 'tracker:class:Issue', 500);

  let issueBackfilled = 0;
  let issueSkipped = 0;
  let issueEmpty = 0;

  for (const issue of issues) {
    const id = String(issue._id ?? '');
    const identifier = String(issue.identifier ?? '');
    const title = String(issue.title ?? '');
    const desc = String(issue.description ?? '');

    if (!desc || desc === 'undefined' || desc === 'null' || desc.trim().length === 0) {
      issueEmpty++;
      continue;
    }

    // Check if Y.js content already exists
    const exists = await bridge.contentExists(id, 'description');
    if (exists) {
      issueSkipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY] ${identifier}: ${title.substring(0, 60)}`);
      console.log(`        description: ${desc.length} chars → would create Y.js binary`);
      issueBackfilled++;
    } else {
      try {
        const result = await bridge.createCollaborativeContent(id, 'description', desc);
        console.log(`  [OK]  ${identifier}: ${title.substring(0, 60)}`);
        console.log(`        → ${result.key} (${result.bytes} bytes)`);
        issueBackfilled++;
      } catch (e) {
        console.error(`  [ERR] ${identifier}: ${(e as Error).message}`);
      }
    }
  }

  console.log(`\n  Issues summary:`);
  console.log(`    Backfilled: ${issueBackfilled}`);
  console.log(`    Skipped (already has Y.js): ${issueSkipped}`);
  console.log(`    Empty description: ${issueEmpty}`);
  console.log(`    Total: ${issues.length}\n`);

  // ── Documents ───────────────────────────────────────────────────────

  console.log('═══ Documents (content → Y.js) ═══\n');
  const docs = await findAll(token, wsId, 'document:class:Document', 200);

  let docBackfilled = 0;
  let docSkipped = 0;
  let docCollabRef = 0;
  let docEmpty = 0;

  // Pattern for Collaborator refs (e.g., "69a6e421972d134b5e8c1260-content-1772545066195")
  const collabRefPattern = /^[a-f0-9]+-[a-z]+-\d+$/;

  for (const doc of docs) {
    const id = String(doc._id ?? '');
    const title = String(doc.title ?? '(untitled)');
    const content = String(doc.content ?? '');

    if (!content || content === 'undefined' || content === 'null') {
      docEmpty++;
      continue;
    }

    // Skip if already a Collaborator reference
    if (collabRefPattern.test(content)) {
      docCollabRef++;
      continue;
    }

    // Check if Y.js content already exists
    const exists = await bridge.contentExists(id, 'content');
    if (exists) {
      docSkipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY] "${title}"`);
      console.log(`        content: ${content.length} chars → would create Y.js binary`);
      docBackfilled++;
    } else {
      try {
        const result = await bridge.createCollaborativeContent(id, 'content', content);
        console.log(`  [OK]  "${title}"`);
        console.log(`        → ${result.key} (${result.bytes} bytes)`);
        docBackfilled++;
      } catch (e) {
        console.error(`  [ERR] "${title}": ${(e as Error).message}`);
      }
    }
  }

  console.log(`\n  Documents summary:`);
  console.log(`    Backfilled: ${docBackfilled}`);
  console.log(`    Already Collaborator ref: ${docCollabRef}`);
  console.log(`    Skipped (already has Y.js): ${docSkipped}`);
  console.log(`    Empty content: ${docEmpty}`);
  console.log(`    Total: ${docs.length}\n`);

  // ── Summary ─────────────────────────────────────────────────────────

  console.log('═══════════════════════════════════════════════════════');
  console.log(
    `Total backfilled: ${issueBackfilled + docBackfilled} (${issueBackfilled} issues + ${docBackfilled} docs)`
  );

  if (DRY_RUN) {
    console.log('\nThis was a DRY RUN. Re-run with --live to apply changes.');
  } else if (RESTART_COLLAB) {
    console.log('\nRestarting Collaborator container to clear cache...');
    const { execSync } = await import('child_process');
    try {
      execSync('docker compose restart collaborator', {
        cwd: path.resolve(__dirname, '../docker'),
        stdio: 'inherit',
      });
      console.log('Collaborator restarted.');
    } catch {
      console.log('Could not restart collaborator. Run manually:');
      console.log('  cd tools/huly-os/docker && docker compose restart collaborator');
    }
  } else {
    console.log('\nDone. You may want to restart the Collaborator:');
    console.log('  cd tools/huly-os/docker && docker compose restart collaborator');
  }

  console.log('═══════════════════════════════════════════════════════');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
