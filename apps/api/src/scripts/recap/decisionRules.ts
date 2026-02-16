/**
 * Non-emotional decision rules for EXPAND / HOLD / ROLLBACK.
 *
 * Definitions:
 *   promoted := promotion_band IN ('HARD', 'SOFT')
 *   rejected := promotion_band = 'NONE' OR NULL
 *
 * Rules implemented exactly as specified in RECAP-AGENT-001 mission.
 */

import type { DecisionResult, IntegrityChecks, SettledPick } from './types';

interface RuleInput {
  picks: SettledPick[];
  integrity: IntegrityChecks;
}

interface DecisionMetrics {
  settled_total: number;
  promoted_total: number;
  promoted_win_rate: number;
  rejected_win_rate: number;
  hard_win_rate: number;
  hard_count: number;
  delta: number;
  integrity_ok: boolean;
}

function computeMetrics(picks: SettledPick[], integrity: IntegrityChecks): DecisionMetrics {
  const promoted = picks.filter(p => p.promotion_band === 'HARD' || p.promotion_band === 'SOFT');
  const rejected = picks.filter(p => p.promotion_band === 'NONE' || p.promotion_band === null);
  const hard = picks.filter(p => p.promotion_band === 'HARD');

  const promotedWins = promoted.filter(p => p.settlement_result === 'win').length;
  const rejectedWins = rejected.filter(p => p.settlement_result === 'win').length;
  const hardWins = hard.filter(p => p.settlement_result === 'win').length;

  const promotedWinRate = promoted.length > 0 ? promotedWins / promoted.length : 0;
  const rejectedWinRate = rejected.length > 0 ? rejectedWins / rejected.length : 0;
  const hardWinRate = hard.length > 0 ? hardWins / hard.length : 0;

  return {
    settled_total: picks.length,
    promoted_total: promoted.length,
    promoted_win_rate: promotedWinRate,
    rejected_win_rate: rejectedWinRate,
    hard_win_rate: hardWinRate,
    hard_count: hard.length,
    delta: promotedWinRate - rejectedWinRate,
    integrity_ok: integrity.missing_settlements === 0 && integrity.missing_results === 0,
  };
}

function fmtPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function checkSampleGate(m: DecisionMetrics): DecisionResult | null {
  if (m.settled_total >= 30 && m.promoted_total >= 10) return null;
  const reasons: string[] = [];
  if (m.settled_total < 30) {
    reasons.push(`Insufficient sample: settled_total=${m.settled_total} < 30 threshold`);
  }
  if (m.promoted_total < 10) {
    reasons.push(`Insufficient promoted sample: promoted_total=${m.promoted_total} < 10 threshold`);
  }
  return { decision: 'HOLD', reasons, metrics: m };
}

function checkRollback(m: DecisionMetrics, integrity: IntegrityChecks): DecisionResult | null {
  if (m.promoted_win_rate < 0.48) {
    return {
      decision: 'ROLLBACK',
      reasons: [`promoted_win_rate=${fmtPct(m.promoted_win_rate)} < 48% threshold`],
      metrics: m,
    };
  }
  if (m.promoted_win_rate < m.rejected_win_rate) {
    return {
      decision: 'ROLLBACK',
      reasons: [
        `promoted_win_rate=${fmtPct(m.promoted_win_rate)} < rejected_win_rate=${fmtPct(m.rejected_win_rate)}`,
      ],
      metrics: m,
    };
  }
  if (!m.integrity_ok) {
    return {
      decision: 'ROLLBACK',
      reasons: [
        `Integrity failure: missing_settlements=${integrity.missing_settlements}, missing_results=${integrity.missing_results}`,
      ],
      metrics: m,
    };
  }
  return null;
}

function buildExpandChecks(m: DecisionMetrics): { pass: boolean; msg: string }[] {
  const hardMsg =
    m.hard_count < 5
      ? `Insufficient HARD sample: count=${m.hard_count} < 5`
      : `hard_win_rate=${fmtPct(m.hard_win_rate)} ${m.hard_win_rate >= 0.5 ? '>=' : '<'} 50%`;

  return [
    {
      pass: m.promoted_win_rate >= 0.55,
      msg: `promoted_win_rate=${fmtPct(m.promoted_win_rate)} ${m.promoted_win_rate >= 0.55 ? '>=' : '<'} 55%`,
    },
    {
      pass: m.delta >= 0.07,
      msg: `delta=${fmtPct(m.delta)} ${m.delta >= 0.07 ? '>=' : '<'} 7%`,
    },
    {
      pass: m.hard_count >= 5 ? m.hard_win_rate >= 0.5 : false,
      msg: hardMsg,
    },
    {
      pass: m.integrity_ok,
      msg: `integrity=${m.integrity_ok ? 'OK' : 'FAILED'}`,
    },
  ];
}

export function computeDecision(input: RuleInput): DecisionResult {
  const m = computeMetrics(input.picks, input.integrity);

  const sampleHold = checkSampleGate(m);
  if (sampleHold) return sampleHold;

  const rollback = checkRollback(m, input.integrity);
  if (rollback) return rollback;

  const expandChecks = buildExpandChecks(m);
  const allPass = expandChecks.every(c => c.pass);

  if (allPass) {
    return {
      decision: 'EXPAND',
      reasons: expandChecks.map(c => `[PASS] ${c.msg}`),
      metrics: m,
    };
  }

  return {
    decision: 'HOLD',
    reasons: expandChecks.map(c => `[${c.pass ? 'PASS' : 'FAIL'}] ${c.msg}`),
    metrics: m,
  };
}
