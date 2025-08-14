import { getAdminClient } from './db';

/**
 * Canonical health tiles interface
 * This is the source of truth for all health monitoring data
 */
export interface CanonicalHealthTiles {
  feedFreshnessSeconds: number;
  temporalBacklogAgeSeconds: number;
  canaryLastSeenAt: string | null;
  failureBurnRateLevel: 'green' | 'yellow' | 'red' | 'unknown';
  providerCreditsPerMin: number | null;
  providerPctDailyBudget: number | null;
  dlqCount: number;
  source: 'live' | 'fallback';
  timestamp: string;
}

/**
 * Legacy health tiles interface for backward compatibility
 * TODO: Remove after 2025-09-30 cutover
 */
export interface LegacyHealthTiles {
  freshnessSeconds: number;
  backlogSeconds: number;
  canaryAgeSeconds: number | null;
  burnRate: number;
  spendPerMin: number | null;
  budgetPct: number | null;
  dlqCount: number;
  source: 'live' | 'fallback';
  timestamp: string;
}

// Calculate feed freshness in seconds - returns -1 if source missing
async function getFeedFreshness(supabase: any): Promise<number> {
  try {
    // Check latest ingestion timestamp from agent_health
    const { data, error } = await supabase
      .from('agent_health')
      .select('created_at')
      .eq('agent', 'FeedAgent')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      // Fallback: check raw_props for latest ingestion
      const { data: propsData, error: propsError } = await supabase
        .from('raw_props')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (propsError || !propsData || propsData.length === 0) {
        return -1; // Indicates missing source
      }

      const lastIngest = new Date(propsData[0].created_at);
      return Math.floor((Date.now() - lastIngest.getTime()) / 1000);
    }

    const lastHeartbeat = new Date(data[0].created_at);
    return Math.floor((Date.now() - lastHeartbeat.getTime()) / 1000);
  } catch (error) {
    console.error('Error calculating feed freshness:', error);
    return -1; // Indicates error state
  }
}

// Calculate Temporal backlog age
async function getTemporalBacklogAge(supabase: any): Promise<number> {
  try {
    // Connect to Temporal via SDK or estimate based on grading queue
    const { data, error } = await supabase
      .from('unified_picks')
      .select('created_at')
      .is('graded_at', null)
      .order('created_at', { ascending: true })
      .limit(1);

    if (error || !data || data.length === 0) {
      return 0; // No backlog
    }

    const oldestUngraded = new Date(data[0].created_at);
    return Math.floor((Date.now() - oldestUngraded.getTime()) / 1000);
  } catch (error) {
    console.error('Error calculating Temporal backlog age:', error);
    return -1; // Error state for fallback handling
  }
}

// Get canary heartbeat status
async function getCanaryStatus(supabase: any): Promise<string | null> {
  try {
    // Check for canary heartbeat in agent_health
    const { data, error } = await supabase
      .from('agent_health')
      .select('created_at')
      .eq('agent', 'CanaryAgent')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }

    return data[0].created_at;
  } catch (error) {
    console.error('Error getting canary status:', error);
    return null;
  }
}

// Calculate failure burn rate level - returns 'unknown' if source missing
async function getFailureBurnRateLevel(supabase: any): Promise<'green' | 'yellow' | 'red' | 'unknown'> {
  try {
    // Check recent errors in audit log or agent health
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('app_audit_log')
      .select('id')
      .gte('occurred_at', oneHourAgo)
      .ilike('action', '%error%');

    if (error) {
      console.error('Error calculating failure burn rate:', error);
      return 'unknown';
    }

    const errorCount = data?.length || 0;

    // Thresholds for burn rate levels
    if (errorCount > 50) return 'red';
    if (errorCount > 10) return 'yellow';
    return 'green';
  } catch (error) {
    console.error('Error calculating failure burn rate:', error);
    return 'unknown';
  }
}

// Get provider usage stats
async function getProviderUsage(supabase: any): Promise<{ creditsPerMin: number | null; percentOfBudget: number | null }> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('provider_usage')
      .select('credits_used, window_minutes')
      .gte('timestamp', oneHourAgo);

    if (error || !data) {
      return { creditsPerMin: null, percentOfBudget: null };
    }

    // Calculate credits per minute from recent usage
    const totalCredits = data.reduce((sum, row) => sum + (row.credits_used || 0), 0);
    const totalMinutes = data.reduce((sum, row) => sum + (row.window_minutes || 5), 0);
    const creditsPerMin = totalMinutes > 0 ? totalCredits / totalMinutes : 0;

    // Estimate daily budget usage (assuming 1000 credits/day budget)
    const dailyBudget = 1000;
    const percentOfBudget = (creditsPerMin * 24 * 60) / dailyBudget * 100;

    return {
      creditsPerMin: Math.round(creditsPerMin * 100) / 100,
      percentOfBudget: Math.round(percentOfBudget * 100) / 100,
    };
  } catch (error) {
    console.error('Error calculating provider usage:', error);
    return { creditsPerMin: null, percentOfBudget: null };
  }
}

// Get DLQ count
async function getDLQCount(supabase: any): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('notifications_outbox')
      .select('id', { count: 'exact' })
      .eq('status', 'failed');

    if (error) {
      console.error('Error getting DLQ count:', error);
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    console.error('Error getting DLQ count:', error);
    return 0;
  }
}

/**
 * Get canonical health tiles data
 * This is the single source of truth for all health monitoring
 * Returns safe fallbacks when live data is unavailable
 */
export async function getCanonicalHealthTiles(): Promise<CanonicalHealthTiles> {
  try {
    const supabase = getAdminClient();

    // Fetch all health metrics in parallel
    const [
      feedFreshnessSeconds,
      temporalBacklogAgeSeconds,
      canaryLastSeenAt,
      failureBurnRateLevel,
      providerUsage,
      dlqCount,
    ] = await Promise.all([
      getFeedFreshness(supabase),
      getTemporalBacklogAge(supabase),
      getCanaryStatus(supabase),
      getFailureBurnRateLevel(supabase),
      getProviderUsage(supabase),
      getDLQCount(supabase),
    ]);

    // Determine if any fallbacks were used
    const hasFallbacks = feedFreshnessSeconds === -1 || 
                        temporalBacklogAgeSeconds === -1 ||
                        failureBurnRateLevel === 'unknown';

    return {
      feedFreshnessSeconds: feedFreshnessSeconds === -1 ? 3600 : feedFreshnessSeconds, // 1 hour fallback
      temporalBacklogAgeSeconds: temporalBacklogAgeSeconds === -1 ? 300 : temporalBacklogAgeSeconds, // 5 min fallback
      canaryLastSeenAt,
      failureBurnRateLevel,
      providerCreditsPerMin: providerUsage.creditsPerMin,
      providerPctDailyBudget: providerUsage.percentOfBudget,
      dlqCount,
      source: hasFallbacks ? 'fallback' : 'live',
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    console.error('Error getting canonical health tiles:', error);
    
    // Return safe fallbacks on complete failure
    return {
      feedFreshnessSeconds: 3600, // 1 hour
      temporalBacklogAgeSeconds: 300, // 5 minutes  
      canaryLastSeenAt: null,
      failureBurnRateLevel: 'unknown',
      providerCreditsPerMin: null,
      providerPctDailyBudget: null,
      dlqCount: 0,
      source: 'fallback',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Convert canonical health tiles to legacy format
 * TODO: Remove after 2025-09-30 cutover
 */
export function convertToLegacyFormat(canonical: CanonicalHealthTiles): LegacyHealthTiles {
  // Convert canaryLastSeenAt to age in seconds
  let canaryAgeSeconds: number | null = null;
  if (canonical.canaryLastSeenAt) {
    const canaryTime = new Date(canonical.canaryLastSeenAt);
    canaryAgeSeconds = Math.floor((Date.now() - canaryTime.getTime()) / 1000);
  }

  // Convert failure burn rate level to numeric burn rate
  let burnRate: number;
  switch (canonical.failureBurnRateLevel) {
    case 'green':
      burnRate = 0.1; // ≤0.2 threshold
      break;
    case 'yellow': 
      burnRate = 0.35; // ≤0.5 threshold
      break;
    case 'red':
      burnRate = 0.8; // >0.5 threshold
      break;
    case 'unknown':
    default:
      burnRate = -1; // Unknown state
      break;
  }

  return {
    freshnessSeconds: canonical.feedFreshnessSeconds,
    backlogSeconds: canonical.temporalBacklogAgeSeconds,
    canaryAgeSeconds,
    burnRate,
    spendPerMin: canonical.providerCreditsPerMin,
    budgetPct: canonical.providerPctDailyBudget,
    dlqCount: canonical.dlqCount,
    source: canonical.source,
    timestamp: canonical.timestamp,
  };
}

/**
 * Convert legacy burn rate number to canonical level
 * Used for threshold mapping: ≤0.2:green, ≤0.5:yellow, else:red
 */
export function convertBurnRateToLevel(burnRate: number): 'green' | 'yellow' | 'red' | 'unknown' {
  if (burnRate < 0) return 'unknown';
  if (burnRate <= 0.2) return 'green';
  if (burnRate <= 0.5) return 'yellow';
  return 'red';
}