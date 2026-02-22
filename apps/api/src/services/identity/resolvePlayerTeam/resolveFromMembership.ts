/**
 * Resolve from participant_memberships
 * Highest priority - authoritative roster data
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { TeamResolutionResult, extractTeamFromJoin } from './types';

export async function resolveFromMembership(
  supabase: SupabaseClient,
  participantId: string,
  contextDate: string
): Promise<TeamResolutionResult | null> {
  const { data: membership, error } = await supabase
    .from('participant_memberships')
    .select(
      `
      team_id,
      valid_from,
      valid_to,
      team:participants!participant_memberships_team_id_fkey(id, name)
    `
    )
    .eq('participant_id', participantId)
    .lte('valid_from', contextDate)
    .or(`valid_to.is.null,valid_to.gte.${contextDate}`)
    .order('valid_from', { ascending: false })
    .limit(1)
    .single();

  if (error || !membership || !membership.team_id) {
    return null;
  }

  const team = extractTeamFromJoin(membership.team);

  return {
    teamId: membership.team_id,
    teamName: team?.name || 'Unknown',
    confidence: 1.0,
    source: 'membership',
    meta: {
      validFrom: membership.valid_from,
      validTo: membership.valid_to,
    },
  };
}
