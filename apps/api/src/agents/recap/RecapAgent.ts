/**
 * RecapAgent - Minimal Smoke Test Version
 *
 * Generates simple recap artifact for E2E validation
 * Safe non-destructive operations only
 */

import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = process.env.OPS_OUT_DIR || path.join(process.cwd(), 'apps/api/out/ops');

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export async function runRecapAgent(runId: string) {
  ensureDir(OUT_DIR);
  ensureDir(path.join(OUT_DIR, 'agents'));

  console.log('🎯 RecapAgent: Generating recap...');

  const ts = new Date().toISOString();
  const text = `E2E Recap ${runId} @ ${ts}`;

  console.log(`📝 RecapAgent: ${text}`);

  const outFile = path.join(OUT_DIR, `agents/recapagent-${runId}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    runId,
    recap: text,
    timestamp: ts,
    note: 'smoke mode recap'
  }, null, 2));

  return { recap: text, timestamp: ts, outFile };
}
