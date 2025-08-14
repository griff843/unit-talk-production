import { useQuery } from '@tanstack/react-query'
import { CanonicalHealthTiles } from '@/server/health'

/**
 * React Query hook for fetching canonical health tiles data
 * Polls /api/ops/health/tiles every 10 seconds for real-time updates
 */
export function useHealthTiles() {
  return useQuery<CanonicalHealthTiles>({
    queryKey: ['health', 'tiles'],
    queryFn: async () => {
      const response = await fetch('/api/ops/health/tiles', {
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch health tiles: ${response.status}`)
      }
      
      return response.json()
    },
    refetchInterval: 10000, // Poll every 10 seconds
    refetchIntervalInBackground: true,
    staleTime: 5000, // Consider data stale after 5 seconds
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Keep previous data while fetching new data (replaced in v5 with placeholderData)
    placeholderData: (previousData) => previousData,
    // Don't refetch on window focus by default to reduce noise
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook to get individual health tile status based on thresholds
 */
export function useHealthTileStatus(tiles: CanonicalHealthTiles | undefined) {
  if (!tiles) {
    return {
      feedStatus: 'unknown' as const,
      backlogStatus: 'unknown' as const,
      canaryStatus: 'unknown' as const,
      burnRateStatus: tiles?.failureBurnRateLevel || 'unknown' as const,
      providerStatus: 'unknown' as const,
      dlqStatus: 'unknown' as const,
    }
  }

  // Define thresholds for status determination
  const feedStatus = tiles.feedFreshnessSeconds < 300 ? 'healthy' : 
                    tiles.feedFreshnessSeconds < 1800 ? 'warning' : 'critical'
  
  const backlogStatus = tiles.temporalBacklogAgeSeconds < 300 ? 'healthy' :
                       tiles.temporalBacklogAgeSeconds < 1800 ? 'warning' : 'critical'
  
  const canaryStatus = tiles.canaryLastSeenAt 
    ? (() => {
        const canaryAge = Math.floor((Date.now() - new Date(tiles.canaryLastSeenAt).getTime()) / 1000)
        return canaryAge < 300 ? 'healthy' : canaryAge < 900 ? 'warning' : 'critical'
      })()
    : 'unknown'
  
  const providerStatus = tiles.providerPctDailyBudget 
    ? tiles.providerPctDailyBudget < 50 ? 'healthy' :
      tiles.providerPctDailyBudget < 80 ? 'warning' : 'critical'
    : 'unknown'
  
  const dlqStatus = tiles.dlqCount === 0 ? 'healthy' :
                   tiles.dlqCount < 10 ? 'warning' : 'critical'

  return {
    feedStatus,
    backlogStatus,
    canaryStatus,
    burnRateStatus: tiles.failureBurnRateLevel,
    providerStatus,
    dlqStatus,
  }
}

/**
 * Hook to get formatted health tile values for display
 */
export function useFormattedHealthTiles(tiles: CanonicalHealthTiles | undefined) {
  if (!tiles) {
    return {
      feedFreshness: '...',
      backlogAge: '...',
      canaryAge: '...',
      burnRate: '...',
      creditsPerMin: '...',
      budgetPercent: '...',
      dlqCount: '...',
    }
  }

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
    return `${Math.floor(seconds / 86400)}d`
  }

  const canaryAge = tiles.canaryLastSeenAt 
    ? formatDuration(Math.floor((Date.now() - new Date(tiles.canaryLastSeenAt).getTime()) / 1000))
    : 'unknown'

  return {
    feedFreshness: formatDuration(tiles.feedFreshnessSeconds),
    backlogAge: formatDuration(tiles.temporalBacklogAgeSeconds),
    canaryAge,
    burnRate: tiles.failureBurnRateLevel.toUpperCase(),
    creditsPerMin: tiles.providerCreditsPerMin?.toFixed(2) || 'N/A',
    budgetPercent: tiles.providerPctDailyBudget?.toFixed(1) + '%' || 'N/A',
    dlqCount: tiles.dlqCount.toString(),
  }
}

/**
 * Get status color classes for health tiles
 */
export function getHealthStatusColor(status: 'healthy' | 'warning' | 'critical' | 'unknown' | 'green' | 'yellow' | 'red') {
  switch (status) {
    case 'healthy':
    case 'green':
      return 'bg-green-500 text-green-50'
    case 'warning':  
    case 'yellow':
      return 'bg-yellow-500 text-yellow-50'
    case 'critical':
    case 'red':
      return 'bg-red-500 text-red-50'
    case 'unknown':
    default:
      return 'bg-gray-500 text-gray-50'
  }
}

/**
 * Get tooltip explanations for health tile thresholds
 */
export function getHealthTooltips() {
  return {
    feedFreshness: 'Feed freshness: <5min (healthy), <30min (warning), ≥30min (critical)',
    backlogAge: 'Temporal backlog: <5min (healthy), <30min (warning), ≥30min (critical)', 
    canary: 'Canary heartbeat: <5min (healthy), <15min (warning), ≥15min (critical)',
    burnRate: 'Failure burn rate: green (≤0.2), yellow (≤0.5), red (>0.5)',
    provider: 'Daily budget usage: <50% (healthy), <80% (warning), ≥80% (critical)',
    dlq: 'Dead letter queue: 0 (healthy), <10 (warning), ≥10 (critical)',
    source: 'Data source: live (real-time data), fallback (safe defaults when live unavailable)',
  }
}