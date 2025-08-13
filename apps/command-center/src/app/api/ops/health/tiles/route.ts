import { NextRequest, NextResponse } from 'next/server';
import { getSystemFlags } from '@/server/systemConfig';
import { requirePermission, auditApiAction, createUnauthorizedResponse } from '@/app/api/_lib/rbac';

interface HealthTiles {
  feedFreshnessSeconds: number;
  temporalBacklogAgeSeconds: number;
  canaryLastSeenAt: string | null;
  failureBurnRateLevel: 'green' | 'yellow' | 'red';
  providerCreditsPerMin: number;
  percentOfDailyBudget: number;
  dlqCount: number;
}

// Helper function to create Supabase client for server operations
function createServerClient() {
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration for server operations');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Calculate feed freshness in seconds
async function getFeedFreshness(supabase: any): Promise<number> {
  try {
    // Check latest ingestion timestamp - this could be from agent_health or similar table
    const { data, error } = await supabase
      .from('agent_health')
      .select('last_heartbeat')
      .eq('agent_name', 'feed_agent')
      .order('last_heartbeat', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      // Fallback: check raw_props for latest ingestion
      const { data: propsData, error: propsError } = await supabase
        .from('raw_props')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (propsError || !propsData || propsData.length === 0) {
        return 3600; // Default to 1 hour if no data
      }

      const lastIngest = new Date(propsData[0].created_at);
      return Math.floor((Date.now() - lastIngest.getTime()) / 1000);
    }

    const lastHeartbeat = new Date(data[0].last_heartbeat);
    return Math.floor((Date.now() - lastHeartbeat.getTime()) / 1000);
  } catch (error) {
    console.error('Error calculating feed freshness:', error);
    return 3600; // Default to 1 hour on error
  }
}

// Calculate Temporal backlog age
async function getTemporalBacklogAge(supabase: any): Promise<number> {
  try {
    // This would ideally connect to Temporal via SDK
    // For now, we'll estimate based on grading queue
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
    return 300; // Default to 5 minutes on error
  }
}

// Get canary heartbeat status
async function getCanaryStatus(supabase: any): Promise<string | null> {
  try {
    // Check for canary heartbeat - could be in agent_health or dedicated table
    const { data, error } = await supabase
      .from('agent_health')
      .select('last_heartbeat')
      .eq('agent_name', 'canary')
      .order('last_heartbeat', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }

    return data[0].last_heartbeat;
  } catch (error) {
    console.error('Error getting canary status:', error);
    return null;
  }
}

// Calculate failure burn rate level
async function getFailureBurnRateLevel(supabase: any): Promise<'green' | 'yellow' | 'red'> {
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
      return 'yellow';
    }

    const errorCount = data?.length || 0;

    if (errorCount > 50) return 'red';
    if (errorCount > 10) return 'yellow';
    return 'green';
  } catch (error) {
    console.error('Error calculating failure burn rate:', error);
    return 'yellow';
  }
}

// Get provider usage stats
async function getProviderUsage(supabase: any): Promise<{ creditsPerMin: number; percentOfBudget: number }> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('provider_usage')
      .select('credits_used, window_minutes')
      .gte('ts', oneHourAgo);

    if (error || !data) {
      return { creditsPerMin: 0, percentOfBudget: 0 };
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
    return { creditsPerMin: 0, percentOfBudget: 0 };
  }
}

// Get DLQ count
async function getDLQCount(supabase: any): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('notifications_outbox')
      .select('id', { count: 'exact' })
      .eq('status', 'retrying');

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

// GET /api/ops/health/tiles - Get all health tiles data
export async function GET(request: NextRequest) {
  try {
    // Check user permissions
    const { success, user, error } = await requirePermission(request, 'read');
    
    if (!success || !user) {
      return createUnauthorizedResponse(error || 'Authentication required', 401);
    }

    // Create server client for data operations
    const supabase = createServerClient();

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

    const healthTiles: HealthTiles = {
      feedFreshnessSeconds,
      temporalBacklogAgeSeconds,
      canaryLastSeenAt,
      failureBurnRateLevel,
      providerCreditsPerMin: providerUsage.creditsPerMin,
      percentOfDailyBudget: providerUsage.percentOfBudget,
      dlqCount,
    };

    // Log audit event for health data access
    await auditApiAction(user, 'health_tiles_read', 'system_health', {
      tiles_accessed: Object.keys(healthTiles),
    }, request);

    return NextResponse.json(healthTiles);

  } catch (error) {
    console.error('Health tiles GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}