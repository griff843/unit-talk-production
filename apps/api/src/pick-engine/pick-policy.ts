/**
 * Market Policy Filter
 * Sprint: SPRINT-030-EDGE-POLICY-SEPARATION
 *
 * Rejects picks for disabled market types or those below
 * market-specific edge thresholds. Fail-open: unknown markets pass.
 */

import type { PickEngineInput, FilterResult } from './pick-engine';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface MarketPolicy {
  id: number;
  sport: string;
  market_type: string;
  tier: string;
  enabled: boolean;
  min_edge: number;
  min_confidence: number;
  stake_multiplier: number;
}

// ── Filter ──────────────────────────────────────────────────────────────────

export function applyPolicyFilter(
  input: PickEngineInput,
  policies: MarketPolicy[],
  typeMap?: Map<number, string>
): FilterResult {
  const marketKey = typeMap?.get(input.market_type_id);

  // No market key mapping → pass (fail-open)
  if (!marketKey) {
    return {
      filter_name: 'market_policy',
      passed: true,
      value: input.edge_final,
      threshold: 0,
      reason: `no market_key mapping for type_id ${input.market_type_id} — pass`,
    };
  }

  const policy = policies.find(p => p.market_type === marketKey);

  // No policy for this market → pass (fail-open)
  if (!policy) {
    return {
      filter_name: 'market_policy',
      passed: true,
      value: input.edge_final,
      threshold: 0,
      reason: `no policy for ${marketKey} — pass`,
    };
  }

  // Market disabled by policy
  if (!policy.enabled) {
    return {
      filter_name: 'market_policy',
      passed: false,
      value: 0,
      threshold: 0,
      reason: `${marketKey} disabled by policy (tier=${policy.tier})`,
    };
  }

  // Edge below market-specific minimum
  if (input.edge_final < policy.min_edge) {
    return {
      filter_name: 'market_policy',
      passed: false,
      value: input.edge_final,
      threshold: policy.min_edge,
      reason: `edge ${input.edge_final.toFixed(4)} < policy min_edge ${policy.min_edge} for ${marketKey}`,
    };
  }

  return {
    filter_name: 'market_policy',
    passed: true,
    value: input.edge_final,
    threshold: policy.min_edge,
    reason: `${marketKey} policy pass (tier=${policy.tier}, multiplier=${policy.stake_multiplier})`,
  };
}

// ── Loader ──────────────────────────────────────────────────────────────────

export async function loadMarketPolicies(supabase: SupabaseClient): Promise<MarketPolicy[]> {
  const { data, error } = await supabase
    .from('market_policy')
    .select('id, sport, market_type, tier, enabled, min_edge, min_confidence, stake_multiplier')
    .order('id');

  if (error) {
    console.warn('[pick-policy] Failed to load market policies:', error.message);
    return [];
  }

  return (data ?? []).map(row => ({
    id: row.id,
    sport: row.sport,
    market_type: row.market_type,
    tier: row.tier,
    enabled: row.enabled,
    min_edge: Number(row.min_edge),
    min_confidence: Number(row.min_confidence),
    stake_multiplier: Number(row.stake_multiplier),
  }));
}
