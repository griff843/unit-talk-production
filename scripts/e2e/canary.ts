import fs from 'fs';
import path from 'path';
import { AlertSystem } from '../../apps/api/src/services/AlertSystem';

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

async function main() {
  const outDir = path.resolve(process.cwd(), 'out', 'e2e', 'canary');
  ensureDir(outDir);

  const alerts = new AlertSystem();
  const unified_id = 'canary-' + Date.now();
  const res1 = await alerts.queueAlert({ unified_id, type: 'line_movement', signal_strength: 0.8, metadata: { reason: 'ci-canary' } });

  // Immediately attempt second to ensure cooldown prevents duplicate
  const res2 = await alerts.queueAlert({ unified_id, type: 'line_movement', signal_strength: 0.8, metadata: { reason: 'ci-canary' } });

  const alertsPosted = res1.queued ? 1 : 0;
  const cooldownApplied = res2.queued === false;

  const payload = {
    ok: alertsPosted === 1 && cooldownApplied,
    alertsPosted,
    provider: 'discord',
    cooldownApplied,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(path.join(outDir, 'canary-run.json'), JSON.stringify(payload, null, 2));
  console.log('Canary E2E payload written');
}

main().catch(err => { console.error(err); process.exitCode = 1; });
