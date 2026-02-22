/**
 * Resolve from event context
 * If we know the event, check if player is on home/away team roster
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { TeamResolutionResult } from './types';

interface TeamCheckContext {
  eventId: string;
  role: 'home' | 'away';
}

async function checkTeamMembership(
  supabase: SupabaseClient,
  participantId: string,
  teamId: string,
  context: TeamCheckContext
): Promise<TeamResolutionResult | null> {
  const { data: membership } = await supabase
    .from('participant_memberships')
    .select('team_id')
    .eq('participant_id', participantId)
    .eq('team_id', teamId)
    .limit(1)
    .single();

  if (!membership) {
    return null;
  }

  const { data: team } = await supabase
    .from('participants')
    .select('name')
    .eq('id', teamId)
    .single();

  return {
    teamId,
    teamName: team?.name || 'Unknown',
    confidence: 0.9,
    source: 'event_context',
    meta: { eventId: context.eventId, role: context.role },
  };
}

export async function resolveFromEventContext(
  supabase: SupabaseClient,
  participantId: string,
  eventId: string
): Promise<TeamResolutionResult | null> {
  const { data: event } = await supabase
    .from('canonical_events')
    .select('home_participant_id, away_participant_id')
    .eq('id', eventId)
    .single();

  if (!event) {
    return null;
  }

  if (event.home_participant_id) {
    const homeResult = await checkTeamMembership(
      supabase,
      participantId,
      event.home_participant_id,
      {
        eventId,
        role: 'home',
      }
    );
    if (homeResult) return homeResult;
  }

  if (event.away_participant_id) {
    const awayResult = await checkTeamMembership(
      supabase,
      participantId,
      event.away_participant_id,
      {
        eventId,
        role: 'away',
      }
    );
    if (awayResult) return awayResult;
  }

  return null;
}
