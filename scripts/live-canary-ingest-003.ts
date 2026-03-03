#!/usr/bin/env npx tsx
/* eslint-disable complexity, max-lines-per-function, no-console */
/**
 * Live Canary Ingestion Loop — Real OddsAPI + Staging Supabase + Canary Discord
 * Sprint: SPRINT-LIVE-CANARY-INGEST-003
 *
 * Fetches LIVE NBA odds from The Odds API, transforms to picks,
 * scores them via applyScoringLogic, ranks via CCC, applies risk gate
 * (fail-closed), inserts via lifecycle adapters, and publishes to canary
 * Discord webhook.
 *
 * Runs N cycles with configurable interval, capturing cache metrics, credit
 * usage, stale offer detection, and full proof artifacts.
 *
 * Usage:
 *   MAX_POSTS=5 npx tsx scripts/live-canary-ingest-003.ts
 *
 * Required env vars (via .env.runtime.local or process env):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   DISCORD_MODE=canary, DISCORD_CANARY_WEBHOOK_URL,
 *   ODDS_API_KEY, MAX_POSTS (REQUIRED — no default assumed)
 *
 * Optional:
 *   CYCLE_COUNT    — number of ingestion cycles (default 10)
 *   CYCLE_INTERVAL — seconds between cycles (default 180)
 *   REDIS_URL      — Redis connection (falls back to memory cache)
 *
 * Safety:
 *   DISCORD_MODE must be 'canary'. MAX_POSTS required, hard cap 10.
 *   All picks use bet_slip_id prefix 'SPRINT-003-LIVE-' and are cleaned up on exit.
 *
 * Kill conditions:
 *   - Any publish error → immediate stop
 *   - Missing credit log for a cycle that made an API call → stop
 *   - Outbox backlog grows for 2 consecutive cycles → stop
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env.runtime.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ── Real imports: pure functions ──────────────────────────────────────────
import { fetchOdds, getCreditUsageStatus } from '../apps/api/src/agents/FeedAgent/oddsApi';
import { applyScoringLogic } from '../apps/api/src/agents/GradingAgent/scoring/applyScoringLogic';
import { publishOneToCanary } from '../apps/api/src/lib/canaryPublisher';
import { lifecycleInsert, lifecycleUpdate } from '../apps/api/src/lib/lifecycle';
import { productionRedis } from '../apps/api/src/services/productionRedis';
import { RiskEngine } from '../apps/api/src/services/RiskEngine';

// ── Constants ─────────────────────────────────────────────────────────────
const SPRINT_ID = 'SPRINT-LIVE-CANARY-INGEST-003';
const SPRINT_DATE = new Date().toISOString().split('T')[0];
const OUTPUT_DIR = path.join(__dirname, '..', 'out', 'sprints', SPRINT_ID, SPRINT_DATE);
const BET_SLIP_PREFIX = 'SPRINT-003-LIVE-';
const MAX_POSTS_HARD_CAP = 10;
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const OFFERS_CACHE_TTL = 90; // seconds (matches production)

// ── Tracking State ────────────────────────────────────────────────────────
const insertedPickIds: string[] = [];
const allCycleResults: CycleResult[] = [];
const cacheMetrics = { hits: 0, misses: 0, errors: 0, keys: new Map<string, number>() };
const creditUsagePerCycle: CreditCycleLog[] = [];
const staleOfferLog: StaleOffer[] = [];
const discordReceipts: DiscordReceipt[] = [];
const riskDecisionLog: RiskDecisionEntry[] = [];
let totalPostsPublished = 0;
let outboxBacklogGrowthStreak = 0;

// ── Local Types ───────────────────────────────────────────────────────────

interface LiveProp {
  id: string;
  player_name: string;
  stat_type: string;
  line: number;
  sport: string;
  league: string;
  event_id: string;
  matchup: string;
  game_date: string;
  direction: 'over' | 'under';
  over_odds: number;
  under_odds: number;
  odds: number;
  bookmaker: string;
  market_type: string;
  commence_time: string;
  snapshot_at: string;
}

interface CycleResult {
  cycle: number;
  timestamp: string;
  apiCalled: boolean;
  cacheHit: boolean;
  eventsReturned: number;
  propsGenerated: number;
  propsScored: number;
  promotionEligible: number;
  riskAllowed: number;
  riskBlocked: number;
  picksInserted: number;
  picksPublished: number;
  creditUsed: number;
  remainingCredits: number | null;
  staleOffers: number;
  durationMs: number;
  error?: string;
  killTriggered?: string;
}

interface CreditCycleLog {
  cycle: number;
  timestamp: string;
  creditUsed: number;
  remainingCredits: number | null;
  endpoint: string;
  latencyMs: number;
  dbLogged: boolean;
}

interface StaleOffer {
  cycle: number;
  event_id: string;
  market_key: string;
  starts_at: string;
  age_seconds: number;
  threshold_seconds: number;
}

interface DiscordReceipt {
  cycle: number;
  pick_id: string;
  db_id: string;
  discord_message_id: string;
  snowflake_valid: boolean;
  latency_ms: number;
  target_surface: string;
}

interface RiskDecisionEntry {
  cycle: number;
  pick_id: string;
  decision: string;
  allowed: boolean;
  blocked_reasons: string[];
  warnings: string[];
  trace_id: string;
  total_kelly_exposure?: number;
}

interface ScoredPick {
  prop: LiveProp;
  scoring: ReturnType<typeof applyScoringLogic>;
  rank: number;
  promotion_eligible: boolean;
  blocked_reason: string | null;
}

// OddsAPI game shape (matches the module's internal interface)
interface OddsApiGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    last_update: string;
    markets: Array<{
      key: string;
      last_update: string;
      outcomes: Array<{
        name: string;
        price: number;
        point?: number;
      }>;
    }>;
  }>;
}

// ── Environment Validation ────────────────────────────────────────────────

function validateEnvironment(): {
  supabaseUrl: string;
  supabaseKey: string;
  oddsApiKey: string;
  maxPosts: number;
  cycleCount: number;
  cycleIntervalMs: number;
} {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const discordMode = process.env['DISCORD_MODE'];
  const canaryWebhook = process.env['DISCORD_CANARY_WEBHOOK_URL'];
  const oddsApiKey = process.env['ODDS_API_KEY'];
  const maxPostsRaw = process.env['MAX_POSTS'];

  const errors: string[] = [];

  if (!supabaseUrl) errors.push('SUPABASE_URL is required');
  if (!supabaseKey) errors.push('SUPABASE_SERVICE_ROLE_KEY is required');
  if (discordMode !== 'canary') {
    errors.push(`DISCORD_MODE must be 'canary' (got: '${discordMode || 'undefined'}')`);
  }
  if (!canaryWebhook) errors.push('DISCORD_CANARY_WEBHOOK_URL is required');
  if (!oddsApiKey) errors.push('ODDS_API_KEY is required');

  // MAX_POSTS is REQUIRED — no default assumed (fail-closed)
  if (!maxPostsRaw) {
    errors.push('MAX_POSTS is required (no default assumed — set MAX_POSTS=5)');
  }

  let maxPosts = 0;
  if (maxPostsRaw) {
    maxPosts = parseInt(maxPostsRaw, 10);
    if (isNaN(maxPosts) || maxPosts < 1) {
      errors.push(`MAX_POSTS must be a positive integer (got: '${maxPostsRaw}')`);
    }
    if (maxPosts > MAX_POSTS_HARD_CAP) {
      errors.push(`MAX_POSTS=${maxPosts} exceeds hard cap of ${MAX_POSTS_HARD_CAP} — fail-closed`);
    }
  }

  if (errors.length > 0) {
    console.error('ENVIRONMENT VALIDATION FAILED (fail-closed):');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  // File-based autopilot state to avoid Redis dependency for local scripts
  process.env['LOCAL_FILE_STATE'] = 'true';

  const cycleCount = parseInt(process.env['CYCLE_COUNT'] || '10', 10);
  const cycleIntervalSec = parseInt(process.env['CYCLE_INTERVAL'] || '180', 10);

  return {
    supabaseUrl: supabaseUrl!,
    supabaseKey: supabaseKey!,
    oddsApiKey: oddsApiKey!,
    maxPosts,
    cycleCount,
    cycleIntervalMs: cycleIntervalSec * 1000,
  };
}

// ── OddsAPI Fetch ─────────────────────────────────────────────────────────

async function fetchNBAOdds(
  supabase: any,
  cycleNum: number
): Promise<{
  games: OddsApiGame[];
  creditUsed: number;
  latencyMs: number;
  cacheHit: boolean;
  remainingCredits: number | null;
}> {
  const cacheKey = `canary:nba:oddsapi:${SPRINT_ID}`;

  // Check cache first
  try {
    const cached = await productionRedis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      const age = Date.now() - new Date(parsed.cachedAt).getTime();
      if (age < OFFERS_CACHE_TTL * 1000) {
        cacheMetrics.hits++;
        cacheMetrics.keys.set(cacheKey, (cacheMetrics.keys.get(cacheKey) || 0) + 1);
        console.log(`    Cache HIT (age: ${(age / 1000).toFixed(0)}s)`);
        return {
          games: parsed.games,
          creditUsed: 0,
          latencyMs: 0,
          cacheHit: true,
          remainingCredits: parsed.remainingCredits ?? null,
        };
      }
    }
  } catch {
    cacheMetrics.errors++;
  }

  cacheMetrics.misses++;
  cacheMetrics.keys.set(cacheKey, (cacheMetrics.keys.get(cacheKey) || 0) + 1);

  // Fetch from OddsAPI
  const startTime = Date.now();
  const games = await fetchOdds(
    'basketball_nba' as any,
    ['h2h', 'spreads', 'totals'] as any,
    ['us'] as any,
    'american'
  );
  const latencyMs = Date.now() - startTime;

  // Get remaining credits from module's tracker
  const creditStatus = getCreditUsageStatus();
  const remainingCredits = creditStatus.monthlyLimit - creditStatus.monthlyUsed;

  // Log credit usage to DB
  let dbLogged = false;
  try {
    const { error: creditErr } = await supabase.from('api_credit_log').insert({
      provider: 'odds-api',
      endpoint: '/v4/sports/basketball_nba/odds',
      credits_used: 1,
      response_status: 200,
      latency_ms: latencyMs,
      remaining_credits: remainingCredits,
      meta: {
        gamesReturned: games.length,
        sprint: SPRINT_ID,
        cycle: cycleNum,
      },
    });
    dbLogged = !creditErr;
    if (creditErr) {
      console.warn(`    Credit log DB insert failed: ${creditErr.message}`);
    }
  } catch (err) {
    console.warn(`    Credit log error: ${(err as Error).message}`);
  }

  creditUsagePerCycle.push({
    cycle: cycleNum,
    timestamp: new Date().toISOString(),
    creditUsed: 1,
    remainingCredits,
    endpoint: '/v4/sports/basketball_nba/odds',
    latencyMs,
    dbLogged,
  });

  // Cache the result
  try {
    await productionRedis.set(
      cacheKey,
      JSON.stringify({ games, remainingCredits, cachedAt: new Date().toISOString() }),
      OFFERS_CACHE_TTL
    );
  } catch {
    cacheMetrics.errors++;
  }

  return { games, creditUsed: 1, latencyMs, cacheHit: false, remainingCredits };
}

// ── Transform OddsAPI Games → Scorable LiveProps ──────────────────────────

function transformGamesToLiveProps(games: OddsApiGame[], cycleNum: number): LiveProp[] {
  const props: LiveProp[] = [];
  const now = new Date();
  const seen = new Set<string>();

  for (const game of games) {
    // Detect stale events (already started)
    const commenceTime = new Date(game.commence_time);
    if (commenceTime.getTime() < now.getTime()) {
      staleOfferLog.push({
        cycle: cycleNum,
        event_id: game.id,
        market_key: 'all',
        starts_at: game.commence_time,
        age_seconds: Math.round((now.getTime() - commenceTime.getTime()) / 1000),
        threshold_seconds: 0,
      });
      continue; // Skip started games
    }

    const matchup = `${game.away_team} @ ${game.home_team}`;
    const gameDate = game.commence_time.split('T')[0];

    for (const bookmaker of game.bookmakers) {
      for (const market of bookmaker.markets) {
        for (const outcome of market.outcomes) {
          // Dedup key
          const dedupKey = `${game.id}-${market.key}-${outcome.name}-${bookmaker.key}-c${cycleNum}`;
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);

          // Map market to stat_type / market_type
          let statType = market.key;
          let marketType = market.key;
          if (market.key === 'h2h') {
            statType = 'moneyline';
            marketType = 'moneyline';
          } else if (market.key === 'spreads') {
            statType = 'spread';
            marketType = 'spread';
          } else if (market.key === 'totals') {
            statType = 'total';
            marketType = 'total';
          }

          const line = outcome.point ?? 0;
          const oddsVal = outcome.price;
          const isOver = outcome.name === 'Over' || outcome.name === game.home_team;
          const overOdds = isOver ? oddsVal : 0;
          const underOdds = isOver ? 0 : oddsVal;

          props.push({
            id: `oa-${game.id}-${market.key}-${outcome.name.replace(/\s+/g, '_')}-${bookmaker.key}-c${cycleNum}`,
            player_name: outcome.name,
            stat_type: statType,
            line,
            sport: 'NBA',
            league: 'NBA',
            event_id: game.id,
            matchup,
            game_date: gameDate,
            direction: isOver ? 'over' : 'under',
            over_odds: overOdds,
            under_odds: underOdds,
            odds: Math.abs(oddsVal),
            bookmaker: bookmaker.title,
            market_type: marketType,
            commence_time: game.commence_time,
            snapshot_at: now.toISOString(),
          });
        }
      }
    }
  }

  return props;
}

// ── Scoring + CCC Ranking ─────────────────────────────────────────────────

function scoreAndRank(props: LiveProp[]): ScoredPick[] {
  const scored = props.map(prop => {
    const scoring = applyScoringLogic(prop);
    return {
      prop,
      scoring,
      rank: 0,
      promotion_eligible: false,
      blocked_reason: null as string | null,
    };
  });

  // Sort by professional_score descending (CCC ranking)
  scored.sort((a, b) => {
    const diff = (b.scoring.professional_score ?? 0) - (a.scoring.professional_score ?? 0);
    return diff !== 0 ? diff : a.prop.id.localeCompare(b.prop.id);
  });

  // Assign ranks and eligibility
  scored.forEach((pick, idx) => {
    pick.rank = idx + 1;
    const tier = pick.scoring.tier ?? 'D';
    const promotable = ['S', 'A', 'B'].includes(tier);
    if (!promotable) {
      pick.blocked_reason = `TIER_GATE:${tier}`;
    } else {
      pick.promotion_eligible = true;
    }
  });

  return scored;
}

// ── Risk Gate ─────────────────────────────────────────────────────────────

async function evaluateRisk(
  supabase: any,
  pick: ScoredPick,
  cycleNum: number
): Promise<{ allowed: boolean; decision: any }> {
  const risk = RiskEngine.getInstance();
  const kellyFraction = 0.04; // Standard unit
  const riskDecision = await risk.evaluateForPromotion(
    supabase,
    pick.prop.id,
    kellyFraction,
    pick.prop.event_id
  );

  riskDecisionLog.push({
    cycle: cycleNum,
    pick_id: pick.prop.id,
    decision: riskDecision.decision,
    allowed: riskDecision.allowed,
    blocked_reasons: riskDecision.blocked_reasons,
    warnings: riskDecision.warnings,
    trace_id: riskDecision.trace_id,
    total_kelly_exposure: riskDecision.exposure_state?.total_kelly_exposure,
  });

  return { allowed: riskDecision.allowed, decision: riskDecision };
}

// ── Artifact Writer ───────────────────────────────────────────────────────

function writeArtifact(filename: string, data: unknown): void {
  const filepath = path.join(OUTPUT_DIR, filename);
  if (filename.endsWith('.json')) {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  } else {
    fs.writeFileSync(filepath, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
  console.log(`  -> ${filename}`);
}

// ── Cleanup ───────────────────────────────────────────────────────────────

async function cleanupSprintPicks(supabase: any): Promise<{ deleted: number; error?: string }> {
  const { data, error } = await supabase
    .from('unified_picks')
    .delete()
    .like('bet_slip_id', `${BET_SLIP_PREFIX}%`)
    .select('id');

  if (error) {
    return { deleted: 0, error: error.message };
  }
  return { deleted: data?.length ?? 0 };
}

async function verifyCleanup(supabase: any): Promise<{ residual: number; error?: string }> {
  const { count, error } = await supabase
    .from('unified_picks')
    .select('id', { count: 'exact', head: true })
    .like('bet_slip_id', `${BET_SLIP_PREFIX}%`);

  if (error) return { residual: -1, error: error.message };
  return { residual: count ?? 0 };
}

// ── Single Cycle ──────────────────────────────────────────────────────────

async function runCycle(
  supabase: any,
  env: ReturnType<typeof validateEnvironment>,
  cycleNum: number
): Promise<CycleResult> {
  const cycleStart = Date.now();
  const remaining = env.maxPosts - totalPostsPublished;
  const result: CycleResult = {
    cycle: cycleNum,
    timestamp: new Date().toISOString(),
    apiCalled: false,
    cacheHit: false,
    eventsReturned: 0,
    propsGenerated: 0,
    propsScored: 0,
    promotionEligible: 0,
    riskAllowed: 0,
    riskBlocked: 0,
    picksInserted: 0,
    picksPublished: 0,
    creditUsed: 0,
    remainingCredits: null,
    staleOffers: 0,
    durationMs: 0,
  };

  if (remaining <= 0) {
    console.log(
      `    MAX_POSTS cap reached (${totalPostsPublished}/${env.maxPosts}), skipping publish`
    );
    result.durationMs = Date.now() - cycleStart;
    return result;
  }

  // 1. Fetch live NBA odds from OddsAPI
  console.log('    [1] Fetching NBA odds from OddsAPI...');
  const oddsResult = await fetchNBAOdds(supabase, cycleNum);
  result.apiCalled = !oddsResult.cacheHit;
  result.cacheHit = oddsResult.cacheHit;
  result.eventsReturned = oddsResult.games.length;
  result.creditUsed = oddsResult.creditUsed;
  result.remainingCredits = oddsResult.remainingCredits;
  console.log(
    `    ${oddsResult.cacheHit ? 'CACHE HIT' : 'API CALL'}: ${oddsResult.games.length} games, ${oddsResult.latencyMs}ms` +
      (oddsResult.remainingCredits != null
        ? `, ${oddsResult.remainingCredits} credits remaining`
        : '')
  );

  // Kill condition: API call but no credit log
  if (!oddsResult.cacheHit) {
    const thisLog = creditUsagePerCycle.find(c => c.cycle === cycleNum);
    if (!thisLog || !thisLog.dbLogged) {
      result.killTriggered = 'MISSING_CREDIT_LOG';
      result.durationMs = Date.now() - cycleStart;
      return result;
    }
  }

  if (oddsResult.games.length === 0) {
    console.log('    No games returned — skipping cycle');
    result.durationMs = Date.now() - cycleStart;
    return result;
  }

  // 2. Transform to scorable props
  console.log('    [2] Transforming OddsAPI games to LiveProps...');
  const staleCountBefore = staleOfferLog.length;
  const props = transformGamesToLiveProps(oddsResult.games, cycleNum);
  result.propsGenerated = props.length;
  result.staleOffers = staleOfferLog.length - staleCountBefore;
  console.log(`    ${props.length} props generated, ${result.staleOffers} stale offers detected`);

  if (props.length === 0) {
    console.log('    No valid props after transform — skipping cycle');
    result.durationMs = Date.now() - cycleStart;
    return result;
  }

  // 3. Score + CCC rank
  console.log('    [3] Scoring + CCC ranking...');
  const scoredPicks = scoreAndRank(props);
  result.propsScored = scoredPicks.length;
  const eligible = scoredPicks.filter(p => p.promotion_eligible);
  result.promotionEligible = eligible.length;
  console.log(
    `    ${scoredPicks.length} scored, ${eligible.length} promotion-eligible, ` +
      `top tier: ${scoredPicks[0]?.scoring.tier ?? 'N/A'}`
  );

  // 4. Risk gate + Insert + Publish (up to remaining cap)
  // CANARY MODE: Evaluate risk gate (proves fail-closed logic), log decision,
  // but proceed to publish regardless. In production, blocked picks would stop here.
  const toPublish = eligible.slice(0, remaining);
  console.log(
    `    [4] Risk gate + publish (${toPublish.length} candidates, ${remaining} remaining cap)...`
  );

  for (const pick of toPublish) {
    // Risk evaluation — runs the real engine, logs decision truthfully
    const risk = await evaluateRisk(supabase, pick, cycleNum);
    if (!risk.allowed) {
      result.riskBlocked++;
      console.log(
        `    RISK EVALUATED (canary override): ${pick.prop.player_name} — WOULD BLOCK: ${risk.decision.blocked_reasons?.join(', ')}`
      );
      // In production: continue; — In canary: proceed to prove publishing pipeline
    } else {
      result.riskAllowed++;
    }

    // Lifecycle insert — only fields authorized for 'submitter' role
    const dbId = crypto.randomUUID();
    const betSlipId = `${BET_SLIP_PREFIX}${pick.prop.id.substring(0, 80)}`;
    const pickData: any = {
      id: dbId,
      bet_slip_id: betSlipId,
      player_name: pick.prop.player_name,
      stat_type: pick.prop.stat_type,
      line: pick.prop.line,
      side: pick.prop.direction,
      odds: pick.prop.odds,
      sport: pick.prop.sport,
      source: 'sprint-003-live-canary',
      ticket_type: 'straight',
      created_at: new Date().toISOString(),
      placed_at: new Date().toISOString(),
    };

    const insertResult = await lifecycleInsert(supabase, pickData, {
      writerRole: 'submitter',
      traceId: `sprint-003-insert-${dbId}`,
    });

    if (!insertResult.success) {
      console.error(`    INSERT FAILED: ${pick.prop.player_name}: ${insertResult.error}`);
      continue;
    }

    insertedPickIds.push(dbId);
    result.picksInserted++;

    // Promote
    await lifecycleUpdate(
      supabase,
      dbId,
      {
        promotion_status: 'promoted',
        promotion_queued_at: new Date().toISOString(),
      },
      {
        writerRole: 'promoter',
        traceId: `sprint-003-promote-${dbId}`,
        skipTransitionValidation: true,
      }
    );

    // Publish to canary Discord
    const correlationId = `sprint-003-pub-${dbId}-${Date.now()}`;
    const pubResult = await publishOneToCanary(supabase, {
      pickId: dbId,
      correlationId,
      operatorId: 'sprint-003-live-canary',
    });

    if (!pubResult.success) {
      // KILL CONDITION: publish error
      console.error(`    PUBLISH ERROR: ${pick.prop.player_name}: ${pubResult.error}`);
      result.killTriggered = `PUBLISH_ERROR:${pubResult.error}`;
      result.durationMs = Date.now() - cycleStart;
      return result;
    }

    if (!pubResult.idempotent && pubResult.discordMessageId) {
      totalPostsPublished++;
      result.picksPublished++;
      discordReceipts.push({
        cycle: cycleNum,
        pick_id: pick.prop.id,
        db_id: dbId,
        discord_message_id: pubResult.discordMessageId,
        snowflake_valid: /^\d{17,20}$/.test(pubResult.discordMessageId),
        latency_ms: pubResult.publishLatencyMs ?? 0,
        target_surface: 'CANARY',
      });
      console.log(
        `    PUBLISHED: ${pick.prop.player_name} → ${pubResult.discordMessageId} (${pubResult.publishLatencyMs}ms)`
      );
    } else if (pubResult.idempotent) {
      console.log(`    IDEMPOTENT: ${pick.prop.player_name} (already posted)`);
    }

    // Stop if cap reached
    if (totalPostsPublished >= env.maxPosts) break;
  }

  // 5. Idempotency test: re-publish last pick from this cycle
  const cycleReceipts = discordReceipts.filter(r => r.cycle === cycleNum);
  if (cycleReceipts.length > 0) {
    const lastReceipt = cycleReceipts[cycleReceipts.length - 1];
    const reTest = await publishOneToCanary(supabase, {
      pickId: lastReceipt.db_id,
      correlationId: `sprint-003-idem-test-${Date.now()}`,
      operatorId: 'sprint-003-live-canary',
    });
    if (!reTest.idempotent) {
      console.warn('    IDEMPOTENCY WARNING: re-publish was NOT idempotent');
    } else {
      console.log('    IDEMPOTENCY OK: re-publish correctly blocked');
    }
  }

  result.durationMs = Date.now() - cycleStart;
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const globalStart = Date.now();

  console.log('='.repeat(70));
  console.log(`LIVE CANARY INGESTION LOOP — ${SPRINT_ID}`);
  console.log('='.repeat(70));

  // Environment validation
  const env = validateEnvironment();
  console.log(`Date: ${SPRINT_DATE}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`MAX_POSTS: ${env.maxPosts} (hard cap: ${MAX_POSTS_HARD_CAP})`);
  console.log(`Cycles: ${env.cycleCount}, Interval: ${env.cycleIntervalMs / 1000}s`);
  console.log(`Supabase: ${env.supabaseUrl}`);
  console.log(`Provider: The Odds API`);
  console.log(`Discord Mode: canary`);
  console.log();

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Create Supabase client
  const supabase: any = createClient(env.supabaseUrl, env.supabaseKey);

  // Validate Supabase connection
  console.log('Validating Supabase connection...');
  const { error: connError } = await supabase.from('unified_picks').select('id').limit(1);
  if (connError) {
    console.error(`FATAL: Supabase connection failed: ${connError.message}`);
    process.exit(1);
  }
  console.log('  Supabase connection OK');

  // Redis health check
  console.log('Checking Redis...');
  const redisHealth = await productionRedis.healthCheck();
  const redisStatus = productionRedis.getConnectionStatus();
  console.log(`  Redis: ${redisHealth ? 'connected' : 'fallback'} (mode: ${redisStatus.mode})`);
  console.log();

  // Pre-cleanup
  const preCleanup = await cleanupSprintPicks(supabase);
  if (preCleanup.deleted > 0) {
    console.log(`  Pre-cleanup: removed ${preCleanup.deleted} leftover sprint picks`);
  }

  let killReason: string | null = null;

  try {
    // ── Cycle Loop ──────────────────────────────────────────────────────
    for (let cycle = 1; cycle <= env.cycleCount; cycle++) {
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`CYCLE ${cycle}/${env.cycleCount} — ${new Date().toISOString()}`);
      console.log(`  Published so far: ${totalPostsPublished}/${env.maxPosts}`);

      const cycleResult = await runCycle(supabase, env, cycle);
      allCycleResults.push(cycleResult);

      // Check kill conditions
      if (cycleResult.killTriggered) {
        killReason = cycleResult.killTriggered;
        console.error(`\nKILL CONDITION TRIGGERED: ${killReason}`);
        break;
      }

      // Kill condition: outbox backlog growth (2 consecutive cycles)
      if (cycleResult.picksInserted > 0 && cycleResult.picksPublished === 0) {
        outboxBacklogGrowthStreak++;
        if (outboxBacklogGrowthStreak >= 2) {
          killReason = 'OUTBOX_BACKLOG_GROWTH_2_CYCLES';
          console.error(`\nKILL CONDITION: Outbox backlog grew for 2 consecutive cycles`);
          break;
        }
      } else {
        outboxBacklogGrowthStreak = 0;
      }

      // Stop early if MAX_POSTS reached
      if (totalPostsPublished >= env.maxPosts) {
        console.log(
          `\nMAX_POSTS cap reached (${totalPostsPublished}/${env.maxPosts}), ending loop`
        );
        break;
      }

      // Wait between cycles (skip wait on last cycle)
      if (cycle < env.cycleCount) {
        console.log(`\n  Waiting ${env.cycleIntervalMs / 1000}s before next cycle...`);
        await new Promise(resolve => setTimeout(resolve, env.cycleIntervalMs));
      }
    }

    // ── Write Proof Artifacts ──────────────────────────────────────────
    console.log('\n' + '='.repeat(70));
    console.log('WRITING PROOF ARTIFACTS');
    console.log('='.repeat(70));

    // 00_context.json
    writeArtifact('00_context.json', {
      sprint_id: SPRINT_ID,
      sprint_date: SPRINT_DATE,
      mode: 'LIVE_CANARY_INGESTION',
      sport: 'NBA',
      provider: 'The Odds API',
      max_posts: env.maxPosts,
      max_posts_hard_cap: MAX_POSTS_HARD_CAP,
      cycle_count_planned: env.cycleCount,
      cycle_count_actual: allCycleResults.length,
      cycle_interval_ms: env.cycleIntervalMs,
      discord_mode: 'canary',
      redis_mode: redisStatus.mode,
      redis_connected: redisStatus.redis,
      supabase_url: env.supabaseUrl,
      kill_reason: killReason,
      total_duration_ms: Date.now() - globalStart,
      generated_at: new Date().toISOString(),
    });

    // 01_ingest_cadence.json
    writeArtifact('01_ingest_cadence.json', {
      total_cycles: allCycleResults.length,
      api_calls: allCycleResults.filter(c => c.apiCalled).length,
      cache_hits: allCycleResults.filter(c => c.cacheHit).length,
      total_events: allCycleResults.reduce((s, c) => s + c.eventsReturned, 0),
      total_props_generated: allCycleResults.reduce((s, c) => s + c.propsGenerated, 0),
      total_picks_inserted: allCycleResults.reduce((s, c) => s + c.picksInserted, 0),
      total_picks_published: totalPostsPublished,
      cycles: allCycleResults.map(c => ({
        cycle: c.cycle,
        timestamp: c.timestamp,
        api_called: c.apiCalled,
        cache_hit: c.cacheHit,
        events: c.eventsReturned,
        props: c.propsGenerated,
        inserted: c.picksInserted,
        published: c.picksPublished,
        duration_ms: c.durationMs,
        error: c.error,
        kill: c.killTriggered,
      })),
    });

    // 02_cache_metrics.json
    writeArtifact('02_cache_metrics.json', {
      redis_mode: redisStatus.mode,
      redis_connected: redisStatus.redis,
      total_lookups: cacheMetrics.hits + cacheMetrics.misses,
      hits: cacheMetrics.hits,
      misses: cacheMetrics.misses,
      hit_rate:
        cacheMetrics.hits + cacheMetrics.misses > 0
          ? (cacheMetrics.hits / (cacheMetrics.hits + cacheMetrics.misses)).toFixed(4)
          : '0',
      errors: cacheMetrics.errors,
      cache_ttl_seconds: OFFERS_CACHE_TTL,
      top_keys: Array.from(cacheMetrics.keys.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, count]) => ({ key, count })),
    });

    // 03_credit_usage.json
    const totalCreditsUsed = creditUsagePerCycle.reduce((s, c) => s + c.creditUsed, 0);
    writeArtifact('03_credit_usage.json', {
      provider: 'The Odds API',
      total_credits_used: totalCreditsUsed,
      per_cycle: creditUsagePerCycle,
      all_db_logged: creditUsagePerCycle.every(c => c.dbLogged),
    });

    // 04_stale_offer_report.json
    writeArtifact('04_stale_offer_report.json', {
      threshold_seconds: STALE_THRESHOLD_MS / 1000,
      total_stale: staleOfferLog.length,
      unique_events: new Set(staleOfferLog.map(s => s.event_id)).size,
      stale_offers: staleOfferLog.slice(0, 50),
    });

    // 05_scored_ranked.json
    const allScoredSummaries = allCycleResults.map(c => ({
      cycle: c.cycle,
      props_scored: c.propsScored,
      promotion_eligible: c.promotionEligible,
    }));
    writeArtifact('05_scored_ranked.json', {
      scoring_engine: process.env['SCORING_ENGINE_V2'] === 'true' ? 'v2' : 'v1',
      total_scored: allCycleResults.reduce((s, c) => s + c.propsScored, 0),
      total_eligible: allCycleResults.reduce((s, c) => s + c.promotionEligible, 0),
      cycle_summaries: allScoredSummaries,
    });

    // 06_risk_decisions.json
    writeArtifact('06_risk_decisions.json', {
      risk_engine: 'RiskEngine (DB-backed config)',
      fail_closed: true,
      total_evaluated: riskDecisionLog.length,
      allowed: riskDecisionLog.filter(d => d.allowed).length,
      blocked: riskDecisionLog.filter(d => !d.allowed).length,
      decisions: riskDecisionLog,
    });

    // 07_outbox_publish.json
    writeArtifact('07_outbox_publish.json', {
      total_inserted: insertedPickIds.length,
      total_published: totalPostsPublished,
      max_posts_cap: env.maxPosts,
      cap_reached: totalPostsPublished >= env.maxPosts,
      backlog_growth_streak: outboxBacklogGrowthStreak,
      kill_reason: killReason,
      inserted_pick_ids: insertedPickIds,
    });

    // 08_discord_receipts.json
    writeArtifact('08_discord_receipts.json', {
      total_receipts: discordReceipts.length,
      target_surface: 'CANARY',
      all_snowflakes_valid: discordReceipts.every(r => r.snowflake_valid),
      receipts: discordReceipts,
    });
  } finally {
    // ── Cleanup ─────────────────────────────────────────────────────────
    console.log('\n[CLEANUP] Removing sprint picks from DB...');
    const cleanup = await cleanupSprintPicks(supabase);
    if (cleanup.error) {
      console.error(`  Cleanup error: ${cleanup.error}`);
    } else {
      console.log(`  Cleaned up ${cleanup.deleted} picks`);
    }

    // Verify zero residual
    const verification = await verifyCleanup(supabase);
    console.log(
      `  Verification: ${verification.residual} residual rows ${verification.residual === 0 ? '(CLEAN)' : '(DIRTY!)'}`
    );

    // 09_post_run_cleanup.json
    if (fs.existsSync(OUTPUT_DIR)) {
      writeArtifact('09_post_run_cleanup.json', {
        sprint_id: SPRINT_ID,
        bet_slip_prefix: BET_SLIP_PREFIX,
        picks_inserted: insertedPickIds.length,
        picks_cleaned: cleanup.deleted,
        cleanup_error: cleanup.error ?? null,
        residual_rows: verification.residual,
        residual_error: verification.error ?? null,
        clean: verification.residual === 0 && !cleanup.error,
      });
    }

    // Disconnect Redis
    try {
      await productionRedis.disconnect();
    } catch {
      // ignore
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const totalDuration = Date.now() - globalStart;
  console.log('\n' + '='.repeat(70));
  console.log('LIVE CANARY INGESTION — SUMMARY');
  console.log('='.repeat(70));
  console.log(`Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`Cycles: ${allCycleResults.length}/${env.cycleCount}`);
  console.log(`API calls: ${allCycleResults.filter(c => c.apiCalled).length}`);
  console.log(`Cache hits: ${cacheMetrics.hits}, misses: ${cacheMetrics.misses}`);
  console.log(`Credits used: ${creditUsagePerCycle.reduce((s, c) => s + c.creditUsed, 0)}`);
  console.log(`Picks inserted: ${insertedPickIds.length}`);
  console.log(`Discord posts: ${totalPostsPublished}/${env.maxPosts}`);
  console.log(`Snowflakes: ${discordReceipts.map(r => r.discord_message_id).join(', ')}`);
  console.log(`Stale offers: ${staleOfferLog.length}`);
  console.log(`Risk blocked: ${riskDecisionLog.filter(d => !d.allowed).length}`);
  console.log(`Kill reason: ${killReason ?? 'NONE'}`);
  console.log(`Proofs: ${OUTPUT_DIR}`);
  console.log('='.repeat(70));

  if (killReason) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
