/**
 * Performance-Optimized Caching System for Dashboard
 *
 * Features:
 * - React Query integration for server state
 * - Local storage for user preferences
 * - Session storage for temporary data
 * - Intelligent cache invalidation
 * - Performance metrics tracking
 * - Dashboard-specific optimizations
 */

interface DashboardCacheItem<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  chartType?: string;
  userId?: string;
}

interface DashboardCacheOptions {
  ttl?: number;
  persist?: boolean; // Whether to persist to localStorage
  userId?: string;
  chartType?: string;
}

class DashboardCache {
  private cache = new Map<string, DashboardCacheItem>();
  private readonly DEFAULT_TTL = 120000; // 2 minutes for dashboard data
  private readonly CHART_TTL = 60000; // 1 minute for chart data
  private readonly USER_PREF_TTL = 86400000; // 24 hours for user preferences
  private readonly ANALYTICS_TTL = 30000; // 30 seconds for analytics

  // Core cache operations
  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // Check TTL
    if (Date.now() > item.timestamp + item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  set<T>(key: string, data: T, options: DashboardCacheOptions = {}): void {
    const ttl = options.ttl || this.DEFAULT_TTL;

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      chartType: options.chartType,
      userId: options.userId,
    });

    // Persist to localStorage if requested
    if (options.persist) {
      this.persistToStorage(key, data, ttl);
    }
  }

  // Dashboard-specific cache methods
  cacheChartData(chartId: string, data: any, chartType: string): void {
    this.set(`chart:${chartId}`, data, {
      ttl: this.CHART_TTL,
      chartType,
      persist: false,
    });
  }

  cacheAnalyticsData(analyticsKey: string, data: any): void {
    this.set(`analytics:${analyticsKey}`, data, {
      ttl: this.ANALYTICS_TTL,
      persist: false,
    });
  }

  cacheUserDashboardLayout(userId: string, layout: any): void {
    this.set(`layout:${userId}`, layout, {
      ttl: this.USER_PREF_TTL,
      userId,
      persist: true,
    });
  }

  cacheWidgetConfig(userId: string, widgetId: string, config: any): void {
    this.set(`widget:${userId}:${widgetId}`, config, {
      ttl: this.USER_PREF_TTL,
      userId,
      persist: true,
    });
  }

  // Performance metrics cache
  cacheMetrics(timeframe: string, metrics: any): void {
    this.set(`metrics:${timeframe}`, metrics, {
      ttl: this.ANALYTICS_TTL,
    });
  }

  // Local storage persistence
  private persistToStorage(key: string, data: any, ttl: number): void {
    if (typeof window === 'undefined') return;

    try {
      const item = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(`dashboard:${key}`, JSON.stringify(item));
    } catch (error) {
      console.warn('Failed to persist to localStorage:', error);
    }
  }

  // Load from local storage
  loadFromStorage<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem(`dashboard:${key}`);
      if (!stored) return null;

      const item = JSON.parse(stored);

      // Check TTL
      if (Date.now() > item.timestamp + item.ttl) {
        localStorage.removeItem(`dashboard:${key}`);
        return null;
      }

      return item.data;
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
      return null;
    }
  }

  // Session storage for temporary dashboard state
  setSessionState(key: string, data: any): void {
    if (typeof window === 'undefined') return;

    try {
      sessionStorage.setItem(
        `dashboard:session:${key}`,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.warn('Failed to set session state:', error);
    }
  }

  getSessionState<T>(key: string, maxAge: number = 1800000): T | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = sessionStorage.getItem(`dashboard:session:${key}`);
      if (!stored) return null;

      const item = JSON.parse(stored);

      // Check age (default 30 minutes)
      if (Date.now() - item.timestamp > maxAge) {
        sessionStorage.removeItem(`dashboard:session:${key}`);
        return null;
      }

      return item.data;
    } catch (error) {
      console.warn('Failed to get session state:', error);
      return null;
    }
  }

  // Chart-specific optimizations
  getCachedChartData(chartId: string): any | null {
    return this.get(`chart:${chartId}`);
  }

  invalidateChartCache(chartType?: string): void {
    if (chartType) {
      // Invalidate specific chart type
      for (const [key, item] of Array.from(this.cache.entries())) {
        if (key.startsWith('chart:') && item.chartType === chartType) {
          this.cache.delete(key);
        }
      }
    } else {
      // Invalidate all chart cache
      for (const key of Array.from(this.cache.keys())) {
        if (key.startsWith('chart:')) {
          this.cache.delete(key);
        }
      }
    }
  }

  // User-specific cache management
  invalidateUserCache(userId: string): void {
    for (const [key, item] of Array.from(this.cache.entries())) {
      if (item.userId === userId) {
        this.cache.delete(key);
      }
    }

    // Also clear localStorage for this user
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes(userId)) {
          localStorage.removeItem(key);
        }
      });
    }
  }

  // Cache warming for dashboard initialization
  async warmDashboardCache(userId: string): Promise<void> {
    console.log('🔥 Warming dashboard cache for user:', userId);

    try {
      // Try to load persisted user preferences
      const layout = this.loadFromStorage(`layout:${userId}`);
      if (layout) {
        this.set(`layout:${userId}`, layout, { persist: false });
      }

      // Pre-warm common analytics data
      const commonMetrics = this.loadFromStorage('metrics:7d');
      if (commonMetrics) {
        this.set('metrics:7d', commonMetrics);
      }

      console.log('✅ Dashboard cache warmed');
    } catch (error) {
      console.warn('Dashboard cache warming failed:', error);
    }
  }

  // Cleanup expired items
  cleanup(): void {
    const now = Date.now();

    // Cleanup memory cache
    for (const [key, item] of Array.from(this.cache.entries())) {
      if (now > item.timestamp + item.ttl) {
        this.cache.delete(key);
      }
    }

    // Cleanup localStorage
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('dashboard:')) {
          try {
            const item = JSON.parse(localStorage.getItem(key) || '{}');
            if (now > item.timestamp + item.ttl) {
              localStorage.removeItem(key);
            }
          } catch (error) {
            localStorage.removeItem(key); // Remove corrupted items
          }
        }
      });

      // Cleanup sessionStorage
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach(key => {
        if (key.startsWith('dashboard:session:')) {
          try {
            const item = JSON.parse(sessionStorage.getItem(key) || '{}');
            if (now - item.timestamp > 1800000) {
              // 30 minutes
              sessionStorage.removeItem(key);
            }
          } catch (error) {
            sessionStorage.removeItem(key);
          }
        }
      });
    }
  }

  // Performance monitoring
  getStats() {
    return {
      cacheSize: this.cache.size,
      memoryUsage: this.cache.size * 64, // Rough estimate in bytes
      charts: Array.from(this.cache.keys()).filter(k => k.startsWith('chart:')).length,
      analytics: Array.from(this.cache.keys()).filter(k => k.startsWith('analytics:')).length,
      userPrefs: Array.from(this.cache.keys()).filter(
        k => k.startsWith('layout:') || k.startsWith('widget:')
      ).length,
    };
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();

    if (typeof window !== 'undefined') {
      // Clear localStorage
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('dashboard:')) {
          localStorage.removeItem(key);
        }
      });

      // Clear sessionStorage
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach(key => {
        if (key.startsWith('dashboard:session:')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  }
}

// Global dashboard cache instance
export const dashboardCache = new DashboardCache();

// React hooks for dashboard cache integration
import { useCallback, useEffect, useState } from 'react';

export function useDashboardCache() {
  return {
    get: dashboardCache.get.bind(dashboardCache),
    set: dashboardCache.set.bind(dashboardCache),
    cacheChartData: dashboardCache.cacheChartData.bind(dashboardCache),
    cacheAnalyticsData: dashboardCache.cacheAnalyticsData.bind(dashboardCache),
    invalidateChartCache: dashboardCache.invalidateChartCache.bind(dashboardCache),
  };
}

export function useCachedChartData<T>(
  chartId: string,
  chartType: string,
  dataFetcher: () => Promise<T>
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Try cache first
      const cached = dashboardCache.getCachedChartData(chartId);
      if (cached) {
        setData(cached);
        setLoading(false);
        return;
      }

      // Fetch fresh data
      const freshData = await dataFetcher();
      dashboardCache.cacheChartData(chartId, freshData, chartType);
      setData(freshData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [chartId, chartType, dataFetcher]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useUserDashboardLayout(userId: string) {
  const [layout, setLayoutState] = useState<any>(null);

  useEffect(() => {
    // Load layout from cache or storage
    const cached =
      dashboardCache.get(`layout:${userId}`) || dashboardCache.loadFromStorage(`layout:${userId}`);
    if (cached) {
      setLayoutState(cached);
    }
  }, [userId]);

  const setLayout = useCallback(
    (newLayout: any) => {
      dashboardCache.cacheUserDashboardLayout(userId, newLayout);
      setLayoutState(newLayout);
    },
    [userId]
  );

  return [layout, setLayout] as const;
}

export function useSessionDashboardState<T>(key: string, defaultValue: T) {
  const [state, setState] = useState<T>(() => {
    return dashboardCache.getSessionState<T>(key) ?? defaultValue;
  });

  const updateState = useCallback(
    (newState: T) => {
      dashboardCache.setSessionState(key, newState);
      setState(newState);
    },
    [key]
  );

  return [state, updateState] as const;
}

export function useCacheStats() {
  const [stats, setStats] = useState(dashboardCache.getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(dashboardCache.getStats());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return stats;
}

// Initialize dashboard cache
if (typeof window !== 'undefined') {
  // Warm cache on load
  const userId = 'current-user'; // This should come from your auth system
  dashboardCache.warmDashboardCache(userId);

  // Cleanup periodically
  setInterval(() => {
    dashboardCache.cleanup();
  }, 300000); // Every 5 minutes

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    dashboardCache.cleanup();
  });
}

export default dashboardCache;
