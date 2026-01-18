/**
 * usePlayerSearch Hook
 *
 * Production-grade player search with:
 * - 200ms debounce
 * - AbortController for canceling stale requests
 * - 10 minute cache
 * - p95 <120ms performance target
 */

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { queryKeys } from '@/lib/query-client';
import type { Player } from '@/types/form';

interface PlayerSearchResponse {
  success: boolean;
  players: Array<{
    name: string;
    team: string;
    display: string;
  }>;
  count: number;
}

async function searchPlayers(
  query: string,
  league?: string,
  signal?: AbortSignal
): Promise<Player[]> {
  if (query.length < 2) {
    return [];
  }

  const params = new URLSearchParams();
  params.set('q', query);
  if (league) {
    params.set('sport', league);
  }

  const response = await fetch(`/api/players?${params.toString()}`, { signal });

  if (!response.ok) {
    throw new Error(`Failed to search players: ${response.statusText}`);
  }

  const data: PlayerSearchResponse = await response.json();

  // Transform to Player format
  return data.players.map(p => ({
    id: p.name, // Using name as ID since we don't have unique player IDs yet
    name: p.name,
    team: p.team,
    league: league as any || 'NBA',
  }));
}

export function usePlayerSearch(initialQuery: string = '', league?: string) {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce search query (200ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // React Query for fetching with abort control
  const queryResult = useQuery({
    queryKey: queryKeys.players(debouncedQuery, league),
    queryFn: async ({ signal }) => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      const startTime = performance.now();
      try {
        const result = await searchPlayers(
          debouncedQuery,
          league,
          abortControllerRef.current.signal
        );
        const duration = performance.now() - startTime;

        // Log performance for monitoring (p95 target: <120ms)
        if (duration > 120) {
          console.warn(`[PlayerSearch] Slow query: ${duration.toFixed(2)}ms for "${debouncedQuery}"`);
        }

        return result;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          console.log('[PlayerSearch] Request aborted (stale)');
          return [];
        }
        throw error;
      }
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...queryResult,
    query,
    setQuery,
    debouncedQuery,
  };
}
