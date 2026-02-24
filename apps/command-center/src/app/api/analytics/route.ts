import { NextRequest, NextResponse } from 'next/server';

import {
  getUserMetrics,
  getAgentMetrics,
  getSecurityMetrics,
  getPickMetrics,
  getRevenueMetrics,
  getPerformanceMetrics,
} from './databaseMetrics';

import { MetricType } from '@/types/analytics';

/**
 * Analytics API Endpoint
 * SPRINT-DEMO-MODE-REMOVAL: All mock fallbacks removed.
 * Fail-closed: If database unavailable, return explicit error.
 */

// GET /api/analytics - Get analytics data and metrics
export async function GET(request: NextRequest) {
  try {
    const params = parseRequestParams(request);
    console.log('[CC] GET /api/analytics', params);

    const startDate = calculateStartDate(params.period);

    if (params.metric) {
      return await handleSpecificMetric(params.metric, startDate, params.period, params.detailed);
    }

    return await handleComprehensiveAnalytics(
      startDate,
      params.period,
      params.detailed,
      params.realtime
    );
  } catch (error) {
    console.error('[CC] GET /api/analytics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// Helper function to parse request parameters
function parseRequestParams(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  return {
    metric: searchParams.get('metric'),
    period: searchParams.get('period') || '30d',
    detailed: searchParams.get('detailed') === 'true',
    realtime: searchParams.get('realtime') === 'true',
  };
}

// Helper function to calculate start date
function calculateStartDate(period: string): string {
  const periodMs = getPeriodMs(period);
  return new Date(Date.now() - periodMs).toISOString();
}

// Handle specific metric requests
async function handleSpecificMetric(
  metric: string,
  startDate: string,
  period: string,
  detailed: boolean
) {
  const metricData = await getSpecificMetric(metric as MetricType, startDate, detailed);
  return NextResponse.json({
    success: true,
    data: metricData,
    metric,
    period,
    source: 'database',
  });
}

// Handle comprehensive analytics requests
async function handleComprehensiveAnalytics(
  startDate: string,
  period: string,
  detailed: boolean,
  realtime: boolean
) {
  const analytics = await getComprehensiveAnalytics(startDate, detailed, realtime);

  // Transform for API response
  const overview = analytics.overview as Record<string, number> | undefined;
  const users = analytics.users as
    | { total?: number; active?: number; byTier?: Record<string, number> }
    | undefined;
  const picks = analytics.picks as
    | { total?: number; byStatus?: Record<string, number> }
    | undefined;
  const revenue = analytics.revenue as { total?: number } | undefined;

  const transformedAnalytics = {
    success: true,
    overview: {
      totalUsers: overview?.users || users?.total || 0,
      activeUsers: overview?.activeUsers || users?.active || 0,
      totalPicks: overview?.picks || picks?.total || 0,
      totalRevenue: revenue?.total || 0,
    },
    usersByTier: users?.byTier || {},
    picksByStatus: picks?.byStatus || {},
    ...analytics,
    source: 'database',
  };

  return NextResponse.json(transformedAnalytics);
}

// Helper function to get period in milliseconds
function getPeriodMs(period: string): number {
  const periodMap: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
  };
  return periodMap[period] || periodMap['30d'];
}

// Get specific metric from database
async function getSpecificMetric(metric: MetricType, startDate: string, detailed: boolean) {
  switch (metric) {
    case 'users':
      return getUserMetrics(startDate, detailed);
    case 'agents':
      return getAgentMetrics(startDate, detailed);
    case 'security':
      return getSecurityMetrics(startDate, detailed);
    case 'picks':
      return getPickMetrics(startDate, detailed);
    case 'revenue':
      return getRevenueMetrics(startDate, detailed);
    case 'performance':
      return getPerformanceMetrics(startDate, detailed);
    default:
      throw new Error(`Unknown metric: ${metric}`);
  }
}

// Comprehensive analytics from database
async function getComprehensiveAnalytics(startDate: string, detailed: boolean, realtime: boolean) {
  const [users, agents, securityEvents, picks] = await Promise.all([
    getUserMetrics(startDate, detailed),
    getAgentMetrics(startDate, detailed),
    getSecurityMetrics(startDate, detailed),
    getPickMetrics(startDate, detailed),
  ]);

  const analytics: Record<string, unknown> = {
    overview: {
      totalUsers: users.total,
      activeUsers: users.active,
      totalPicks: picks.total || picks.recent,
      totalRevenue: 0,
      users: users.total,
      agents: agents.total,
      healthyAgents: agents.healthy,
      securityEvents: securityEvents.recent,
      criticalEvents: securityEvents.critical,
      picks: picks.recent,
      winRate: picks.winRate,
    },
    users,
    agents,
    security: securityEvents,
    picks,
    system: {
      status: agents.error > 0 ? 'warning' : 'healthy',
      lastUpdated: new Date().toISOString(),
    },
  };

  if (realtime) {
    analytics.realtime = {
      activeConnections: 0,
      requestsPerSecond: 0,
      avgResponseTime: 0,
    };
  }

  return analytics;
}
