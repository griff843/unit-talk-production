import {
  getMockAnalytics,
  mockUsers,
  mockAgents,
  mockSecurityEvents,
  mockRecentPicks,
} from '@/lib/mockData';

// Mock data functions for analytics fallback
export function getMockSpecificMetric(metric: string, _period: string, _detailed: boolean) {
  const mockAnalytics = getMockAnalytics();

  switch (metric) {
    case 'users':
      return {
        total: mockUsers.length,
        active: mockUsers.filter(u => u.status === 'active').length,
        byTier: mockAnalytics.usersByTier,
        byStatus: mockAnalytics.usersByStatus,
        source: 'mock',
      };
    case 'agents':
      return {
        total: mockAgents.length,
        healthy: mockAnalytics.agentsByStatus.healthy,
        warning: mockAnalytics.agentsByStatus.warning,
        error: mockAnalytics.agentsByStatus.error,
        source: 'mock',
      };
    case 'security':
      return {
        total: mockSecurityEvents.length,
        open: mockSecurityEvents.filter(e => !e.resolved_at).length,
        critical: mockSecurityEvents.filter(e => e.severity === 'critical').length,
        source: 'mock',
      };
    default:
      return { error: 'Unknown metric', source: 'mock' };
  }
}

export function getComprehensiveMockAnalytics(
  _period: string,
  detailed: boolean,
  realtime: boolean
) {
  const mockAnalytics = getMockAnalytics();

  const analytics: any = {
    overview: mockAnalytics.overview,
    users: {
      total: mockUsers.length,
      active: mockUsers.filter(u => u.status === 'active').length,
      newUsers: mockUsers.filter(
        u => new Date(u.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).length,
      byTier: mockAnalytics.usersByTier,
      byStatus: mockAnalytics.usersByStatus,
      avgWinRate: mockUsers.reduce((sum, u) => sum + u.win_rate, 0) / mockUsers.length,
    } as any,
    agents: {
      total: mockAgents.length,
      healthy: mockAnalytics.agentsByStatus.healthy,
      warning: mockAnalytics.agentsByStatus.warning,
      error: mockAnalytics.agentsByStatus.error,
      avgSuccessRate: mockAgents.reduce((sum, a) => sum + a.success_rate, 0) / mockAgents.length,
      avgResponseTime:
        mockAgents.reduce((sum, a) => sum + a.avg_response_time, 0) / mockAgents.length,
      totalOperations: mockAgents.reduce((sum, a) => sum + a.total_operations, 0),
    } as any,
    security: {
      total: mockSecurityEvents.length,
      recent: mockSecurityEvents.filter(
        e => new Date(e.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length,
      open: mockSecurityEvents.filter(e => !e.resolved_at).length,
      critical: mockSecurityEvents.filter(e => e.severity === 'critical').length,
      bySeverity: mockSecurityEvents.reduce(
        (acc, e) => ({ ...acc, [e.severity]: (acc[e.severity] || 0) + 1 }),
        {} as Record<string, number>
      ),
      byType: mockSecurityEvents.reduce(
        (acc, e) => ({ ...acc, [e.type]: (acc[e.type] || 0) + 1 }),
        {} as Record<string, number>
      ),
      resolutionRate: 75, // Mock resolution rate
    } as any,
    picks: {
      total: mockRecentPicks.length,
      recent: mockRecentPicks.filter(
        p => new Date(p.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length,
      pending: mockRecentPicks.filter(p => p.status === 'pending').length,
      won: mockRecentPicks.filter(p => p.status === 'won').length,
      lost: mockRecentPicks.filter(p => p.status === 'lost').length,
      winRate: 68.5, // Mock win rate
    } as any,
    system: {
      uptime: 2847291, // Mock uptime in seconds
      status: 'healthy',
      lastUpdated: new Date().toISOString(),
    },
  };

  if (detailed) {
    analytics.users.topUsers = mockUsers
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(u => ({ username: u.username, tier: u.tier, revenue: u.revenue }));

    analytics.agents.performanceDetails = mockAgents.map(a => ({
      name: a.name,
      status: a.status,
      success_rate: a.success_rate,
      avg_response_time: a.avg_response_time,
    }));
  }

  if (realtime) {
    analytics.realtime = {
      activeConnections: Math.floor(Math.random() * 100) + 50,
      requestsPerSecond: Math.floor(Math.random() * 50) + 10,
      avgResponseTime: Math.floor(Math.random() * 100) + 50,
      timestamp: new Date().toISOString(),
    };
  }

  return analytics;
}
