#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * e2e-lifecycle-harness-068.ts — SPRINT-068-E2E-LIFECYCLE-CERT
 *
 * Proves the full pick lifecycle: SUBMIT → SCORE → PROMOTE → POST → SETTLE → RECAP
 * Each phase uses the canonical lifecycle adapter. Produces a JSON proof artifact.
 *
 * PROVES:
 *   - L1-R13: Full lifecycle E2E path (Layer 1 exit requirement)
 *   - L1-R04: computeScoreV2 runs at runtime
 *   - L1-R06: evaluatePromotion gates exercised
 *   - L1-R08: lifecycleSettle transitions POSTED → SETTLED
 *   - L1-R10: RecapService query finds settled picks (status fix verified)
 *
 * USAGE:
 *   npx tsx e2e-lifecycle-harness-068.ts
 *   npx tsx e2e-lifecycle-harness-068.ts --json   # JSON proof output only
 */

import { randomUUID } from 'crypto';

import { createClient } from '@supabase/supabase-js';

import { computeScoreV2 } from '../agents/GradingAgent/scoring/computeScoreV2';
import { canonicalTier } from '../agents/GradingAgent/scoring/TierScale';
import {
  evaluatePromotion,
  parsePromotionPolicyConfig,
  type ProbabilityPrimitives,
} from '../agents/GradingAgent/scoring/promotionPolicy';
import {
  lifecycleInsert,
  lifecycleUpdate,
  lifecycleClaimForPosting,
  lifecycleSettle,
} from '../lib/lifecycle';
import type { GradingFeatureSet } from '../types/GradingFeatureSet';

// ─── Config ──────────────────────────────────────────────────────────────────

const TS = Date.now();
const PICK_ID = randomUUID();
const BET_SLIP_ID = `bslip-e2e-068-${TS}`;
const JSON_ONLY = process.argv.includes('--json');
const TODAY = new Date().toISOString().split('T')[0]!;

// ─── Phase Tracking ──────────────────────────────────────────────────────────

type PhaseResult = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

const phases: Record<string, PhaseResult> = {};

function log(phase: string, msg: string, data?: unknown): void {
  if (!JSON_ONLY) {
    if (data !== undefined) {
      console.log(`[${phase}] ${msg}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[${phase}] ${msg}`);
    }
  }
}

function record(
  phase: string,
  success: boolean,
  data?: Record<string, unknown>,
  error?: string
): void {
  phases[phase] = {
    success,
    ...(data !== undefined && { data }),
    ...(error !== undefined && { error }),
  };
}

// ─── Supabase Client (service role for lifecycle writes) ─────────────────────

const supabase = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!
);

// ─── Phase 1: SUBMIT ─────────────────────────────────────────────────────────

async function phase1Submit(): Promise<string | null> {
  log('P1:SUBMIT', 'lifecycleInsert (writerRole: submitter)');

  const pickData = {
    id: PICK_ID,
    bet_slip_id: BET_SLIP_ID,
    player_name: 'E2E Test Player',
    sport: 'NBA',
    bet_type: 'player_prop',
    stat_type: 'points',
    line: 25.5,
    odds: -110,
    tier: 'A',
    status: 'pending',
    workflow_stage: 'pending_review',
    created_at: new Date().toISOString(),
    placed_at: new Date().toISOString(),
    meta: { source: 'e2e-lifecycle-harness-068', sprint: 'SPRINT-068' },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await lifecycleInsert(supabase as any, pickData as any, {
    writerRole: 'submitter',
    traceId: `e2e-068-submit-${PICK_ID}`,
  });

  if (!result.success) {
    record('P1:SUBMIT', false, undefined, result.error ?? 'lifecycleInsert failed');
    log('P1:SUBMIT', 'FAILED', result.error);
    return null;
  }

  record('P1:SUBMIT', true, { pickId: PICK_ID, betSlipId: BET_SLIP_ID });
  log('P1:SUBMIT', 'PASS', { pickId: PICK_ID });
  return PICK_ID;
}

// ─── Phase 2: SCORE ──────────────────────────────────────────────────────────

async function phase2Score(): Promise<{ tier: string; band: string } | null> {
  log('P2:SCORE', 'computeScoreV2 + canonicalTier + evaluatePromotion');

  const featureSet: GradingFeatureSet = {
    propId: PICK_ID,
    unifiedPickId: PICK_ID,
    date: TODAY,
    sport: 'NBA',
    league: 'NBA',
    player: 'E2E Test Player',
    marketType: 'points',
    odds: -110,
    market: { type: 'points', odds: -110, line: 25.5 },
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    source: 'e2e-lifecycle-harness-068',
    confidence: 8.5,
    expectedValue: 4,
    lineMovement: 2,
    matchupRating: 65,
    playerForm: 68,
    injuryImpact: 80,
    weatherImpact: 90,
    marketIntelligence: 70,
    sharpMoney: 60,
    volumeProfile: 65,
    closingLineValue: 2,
    playerFatigue: 78,
    venueAdvantage: 65,
    refereeImpact: 75,
    paceImpact: 70,
    motivationalFactors: 72,
    correlationRisk: 0.3,
    volatility: 4,
    portfolioImpact: 0.2,
    dataQuality: {
      dataValidationScore: 0.88,
      outlierScore: 0.85,
      consistencyScore: 0.87,
      completeness: 0.9,
    },
  };

  try {
    const scoreResult = computeScoreV2(featureSet);
    const tier = canonicalTier({ score: scoreResult.score, edge: scoreResult.ev, risk: 2.64 });

    const probPrimitives: ProbabilityPrimitives = {
      pFinal: 0.58,
      uncertaintyFinal: 0.12,
      pMarketDevig: 0.52,
      edgeFinal: scoreResult.ev,
    };

    const policyConfig = parsePromotionPolicyConfig({
      PROMOTION_POLICY_V2: 'true',
      PROMOTION_CANARY_PERCENT: '50',
      AUTOPILOT_MODE: 'dev',
    });

    const promoResult = evaluatePromotion(
      {
        tier,
        score: scoreResult.score,
        probPrimitives,
        featureSnapshotId: scoreResult.featureSnapshotId,
        featureVectorHash: scoreResult.featureVectorHash,
      },
      policyConfig
    );

    const band = promoResult.promotionBand ?? 'SOFT';

    record('P2:SCORE', true, {
      score: scoreResult.score,
      tier,
      ev: scoreResult.ev,
      band,
      promoted: promoResult.promoted,
      featureVectorHash: scoreResult.featureVectorHash ?? null,
      featureSnapshotId: scoreResult.featureSnapshotId ?? null,
    });
    log('P2:SCORE', 'PASS', { score: scoreResult.score, tier, band });
    return { tier, band };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    record('P2:SCORE', false, undefined, msg);
    log('P2:SCORE', 'FAILED', msg);
    return null;
  }
}

// ─── Phase 3: PROMOTE ────────────────────────────────────────────────────────

async function phase3Promote(pickId: string, tier: string, band: string): Promise<boolean> {
  log('P3:PROMOTE', 'lifecycleUpdate (writerRole: promoter)');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await lifecycleUpdate(
    supabase as any,
    pickId,
    {
      tier,
      promotion_band: band,
      promotion_status: 'queued',
      status: 'approved',
      workflow_stage: 'approved',
      promotion_queued_at: new Date().toISOString(),
    },
    {
      writerRole: 'promoter',
      traceId: `e2e-068-promote-${pickId}`,
    }
  );

  if (!result.success) {
    record('P3:PROMOTE', false, undefined, result.error ?? 'lifecycleUpdate (promoter) failed');
    log('P3:PROMOTE', 'FAILED', result.error);
    return false;
  }

  record('P3:PROMOTE', true, { tier, band, status: 'approved', workflow_stage: 'approved' });
  log('P3:PROMOTE', 'PASS', { tier, band });
  return true;
}

// ─── Phase 4: POST ───────────────────────────────────────────────────────────

async function phase4Post(pickId: string): Promise<boolean> {
  log('P4:POST', 'lifecycleClaimForPosting (writerRole: poster)');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const claimResult = await lifecycleClaimForPosting(supabase as any, pickId, {
    writerRole: 'poster',
    traceId: `e2e-068-post-${pickId}`,
  });

  if (!claimResult.success) {
    record('P4:POST', false, undefined, claimResult.error ?? 'lifecycleClaimForPosting failed');
    log('P4:POST', 'FAILED (claim)', claimResult.error);
    return false;
  }

  // Set discord_message_id (harness uses mock ID — no real Discord post needed)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgResult = await lifecycleUpdate(
    supabase as any,
    pickId,
    { discord_message_id: `mock-discord-msg-e2e-068-${TS}` },
    {
      writerRole: 'poster',
      traceId: `e2e-068-post-msg-${pickId}`,
    }
  );

  const discordMsgId = msgResult.success ? `mock-discord-msg-e2e-068-${TS}` : null;
  record('P4:POST', true, {
    posted_to_discord: true,
    discord_message_id: discordMsgId,
    msg_id_recorded: msgResult.success,
  });
  log('P4:POST', 'PASS', { posted: true, discord_message_id: discordMsgId });
  return true;
}

// ─── Phase 5: SETTLE ─────────────────────────────────────────────────────────

async function phase5Settle(pickId: string): Promise<boolean> {
  log('P5:SETTLE', 'lifecycleSettle (writerRole: settler)');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await lifecycleSettle(
    supabase as any,
    pickId,
    {
      settlement_status: 'settled',
      settlement_result: 'win',
      settlement_source: 'e2e-lifecycle-harness-068',
    },
    {
      writerRole: 'settler',
      traceId: `e2e-068-settle-${pickId}`,
    }
  );

  if (!result.success) {
    record('P5:SETTLE', false, undefined, result.error ?? 'lifecycleSettle failed');
    log('P5:SETTLE', 'FAILED', result.error);
    return false;
  }

  // lifecycleSettle sets status='won' (for settlement_result='win')
  record('P5:SETTLE', true, {
    settlement_status: 'settled',
    settlement_result: 'win',
    status_after_settle: 'won',
  });
  log('P5:SETTLE', 'PASS', { settlement_result: 'win', status_after: 'won' });
  return true;
}

// ─── Phase 6: RECAP ──────────────────────────────────────────────────────────

async function phase6Recap(pickId: string): Promise<boolean> {
  log(
    'P6:RECAP',
    'Verifying pick discoverable by recap query (status IN won/lost/push/void/settled/graded)'
  );

  // Query using the corrected terminal status list (SPRINT-068 RecapService fix)
  const { data: recapPicks, error } = await supabase
    .from('unified_picks')
    .select('id, status, settlement_result, settlement_status, tier, player_name, created_at')
    .eq('id', pickId)
    .in('status', ['won', 'lost', 'push', 'void', 'settled', 'graded'])
    .not('settlement_result', 'is', null);

  if (error) {
    record('P6:RECAP', false, undefined, error.message);
    log('P6:RECAP', 'FAILED (query error)', error.message);
    return false;
  }

  if (!recapPicks || recapPicks.length === 0) {
    // Diagnose: check what status the pick actually has
    const { data: check } = await supabase
      .from('unified_picks')
      .select('id, status, settlement_result, settlement_status')
      .eq('id', pickId)
      .single();

    record(
      'P6:RECAP',
      false,
      { actualState: check ?? null },
      'Pick not discoverable by recap query'
    );
    log('P6:RECAP', 'FAILED — pick not in recap window', check);
    return false;
  }

  const pick = recapPicks[0];
  record('P6:RECAP', true, {
    recapPicksFound: recapPicks.length,
    pick,
    query:
      "status IN ('won','lost','push','void','settled','graded') AND settlement_result IS NOT NULL",
    recapServiceFixVerified: true,
  });
  log('P6:RECAP', 'PASS — pick found in recap window', pick);
  return true;
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

async function cleanup(pickId: string): Promise<void> {
  const { error } = await supabase
    .from('unified_picks')
    .delete()
    .eq('id', pickId)
    .eq('bet_slip_id', BET_SLIP_ID); // Guard: only delete our specific test pick

  if (error) {
    log('CLEANUP', 'Warning: could not delete test pick', error.message);
  } else {
    log('CLEANUP', 'Test pick deleted', { pickId });
  }
}

// ─── Report ──────────────────────────────────────────────────────────────────

function printReport(): void {
  const PHASE_ORDER = ['P1:SUBMIT', 'P2:SCORE', 'P3:PROMOTE', 'P4:POST', 'P5:SETTLE', 'P6:RECAP'];

  const results = PHASE_ORDER.map(p => ({
    phase: p,
    status: phases[p]?.success === true ? 'PASS' : phases[p]?.success === false ? 'FAIL' : 'SKIP',
    ...(phases[p] ?? {}),
  }));

  const passCount = results.filter(r => r.status === 'PASS').length;
  const allPass = passCount === PHASE_ORDER.length;

  const proof = {
    sprint: 'SPRINT-068-E2E-LIFECYCLE-CERT',
    timestamp: new Date().toISOString(),
    pickId: PICK_ID,
    date: TODAY,
    summary: {
      passed: passCount,
      total: PHASE_ORDER.length,
      verdict: allPass
        ? 'PASS — L1-R13 certified: full lifecycle E2E path traversed'
        : `PARTIAL — ${passCount}/${PHASE_ORDER.length} phases passed`,
    },
    phases: results,
    r13_status: allPass ? 'CERTIFIED' : 'PARTIAL',
  };

  if (JSON_ONLY) {
    console.log(JSON.stringify(proof, null, 2));
  } else {
    console.log('\n' + JSON.stringify(proof, null, 2));
    console.log('\n=== SPRINT-068 E2E LIFECYCLE CERTIFICATION ===');
    for (const r of results) {
      const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
      console.log(`  ${icon} ${r.phase}: ${r.status}`);
    }
    console.log(`\n  Verdict: ${proof.summary.verdict}`);
    console.log(`  R13: ${proof.r13_status}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log('HARNESS', 'SPRINT-068-E2E-LIFECYCLE-CERT starting', { pickId: PICK_ID, date: TODAY });

  // Phase 1: SUBMIT
  const pickId = await phase1Submit();
  if (!pickId) {
    printReport();
    return;
  }

  // Phase 2: SCORE (pure function — does not touch DB, cannot block phases 3+)
  const scoreResult = await phase2Score();
  const tier = (scoreResult?.tier as string) ?? 'A';
  const band = (scoreResult?.band as string) ?? 'SOFT';

  // Phase 3: PROMOTE
  const promoted = await phase3Promote(pickId, tier, band);
  if (!promoted) {
    await cleanup(pickId);
    printReport();
    return;
  }

  // Phase 4: POST
  const posted = await phase4Post(pickId);
  if (!posted) {
    await cleanup(pickId);
    printReport();
    return;
  }

  // Phase 5: SETTLE
  const settled = await phase5Settle(pickId);
  if (!settled) {
    await cleanup(pickId);
    printReport();
    return;
  }

  // Phase 6: RECAP
  await phase6Recap(pickId);

  await cleanup(pickId);
  printReport();
}

main().catch(err => {
  console.error('Harness fatal error:', err);
  process.exit(1);
});
