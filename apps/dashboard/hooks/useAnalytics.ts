'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardCache } from '../lib/cache';

interface AnalyticsData {
  performance: {
    totalPicks: number;
    winRate: number;
    roi: number;
    profit: number;
    units: number;
  };
  recentPicks: Array<{
    id: string;
    capper: string;
    sport: string;
    pick_type: string;
    status: string;
    created_at: string;
    odds: number;
    result?: string;
  }>;
  capperLeaderboard: Array<{
    capper: string;
    picks: number;
    winRate: number;
    roi: number;
    profit: number;
  }>;
  systemHealth: {
    agents: Array<{
      name: string;
      status: 'healthy' | 'warning' | 'error';
      lastUpdate: string;
      uptime: number;
    }>;
    apiStatus: 'operational' | 'degraded' | 'down';
    dbStatus: 'healthy' | 'slow' | 'error';
  };
}

// Fallback data for development/error states
const fallbackData: AnalyticsData = {
  performance: {
    totalPicks: 0,
    winRate: 0,
    roi: 0,
    profit: 0,
    units: 0,
  },
  recentPicks: [],
  capperLeaderboard: [],
  systemHealth: {
    agents: [
      {
        name: 'GradingAgent',
        status: 'healthy',
        lastUpdate: new Date().toISOString(),
        uptime: 99.9,
      },
      { name: 'AlertAgent', status: 'healthy', lastUpdate: new Date().toISOString(), uptime: 99.8 },
      {
        name: 'SmartFormBridge',
        status: 'healthy',
        lastUpdate: new Date().toISOString(),
        uptime: 98.5,
      },
    ],
    apiStatus: 'operational',
    dbStatus: 'healthy',
  },
};

// Optimized API fetcher function with caching
const fetchAnalytics = async (timeframe: string): Promise<AnalyticsData> => {
  // Check cache first for is_instant response
  const cacheKey = `analytics:${timeframe}`;
  const cached = dashboardCache.get<AnalyticsData>(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetch(`/api/analytics?timeframe=${timeframe}`);

  if (!response.ok) {
    // Return cached data if available, even if expired, during API errors
    const staleCache = dashboardCache.loadFromStorage<AnalyticsData>(cacheKey);
    if (staleCache) {
      console.warn('Using stale cache due to API error');
      return staleCache;
    }
    throw new Error(`Analytics API error: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch analytics');
  }

  // Cache the successful result
  dashboardCache.cacheAnalyticsData(timeframe, result.data);

  return result.data;
};

interface UseAnalyticsResult {
  data: AnalyticsData | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAnalytics(timeframe: '24h' | '7d' | '30d' = '7d'): UseAnalyticsResult {
  const {
    data,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['analytics', timeframe],
    queryFn: () => fetchAnalytics(timeframe),
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute for live updates
    retry: 1,
    refetchOnWindowFocus: true,
    placeholderData: fallbackData, // Show fallback immediately
  });

  return {
    data,
    loading,
    error: error as Error | null,
    refetch,
  };
}

// Health API fetcher
const fetchSystemHealth = async () => {
  const response = await fetch('/api/system/health');

  if (!response.ok) {
    throw new Error(`Health API error: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch system health');
  }

  return result.health;
};

interface UseSystemHealthResult {
  health: any | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useSystemHealth(): UseSystemHealthResult {
  const {
    data: health,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['system-health'],
    queryFn: fetchSystemHealth,
    staleTime: 30 * 1000, // Consider fresh for 30 seconds
    gcTime: 2 * 60 * 1000, // Keep in cache for 2 minutes
    refetchInterval: 60 * 1000, // Refetch every minute (less aggressive than before)
    retry: 2,
    refetchOnWindowFocus: true,
  });

  return {
    health,
    loading,
    error: error as Error | null,
    refetch,
  };
}

// Users API fetcher
const fetchUsers = async (action: string, limit: number, offset: number) => {
  const params = new URLSearchParams({
    action,
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`/api/users?${params}`);

  if (!response.ok) {
    throw new Error(`Users API error: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch users');
  }

  return result;
};

interface UseUsersResult {
  users: any[] | undefined;
  stats: any | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useUsers(
  action: 'list' | 'stats' = 'list',
  limit = 50,
  offset = 0
): UseUsersResult {
  const {
    data,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['users', action, limit, offset],
    queryFn: () => fetchUsers(action, limit, offset),
    staleTime: 3 * 60 * 1000, // User data is less dynamic, fresh for 3 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchInterval: action === 'stats' ? 2 * 60 * 1000 : false, // Only auto-refetch stats every 2 minutes
    retry: 1,
    refetchOnWindowFocus: false, // Don't refetch user lists on focus
  });

  return {
    users: data?.users,
    stats: data?.stats,
    loading,
    error: error as Error | null,
    refetch,
  };
}
