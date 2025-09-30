'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Temporarily removed for build fix
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  TrendingUp,
  Users,
  Target,
  DollarSign,
  Activity,
  Bell,
  Crown,
  Zap,
  PieChart as RechartsPieChart,
  LineChart,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Trophy,
  Star,
} from 'lucide-react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

// Types
interface DashboardStats {
  totalPicks: number;
  winRate: number;
  totalUsers: number;
  activeUsers: number;
  revenue: number;
  revenueGrowth: number;
  avgROI: number;
  topPerformers: Array<{
    id: string;
    name: string;
    winRate: number;
    totalPicks: number;
    tier: 'FREE' | 'VIP' | 'VIP_PLUS';
  }>;
}

interface LiveMetrics {
  activePicks: number;
  pendingGrades: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  lastUpdate: string;
  alerts: Array<{
    id: string;
    type: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
}

interface PerformanceData {
  date: string;
  winRate: number;
  totalPicks: number;
  revenue: number;
  users: number;
}

interface UserAnalytics {
  tierDistribution: Array<{
    tier: string;
    count: number;
    revenue: number;
  }>;
  retentionRate: number;
  churnRate: number;
  avgLifetimeValue: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function EnhancedDashboard() {
  // State Management
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date().toISOString());

  // Real-time data fetching
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Simulate API calls - replace with actual endpoints
        const [statsRes, metricsRes, performanceRes, analyticsRes] = await Promise.all([
          fetch(`/api/dashboard/stats?timeRange=${selectedTimeRange}`),
          fetch('/api/dashboard/live-metrics'),
          fetch(`/api/dashboard/performance?timeRange=${selectedTimeRange}`),
          fetch(`/api/dashboard/user-analytics?timeRange=${selectedTimeRange}`),
        ]);

        if (!statsRes.ok || !metricsRes.ok || !performanceRes.ok || !analyticsRes.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const [statsData, metricsData, performanceDataRes, analyticsData] = await Promise.all([
          statsRes.json(),
          metricsRes.json(),
          performanceRes.json(),
          analyticsRes.json(),
        ]);

        setStats(statsData);
        setLiveMetrics(metricsData);
        setPerformanceData(performanceDataRes);
        setUserAnalytics(analyticsData);
        setLastRefresh(new Date().toISOString());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
        console.error('Dashboard data fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    // Auto-refresh every 30 seconds if enabled
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchDashboardData, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedTimeRange, autoRefresh]);

  // Mock data for development
  const mockStats: DashboardStats = {
    totalPicks: 1247,
    winRate: 67.3,
    totalUsers: 892,
    activeUsers: 234,
    revenue: 15420,
    revenueGrowth: 12.5,
    avgROI: 8.7,
    topPerformers: [
      { id: '1', name: 'ProCapperAI', winRate: 78.2, totalPicks: 156, tier: 'VIP_PLUS' },
      { id: '2', name: 'SportsMaster', winRate: 74.1, totalPicks: 203, tier: 'VIP' },
      { id: '3', name: 'BetWizard', winRate: 71.8, totalPicks: 189, tier: 'VIP_PLUS' },
    ],
  };

  const mockLiveMetrics: LiveMetrics = {
    activePicks: 47,
    pendingGrades: 12,
    systemHealth: 'healthy',
    lastUpdate: new Date().toISOString(),
    alerts: [
      {
        id: '1',
        type: 'info',
        message: 'System performing optimally',
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        type: 'warning',
        message: 'High volume detected - monitoring closely',
        timestamp: new Date(Date.now() - 300000).toISOString(),
      },
    ],
  };

  const mockPerformanceData: PerformanceData[] = [
    { date: '2024-01-01', winRate: 65.2, totalPicks: 45, revenue: 1200, users: 23 },
    { date: '2024-01-02', winRate: 68.1, totalPicks: 52, revenue: 1450, users: 28 },
    { date: '2024-01-03', winRate: 71.3, totalPicks: 48, revenue: 1380, users: 25 },
    { date: '2024-01-04', winRate: 69.7, totalPicks: 56, revenue: 1620, users: 31 },
    { date: '2024-01-05', winRate: 73.2, totalPicks: 61, revenue: 1890, users: 34 },
    { date: '2024-01-06', winRate: 67.8, totalPicks: 53, revenue: 1540, users: 29 },
    { date: '2024-01-07', winRate: 70.4, totalPicks: 58, revenue: 1720, users: 32 },
  ];

  const mockUserAnalytics: UserAnalytics = {
    tierDistribution: [
      { tier: 'FREE', count: 456, revenue: 0 },
      { tier: 'VIP', count: 312, revenue: 9360 },
      { tier: 'VIP_PLUS', count: 124, revenue: 6200 },
    ],
    retentionRate: 78.5,
    churnRate: 4.2,
    avgLifetimeValue: 127.5,
  };

  // Use mock data if real data isn't available
  const displayStats = stats || mockStats;
  const displayMetrics = liveMetrics || mockLiveMetrics;
  const displayPerformance = performanceData.length > 0 ? performanceData : mockPerformanceData;
  const displayAnalytics = userAnalytics || mockUserAnalytics;

  // Computed values
  const systemHealthColor = useMemo(() => {
    switch (displayMetrics.systemHealth) {
      case 'healthy':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'critical':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  }, [displayMetrics.systemHealth]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const handleRefresh = () => {
    setLastRefresh(new Date().toISOString());
    // Trigger data refresh
    window.location.reload();
  };

  const handleExportData = () => {
    // Implement data export functionality
    const dataToExport = {
      stats: displayStats,
      performance: displayPerformance,
      analytics: displayAnalytics,
      exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unit-talk-dashboard-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="h-8 w-8 text-yellow-600" />
              Unit Talk Dashboard
            </h1>
            <p className="text-gray-600 mt-1">Last updated: {new Date(lastRefresh).toLocaleTimeString()}</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedTimeRange}
              onChange={e => setSelectedTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1d">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportData}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>

            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="flex items-center gap-2"
            >
              <Activity className="h-4 w-4" />
              {autoRefresh ? 'Live' : 'Manual'}
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* System Health Alert */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm">
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${
                displayMetrics.systemHealth === 'healthy'
                  ? 'bg-green-500'
                  : displayMetrics.systemHealth === 'warning'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
            ></div>
            <span className={`font-medium ${systemHealthColor}`}>
              System Status:{' '}
              {displayMetrics.systemHealth.charAt(0).toUpperCase() +
                displayMetrics.systemHealth.slice(1)}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Active Picks: {displayMetrics.activePicks}</span>
            <span>Pending Grades: {displayMetrics.pendingGrades}</span>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium opacity-90">Total Picks</CardTitle>
              <Target className="h-4 w-4 opacity-90" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{displayStats.totalPicks.toLocaleString()}</div>
              <p className="text-xs opacity-90 mt-1">
                +{Math.round(displayStats.totalPicks * 0.08)} from last period
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium opacity-90">Win Rate</CardTitle>
              <TrendingUp className="h-4 w-4 opacity-90" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPercentage(displayStats.winRate)}</div>
              <p className="text-xs opacity-90 mt-1">+2.3% from last period</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium opacity-90">Active Users</CardTitle>
              <Users className="h-4 w-4 opacity-90" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{displayStats.activeUsers}</div>
              <p className="text-xs opacity-90 mt-1">{displayStats.totalUsers} total users</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium opacity-90">Revenue</CardTitle>
              <DollarSign className="h-4 w-4 opacity-90" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(displayStats.revenue)}</div>
              <p className="text-xs opacity-90 mt-1">
                +{formatPercentage(displayStats.revenueGrowth)} growth
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <div className="space-y-6">
          {/* Tabs temporarily simplified for build fix */}
          <div className="w-full">
            <div className="grid w-full grid-cols-4 h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
              <button className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium bg-background text-foreground shadow-sm">Overview</button>
              <button className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium">Performance</button>
              <button className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium">Users</button>
              <button className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium">Alerts</button>
            </div>

          {/* Overview Tab */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Performance Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5" />
                    Win Rate Trend
                  </CardTitle>
                  <CardDescription>Daily win rate performance over selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsLineChart data={displayPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={value => new Date(value).toLocaleDateString()}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={value => new Date(value).toLocaleDateString()}
                        formatter={(value: number) => [formatPercentage(value), 'Win Rate']}
                      />
                      <Line
                        type="monotone"
                        dataKey="winRate"
                        stroke="#8884d8"
                        strokeWidth={2}
                        dot={{ fill: '#8884d8' }}
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* User Tier Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RechartsPieChart className="h-5 w-5" />
                    User Tier Distribution
                  </CardTitle>
                  <CardDescription>Breakdown of users by subscription tier</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={displayAnalytics.tierDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ tier, count }) => `${tier}: ${count}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {displayAnalytics.tierDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Top Performers
                </CardTitle>
                <CardDescription>Highest performing cappers this period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {displayStats.topPerformers.map((performer, index) => (
                    <div
                      key={performer.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-yellow-100 rounded-full">
                          <span className="text-sm font-bold text-yellow-800">#{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium">{performer.name}</p>
                          <p className="text-sm text-gray-600">{performer.totalPicks} picks</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            performer.tier === 'VIP_PLUS'
                              ? 'default'
                              : performer.tier === 'VIP'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {performer.tier === 'VIP_PLUS' ? (
                            <>
                              <Crown className="h-3 w-3 mr-1" />
                              VIP+
                            </>
                          ) : performer.tier === 'VIP' ? (
                            <>
                              <Zap className="h-3 w-3 mr-1" />
                              VIP
                            </>
                          ) : (
                            'FREE'
                          )}
                        </Badge>
                        <span className="font-bold text-green-600">
                          {formatPercentage(performer.winRate)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Tab */}
          <div className="space-y-6" style={{display: 'none'}}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Trend</CardTitle>
                  <CardDescription>Daily revenue performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={displayPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={value => new Date(value).toLocaleDateString()}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={value => new Date(value).toLocaleDateString()}
                        formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                      />
                      <Bar dataKey="revenue" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Key Performance Indicators */}
              <Card>
                <CardHeader>
                  <CardTitle>Key Performance Indicators</CardTitle>
                  <CardDescription>Critical business metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Average ROI</span>
                    <span className="text-lg font-bold text-green-600">
                      +{formatPercentage(displayStats.avgROI)}
                    </span>
                  </div>
                  <Progress value={displayStats.avgROI * 10} />

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">User Retention</span>
                    <span className="text-lg font-bold text-blue-600">
                      {formatPercentage(displayAnalytics.retentionRate)}
                    </span>
                  </div>
                  <Progress value={displayAnalytics.retentionRate} />

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Churn Rate</span>
                    <span className="text-lg font-bold text-red-600">
                      {formatPercentage(displayAnalytics.churnRate)}
                    </span>
                  </div>
                  <Progress value={displayAnalytics.churnRate} />

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Avg Lifetime Value</span>
                    <span className="text-lg font-bold text-purple-600">
                      {formatCurrency(displayAnalytics.avgLifetimeValue)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Users Tab */}
          <div className="space-y-6" style={{display: 'none'}}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {displayAnalytics.tierDistribution.map((tier, index) => (
                <Card key={tier.tier}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {tier.tier === 'VIP_PLUS' && <Crown className="h-5 w-5 text-yellow-600" />}
                      {tier.tier === 'VIP' && <Zap className="h-5 w-5 text-blue-600" />}
                      {tier.tier === 'FREE' && <Users className="h-5 w-5 text-gray-600" />}
                      {tier.tier.replace('_', ' ')} Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold mb-2">{tier.count}</div>
                    <div className="text-sm text-gray-600">
                      Revenue: {formatCurrency(tier.revenue)}
                    </div>
                    <div className="text-sm text-gray-600">
                      Avg per user: {formatCurrency(tier.count > 0 ? tier.revenue / tier.count : 0)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Alerts Tab */}
          <div className="space-y-6" style={{display: 'none'}}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  System Alerts
                </CardTitle>
                <CardDescription>Recent system notifications and alerts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {displayMetrics.alerts.map(alert => (
                    <div
                      key={alert.id}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        alert.type === 'error'
                          ? 'bg-red-50 border border-red-200'
                          : alert.type === 'warning'
                            ? 'bg-yellow-50 border border-yellow-200'
                            : 'bg-blue-50 border border-blue-200'
                      }`}
                    >
                      {alert.type === 'error' && (
                        <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      )}
                      {alert.type === 'warning' && (
                        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      )}
                      {alert.type === 'info' && (
                        <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p
                          className={`font-medium ${
                            alert.type === 'error'
                              ? 'text-red-800'
                              : alert.type === 'warning'
                                ? 'text-yellow-800'
                                : 'text-blue-800'
                          }`}
                        >
                          {alert.message}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {alert.timestamp.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
