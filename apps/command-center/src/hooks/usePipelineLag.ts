/**
 * @fileoverview Pipeline Lag Hook
 * Fetches and manages pipeline lag metrics with auto-refresh
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LagRow } from '@/app/api/pipeline/lag/route';

export type PipelineLagPoint = {
  t: string; // minute_bucket ISO timestamp
  sport: string;
  p50s: number; // p50 lag in seconds
  p95s: number; // p95 lag in seconds
  ct: number; // promoted count
};

export type PipelineLagData = {
  data: Record<string, PipelineLagPoint[]>; // grouped by sport
  isLoading: boolean;
  error?: string;
  lastUpdated?: string;
  refetch: () => Promise<void>;
};

/**
 * Hook to fetch and manage pipeline lag metrics
 * Auto-refreshes every 30 seconds with abort controller for cleanup
 */
export function usePipelineLag(sport: string = 'all'): PipelineLagData {
  const [data, setData] = useState<Record<string, PipelineLagPoint[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [lastUpdated, setLastUpdated] = useState<string | undefined>();

  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Abort previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      setError(undefined);

      const url = new URL('/api/pipeline/lag', window.location.origin);
      url.searchParams.set('limit', '600');
      if (sport && sport !== 'all') {
        url.searchParams.set('sport', sport);
      }

      console.log('🔍 Fetching pipeline lag metrics...', { sport, url: url.pathname + url.search });

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`API Error: ${errorData.error || response.statusText}`);
      }

      const lagRows: LagRow[] = await response.json();

      console.log(`✅ Successfully fetched ${lagRows.length} pipeline lag data points`);

      // Group data by sport and sort by time ascending (oldest first for time-series)
      const groupedData: Record<string, PipelineLagPoint[]> = {};

      lagRows
        .sort((a, b) => new Date(a.minute_bucket).getTime() - new Date(b.minute_bucket).getTime())
        .forEach(row => {
          const sportKey = row.sport || 'unknown';
          if (!groupedData[sportKey]) {
            groupedData[sportKey] = [];
          }

          groupedData[sportKey].push({
            t: row.minute_bucket,
            sport: sportKey,
            p50s: row.promotion_lag_p50_seconds,
            p95s: row.promotion_lag_p95_seconds,
            ct: row.promoted_ct,
          });
        });

      // Create combined "all sports" dataset if multiple sports exist
      const sportKeys = Object.keys(groupedData);
      if (sportKeys.length > 1) {
        const allSportsData: PipelineLagPoint[] = [];
        const timeMap = new Map<string, { p50s: number[]; p95s: number[]; ct: number }>();

        // Aggregate data by time bucket
        Object.values(groupedData)
          .flat()
          .forEach(point => {
            if (!timeMap.has(point.t)) {
              timeMap.set(point.t, { p50s: [], p95s: [], ct: 0 });
            }
            const entry = timeMap.get(point.t)!;
            entry.p50s.push(point.p50s);
            entry.p95s.push(point.p95s);
            entry.ct += point.ct;
          });

        // Calculate aggregated metrics
        timeMap.forEach((entry, timestamp) => {
          const avgP50 = entry.p50s.reduce((sum, val) => sum + val, 0) / entry.p50s.length;
          const avgP95 = entry.p95s.reduce((sum, val) => sum + val, 0) / entry.p95s.length;

          allSportsData.push({
            t: timestamp,
            sport: 'all',
            p50s: avgP50,
            p95s: avgP95,
            ct: entry.ct,
          });
        });

        groupedData['all'] = allSportsData.sort(
          (a, b) => new Date(a.t).getTime() - new Date(b.t).getTime()
        );
      }

      setData(groupedData);
      setLastUpdated(new Date().toISOString());
      setIsLoading(false);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Pipeline lag fetch aborted');
        return; // Don't set error state for aborted requests
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch pipeline lag data';
      console.error('❌ Pipeline lag fetch failed:', errorMessage);
      setError(errorMessage);
      setIsLoading(false);
    }
  }, [sport]);

  // Effect for initial load and sport changes
  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  // Effect for auto-refresh every 30 seconds
  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up new interval for auto-refresh
    intervalRef.current = setInterval(() => {
      fetchData();
    }, 30000); // 30 seconds

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    lastUpdated,
    refetch,
  };
}
