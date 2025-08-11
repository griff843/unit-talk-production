/**
 * Analytics Types for Command Center
 * Comprehensive type definitions for all analytics data structures
 */

export interface UserMetrics {
  total: number;
  active: number;
  newUsers: number;
  byTier: Record<'Free' | 'Premium' | 'VIP', number>;
  byStatus: Record<'active' | 'inactive' | 'banned', number>;
  avgWinRate: number;
  topUsers?: Array<{
    id: string;
    username: string;
    tier: string;
    winRate: number;
    totalPicks: number;
  }>;
}

export interface AgentMetrics {
  total: number;
  healthy: number;
  warning: number;
  error: number;
  avgSuccessRate: number;
  avgResponseTime: number;
  totalOperations: number;
  byType?: Record<string, number>;
  performanceDetails?: Array<{
    id: string;
    name: string;
    type: string;
    successRate: number;
    responseTime: number;
  }>;
}

export interface SecurityMetrics {
  total: number;
  recent: number;
  open: number;
  critical: number;
  bySeverity: Record<'low' | 'medium' | 'high' | 'critical', number>;
  byType: Record<'login_attempt' | 'api_access' | 'rate_limit' | 'suspicious_activity', number>;
  resolutionRate: number;
  criticalEvents?: Array<{
    id: string;
    type: string;
    severity: string;
    timestamp: string;
    description: string;
  }>;
}

export interface PicksMetrics {
  total: number;
  recent: number;
  pending: number;
  won: number;
  lost: number;
  winRate: number;
  bySport?: Record<string, number>;
  recentPicks?: Array<{
    id: string;
    sport: string;
    type: string;
    status: string;
    timestamp: string;
  }>;
}

export interface RevenueMetrics {
  total: number;
  avgPerUser: number;
  byTier: Record<'Free' | 'Premium' | 'VIP', number>;
  topRevenue?: Array<{
    userId: string;
    username: string;
    tier: string;
    revenue: number;
  }>;
}

export interface SystemMetrics {
  uptime: number;
  responseTime: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
}

export interface OverviewMetrics {
  users: number;
  activeUsers: number;
  agents: number;
  healthyAgents: number;
  securityEvents: number;
  criticalEvents: number;
  picks: number;
  winRate: number;
  revenue?: number;
  totalUsers?: number;
  vipUsers?: number;
  premiumUsers?: number;
  bannedUsers?: number;
  totalPicks?: number;
  pendingPicks?: number;
  wonPicks?: number;
  lostPicks?: number;
  totalAgents?: number;
  warningAgents?: number;
  errorAgents?: number;
  inactiveAgents?: number;
  totalRevenue?: number;
  avgRevenuePerUser?: number;
}

export interface RealtimeMetrics {
  timestamp: string;
  activeUsers: number;
  systemLoad: number;
  agentActivity: number;
  securityAlerts: number;
}

export interface AnalyticsResponse {
  overview: OverviewMetrics;
  users: UserMetrics;
  agents: AgentMetrics;
  security: SecurityMetrics;
  picks: PicksMetrics;
  revenue: RevenueMetrics;
  system: SystemMetrics;
  realtime?: RealtimeMetrics;
}

export interface AnalyticsResponseWithRealtime extends AnalyticsResponse {
  realtime: RealtimeMetrics;
}

export interface MetricDataWithSource {
  data: any;
  source: 'database' | 'mock';
}

export type Period = '1d' | '7d' | '30d' | '90d';
export type MetricType = 'users' | 'agents' | 'security' | 'picks' | 'revenue' | 'system' | 'overview' | 'performance';