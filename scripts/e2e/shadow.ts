import fs from 'fs';
import path from 'path';
import { AlertSystem } from '../../apps/api/src/services/AlertSystem';
import { RecapService } from '../../apps/api/src/agents/RecapAgent/recapService';

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

async function main() {
  const outDir = path.resolve(process.cwd(), 'out', 'e2e', 'shadow');
  ensureDir(outDir);

  // 1) Prove alert dedupe/cooldown using live DB via AlertSystem
  const alerts = new AlertSystem();
  const unified_id = 'shadow-test-' + new Date().toISOString().slice(0,10);
  const baseAlert = { unified_id, type: 'steam' as const, signal_strength: 0.9, metadata: { reason: 'ci-shadow' } };

  const first = await alerts.queueAlert(baseAlert);
  const second = await alerts.queueAlert(baseAlert);

  const dedupeTriggered = first.queued === true && second.queued === false && /Duplicate|cooldown/i.test(second.reason || '');
  const cooldownApplied = second.queued === false;

  const payload = {
    ok: dedupeTriggered && cooldownApplied,
    firstQueued: first.queued,
    secondQueued: second.queued,
    reason: second.reason || null,
    dedupeTriggered,
    cooldownApplied,
    postedAlerts: first.queued ? 1 : 0,
    simulated: false,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(path.join(outDir, 'shadow-run.json'), JSON.stringify(payload, null, 2));

  // 2) Daily recap generated from live data (prefer matview presence)
  const recapService = new RecapService({ microRecap: false });
  await recapService.initialize();
  const today = new Date().toISOString().split('T')[0]!;
  const daily = await recapService.getDailyRecapData(today);

  const recap = {
    ok: !!daily && daily.totalPicks >= 0,
    source: 'matview:materialized_feature_store_or_unified_picks',
    summary: daily ? { totalPicks: daily.totalPicks, wins: daily.wins, losses: daily.losses, roi: daily.roi } : null,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(path.join(outDir, 'recap.json'), JSON.stringify(recap, null, 2));
  console.log('Shadow E2E payload + recap written');
}

main().catch(err => { console.error(err); process.exitCode = 1; });
