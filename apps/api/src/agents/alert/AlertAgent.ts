/**
 * AlertAgent - Minimal Smoke Test Version
 *
 * Simulates Discord alert workflow for E2E validation
 * Checks for Discord credentials but makes no actual posts in smoke mode
 */

import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = process.env.OPS_OUT_DIR || path.join(process.cwd(), 'apps/api/out/ops');

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export async function runAlertAgent(runId: string) {
  ensureDir(OUT_DIR);
  ensureDir(path.join(OUT_DIR, 'agents'));

  console.log('🎯 AlertAgent: Preparing alert metadata...');

  // Check if Discord bot envs are present (but don't actually post in smoke mode)
  const channel = process.env.DISCORD_ALERT_CHANNEL_ID || 'unknown';
  const hasToken = !!process.env.DISCORD_BOT_TOKEN;
  const ts = new Date().toISOString();

  // For smoke: assume posted if token exists
  const posted = hasToken;

  console.log(`${posted ? '✅' : '⚠️'} AlertAgent: Discord token ${hasToken ? 'configured' : 'missing'}`);
  console.log(`📢 AlertAgent: Would post to channel ${channel}`);

  const outFile = path.join(OUT_DIR, `agents/alertagent-${runId}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    runId,
    posted,
    channel,
    timestamp: ts,
    note: 'smoke mode - no actual Discord post made'
  }, null, 2));

  return { posted, channel, timestamp: ts, outFile };
}
