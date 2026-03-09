/**
 * Data Integrity Check
 * Sprint: SPRINT-027-MODEL-EDGE-VALIDATION
 *
 * Validates data quality before any statistical tests.
 * Fail-closed: any integrity violation blocks all subsequent tests.
 */

import type { ShadowScoreRow, ShadowCLVRow, CanonicalEventRow, TestResult } from './types';

export interface IntegrityCheckInput {
  scores: ShadowScoreRow[];
  clvResults: ShadowCLVRow[];
  events: Map<string, CanonicalEventRow>;
}

export function runIntegrityCheck(input: IntegrityCheckInput): TestResult {
  const { scores, clvResults, events } = input;

  // 1. Temporal ordering: score snapshot_at must be before game scheduled_at
  let temporalViolations = 0;
  let temporalChecked = 0;

  for (const score of scores) {
    const event = events.get(score.event_id);
    if (!event) continue;
    temporalChecked++;

    const scoreTime = new Date(score.snapshot_at).getTime();
    const gameTime = new Date(event.scheduled_at).getTime();

    if (scoreTime >= gameTime) {
      temporalViolations++;
    }
  }

  // 2. Market uniqueness in CLV table
  const clvKeys = new Set<string>();
  let duplicateMarketKeys = 0;

  for (const clv of clvResults) {
    const key = `${clv.market_key}|${clv.model_version}`;
    if (clvKeys.has(key)) {
      duplicateMarketKeys++;
    } else {
      clvKeys.add(key);
    }
  }

  // 3. Provider coverage
  let strongCoverage = 0;
  let weakCoverage = 0;

  for (const score of scores) {
    if (score.book_count >= 3) strongCoverage++;
    else weakCoverage++;
  }

  // 4. Null checks
  // Partial CLV rows (reason_code != null) are expected to have null p_close_devig.
  // Only count nulls on rows that should have values.
  const scoresMissingPFinal = scores.filter(s => s.p_final == null).length;
  const scoresMissingEdge = scores.filter(s => s.edge_final == null).length;
  const clvPartialCount = clvResults.filter(c => c.reason_code != null).length;
  const clvComplete = clvResults.filter(c => c.reason_code == null);
  const clvMissingPClose = clvComplete.filter(c => c.p_close_devig == null).length;

  const totalChecks = scores.length + clvComplete.length;
  const totalNulls = scoresMissingPFinal + clvMissingPClose;
  const nullRate = totalChecks > 0 ? totalNulls / totalChecks : 0;

  // 5. CLV join rate
  const scoreKeys = new Set(scores.map(s => `${s.market_key}|${s.model_version}`));
  const clvKeySet = new Set(
    clvResults.filter(c => c.reason_code == null).map(c => `${c.market_key}|${c.model_version}`)
  );
  let scoresWithClv = 0;
  for (const key of scoreKeys) {
    if (clvKeySet.has(key)) scoresWithClv++;
  }

  // Determine verdict
  let verdict: 'PASS' | 'FAIL' | 'WARN' = 'PASS';
  const failures: string[] = [];

  if (temporalViolations > 0) {
    verdict = 'FAIL';
    failures.push(`${temporalViolations} temporal violations (score after game start)`);
  }

  if (duplicateMarketKeys > 0) {
    verdict = 'FAIL';
    failures.push(`${duplicateMarketKeys} duplicate market keys in CLV table`);
  }

  if (nullRate > 0.05) {
    verdict = 'FAIL';
    failures.push(`Null rate ${(nullRate * 100).toFixed(1)}% exceeds 5% threshold`);
  }

  if (verdict === 'PASS' && weakCoverage > strongCoverage) {
    verdict = 'WARN';
  }

  const summary =
    verdict === 'PASS'
      ? `All integrity checks passed. ${scores.length} scores, ${scoresWithClv} joined to CLV.`
      : verdict === 'WARN'
        ? `Integrity OK with warnings. Weak coverage: ${weakCoverage}/${scores.length} markets have <3 books.`
        : `INTEGRITY FAILURE: ${failures.join('; ')}`;

  return {
    test_name: 'integrity_check',
    verdict,
    summary,
    details: {
      temporal_violations: temporalViolations,
      temporal_checked: temporalChecked,
      duplicate_market_keys: duplicateMarketKeys,
      book_count_distribution: {
        strong_gte3: strongCoverage,
        weak_lt3: weakCoverage,
      },
      null_checks: {
        scores_missing_p_final: scoresMissingPFinal,
        scores_missing_edge_final: scoresMissingEdge,
        clv_missing_p_close: clvMissingPClose,
        clv_partial_count: clvPartialCount,
        null_rate: nullRate,
      },
      join_rate: {
        total_scores: scores.length,
        scores_with_clv: scoresWithClv,
        join_rate_percent: scores.length > 0 ? (scoresWithClv / scores.length) * 100 : 0,
      },
      failures,
    },
    timestamp: new Date().toISOString(),
  };
}
