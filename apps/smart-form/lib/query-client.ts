/**
 * React Query Client Configuration
 *
 * Optimized for production with proper caching, stale times, and retry logic.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: how long before data is considered stale
      staleTime: 5 * 60 * 1000, // 5 minutes

      // Cache time: how long inactive data stays in cache
      gcTime: 15 * 60 * 1000, // 15 minutes (was cacheTime in v4)

      // Retry configuration
      retry: 2,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch configuration
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

/**
 * Query keys for consistent cache management
 */
export const queryKeys = {
  cappers: (active?: boolean) => ['cappers', { active }] as const,
  players: (query: string, league?: string) => ['players', { query, league }] as const,
  games: (league: string, date?: string, teamId?: string) => ['games', { league, date, teamId }] as const,
  gameResolve: (playerId: string, date: string) => ['game-resolve', { playerId, date }] as const,
  props: (league: string) => ['props', { league }] as const,
} as const;
