#!/usr/bin/env ts-node

/**
 * liveSportsGameOdds.ts
 *
 * Polls the SportsGameOdds (SGO) API for today's games + props and ingests into
 * public.games and public.raw_props. Inserts are idempotent via unique keys:
 * - games: external_game_id
 * - raw_props: (source, external_game_id, external_prop_id)
 *
 * All inserted props are marked source='sgo'. After insertion, triggers
 * ScoringAgent. If any games are already final, best-effort trigger of
 * SettlementAgent is attempted (no-op if unavailable).
 */

import 'dotenv/config';
import path from 'node:path';
import process from 'node:process';

// Reuse the API service-role Supabase client
// Relative import from monorepo (apps/api)
// Falls back to local createClient if import fails
let supabase: any = null;

async function getSupabase() {
  if (supabase) return supabase;
  try {
    const svc = await import(path.resolve(process.cwd(), 'apps/api/src/services/supabaseClient'));
    supabase = svc.supabaseClient || svc.supabase;
  } catch (_err) {
    // Fallback lightweight client
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env['SUPABASE_URL'] as string;
    const key = (process.env['SUPABASE_SERVICE_ROLE_KEY'] || process.env['SUPABASE_KEY']) as string;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    supabase = createClient(url, key);
  }
  return supabase;
}

function getTodayUTC(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = `${now.getUTCMonth() + 1}`.padStart(2, '0');
  const d = `${now.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseArgv(): { sports: string } {
  const sportsArg = process.argv.find(a => a.startsWith('--sports='));
  const sports = sportsArg ? sportsArg.split('=')[1] || 'all' : 'all';
  return { sports };
}

// Types we need minimally
type SgoGame = {
  id: string; // external game id
  sport: string;
  league?: string;
  home_team?: string;
  away_team?: string;
  start_time?: string; // ISO
  status?: string; // scheduled|in_progress|final
};

type SgoProp = {
  id: string; // external prop id
  external_game_id: string;
  sport?: string;
  league?: string;
  player_name?: string;
  team?: string;
  opponent?: string;
  market?: string; // e.g., Points, Rebounds
  market_type?: string; // e.g., player_prop
  stat_type?: string; // normalized stat name
  line?: number;
  over_odds?: number;
  under_odds?: number;
  game_time?: string; // ISO
};

async function fetchSgoGames(date: string, sports: string): Promise<SgoGame[]> {
  const key = process.env['SPORTSGAMEODDS_KEY'];
  const base = process.env['SPORTSGAMEODDS_BASE_URL'] || 'https://api.sportsgameodds.com';
  if (!key) {
    console.warn('SPORTSGAMEODDS_KEY not set; returning empty games list');
    return [];
  }
  const url = `${base}/v1/games?date=${encodeURIComponent(date)}&sports=${encodeURIComponent(sports)}`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SGO games fetch failed: ${res.status} ${res.statusText} ${text}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data.games || []);
}

async function fetchSgoProps(date: string, sports: string): Promise<SgoProp[]> {
  const key = process.env['SPORTSGAMEODDS_KEY'];
  const base = process.env['SPORTSGAMEODDS_BASE_URL'] || 'https://api.sportsgameodds.com';
  if (!key) {
    console.warn('SPORTSGAMEODDS_KEY not set; returning empty props list');
    return [];
  }
  const url = `${base}/v1/props?date=${encodeURIComponent(date)}&sports=${encodeURIComponent(sports)}`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SGO props fetch failed: ${res.status} ${res.statusText} ${text}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data.props || []);
}

async function upsertGames(games: SgoGame[]): Promise<SgoGame[]> {
  if (!games.length) return [];
  const client = await getSupabase();
  const rows = games.map(g => ({
    external_game_id: g.id,
    sport: g.sport,
    league: g.league ?? null,
    home_team: g.home_team ?? null,
    away_team: g.away_team ?? null,
    game_date: g.start_time ?? new Date().toISOString(),
    status: g.status ?? null,
  }));
  const { data, error } = await client
    .from('games')
    .upsert(rows, { onConflict: 'external_game_id' })
    .select();
  if (error) throw error;
  return data || [];
}

async function upsertProps(props: SgoProp[]): Promise<number> {
  if (!props.length) return 0;
  const client = await getSupabase();
  const rows = props.map(p => ({
    source: 'sgo',
    external_game_id: p.external_game_id,
    external_prop_id: p.id,
    sport: p.sport ?? null,
    league: p.league ?? null,
    player_name: p.player_name ?? null,
    team: p.team ?? null,
    opponent: p.opponent ?? null,
    market: p.market ?? p.stat_type ?? null,
    market_type: p.market_type ?? 'player_prop',
    stat_type: p.stat_type ?? null,
    line: p.line ?? null,
    over_odds: p.over_odds ?? null,
    under_odds: p.under_odds ?? null,
    game_time: p.game_time ?? null,
  }));

  const { data, error } = await client
    .from('raw_props')
    .upsert(rows, { onConflict: 'source,external_game_id,external_prop_id' })
    .select('id');
  if (error) throw error;
  return data?.length || 0;
}

async function triggerScoringAgent(): Promise<void> {
  try {
    const { loadBaseAgentDependencies } = await import(path.resolve(process.cwd(), 'apps/api/src/agents/BaseAgent/loadDeps'));
    const { ScoringAgent } = await import(path.resolve(process.cwd(), 'apps/api/src/agents/ScoringAgent/ScoringAgent'));
    const { scoringAgentConfig } = await import(path.resolve(process.cwd(), 'apps/api/src/config/agentConfig'));
    const deps = await loadBaseAgentDependencies();
    const agent = new (ScoringAgent as any)(scoringAgentConfig, deps);
    await agent.run?.();
    console.log('✅ ScoringAgent run triggered');
  } catch (err) {
    console.warn('⚠️ ScoringAgent trigger skipped (not available in this environment):', (err as Error).message);
  }
}

async function triggerSettlementIfFinal(games: SgoGame[]): Promise<void> {
  const finals = games.filter(g => (g.status || '').toLowerCase() === 'final');
  if (!finals.length) return;
  try {
    const { loadBaseAgentDependencies } = await import(path.resolve(process.cwd(), 'apps/api/src/agents/BaseAgent/loadDeps'));
    const mod = await import(path.resolve(process.cwd(), 'apps/api/src/agents/SettlementAgent'));
    const SettlementAgent = (mod as any).SettlementAgent || (mod as any).default || mod;
    const deps = await loadBaseAgentDependencies();
    const agent = new SettlementAgent({ name: 'settlement-agent', version: '1.0.0' }, deps);
    await agent.run?.();
    console.log(`✅ SettlementAgent run triggered for ${finals.length} final games`);
  } catch (err) {
    console.warn('⚠️ SettlementAgent trigger skipped (not available in this environment):', (err as Error).message);
  }
}

async function main() {
  const { sports } = parseArgv();
  const date = getTodayUTC();
  console.log(`🎯 SGO live ingestion starting for date=${date}, sports=${sports}`);

  const games = await fetchSgoGames(date, sports).catch(err => {
    console.error('Failed to fetch SGO games:', err);
    return [] as SgoGame[];
  });
  console.log(`• fetched games: ${games.length}`);

  const upsertedGames = await upsertGames(games);
  console.log(`• upserted games: ${upsertedGames.length}`);

  const props = await fetchSgoProps(date, sports).catch(err => {
    console.error('Failed to fetch SGO props:', err);
    return [] as SgoProp[];
  });
  console.log(`• fetched props: ${props.length}`);

  const insertedCount = await upsertProps(props);
  console.log(`• inserted/updated props: ${insertedCount}`);

  if (insertedCount > 0) {
    await triggerScoringAgent();
  }
  await triggerSettlementIfFinal(games);

  console.log('✅ SGO live ingestion completed');
}

if (require.main === module) {
  main().catch(err => {
    console.error('❌ SGO ingestion failed:', err);
    process.exit(1);
  });
}

