/**
 * Edge Bucket Report — Sprint 030
 * SPRINT-030-EDGE-POLICY-SEPARATION
 *
 * Joins shadow_scores + prop_outcomes, computes signal features,
 * and evaluates ROI by edge/confidence/movement/disagreement/market_type buckets.
 * Also simulates market_policy filter to validate policy settings.
 */

import * as dotenv from 'dotenv';

import * as fs from 'fs';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';

import {
  computeSignalVector,
  type ProviderOfferSlim,
  type SignalVector,
} from '../../apps/api/src/analysis/signals/market-signals';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const SPRINT = 'SPRINT-030-EDGE-POLICY-SEPARATION';
const DATE_STR = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../out/sprints/${SPRINT}/${DATE_STR}`);

// ── Types ───────────────────────────────────────────────────────────────────

interface JoinedRecord {
  market_key: string;
  event_id: string;
  market_type_id: number;
  market_type_key: string;
  participant_id: string | null;
  p_final: number;
  edge_final: number;
  score: number;
  book_count: number;
  outcome: 'WIN' | 'LOSS' | 'PUSH';
  actual_value: number;
  line: number;
  signals: SignalVector | null;
}

interface BucketRow {
  label: string;
  count: number;
  wins: number;
  losses: number;
  pushes: number;
  hit_rate_pct: number;
  roi_pct: number;
}

interface PolicySimRow {
  market_type: string;
  policy_enabled: boolean;
  count: number;
  hit_rate_pct: number;
  roi_pct: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function computeROI(outcomes: string[]): number {
  let bankroll = 0;
  for (const o of outcomes) {
    if (o === 'WIN') bankroll += 100;
    else if (o === 'LOSS') bankroll -= 110;
    // PUSH: 0
  }
  const totalRisked = outcomes.filter(o => o !== 'PUSH').length * 110;
  return totalRisked > 0 ? (bankroll / totalRisked) * 100 : 0;
}

function round(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

function buildBuckets(records: JoinedRecord[], labeler: (r: JoinedRecord) => string): BucketRow[] {
  const groups = new Map<string, JoinedRecord[]>();
  for (const r of records) {
    const label = labeler(r);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(r);
  }

  const buckets: BucketRow[] = [];
  for (const [label, group] of Array.from(groups.entries())) {
    const wins = group.filter(r => r.outcome === 'WIN').length;
    const losses = group.filter(r => r.outcome === 'LOSS').length;
    const pushes = group.filter(r => r.outcome === 'PUSH').length;
    const nonPush = group.filter(r => r.outcome !== 'PUSH');
    const roi = computeROI(group.map(r => r.outcome));

    buckets.push({
      label,
      count: group.length,
      wins,
      losses,
      pushes,
      hit_rate_pct: nonPush.length > 0 ? round((wins / nonPush.length) * 100, 2) : 0,
      roi_pct: round(roi, 3),
    });
  }

  return buckets.sort((a, b) => b.count - a.count);
}

// ── Data Fetching ───────────────────────────────────────────────────────────

async function fetchAllRows<T>(table: string, select: string): Promise<T[]> {
  const rows: T[] = [];
  let lastId = '';
  const PAGE = 1000;
  while (true) {
    let q = supabase.from(table).select(select).order('id').limit(PAGE);
    if (lastId) q = q.gt('id', lastId);
    const { data, error } = await q;
    if (error) {
      console.error(`[${table}]`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    lastId = (data[data.length - 1] as Record<string, unknown>).id as string;
    if (data.length < PAGE) break;
  }
  return rows;
}

async function fetchProviderOffers(
  eventIds: string[],
  marketTypeId: number,
  participantId: string | null
): Promise<ProviderOfferSlim[]> {
  // Batch by 10 events at a time
  const all: ProviderOfferSlim[] = [];
  for (let i = 0; i < eventIds.length; i += 10) {
    const batch = eventIds.slice(i, i + 10);
    let q = supabase
      .from('provider_offers')
      .select('provider, line, over_odds, under_odds, snapshot_at, is_opening, is_closing')
      .in('event_id', batch)
      .eq('market_type_id', marketTypeId);

    if (participantId) {
      q = q.eq('participant_id', participantId);
    }

    const { data, error } = await q.limit(500);
    if (error) continue;
    if (data) all.push(...(data as ProviderOfferSlim[]));
  }
  return all;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  SPRINT-030: Edge Bucket Report`);
  console.log(`  OUT_DIR: ${OUT_DIR}`);
  console.log(`${'='.repeat(60)}\n`);

  // 1. Fetch shadow_scores
  console.log('[Data] Fetching shadow_scores...');
  const shadowScores = await fetchAllRows<{
    id: string;
    market_key: string;
    event_id: string;
    market_type_id: number;
    participant_id: string | null;
    p_final: number;
    edge_final: number;
    score: number;
    book_count: number;
  }>(
    'shadow_scores',
    'id, market_key, event_id, market_type_id, participant_id, p_final, edge_final, score, book_count'
  );
  console.log(`[Data] ${shadowScores.length} shadow_scores`);

  // 2. Fetch prop_outcomes
  console.log('[Data] Fetching prop_outcomes...');
  const propOutcomes = await fetchAllRows<{
    id: string;
    market_key: string;
    outcome: string;
    actual_value: number;
    line: number;
  }>('prop_outcomes', 'id, market_key, outcome, actual_value, line');
  console.log(`[Data] ${propOutcomes.length} prop_outcomes`);

  // 3. Fetch market_types
  const { data: mtData } = await supabase.from('market_types').select('id, market_key');
  const marketTypeMap = new Map<number, string>();
  for (const mt of mtData ?? []) {
    marketTypeMap.set(mt.id, mt.market_key);
  }

  // 4. Fetch market_policy
  const { data: policyData } = await supabase.from('market_policy').select('*');
  const policies = (policyData ?? []) as Array<{
    market_type: string;
    enabled: boolean;
    min_edge: number;
    tier: string;
  }>;
  console.log(`[Data] ${policies.length} market policies loaded`);

  // 5. Join shadow_scores + prop_outcomes
  const outcomeMap = new Map<string, { outcome: string; actual_value: number; line: number }>();
  for (const o of propOutcomes) {
    outcomeMap.set(o.market_key, {
      outcome: o.outcome,
      actual_value: o.actual_value,
      line: o.line,
    });
  }

  const joined: JoinedRecord[] = [];
  let unmatched = 0;
  for (const ss of shadowScores) {
    const oc = outcomeMap.get(ss.market_key);
    if (!oc) {
      unmatched++;
      continue;
    }
    joined.push({
      market_key: ss.market_key,
      event_id: ss.event_id,
      market_type_id: ss.market_type_id,
      market_type_key: marketTypeMap.get(ss.market_type_id) ?? `mt_${ss.market_type_id}`,
      participant_id: ss.participant_id,
      p_final: ss.p_final,
      edge_final: ss.edge_final,
      score: ss.score,
      book_count: ss.book_count,
      outcome: oc.outcome as 'WIN' | 'LOSS' | 'PUSH',
      actual_value: oc.actual_value,
      line: oc.line,
      signals: null,
    });
  }
  console.log(`[Join] ${joined.length} joined records, ${unmatched} unmatched`);

  // 6. Compute signals for a sample (full provider_offers fetch is expensive)
  // Group by unique event_id + market_type_id + participant_id
  const signalKeys = new Map<string, JoinedRecord[]>();
  for (const r of joined) {
    const key = `${r.event_id}|${r.market_type_id}|${r.participant_id ?? 'null'}`;
    if (!signalKeys.has(key)) signalKeys.set(key, []);
    signalKeys.get(key)!.push(r);
  }

  console.log(`[Signals] ${signalKeys.size} unique markets to probe`);
  console.log(`[Signals] Sampling up to 500 markets for signal computation...`);

  let signalCount = 0;
  const signalEntries = Array.from(signalKeys.entries()).slice(0, 500);
  for (let i = 0; i < signalEntries.length; i++) {
    const [, records] = signalEntries[i]!;
    const r = records[0]!;

    const offers = await fetchProviderOffers([r.event_id], r.market_type_id, r.participant_id);
    if (offers.length === 0) continue;

    const opening = offers.filter(o => o.is_opening);
    const closing = offers.filter(o => o.is_closing);
    const sv = computeSignalVector(opening, closing, offers);

    for (const rec of records) {
      rec.signals = sv;
    }
    signalCount++;

    if ((i + 1) % 100 === 0) {
      console.log(`[Signals] Progress: ${i + 1}/${signalEntries.length}`);
    }
  }
  console.log(`[Signals] Computed ${signalCount} signal vectors`);

  // 7. Build buckets
  console.log('\n' + '─'.repeat(40));

  // Edge buckets
  const edgeBuckets = buildBuckets(joined, r => {
    const e = r.edge_final;
    if (e < 0) return '<0%';
    if (e < 0.02) return '0-2%';
    if (e < 0.05) return '2-5%';
    if (e < 0.08) return '5-8%';
    return '8%+';
  });

  // Confidence buckets
  const confBuckets = buildBuckets(joined, r => {
    const s = r.score;
    if (s < 30) return '<30';
    if (s < 50) return '30-50';
    if (s < 70) return '50-70';
    return '70+';
  });

  // Market type buckets
  const marketBuckets = buildBuckets(joined, r => r.market_type_key);

  // Movement direction (only records with signals)
  const withSignals = joined.filter(r => r.signals !== null);
  const movementBuckets = buildBuckets(withSignals, r => {
    const m = r.signals!.movement_score;
    if (m > 0.05) return 'positive';
    if (m < -0.05) return 'negative';
    return 'neutral';
  });

  // Book disagreement quartiles (only records with signals)
  const disagreements = withSignals.map(r => r.signals!.disagreement_score).sort((a, b) => a - b);
  const dq1 = disagreements[Math.floor(disagreements.length * 0.25)] ?? 0;
  const dq2 = disagreements[Math.floor(disagreements.length * 0.5)] ?? 0;
  const dq3 = disagreements[Math.floor(disagreements.length * 0.75)] ?? 0;

  const disagreementBuckets = buildBuckets(withSignals, r => {
    const d = r.signals!.disagreement_score;
    if (d <= dq1) return `Q1 (≤${dq1.toFixed(4)})`;
    if (d <= dq2) return `Q2 (≤${dq2.toFixed(4)})`;
    if (d <= dq3) return `Q3 (≤${dq3.toFixed(4)})`;
    return `Q4 (>${dq3.toFixed(4)})`;
  });

  // Sharp-retail delta (only records with signals)
  const sharpDeltaBuckets = buildBuckets(withSignals, r => {
    const d = r.signals!.sharp_retail_delta;
    if (d > 0.01) return 'sharp_bullish';
    if (d < -0.01) return 'sharp_bearish';
    return 'neutral';
  });

  // 8. Policy simulation
  const policyMap = new Map<string, { enabled: boolean; min_edge: number; tier: string }>();
  for (const p of policies) {
    policyMap.set(p.market_type, p);
  }

  const policySim: PolicySimRow[] = [];
  const policyGroups = new Map<string, JoinedRecord[]>();
  for (const r of joined) {
    const p = policyMap.get(r.market_type_key);
    const wouldPass = !p || (p.enabled && r.edge_final >= p.min_edge);
    const key = `${r.market_type_key}|${wouldPass ? 'pass' : 'reject'}`;
    if (!policyGroups.has(key)) policyGroups.set(key, []);
    policyGroups.get(key)!.push(r);
  }

  for (const [key, records] of Array.from(policyGroups.entries())) {
    const [mt, verdict] = key.split('|');
    const wins = records.filter(r => r.outcome === 'WIN').length;
    const nonPush = records.filter(r => r.outcome !== 'PUSH');
    policySim.push({
      market_type: mt!,
      policy_enabled: verdict === 'pass',
      count: records.length,
      hit_rate_pct: nonPush.length > 0 ? round((wins / nonPush.length) * 100, 2) : 0,
      roi_pct: round(computeROI(records.map(r => r.outcome)), 3),
    });
  }
  policySim.sort((a, b) => b.count - a.count);

  // Overall policy simulation
  const policyPassRecords = joined.filter(r => {
    const p = policyMap.get(r.market_type_key);
    return !p || (p.enabled && r.edge_final >= p.min_edge);
  });
  const policyRejectRecords = joined.filter(r => {
    const p = policyMap.get(r.market_type_key);
    return p && (!p.enabled || r.edge_final < p.min_edge);
  });

  // 9. Print summary
  console.log(`\n[Report] Total joined: ${joined.length}`);
  console.log(`[Report] With signals: ${withSignals.length}`);

  console.log(`\n  By edge_final:`);
  for (const b of edgeBuckets) {
    console.log(`    ${b.label}: ${b.count} props, ${b.hit_rate_pct}% hit, ${b.roi_pct}% ROI`);
  }

  console.log(`\n  By confidence (score):`);
  for (const b of confBuckets) {
    console.log(`    ${b.label}: ${b.count} props, ${b.hit_rate_pct}% hit, ${b.roi_pct}% ROI`);
  }

  console.log(`\n  By market type:`);
  for (const b of marketBuckets) {
    console.log(`    ${b.label}: ${b.count} props, ${b.hit_rate_pct}% hit, ${b.roi_pct}% ROI`);
  }

  console.log(`\n  By movement direction (${withSignals.length} with signals):`);
  for (const b of movementBuckets) {
    console.log(`    ${b.label}: ${b.count} props, ${b.hit_rate_pct}% hit, ${b.roi_pct}% ROI`);
  }

  console.log(`\n  By book disagreement:`);
  for (const b of disagreementBuckets) {
    console.log(`    ${b.label}: ${b.count} props, ${b.hit_rate_pct}% hit, ${b.roi_pct}% ROI`);
  }

  console.log(`\n  Policy simulation:`);
  console.log(
    `    Would pass: ${policyPassRecords.length} (${round(computeROI(policyPassRecords.map(r => r.outcome)), 3)}% ROI)`
  );
  console.log(
    `    Would reject: ${policyRejectRecords.length} (${round(computeROI(policyRejectRecords.map(r => r.outcome)), 3)}% ROI)`
  );

  // 10. Write artifacts
  const bucketData = {
    generated_at: new Date().toISOString(),
    total_records: joined.length,
    signal_records: withSignals.length,
    by_edge: edgeBuckets,
    by_confidence: confBuckets,
    by_market_type: marketBuckets,
    by_movement: movementBuckets,
    by_disagreement: disagreementBuckets,
    by_sharp_delta: sharpDeltaBuckets,
  };

  fs.writeFileSync(
    path.join(OUT_DIR, 'EDGE_BUCKET_DATA.json'),
    JSON.stringify(bucketData, null, 2)
  );

  // Policy simulation JSON
  const policySimData = {
    generated_at: new Date().toISOString(),
    total: joined.length,
    pass_count: policyPassRecords.length,
    reject_count: policyRejectRecords.length,
    pass_roi_pct: round(computeROI(policyPassRecords.map(r => r.outcome)), 3),
    reject_roi_pct: round(computeROI(policyRejectRecords.map(r => r.outcome)), 3),
    by_market: policySim,
  };
  fs.writeFileSync(
    path.join(OUT_DIR, 'POLICY_SIMULATION.json'),
    JSON.stringify(policySimData, null, 2)
  );

  // Markdown report
  const md = generateMarkdownReport(bucketData, policySimData);
  fs.writeFileSync(path.join(OUT_DIR, 'EDGE_BUCKET_REPORT.md'), md);

  // Market policy seed for proof
  fs.writeFileSync(
    path.join(OUT_DIR, 'market_policy_seed.json'),
    JSON.stringify(policies, null, 2)
  );

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Artifacts written to ${OUT_DIR}`);
  console.log(`${'='.repeat(60)}\n`);
}

function generateMarkdownReport(
  data: Record<string, unknown>,
  policySim: Record<string, unknown>
): string {
  const lines: string[] = [];
  lines.push('# Edge Bucket Report — SPRINT-030');
  lines.push(`\nGenerated: ${new Date().toISOString()}`);
  lines.push(`\nTotal records: ${data.total_records}`);
  lines.push(`Signal records: ${data.signal_records}`);

  const sections: Array<{ title: string; key: string }> = [
    { title: 'By Edge Final', key: 'by_edge' },
    { title: 'By Confidence (Score)', key: 'by_confidence' },
    { title: 'By Market Type', key: 'by_market_type' },
    { title: 'By Movement Direction', key: 'by_movement' },
    { title: 'By Book Disagreement', key: 'by_disagreement' },
    { title: 'By Sharp-Retail Delta', key: 'by_sharp_delta' },
  ];

  for (const section of sections) {
    lines.push(`\n## ${section.title}\n`);
    lines.push('| Bucket | Count | Hit Rate | ROI |');
    lines.push('|--------|-------|----------|-----|');
    const buckets = data[section.key] as BucketRow[];
    for (const b of buckets) {
      lines.push(`| ${b.label} | ${b.count} | ${b.hit_rate_pct}% | ${b.roi_pct}% |`);
    }
  }

  lines.push('\n## Policy Simulation\n');
  const ps = policySim as {
    pass_count: number;
    reject_count: number;
    pass_roi_pct: number;
    reject_roi_pct: number;
    by_market: PolicySimRow[];
  };
  lines.push(`- **Would pass**: ${ps.pass_count} props → ${ps.pass_roi_pct}% ROI`);
  lines.push(`- **Would reject**: ${ps.reject_count} props → ${ps.reject_roi_pct}% ROI`);
  lines.push('\n| Market Type | Verdict | Count | Hit Rate | ROI |');
  lines.push('|-------------|---------|-------|----------|-----|');
  for (const row of ps.by_market) {
    lines.push(
      `| ${row.market_type} | ${row.policy_enabled ? 'pass' : 'reject'} | ${row.count} | ${row.hit_rate_pct}% | ${row.roi_pct}% |`
    );
  }

  return lines.join('\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
