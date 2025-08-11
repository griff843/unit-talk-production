import { dbOperations } from '@/lib/supabase';
import {
  UserMetrics,
  AgentMetrics,
  SecurityMetrics,
  PicksMetrics,
  RevenueMetrics,
} from '@/types/analytics';

// Database metric functions
export async function getUserMetrics(startDate: string, detailed: boolean): Promise<UserMetrics> {
  const users = await dbOperations.getUsers();
  const recentUsers = users.filter(u => u.created_at >= startDate);

  const byTier = users.reduce(
    (acc, u) => {
      const tier = u.tier as 'Free' | 'Premium' | 'VIP';
      return { ...acc, [tier]: (acc[tier] || 0) + 1 };
    },
    {} as Record<'Free' | 'Premium' | 'VIP', number>
  );

  const byStatus = users.reduce(
    (acc, u) => {
      const status = u.status as 'active' | 'inactive' | 'banned';
      return { ...acc, [status]: (acc[status] || 0) + 1 };
    },
    {} as Record<'active' | 'inactive' | 'banned', number>
  );

  const metrics: UserMetrics = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    newUsers: recentUsers.length,
    byTier,
    byStatus,
    avgWinRate: users.reduce((sum, u) => sum + u.win_rate, 0) / users.length,
  };

  if (detailed) {
    metrics.topUsers = users
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(u => ({
        id: u.id,
        username: u.username,
        tier: u.tier,
        winRate: u.win_rate,
        totalPicks: u.total_picks,
      }));
  }

  return metrics;
}

export async function getAgentMetrics(startDate: string, detailed: boolean): Promise<AgentMetrics> {
  const agents = await dbOperations.getAgents();

  const metrics: AgentMetrics = {
    total: agents.length,
    healthy: agents.filter(a => a.status === 'healthy').length,
    warning: agents.filter(a => a.status === 'warning').length,
    error: agents.filter(a => a.status === 'error').length,
    avgSuccessRate: agents.reduce((sum, a) => sum + a.success_rate, 0) / agents.length,
    avgResponseTime: agents.reduce((sum, a) => sum + a.avg_response_time, 0) / agents.length,
    totalOperations: agents.reduce((sum, a) => sum + a.total_operations, 0),
  };

  if (detailed) {
    metrics.byType = agents.reduce(
      (acc, a) => {
        return { ...acc, [a.type]: (acc[a.type] || 0) + 1 };
      },
      {} as Record<string, number>
    );

    metrics.performanceDetails = agents.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      successRate: a.success_rate,
      responseTime: a.avg_response_time,
    }));
  }

  return metrics;
}

export async function getSecurityMetrics(
  startDate: string,
  detailed: boolean
): Promise<SecurityMetrics> {
  const events = await dbOperations.getSecurityEvents();
  const recentEvents = events.filter(e => e.created_at >= startDate);

  const bySeverity = events.reduce(
    (acc, e) => {
      const severity = e.severity as 'low' | 'medium' | 'high' | 'critical';
      return { ...acc, [severity]: (acc[severity] || 0) + 1 };
    },
    {} as Record<'low' | 'medium' | 'high' | 'critical', number>
  );

  const byType = events.reduce(
    (acc, e) => {
      const type = e.type as 'login_attempt' | 'api_access' | 'rate_limit' | 'suspicious_activity';
      return { ...acc, [type]: (acc[type] || 0) + 1 };
    },
    {} as Record<'login_attempt' | 'api_access' | 'rate_limit' | 'suspicious_activity', number>
  );

  const metrics: SecurityMetrics = {
    total: events.length,
    recent: recentEvents.length,
    open: events.filter(e => !e.resolved_at).length,
    critical: events.filter(e => e.severity === 'critical' && !e.resolved_at).length,
    bySeverity,
    byType,
    resolutionRate:
      events.length > 0 ? (events.filter(e => e.resolved_at).length / events.length) * 100 : 0,
  };

  if (detailed) {
    metrics.criticalEvents = events
      .filter(e => e.severity === 'critical' && !e.resolved_at)
      .slice(0, 5)
      .map(e => ({
        id: e.id,
        type: e.type,
        severity: e.severity,
        timestamp: e.created_at,
        description: e.type,
      }));
  }

  return metrics;
}

export async function getPickMetrics(startDate: string, detailed: boolean): Promise<PicksMetrics> {
  const picks = await dbOperations.getPicks(500); // Get more picks for analysis
  const recentPicks = picks.filter(p => p.created_at >= startDate);

  const metrics: PicksMetrics = {
    total: picks.length,
    recent: recentPicks.length,
    pending: picks.filter(p => p.status === 'pending').length,
    won: picks.filter(p => p.status === 'won').length,
    lost: picks.filter(p => p.status === 'lost').length,
    winRate:
      picks.length > 0
        ? (picks.filter(p => p.status === 'won').length /
            picks.filter(p => p.status !== 'pending').length) *
          100
        : 0,
  };

  if (detailed) {
    metrics.bySport = picks.reduce(
      (acc, p) => {
        const sport = p.sport as string;
        return { ...acc, [sport]: (acc[sport] || 0) + 1 };
      },
      {} as Record<string, number>
    );

    metrics.recentPicks = recentPicks.slice(0, 10).map(p => ({
      id: p.id as string,
      sport: p.sport as string,
      type: p.event as string,
      status: p.status as string,
      timestamp: p.created_at as string,
    }));
  }

  return metrics;
}

export async function getRevenueMetrics(
  startDate: string,
  detailed: boolean
): Promise<RevenueMetrics> {
  const analytics = await dbOperations.getAnalytics();
  const users = (analytics as any).users || [];
  const totalRevenue = users.reduce((sum: number, u: any) => sum + (u.revenue || 0), 0);

  const byTier = users.reduce(
    (acc: any, u: any) => {
      const tier = u.tier as 'Free' | 'Premium' | 'VIP';
      if (!acc[tier]) acc[tier] = 0;
      acc[tier] += u.revenue || 0;
      return acc;
    },
    {} as Record<'Free' | 'Premium' | 'VIP', number>
  );

  const metrics: RevenueMetrics = {
    total: totalRevenue,
    avgPerUser: users.length > 0 ? totalRevenue / users.length : 0,
    byTier,
  };

  if (detailed) {
    metrics.topRevenue = ((analytics as any).users || ([] as any[]))
      .sort((a: any, b: any) => (b.revenue || 0) - (a.revenue || 0))
      .slice(0, 10)
      .map((u: any) => ({
        userId: u.id,
        username: u.username,
        tier: u.tier,
        revenue: u.revenue || 0,
      }));
  }

  return metrics;
}

export async function getPerformanceMetrics(_startDate: string, _detailed: boolean): Promise<any> {
  // This would typically include API response times, error rates, etc.
  const agents = await dbOperations.getAgents();

  const metrics = {
    avgResponseTime: agents.reduce((sum, a) => sum + a.avg_response_time, 0) / agents.length,
    avgSuccessRate: agents.reduce((sum, a) => sum + a.success_rate, 0) / agents.length,
    totalRequests: agents.reduce((sum, a) => sum + a.total_operations, 0),
    errorRate: 100 - agents.reduce((sum, a) => sum + a.success_rate, 0) / agents.length,
  };

  return metrics;
}
