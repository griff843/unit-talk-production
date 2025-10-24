import { useState, useEffect, useCallback, useRef } from 'react';

interface UnifiedPicksHealth {
  total_picks_24h: number;
  system_picks_24h: number;
  manual_picks_24h: number;
  writer_audit_percentage: number;
  duplicate_fingerprints: number;
  missing_prop_ids: number;
  last_updated: string;
  status: 'healthy' | 'warning' | 'critical';
  metadata: {
    source: string;
    timeframe: string;
  };
}

interface UseUnifiedPicksHealthReturn {
  data: UnifiedPicksHealth | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const POLLING_INTERVAL = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

export function useUnifiedPicksHealth(): UseUnifiedPicksHealthReturn {
  const [data, setData] = useState<UnifiedPicksHealth | null>(null);
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

      const response = await fetch('/api/pipeline/health', {
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
            `Unified picks health fetch failed, retrying (${retryCountRef.current}/${MAX_RETRIES}):`,
            err.message
          );

          setTimeout(() => {
            fetchData(true);
          }, RETRY_DELAY * retryCountRef.current);
          return;
        }

        setError(err.message);
      } else {
        setError('Failed to fetch unified picks health data');
      }
    } finally {
      if (!isRetry) {
        setLoading(false);
      }
    }
  }, []);

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
