'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  Target,
  DollarSign,
  Trophy,
  Users,
  Activity,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
} from 'lucide-react';
import { useAnalytics, useSystemHealth, useUsers } from '@/hooks/useAnalytics';

export function RealTimeAnalytics() {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('7d');
  const {
    data: analytics,
    loading: analyticsLoading,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useAnalytics(timeframe);
  const {
    health,
    loading: healthLoading,
    error: healthError,
    refetch: refetchHealth,
  } = useSystemHealth();
  const {
    stats: userStats,
    loading: usersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useUsers('stats');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'operational':
      case 'up':
        return 'text-green-400';
      case 'warning':
      case 'degraded':
      case 'slow':
        return 'text-yellow-400';
      case 'error':
      case 'critical':
      case 'down':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'operational':
      case 'up':
        return <CheckCircle className="h-4 w-4" />;
      case 'warning':
      case 'degraded':
      case 'slow':
        return <AlertCircle className="h-4 w-4" />;
      case 'error':
      case 'critical':
      case 'down':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (analyticsLoading || healthLoading || usersLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-2 text-white">Loading dashboard data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="real-time-analytics">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Unit Talk Analytics</h1>
          <p className="text-gray-400">Real-time performance and system monitoring</p>
        </div>
        <div className="flex items-center space-x-2">
          {/* Tabs temporarily simplified for build fix */}
          <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
            <button className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ${timeframe === '24h' ? 'bg-background text-foreground shadow-sm' : ''}`} onClick={() => setTimeframe('24h')}>24H</button>
            <button className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ${timeframe === '7d' ? 'bg-background text-foreground shadow-sm' : ''}`} onClick={() => setTimeframe('7d')}>7D</button>
            <button className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ${timeframe === '30d' ? 'bg-background text-foreground shadow-sm' : ''}`} onClick={() => setTimeframe('30d')}>30D</button>
          </div>
          <Button
            onClick={() => {
              refetchAnalytics();
              refetchHealth();
              refetchUsers();
            }}
            variant="outline"
            size="sm"
            data-testid="refresh-dashboard"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        data-testid="performance-metrics"
      >
        <Card className="bg-black/40 border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Total Picks</CardTitle>
            <Target className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white" data-testid="total-picks">
              {analytics?.performance.totalPicks || 0}
            </div>
            <p className="text-xs text-gray-400">
              Past {timeframe === '24h' ? '24 hours' : timeframe === '7d' ? '7 days' : '30 days'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Win Rate</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white" data-testid="win-rate">
              {formatPercentage(analytics?.performance.winRate || 0)}
            </div>
            <Progress value={analytics?.performance.winRate || 0} />
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">ROI</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white" data-testid="roi">
              {formatPercentage(analytics?.performance.roi || 0)}
            </div>
            <Badge
              variant={
                analytics?.performance.roi && analytics.performance.roi > 0
                  ? 'default'
                  : 'destructive'
              }
            >
              {analytics?.performance.roi && analytics.performance.roi > 0 ? 'Profitable' : 'Loss'}
            </Badge>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Profit/Loss</CardTitle>
            <DollarSign className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(analytics?.performance.profit || 0)}
            </div>
            <p className="text-xs text-gray-400">
              {analytics?.performance.units || 0} units wagered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Tabs - temporarily simplified for build fix */}
      <div className="space-y-4">
        <div className="grid w-full grid-cols-4 h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          <button className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium bg-background text-foreground shadow-sm">Performance</button>
          <button className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium">Recent Picks</button>
          <button className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium">System Health</button>
          <button className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium">User Management</button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Capper Leaderboard */}
            <Card className="bg-black/40 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white">Top Cappers</CardTitle>
                <CardDescription>Ranked by ROI performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.capperLeaderboard.slice(0, 8).map((capper, index) => (
                    <div key={capper.capper} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Badge
                          variant="outline"
                          className="w-6 h-6 p-0 flex items-center justify-center"
                        >
                          {index + 1}
                        </Badge>
                        <span className="text-white font-medium">{capper.capper}</span>
                        <span className="text-gray-400 text-sm">({capper.picks} picks)</span>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-medium">{formatPercentage(capper.roi)}</div>
                        <div className="text-gray-400 text-sm">
                          {formatPercentage(capper.winRate)} WR
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Chart Placeholder */}
            <Card className="bg-black/40 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white">Performance Trend</CardTitle>
                <CardDescription>Daily performance over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Activity className="h-12 w-12 mx-auto mb-2" />
                    <p>Performance chart coming soon</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-4" style={{display: 'none'}} data-testid="pick-management">
          <Card className="bg-black/40 border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-white">Recent Picks</CardTitle>
              <CardDescription>Latest picks from the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics?.recentPicks.slice(0, 10).map(pick => (
                  <div
                    key={pick.id}
                    className="flex items-center justify-between p-3 bg-black/20 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline">{pick.sport}</Badge>
                      <span className="text-white font-medium">{pick.capper}</span>
                      <span className="text-gray-400">{pick.pick_type}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-gray-400">
                        {pick.odds > 0 ? '+' : ''}
                        {pick.odds}
                      </span>
                      <Badge
                        variant={
                          pick.result === 'win'
                            ? 'default'
                            : pick.result === 'loss'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {pick.result || pick.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4" style={{display: 'none'}} data-testid="system-health">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* System Services */}
            <Card className="bg-black/40 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white">System Services</CardTitle>
                <CardDescription>Agent and service status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {health?.services?.map((service: any) => (
                    <div key={service.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={getStatusColor(service.status)}>
                          {getStatusIcon(service.status)}
                        </div>
                        <span className="text-white">{service.name}</span>
                        {service.version && (
                          <Badge variant="outline" className="text-xs">
                            v{service.version}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-gray-400 text-sm">
                          {service.uptime?.toFixed(1)}% uptime
                        </div>
                        {service.responseTime && (
                          <div className="text-gray-500 text-xs">{service.responseTime}ms</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* API Status */}
            <Card className="bg-black/40 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white">External APIs</CardTitle>
                <CardDescription>Third-party service status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {health?.apis?.map((api: any) => (
                    <div key={api.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={getStatusColor(api.status)}>
                          {getStatusIcon(api.status)}
                        </div>
                        <span className="text-white">{api.name}</span>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={
                            api.status === 'operational'
                              ? 'default'
                              : api.status === 'slow'
                                ? 'secondary'
                                : 'destructive'
                          }
                        >
                          {api.status}
                        </Badge>
                        {api.responseTime && (
                          <div className="text-gray-500 text-xs mt-1">
                            {api.responseTime.toFixed(0)}ms
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-4" style={{display: 'none'}} data-testid="user-analytics">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* User Stats */}
            <Card className="bg-black/40 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white">User Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Total Users</span>
                  <span className="text-white font-bold">{userStats?.totalUsers || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Active Users</span>
                  <span className="text-white font-bold">{userStats?.activeUsers || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">New This Week</span>
                  <span className="text-white font-bold">{userStats?.newUsersThisWeek || 0}</span>
                </div>
              </CardContent>
            </Card>

            {/* Tier Distribution */}
            <Card className="bg-black/40 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white">Tier Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {userStats?.tierDistribution &&
                  Object.entries(userStats.tierDistribution).map(([tier, count]) => (
                    <div key={tier} className="flex items-center justify-between">
                      <Badge variant="outline" className="capitalize">
                        {tier.replace('_', ' ')}
                      </Badge>
                      <span className="text-white font-medium">{count as number}</span>
                    </div>
                  ))}
              </CardContent>
            </Card>

            {/* Top Users */}
            <Card className="bg-black/40 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white">Top Performers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {userStats?.topUsers?.slice(0, 5).map((user: any, index: number) => (
                    <div key={user.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant="outline"
                          className="w-6 h-6 p-0 flex items-center justify-center"
                        >
                          {index + 1}
                        </Badge>
                        <span className="text-white">{user.username}</span>
                      </div>
                      <span className="text-green-400 font-medium">
                        {formatPercentage(user.roi || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {(analyticsError || healthError || usersError) && (
        <Card className="bg-red-900/20 border-red-500/20">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              Connection Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {analyticsError && <p className="text-red-300">Analytics: {analyticsError.message}</p>}
              {healthError && <p className="text-red-300">Health: {healthError.message}</p>}
              {usersError && <p className="text-red-300">Users: {usersError.message}</p>}
              <p className="text-gray-400">Showing fallback data where available.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
