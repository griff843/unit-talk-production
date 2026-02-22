/**
 * Fuzzy match utilities
 *
 * NOTE: Fuzzy match is NOT used in the main resolution flow for fail-closed behavior.
 * It is provided here for debugging and manual resolution assistance only.
 * Per SPRINT-MARKET-SCOPED-IDENTITY-100B2: fuzzy match must not result in 'resolved' status.
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { extractTeamFromJoin } from './types';

/** Simple string similarity using Dice coefficient */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const getBigrams = (str: string): Map<string, number> => {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.substring(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
    return bigrams;
  };

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  let matches = 0;
  for (const [bigram, count] of bigramsA) {
    matches += Math.min(count, bigramsB.get(bigram) || 0);
  }

  return (2 * matches) / (a.length + b.length - 2);
}

export interface FuzzyMatchResult {
  playerId: string;
  playerName: string;
  matchScore: number;
  teamId: string | null;
  teamName: string | null;
}

/**
 * Find fuzzy matches for a player name (for debugging/manual resolution only)
 * This function is NOT used in the main resolution flow.
 */
export async function findFuzzyMatches(
  supabase: SupabaseClient,
  playerName: string,
  sport: string,
  minScore = 0.7
): Promise<FuzzyMatchResult[]> {
  const { data: players } = await supabase
    .from('participants')
    .select('id, name')
    .eq('type', 'player')
    .eq('sport', sport)
    .ilike('name', `%${playerName}%`)
    .limit(10);

  if (!players || players.length === 0) {
    return [];
  }

  const normalizedTarget = playerName.toLowerCase().replace(/[^a-z]/g, '');
  const results: FuzzyMatchResult[] = [];

  for (const p of players) {
    const normalizedName = p.name.toLowerCase().replace(/[^a-z]/g, '');
    const score = stringSimilarity(normalizedTarget, normalizedName);

    if (score >= minScore) {
      const { data: membership } = await supabase
        .from('participant_memberships')
        .select(
          `
          team_id,
          team:participants!participant_memberships_team_id_fkey(id, name)
        `
        )
        .eq('participant_id', p.id)
        .is('valid_to', null)
        .limit(1)
        .single();

      const team = membership ? extractTeamFromJoin(membership.team) : null;

      results.push({
        playerId: p.id,
        playerName: p.name,
        matchScore: score,
        teamId: membership?.team_id || null,
        teamName: team?.name || null,
      });
    }
  }

  return results.sort((a, b) => b.matchScore - a.matchScore);
}
