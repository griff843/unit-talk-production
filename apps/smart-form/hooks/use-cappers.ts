/**
 * useCappers Hook
 *
 * React Query hook for fetching cappers with optimized caching and keyboard search.
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import type { Capper } from '@/types/form';

interface CappersResponse {
  cappers: Capper[];
  meta: {
    total: number;
    filters: {
      active?: boolean;
      sport?: string | null;
    };
    source: string;
    timestamp: string;
  };
}

async function fetchCappers(active: boolean = true): Promise<Capper[]> {
  const params = new URLSearchParams();
  params.set('active', String(active));

  const response = await fetch(`/api/cappers?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch cappers: ${response.statusText}`);
  }

  const data: CappersResponse = await response.json();
  return data.cappers;
}

export function useCappers(active: boolean = true) {
  return useQuery({
    queryKey: queryKeys.cappers(active),
    queryFn: () => fetchCappers(active),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes cache
  });
}
