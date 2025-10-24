import { useState, useEffect, useCallback, useRef } from 'react';

interface PromoBacklogItem {
  raw_prop_id: string;
  sport: string;
  pick_type: string;
  line: number;
  odds: number;
  tier: string;
  processed_at: string;
}

interface UsePromoBacklogParams {
  sport?: string;
  tier?: string;
  limit?: number;
}

interface UsePromoBacklogReturn {
  data: PromoBacklogItem[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const POLLING_INTERVAL = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

export function usePromoBacklog({
  sport = 'all',
  tier = 'all',
  limit = 500,
}: UsePromoBacklogParams = {}): UsePromoBacklogReturn {
  const [data, setData] = useState<PromoBacklogItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  const fetchData = useCallback(
    async (isRetry = false): Promise<void> => {
      try {
        // Cancel any existing request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController();

        if (!isRetry) {
          setLoading(true);
          setError(null);
          retryCountRef.current = 0;
        }

        // Build query parameters
        const params = new URLSearchParams();
        if (sport && sport !== 'all') {
          params.append('sport', sport);
        }
        if (tier && tier !== 'all') {
          params.append('tier', tier);
        }
        params.append('limit', limit.toString());

        const response = await fetch(`/api/pipeline/promo-backlog?${params.toString()}`, {
          signal: abortControllerRef.current.signal,
          headers: {
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        setData(result);
        setError(null);
        retryCountRef.current = 0;
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            // Request was cancelled, don't update error state
            return;
          }

          // Retry logic
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current += 1;
            console.warn(
              `Promo backlog fetch failed, retrying (${retryCountRef.current}/${MAX_RETRIES}):`,
              err.message
            );

            setTimeout(() => {
              fetchData(true);
            }, RETRY_DELAY * retryCountRef.current);
            return;
          }

          setError(err.message);
        } else {
          setError('Failed to fetch promo backlog data');
        }
      } finally {
        if (!isRetry) {
          setLoading(false);
        }
      }
    },
    [sport, tier, limit]
  );

  const refetch = useCallback(async (): Promise<void> => {
    await fetchData();
  }, [fetchData]);

  // Setup polling
  useEffect(() => {
    // Initial fetch
    fetchData();

    // Setup polling interval
    const startPolling = () => {
      timeoutRef.current = setTimeout(() => {
        fetchData().finally(() => {
          startPolling(); // Continue polling
        });
      }, POLLING_INTERVAL);
    };

    startPolling();

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
  };
}
