/**
 * Canary preflight checks for Cloud deployment
 */

import { supabase } from '../../lib/db/supabaseClient';
import fs from 'node:fs';
import path from 'node:path';

const RUNID = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = process.env.OPS_OUT_DIR || path.join(process.cwd(), 'apps/api/out/ops');

interface CanaryResult {
  runId: string;
  supabaseOk: boolean;
  oddsApiOk: boolean;
  discordOk: boolean;
  statuses: {
    supabase?: { status: number; message: string };
    oddsApi?: { status: number; message: string; remaining?: string };
    discord?: { status: number; message: string };
  };
  ts: string;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const result: CanaryResult = {
    runId: RUNID,
    supabaseOk: false,
    oddsApiOk: false,
    discordOk: false,
    statuses: {},
    ts: new Date().toISOString(),
  };

  // 1. Supabase check
  console.log('🔍 Checking Supabase connection...');
  try {
    const { data, error } = await supabase.rpc('version');
    if (error) throw error;
    result.supabaseOk = true;
    result.statuses.supabase = { status: 200, message: 'Connected' };
    console.log('✅ Supabase: OK');
  } catch (err: any) {
    result.statuses.supabase = { status: 500, message: err.message || 'Connection failed' };
    console.error('❌ Supabase: FAILED -', err.message);
  }

  // 2. Odds API check
  console.log('🔍 Checking Odds API...');
  try {
    const ODDS_API_KEY = process.env.ODDS_API_KEY;
    if (!ODDS_API_KEY) throw new Error('ODDS_API_KEY not set');

    const res = await fetch(`https://api.the-odds-api.com/v4/sports?apiKey=${ODDS_API_KEY}`);
    const remaining = res.headers.get('x-requests-remaining');

    if (res.status === 200) {
      result.oddsApiOk = true;
      result.statuses.oddsApi = { status: 200, message: 'Connected', remaining: remaining || 'unknown' };
      console.log(`✅ Odds API: OK (${remaining || '?'} requests remaining)`);
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err: any) {
    result.statuses.oddsApi = { status: 500, message: err.message || 'Connection failed' };
    console.error('❌ Odds API: FAILED -', err.message);
  }

  // 3. Discord check (optional)
  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  if (DISCORD_BOT_TOKEN) {
    console.log('🔍 Checking Discord bot token...');
    try {
      const res = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
      });

      if (res.status === 200) {
        result.discordOk = true;
        result.statuses.discord = { status: 200, message: 'Token valid' };
        console.log('✅ Discord: OK');
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err: any) {
      result.statuses.discord = { status: 500, message: err.message || 'Token validation failed' };
      console.error('❌ Discord: FAILED -', err.message);
    }
  } else {
    result.discordOk = true; // Optional, pass if not configured
    result.statuses.discord = { status: 0, message: 'Not configured (optional)' };
    console.log('⚠️  Discord: Not configured (optional)');
  }

  // Write result
  const outFile = path.join(OUT_DIR, `canary_${RUNID}.json`);
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`\n📄 Canary result: ${outFile}`);

  // Exit code based on critical checks
  const allOk = result.supabaseOk && result.oddsApiOk && result.discordOk;
  if (!allOk) {
    console.error('\n❌ Canary checks FAILED');
    process.exit(1);
  }

  console.log('\n✅ Canary checks PASSED');
  process.exit(0);
})();
