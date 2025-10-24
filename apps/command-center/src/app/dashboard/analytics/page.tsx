'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientTime } from '@/components/ui/client-time';
import {
  TrendingUp,
  BarChart3,
  Activity,
  DollarSign,
  Users,
  Target,
  Bot,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  Download,
} from 'lucide-react';
import { formatCurrency, formatPercentage } from '@/lib/utils';

// Mock analytics data - in production this would come from Phase D system
const analyticsData = {
  overview: {
    systemHealth: 98.7,
    activeUsers: 1234,
    pickAccuracy: 67.3,
    revenueGrowth: 18.9,
    lastUpdated: new Date(),
  },
  businessMetrics: {
    revenue: {
      daily: 2847.5,
      monthly: 87234.2,
      trend: 15.3,
    },
    users: {
      active: 1234,
      new: 87,
      churn: 2.1,
    },
    picks: {
      total: 2847,
      approved: 2623,
      accuracy: 67.3,
    },
    agents: {
      healthy: 5,
      warning: 1,
      error: 0,
    },
  },
  topPerformers: [
    { name: 'ProCapper23', picks: 247, accuracy: 74.2, roi: 18.7, tier: 'S' },
    { name: 'AnalyticsMaster', picks: 189, accuracy: 71.8, roi: 15.2, tier: 'A' },
    { name: 'SharpBettor', picks: 156, accuracy: 69.1, roi: 12.4, tier: 'B' },
    { name: 'DataDriven', picks: 134, accuracy: 65.7, roi: 8.9, tier: 'C' },
  ],
  trends: {
    revenue: [
      { date: '2024-01-01', value: 45000 },
      { date: '2024-01-08', value: 52000 },
      { date: '2024-01-15', value: 48000 },
      { date: '2024-01-22', value: 67000 },
      { date: '2024-01-29', value: 73000 },
    ],
    users: [
      { date: '2024-01-01', value: 980 },
      { date: '2024-01-08', value: 1045 },
      { date: '2024-01-15', value: 1123 },
      { date: '2024-01-22', value: 1189 },
      { date: '2024-01-29', value: 1234 },
    ],
    picks: [
      { date: '2024-01-01', value: 156 },
      { date: '2024-01-08', value: 203 },
      { date: '2024-01-15', value: 187 },
      { date: '2024-01-22', value: 234 },
      { date: '2024-01-29', value: 267 },
    ],
  },
};

const alerts = [
  {
    id: 'alert_001',
    severity: 'high',
    category: 'performance',
    title: 'High Pick Volume Detected',
    description: 'Pick submissions increased by 45% in the last hour',
    timestamp: new Date(Date.now() - 300000),
    status: 'active',
  },
  {
    id: 'alert_002',
    severity: 'medium',
    category: 'agent',
    title: 'RecapAgent Performance Warning',
    description: 'Average response time increased to 340ms (threshold: 200ms)',
    timestamp: new Date(Date.now() - 900000),
    status: 'acknowledged',
  },
  {
    id: 'alert_003',
    severity: 'low',
    category: 'business',
    title: 'New Capper Milestone',
    description: 'ProCapper23 reached 75% accuracy rate milestone',
    timestamp: new Date(Date.now() - 1800000),
    status: 'resolved',
  },
];

export default function AnalyticsPage() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const handleRefresh = async () => {
    setIsLoading(true);
    // Simulate API call to Phase D system
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLastRefresh(new Date());
    setIsLoading(false);
  };

  const handleOpenPhaseD = () => {
    window.open('http://localhost:3005/dashboard', '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Business Intelligence</h1>
          <p className="text-muted-foreground">
            Advanced analytics powered by Phase D system integration
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handleOpenPhaseD}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Phase D Dashboard
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Banner */}
      <Card className="border-green-500/20 bg-green-500/10">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <div>
              <p className="font-semibold text-green-400">
                System Health: {analyticsData.overview.systemHealth}%
              </p>
              <p className="text-sm text-muted-foreground">
                All Phase D analytics systems operational • Last updated:{' '}
                <ClientTime date={lastRefresh} />
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-green-400 border-green-500/20">
            Real-time Active
          </Badge>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.overview.activeUsers.toLocaleString()}
            </div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">+8.1%</span>
              <span>from last week</span>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pick Accuracy</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(analyticsData.overview.pickAccuracy)}
            </div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">+2.3%</span>
              <span>this month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Growth</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(analyticsData.overview.revenueGrowth)}
            </div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">+3.7%</span>
              <span>vs target</span>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(analyticsData.overview.systemHealth)}
            </div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span className="text-green-500">Optimal</span>
              <span>all systems</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Analytics Dashboard</CardTitle>
          <CardDescription>
            Comprehensive business intelligence and predictive insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Business Overview</TabsTrigger>
              <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
              <TabsTrigger value="predictions">Predictive Analytics</TabsTrigger>
              <TabsTrigger value="alerts">Live Monitoring</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Revenue Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Revenue Analytics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Daily Revenue</span>
                        <span className="font-mono font-bold">
                          {formatCurrency(analyticsData.businessMetrics.revenue.daily)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Monthly Revenue</span>
                        <span className="font-mono font-bold">
                          {formatCurrency(analyticsData.businessMetrics.revenue.monthly)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Growth Rate</span>
                        <span className="font-mono font-bold text-green-600">
                          +{formatPercentage(analyticsData.businessMetrics.revenue.trend)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Performers */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Top Performing Cappers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analyticsData.topPerformers.map((capper, index) => (
                        <div
                          key={capper.name}
                          className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{capper.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {capper.picks} picks • {formatPercentage(capper.accuracy)} accuracy
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge
                              className={
                                capper.tier === 'S'
                                  ? 'tier-s'
                                  : capper.tier === 'A'
                                    ? 'tier-a'
                                    : capper.tier === 'B'
                                      ? 'tier-b'
                                      : 'tier-c'
                              }
                            >
                              {capper.tier}
                            </Badge>
                            <p className="text-sm font-mono text-green-600 mt-1">
                              +{formatPercentage(capper.roi)} ROI
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Agent Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span>Healthy Agents</span>
                        <span className="font-bold text-green-600">
                          {analyticsData.businessMetrics.agents.healthy}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Warning Status</span>
                        <span className="font-bold text-yellow-600">
                          {analyticsData.businessMetrics.agents.warning}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Error Status</span>
                        <span className="font-bold text-red-600">
                          {analyticsData.businessMetrics.agents.error}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Pick Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span>Total Picks</span>
                        <span className="font-bold">
                          {analyticsData.businessMetrics.picks.total.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Approved</span>
                        <span className="font-bold text-green-600">
                          {analyticsData.businessMetrics.picks.approved.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Accuracy Rate</span>
                        <span className="font-bold">
                          {formatPercentage(analyticsData.businessMetrics.picks.accuracy)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">User Engagement</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span>Active Users</span>
                        <span className="font-bold">
                          {analyticsData.businessMetrics.users.active.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>New Users</span>
                        <span className="font-bold text-green-600">
                          +{analyticsData.businessMetrics.users.new}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Churn Rate</span>
                        <span className="font-bold text-red-600">
                          {formatPercentage(analyticsData.businessMetrics.users.churn)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="predictions" className="mt-6">
              <div className="text-center py-12">
                <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Predictive Analytics Engine</h3>
                <p className="text-muted-foreground mb-4">
                  Advanced ML-powered insights and forecasting models
                </p>
                <Button onClick={handleOpenPhaseD}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Full Phase D Analytics
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="alerts" className="mt-6">
              <div className="space-y-4">
                {alerts.map(alert => (
                  <Card
                    key={alert.id}
                    className={`border-l-4 ${
                      alert.severity === 'high'
                        ? 'border-l-red-500'
                        : alert.severity === 'medium'
                          ? 'border-l-yellow-500'
                          : 'border-l-blue-500'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div
                            className={`p-1 rounded-full ${
                              alert.severity === 'high'
                                ? 'bg-red-500/20 text-red-400'
                                : alert.severity === 'medium'
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="font-semibold">{alert.title}</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                              {alert.description}
                            </p>
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {alert.category}
                              </Badge>
                              <span>•</span>
                              <ClientTime date={alert.timestamp} />
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={
                            alert.status === 'active'
                              ? 'destructive'
                              : alert.status === 'acknowledged'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {alert.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
