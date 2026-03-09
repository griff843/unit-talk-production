/**
 * CLV Robustness Test
 * Sprint: SPRINT-027-MODEL-EDGE-VALIDATION
 *
 * Breaks CLV into feature groups to identify whether the signal
 * is real across dimensions or an artifact of a single cluster.
 */

import type { JoinedScoringRecord, TestResult } from './types';

export interface FeatureGroupStats {
  group_label: string;
  sample_size: number;
  mean_clv: number;
  positive_clv_rate: number;
  std_clv: number;
  t_statistic: number;
}

export interface RobustnessFeature {
  feature_name: string;
  groups: FeatureGroupStats[];
}

export function runCLVRobustness(
  records: JoinedScoringRecord[],
  marketTypeMap: Map<number, string>,
  eventScheduleMap: Map<string, string>
): TestResult {
  if (records.length === 0) {
    return {
      test_name: 'clv_robustness',
      verdict: 'FAIL',
      summary: 'No records for CLV robustness analysis.',
      details: {},
      timestamp: new Date().toISOString(),
    };
  }

  const features: RobustnessFeature[] = [];

  // 1. By market_type
  features.push(
    buildFeature('market_type', records, r => {
      const name = marketTypeMap.get(r.market_type_id);
      return name ?? `type_${r.market_type_id}`;
    })
  );

  // 2. By provider_count (book_count buckets)
  features.push(
    buildFeature('provider_count', records, r => {
      if (r.book_count >= 5) return '5+';
      return String(r.book_count);
    })
  );

  // 3. By line_move_size (|clv_prob| buckets)
  features.push(
    buildFeature('line_move_size', records, r => {
      const abs = Math.abs(r.clv_prob);
      if (abs < 0.005) return '<0.5%';
      if (abs < 0.01) return '0.5-1%';
      if (abs < 0.02) return '1-2%';
      return '>2%';
    })
  );

  // 4. By game_time_bucket
  features.push(
    buildFeature('game_time_bucket', records, r => {
      const schedule = eventScheduleMap.get(r.event_id);
      if (!schedule) return 'unknown';
      const hour = new Date(schedule).getUTCHours();
      if (hour < 12) return 'morning';
      if (hour < 17) return 'afternoon';
      if (hour < 21) return 'evening';
      return 'late_night';
    })
  );

  // Verdict: FAIL if any group with sample_size >= 500 has mean_clv <= 0 AND positive_clv_rate < 0.50
  let verdict: 'PASS' | 'FAIL' | 'WARN' = 'PASS';
  const failingGroups: string[] = [];

  for (const feature of features) {
    for (const group of feature.groups) {
      if (group.sample_size >= 500 && group.mean_clv <= 0 && group.positive_clv_rate < 0.5) {
        failingGroups.push(
          `${feature.feature_name}:${group.group_label} (n=${group.sample_size}, mean_clv=${group.mean_clv})`
        );
      }
    }
  }

  if (failingGroups.length > 0) {
    verdict = 'FAIL';
  }

  // Count groups with significant positive CLV
  const significantPositive = features
    .flatMap(f => f.groups)
    .filter(g => g.sample_size >= 500 && g.mean_clv > 0).length;

  if (verdict === 'PASS' && significantPositive < 3) {
    verdict = 'WARN';
  }

  const summary =
    verdict === 'FAIL'
      ? `CLV robustness FAIL: ${failingGroups.length} groups with n≥500 show non-positive CLV.`
      : `CLV positive in ${significantPositive} feature groups with n≥500. ${features.length} dimensions analyzed.`;

  return {
    test_name: 'clv_robustness',
    verdict,
    summary,
    details: {
      features,
      significant_positive_groups: significantPositive,
      failing_groups: failingGroups,
      total_records: records.length,
      methodology:
        'CLV broken by market_type, provider_count, line_move_size, game_time_bucket. FAIL if any group with n≥500 has mean_clv≤0 and positive_rate<50%.',
    },
    timestamp: new Date().toISOString(),
  };
}

function buildFeature(
  featureName: string,
  records: JoinedScoringRecord[],
  groupFn: (r: JoinedScoringRecord) => string
): RobustnessFeature {
  const groupMap = new Map<string, number[]>();

  for (const r of records) {
    const label = groupFn(r);
    let arr = groupMap.get(label);
    if (!arr) {
      arr = [];
      groupMap.set(label, arr);
    }
    arr.push(r.clv_prob);
  }

  const groups: FeatureGroupStats[] = [];

  for (const [label, clvs] of groupMap) {
    const n = clvs.length;
    const mean = clvs.reduce((s, v) => s + v, 0) / n;
    const positiveRate = clvs.filter(v => v > 0).length / n;
    const variance = clvs.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    const tStat = std > 0 && n > 1 ? mean / (std / Math.sqrt(n)) : 0;

    groups.push({
      group_label: label,
      sample_size: n,
      mean_clv: round(mean, 6),
      positive_clv_rate: round(positiveRate, 4),
      std_clv: round(std, 6),
      t_statistic: round(tStat, 3),
    });
  }

  // Sort by sample_size descending
  groups.sort((a, b) => b.sample_size - a.sample_size);

  return { feature_name: featureName, groups };
}

function round(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}
