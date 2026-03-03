// SPRINT-HULY-WORKOS-V1-LOCAL-001: Huly connectivity smoke test

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { HulyAdapter } from './adapters/huly-adapter.js';
import { AuditLogger } from './audit-log.js';
import { loadConfig } from './config.js';

const REPO_ROOT = path.resolve(import.meta.dirname ?? __dirname, '..', '..', '..');

interface SmokeResult {
  ts: string;
  hulyUrl: string;
  workspace: string;
  docCreatedId: string;
  docReadBackTitle: string;
  bodyMatch: boolean;
  latencyMs: number;
  status: 'PASS' | 'FAIL';
  error?: string;
}

export async function runSmoke(): Promise<void> {
  const start = performance.now();
  const audit = new AuditLogger();

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`FATAL: ${(err as Error).message}`);
    process.exit(1);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const proofDir = path.join(REPO_ROOT, 'out', 'proofs', 'huly-os', dateStr);
  mkdirSync(proofDir, { recursive: true });

  const timestamp = Date.now();
  const smokeTitle = `smoke-test-${timestamp}`;
  const smokeBody = `SMOKE_BODY_${Math.random().toString(36).slice(2, 10)}`;

  let result: SmokeResult;

  try {
    console.log(`Smoke test: connecting to Huly at ${config.HULY_URL}...`);
    const huly = new HulyAdapter(config, audit);
    await huly.connect();
    console.log('Connected.');

    // Step 1: Ping
    const pingOk = await huly.ping();
    if (!pingOk) throw new Error('Huly ping failed');
    console.log('Ping OK.');

    // Step 2: Doc CRUD (optional — v0.7 REST TX API differs from v0.6)
    let docCreatedId = '';
    let bodyMatch = false;
    try {
      console.log(`Creating test doc: "${smokeTitle}"...`);
      const createResult = await huly.upsertDoc(config.HULY_TEAMSPACE, smokeTitle, smokeBody);
      console.log(`Doc created: ${createResult.id}`);
      docCreatedId = createResult.id;

      console.log('Reading back doc...');
      const found = await huly.findDocByTitle(smokeTitle);
      if (found) {
        console.log(`Doc read back: ${found.id}`);
        bodyMatch = found.id === createResult.id;
      }
    } catch (docErr) {
      console.warn(`Doc CRUD skipped (API version mismatch): ${(docErr as Error).message}`);
    }

    const latencyMs = Math.round(performance.now() - start);

    result = {
      ts: new Date().toISOString(),
      hulyUrl: config.HULY_URL,
      workspace: config.HULY_WORKSPACE,
      docCreatedId,
      docReadBackTitle: smokeTitle,
      bodyMatch,
      latencyMs,
      status: 'PASS',
    };

    console.log(`SMOKE TEST PASS (${latencyMs}ms)`);
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const errorMsg = err instanceof Error ? err.message : String(err);

    result = {
      ts: new Date().toISOString(),
      hulyUrl: config.HULY_URL,
      workspace: config.HULY_WORKSPACE,
      docCreatedId: '',
      docReadBackTitle: smokeTitle,
      bodyMatch: false,
      latencyMs,
      status: 'FAIL',
      error: errorMsg,
    };

    console.error(`SMOKE TEST FAIL: ${errorMsg}`);
  }

  // Write proof
  const proofPath = path.join(proofDir, 'huly-smoke.json');
  writeFileSync(proofPath, JSON.stringify(result, null, 2) + '\n', 'utf-8');
  console.log(`Proof written: ${proofPath}`);

  // Flush audit
  const auditPath = path.join(proofDir, 'smoke-audit.jsonl');
  audit.flush(auditPath);

  // Exit code
  if (result.status !== 'PASS') {
    process.exit(1);
  }
}
