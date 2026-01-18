/**
 * useGameResolve Hook
 *
 * Auto-resolves player to game based on player ID and date.
 * Calls /api/games/resolve to get GameRef.
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import type { GameRef } from '@/types/form';

interface GameResolveResponse {
  gameRef: GameRef;
  resolved: boolean;
  playerTeam?: string;
  matchup?: string;
  reason?: string;
}

async function resolveGame(
  playerId: string,
  date: string,
  league?: string
): Promise<GameResolveResponse> {
  const params = new URLSearchParams();
  params.set('playerId', playerId);
  params.set('date', date);
  if (league) {
    params.set('league', league);
  }

  const response = await fetch(`/api/games/resolve?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to resolve game: ${response.statusText}`);
  }

  return response.json();
}

export function useGameResolve(playerId?: string, date?: string, league?: string) {
  return useQuery({
    queryKey: queryKeys.gameResolve(playerId || '', date || ''),
    queryFn: () => resolveGame(playerId!, date!, league),
    enabled: !!(playerId && date),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 10 * 60 * 1000,
  });
}
