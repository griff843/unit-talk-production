/**
 * Resolve from provider_player_map
 * Check if provider mapping includes team hints in meta
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { resolveFromMembership } from './resolveFromMembership';
import { TeamResolutionResult } from './types';

export async function resolveFromProviderMap(
  supabase: SupabaseClient,
  providerId: number,
  providerPlayerId: string,
  contextDate: string
): Promise<TeamResolutionResult | null> {
  const { data: mapping, error } = await supabase
    .from('provider_player_map')
    .select('canonical_player_id, meta, confidence_score')
    .eq('provider_id', providerId)
    .eq('provider_player_id', providerPlayerId)
    .lte('valid_from', contextDate)
    .or(`valid_to.is.null,valid_to.gte.${contextDate}`)
    .order('mapping_version', { ascending: false })
    .limit(1)
    .single();

  if (error || !mapping) {
    return null;
  }

  const meta = mapping.meta as Record<string, unknown> | null;
  const teamHint = meta?.team_id as string | undefined;
  const teamName = meta?.team_name as string | undefined;

  if (!teamHint) {
    if (mapping.canonical_player_id) {
      return resolveFromMembership(supabase, mapping.canonical_player_id, contextDate);
    }
    return null;
  }

  const { data: team } = await supabase
    .from('participants')
    .select('id, name')
    .eq('id', teamHint)
    .eq('type', 'team')
    .single();

  if (!team) {
    return null;
  }

  return {
    teamId: team.id,
    teamName: team.name || teamName || 'Unknown',
    confidence: (mapping.confidence_score as number) || 0.8,
    source: 'provider_map',
    meta: { providerId, providerPlayerId },
  };
}
