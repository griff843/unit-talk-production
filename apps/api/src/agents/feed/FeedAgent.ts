/**
 * FeedAgent - MLB Props Ingestion
 *
 * Fetches live MLB odds from Odds API, transforms to unified format, writes to Supabase
 * Generates diagnostic artifacts in apps/api/out/ops/agents/
 */

import fs from 'node:fs';
import path from 'node:path';
import fetch from 'node-fetch';
import { oddsToUnifiedRows } from '../../lib/transform/oddsToUnified';
import { writeUnifiedPicks } from '../../lib/writer/unifiedPicksWriter';

const OUT_DIR = process.env.OPS_OUT_DIR || path.join(process.cwd(), 'apps/api/out/ops');

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export async function runFeedAgent(runId: string) {
  ensureDir(OUT_DIR);
  ensureDir(path.join(OUT_DIR, 'agents'));

  const started = Date.now();
  const apiKey = process.env.ODDS_API_KEY!;
  const regions = process.env.ODDS_FEED_REGIONS || 'us';
  const bookmakers = process.env.ODDS_FEED_BOOKMAKERS || 'draftkings,caesars,betmgm,fanduel';
  const markets = process.env.ODDS_FEED_MARKETS || 'h2h,spreads,totals,player_props';
  const lookaheadHours = Number(process.env.ODDS_FEED_LOOKAHEAD_HOURS || 72);

  if (!apiKey) {
    throw new Error('Missing ODDS_API_KEY environment variable');
  }

  // Odds API endpoint for MLB
  const url = `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?regions=${regions}&markets=${markets}&bookmakers=${bookmakers}&oddsFormat=american&dateFormat=iso&apiKey=${apiKey}`;

  console.log(`🎯 FeedAgent: Fetching MLB odds from Odds API...`);
  const resp = await fetch(url);

  if (!resp.ok) {
    const text = await resp.text();
    const errFile = path.join(OUT_DIR, `feedagent-error-${runId}.json`);
    fs.writeFileSync(errFile, JSON.stringify({ status: resp.status, body: text }, null, 2));
    throw new Error(`FeedAgent HTTP ${resp.status}: ${text.substring(0, 200)}`);
  }

  const events = (await resp.json()) as any[];
  console.log(`📊 FeedAgent: Received ${events.length} events from Odds API`);

  // Filter by commence_time within lookahead window
  const cutoff = Date.now() + lookaheadHours * 3600 * 1000;
  const filtered = events.filter((e: any) => {
    const commenceTime = new Date(e.commence_time).getTime();
    return commenceTime <= cutoff;
  });

  console.log(`✂️  FeedAgent: Filtered to ${filtered.length} events within ${lookaheadHours}h window`);

  // Transform to unified format
  const rows = oddsToUnifiedRows(filtered);
  console.log(`🔄 FeedAgent: Transformed to ${rows.length} unified pick rows`);

  // Write to Supabase
  const writeRes = await writeUnifiedPicks(rows, runId);
  console.log(`💾 FeedAgent: Write result - inserted: ${writeRes.inserted}, dedup: ${writeRes.skippedDedup}, errors: ${writeRes.errors}`);

  const elapsedMs = Date.now() - started;
  const outFile = path.join(OUT_DIR, `agents/feedagent-${runId}.json`);

  const result = {
    runId,
    events: filtered.length,
    mappedRows: rows.length,
    ...writeRes,
    ms: elapsedMs,
  };

  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`📄 FeedAgent: Artifact written to ${outFile}`);

  return { ...result, outFile };
}
