/**
 * Player Team Resolution Service
 * Sprint: SPRINT-MARKET-SCOPED-IDENTITY-100B2
 *
 * Resolves a player's team affiliation using authoritative sources only.
 * Fuzzy match is excluded from main flow for fail-closed behavior.
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { resolveFromEventContext } from './resolveFromEventContext';
import { resolveFromMembership } from './resolveFromMembership';
import { resolveFromProviderMap } from './resolveFromProviderMap';
import { PlayerIdentifier, TeamResolutionContext, TeamResolutionResult } from './types';

export * from './types';
export { findFuzzyMatches, stringSimilarity } from './fuzzyMatch';

async function resolveParticipantId(
  supabase: SupabaseClient,
  player: PlayerIdentifier
): Promise<string | null> {
  if (player.participantId) return player.participantId;

  const query = supabase
    .from('participants')
    .select('id')
    .eq('sport', player.sport)
    .eq('type', 'player');

  if (player.externalId) {
    const { data } = await query.eq('external_id', player.externalId).single();
    if (data?.id) return data.id;
  }

  if (player.playerName) {
    const { data } = await query.eq('name', player.playerName).single();
    if (data?.id) return data.id;
  }

  return null;
}

export async function resolvePlayerTeam(
  supabase: SupabaseClient,
  player: PlayerIdentifier,
  context: TeamResolutionContext = {}
): Promise<TeamResolutionResult | null> {
  const contextDate = (context.contextDate || new Date()).toISOString().split('T')[0];
  const participantId = await resolveParticipantId(supabase, player);
  if (!participantId) return null;

  const membership = await resolveFromMembership(supabase, participantId, contextDate);
  if (membership) return membership;

  if (context.providerId && context.providerPlayerId) {
    const providerMap = await resolveFromProviderMap(
      supabase,
      context.providerId,
      context.providerPlayerId,
      contextDate
    );
    if (providerMap) return providerMap;
  }

  if (context.eventId) {
    const eventContext = await resolveFromEventContext(supabase, participantId, context.eventId);
    if (eventContext) return eventContext;
  }

  return null;
}

export async function resolvePlayerTeamsBatch(
  supabase: SupabaseClient,
  players: PlayerIdentifier[],
  context: TeamResolutionContext = {}
): Promise<Map<string, TeamResolutionResult | null>> {
  const results = new Map<string, TeamResolutionResult | null>();
  for (const player of players) {
    const key = player.participantId || player.externalId || player.playerName || '';
    results.set(key, await resolvePlayerTeam(supabase, player, context));
  }
  return results;
}

export async function isPlayerInMarketUniverse(
  supabase: SupabaseClient,
  participantId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('view_market_universe_players')
    .select('participant_id')
    .eq('participant_id', participantId)
    .limit(1)
    .single();
  return !!data && !error;
}
