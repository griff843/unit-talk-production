import { useState, useEffect, useCallback, useRef } from 'react';

interface RecentPromotion {
  unified_pick_id: string;
  promoted_at: string;
  pick_source: string;
  prop_id: string;
  sport: string;
  pick_type: string;
  selection: string;
  line: number;
  odds: number;
  tier_when_placed: string;
  promotion_status: string;
  game_start_time: string;
  processed_at: string;
}

interface UseRecentPromotionsParams {
  limit?: number;
}

interface UseRecentPromotionsReturn {
  data: RecentPromotion[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const POLLING_INTERVAL = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

export function useRecentPromotions({
  limit = 500
}: UseRecentPromotionsParams = {}): UseRecentPromotionsReturn {
  const [data, setData] = useState<RecentPromotion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  const fetchData = useCallback(async (isRetry = false): Promise<void> => {
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
      params.append('limit', limit.toString());

      const response = await fetch(`/api/pipeline/recent-promotions?${params.toString()}`, {
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
          console.warn(`Recent promotions fetch failed, retrying (${retryCountRef.current}/${MAX_RETRIES}):`, err.message);
          
          setTimeout(() => {
            fetchData(true);
          }, RETRY_DELAY * retryCountRef.current);
          return;
        }

        setError(err.message);
      } else {
        setError('Failed to fetch recent promotions data');
      }
    } finally {
      if (!isRetry) {
        setLoading(false);
      }
    }
  }, [limit]);

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