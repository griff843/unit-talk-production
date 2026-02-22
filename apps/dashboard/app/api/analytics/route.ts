import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering for this route since it uses request parameters
export const dynamic = 'force-dynamic';

// SPRINT-SUPABASE-ENDPOINT-TRUTH-LOCK-110A: Fail-closed - no hardcoded fallbacks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'SPRINT-110A: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '7d';

    console.log(`[Analytics API] Fetching analytics data for ${timeframe}`);

    // Calculate date range
    const now = new Date();
    const daysBack =
      timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 7;
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Fetch performance data from daily_picks
    const { data: picksData, error: picksError } = await supabase
      .from('daily_picks')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (picksError) {
      console.error('[Analytics API] Error fetching picks:', picksError);
    }

    // Fetch smart form submissions
    const { data: smartTickets, error: smartError } = await supabase
      .from('smart_tickets')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (smartError) {
      console.error('[Analytics API] Error fetching smart tickets:', smartError);
    }

    // Calculate performance metrics
    const allPicks = [...(picksData || []), ...(smartTickets || [])];
    const completedPicks = allPicks.filter(pick => pick.status === 'settled' || pick.result);
    const wonPicks = completedPicks.filter(pick => pick.result === 'win' || pick.status === 'won');

    const performance = {
      totalPicks: allPicks.length,
      winRate: completedPicks.length > 0 ? (wonPicks.length / completedPicks.length) * 100 : 0,
      roi: completedPicks.length > 0 ? calculateROI(completedPicks) : 0,
      profit: calculateProfit(completedPicks),
      units: allPicks.reduce((sum, pick) => sum + (pick.unit_size || pick.units || 1), 0),
    };

    // Recent picks with better formatting
    const recentPicks = allPicks.slice(0, 20).map(pick => ({
      id: pick.id,
      capper: pick.capper || 'Unknown',
      sport: pick.sport || 'Unknown',
      pick_type: pick.pick_type || pick.ticket_type || 'Standard',
      status: pick.status || 'pending',
      created_at: pick.created_at,
      odds: pick.odds || pick.total_odds || 0,
      result: pick.result,
    }));

    // Capper leaderboard
    const capperStats = calculateCapperStats(allPicks);
    const capperLeaderboard = Object.entries(capperStats)
      .map(([capper, stats]: [string, any]) => ({
        capper,
        picks: stats.total,
        winRate: stats.completed > 0 ? (stats.wins / stats.completed) * 100 : 0,
        roi: stats.completed > 0 ? stats.roi : 0,
        profit: stats.profit,
      }))
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 10);

    // System health (mock data for now - integrate with actual monitoring)
    const systemHealth = {
      agents: [
        {
          name: 'GradingAgent',
          status: 'healthy' as const,
          lastUpdate: now.toISOString(),
          uptime: 99.9,
        },
        {
          name: 'AlertAgent',
          status: 'healthy' as const,
          lastUpdate: now.toISOString(),
          uptime: 99.8,
        },
        {
          name: 'RecapAgent',
          status: 'healthy' as const,
          lastUpdate: now.toISOString(),
          uptime: 99.7,
        },
        {
          name: 'FeedAgent',
          status: 'healthy' as const,
          lastUpdate: now.toISOString(),
          uptime: 99.6,
        },
        {
          name: 'SmartFormBridge',
          status: 'healthy' as const,
          lastUpdate: now.toISOString(),
          uptime: 98.5,
        },
      ],
      apiStatus: 'operational' as const,
      dbStatus: 'healthy' as const,
    };

    const analyticsData: AnalyticsData = {
      performance,
      recentPicks,
      capperLeaderboard,
      systemHealth,
    };

    console.log(`[Analytics API] Returning analytics for ${allPicks.length} picks`);

    return NextResponse.json({
      success: true,
      data: analyticsData,
      timeframe,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('[Analytics API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch analytics data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

function calculateROI(picks: any[]): number {
  let totalStake = 0;
  let totalReturn = 0;

  picks.forEach(pick => {
    const stake = pick.unit_size || pick.units || 1;
    totalStake += stake;

    if (pick.result === 'win' || pick.status === 'won') {
      const odds = pick.odds || pick.total_odds || 100;
      const payout = odds > 0 ? stake * (odds / 100) : stake * (100 / Math.abs(odds));
      totalReturn += payout;
    }
  });

  return totalStake > 0 ? ((totalReturn - totalStake) / totalStake) * 100 : 0;
}

function calculateProfit(picks: any[]): number {
  let profit = 0;

  picks.forEach(pick => {
    const stake = pick.unit_size || pick.units || 1;

    if (pick.result === 'win' || pick.status === 'won') {
      const odds = pick.odds || pick.total_odds || 100;
      const payout = odds > 0 ? stake * (odds / 100) : stake * (100 / Math.abs(odds));
      profit += payout;
    } else if (pick.result === 'loss' || pick.status === 'lost') {
      profit -= stake;
    }
  });

  return profit;
}

function calculateCapperStats(picks: any[]): Record<string, any> {
  const stats: Record<string, any> = {};

  picks.forEach(pick => {
    const capper = pick.capper || 'Unknown';
    if (!stats[capper]) {
      stats[capper] = { total: 0, completed: 0, wins: 0, profit: 0, roi: 0 };
    }

    stats[capper].total++;

    if (pick.result || (pick.status && ['won', 'lost', 'settled'].includes(pick.status))) {
      stats[capper].completed++;

      const stake = pick.unit_size || pick.units || 1;

      if (pick.result === 'win' || pick.status === 'won') {
        stats[capper].wins++;
        const odds = pick.odds || pick.total_odds || 100;
        const payout = odds > 0 ? stake * (odds / 100) : stake * (100 / Math.abs(odds));
        stats[capper].profit += payout;
      } else if (pick.result === 'loss' || pick.status === 'lost') {
        stats[capper].profit -= stake;
      }
    }
  });

  // Calculate ROI for each capper
  Object.keys(stats).forEach(capper => {
    const capperStats = stats[capper];
    const totalStake = capperStats.completed;
    if (totalStake > 0) {
      capperStats.roi = (capperStats.profit / totalStake) * 100;
    }
  });

  return stats;
}
