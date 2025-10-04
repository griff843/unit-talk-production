/**
 * ApprovalAgent - Minimal Smoke Test Version
 *
 * Simulates approval workflow for E2E validation
 * Safe non-destructive operations only
 */

import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = process.env.OPS_OUT_DIR || path.join(process.cwd(), 'apps/api/out/ops');

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export async function runApprovalAgent(runId: string) {
  ensureDir(OUT_DIR);
  ensureDir(path.join(OUT_DIR, 'agents'));

  console.log('🎯 ApprovalAgent: Running smoke test approval...');

  // For smoke: simulate approval count based on scoring output scenario
  const approved = Math.floor(Math.random() * 10) + 1;
  console.log(`✅ ApprovalAgent: Simulated ${approved} approvals`);

  const outFile = path.join(OUT_DIR, `agents/approvalagent-${runId}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    runId,
    approved,
    rationale: 'smoke approval - simulated for E2E validation'
  }, null, 2));

  return { approved, outFile };
}
