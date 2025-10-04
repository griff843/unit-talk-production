/**
 * Cloud Verification Script
 *
 * Verifies Supabase Cloud data state after E2E run
 * - Counts unified_picks total and last 1h (sport='mlb')
 * - Counts games for last 72h
 * - Groups unified_picks by market to show mix
 * - Writes apps/api/out/ops/verify_cloud_<RUNID>.json
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

interface VerificationResult {
  runId: string;
  timestamp: string;
  supabaseUrl: string;
  counts: {
    totalPicks: number;
    picksLast1h: number;
    picksLast24h: number;
    gamesNext72h: number;
    mlbPicks: number;
  };
  marketMix: Record<string, number>;
  bookmakerMix: Record<string, number>;
  samplePicks: any[];
  discordMetadata?: {
    channel: string;
    lastPostTimestamp?: string;
    lastRunId?: string;
  };
  status: 'PASS' | 'FAIL';
  errors: string[];
}

async function verifyCloud(): Promise<VerificationResult> {
  const runId = `verify-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result: VerificationResult = {
    runId,
    timestamp,
    supabaseUrl: supabaseUrl || 'NOT_SET',
    counts: {
      totalPicks: 0,
      picksLast1h: 0,
      picksLast24h: 0,
      gamesNext72h: 0,
      mlbPicks: 0,
    },
    marketMix: {},
    bookmakerMix: {},
    samplePicks: [],
    discordMetadata: {
      channel: process.env.DISCORD_ALERT_CHANNEL_ID || 'NOT_SET',
    },
    status: 'PASS',
    errors: [],
  };

  if (!supabaseUrl || !supabaseKey) {
    result.status = 'FAIL';
    result.errors.push('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return result;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    // Total picks
    const { count: totalPicks, error: totalError } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;
    result.counts.totalPicks = totalPicks || 0;

    // Picks last 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: picksLast1h, error: last1hError } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo);

    if (last1hError) throw last1hError;
    result.counts.picksLast1h = picksLast1h || 0;

    // Picks last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: picksLast24h, error: last24hError } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo);

    if (last24hError) throw last24hError;
    result.counts.picksLast24h = picksLast24h || 0;

    // MLB picks
    const { count: mlbPicks, error: mlbError } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'mlb');

    if (mlbError) throw mlbError;
    result.counts.mlbPicks = mlbPicks || 0;

    // Games next 72h
    const seventyTwoHoursFromNow = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const { count: gamesNext72h, error: gamesError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .gte('game_date', new Date().toISOString())
      .lte('game_date', seventyTwoHoursFromNow);

    if (gamesError) throw gamesError;
    result.counts.gamesNext72h = gamesNext72h || 0;

    // Market mix (group by market)
    const { data: marketData, error: marketError } = await supabase
      .from('unified_picks')
      .select('market')
      .limit(10000);

    if (marketError) throw marketError;
    if (marketData) {
      result.marketMix = marketData.reduce((acc: Record<string, number>, row: any) => {
        acc[row.market] = (acc[row.market] || 0) + 1;
        return acc;
      }, {});
    }

    // Bookmaker mix
    const { data: bookmakerData, error: bookmakerError } = await supabase
      .from('unified_picks')
      .select('bookmaker_key')
      .limit(10000);

    if (bookmakerError) throw bookmakerError;
    if (bookmakerData) {
      result.bookmakerMix = bookmakerData.reduce((acc: Record<string, number>, row: any) => {
        acc[row.bookmaker_key] = (acc[row.bookmaker_key] || 0) + 1;
        return acc;
      }, {});
    }

    // Sample picks (last 5)
    const { data: sampleData, error: sampleError } = await supabase
      .from('unified_picks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (sampleError) throw sampleError;
    result.samplePicks = sampleData || [];

  } catch (err: any) {
    result.status = 'FAIL';
    result.errors.push(err.message);
  }

  return result;
}

async function main() {
  console.log('☁️  Cloud Verification Starting...\n');

  const result = await verifyCloud();

  // Write to out/ops/verify_cloud_<RUNID>.json
  const outDir = path.join(__dirname, '../../../../out/ops');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outFile = path.join(outDir, `verify_cloud_${result.runId}.json`);
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf-8');

  // Console output
  console.log(`📊 Cloud Verification Results (${result.runId})\n`);
  console.log(`Supabase URL: ${result.supabaseUrl}`);
  console.log(`Timestamp: ${result.timestamp}\n`);

  console.log('📈 Counts:');
  console.log(`   Total Picks: ${result.counts.totalPicks}`);
  console.log(`   Picks (last 1h): ${result.counts.picksLast1h}`);
  console.log(`   Picks (last 24h): ${result.counts.picksLast24h}`);
  console.log(`   MLB Picks: ${result.counts.mlbPicks}`);
  console.log(`   Games (next 72h): ${result.counts.gamesNext72h}\n`);

  console.log('🎯 Market Mix:');
  Object.entries(result.marketMix).forEach(([market, count]) => {
    console.log(`   ${market}: ${count}`);
  });
  console.log('');

  console.log('📚 Bookmaker Mix:');
  Object.entries(result.bookmakerMix).forEach(([bookmaker, count]) => {
    console.log(`   ${bookmaker}: ${count}`);
  });
  console.log('');

  console.log(`\n🎯 Status: ${result.status}`);
  console.log(`📄 Report saved to: ${outFile}\n`);

  if (result.errors.length > 0) {
    console.error('❌ Errors:');
    result.errors.forEach(err => console.error(`   - ${err}`));
    console.error('');
  }

  if (result.status === 'FAIL') {
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('💥 Fatal error during verification:', err);
  process.exit(1);
});
