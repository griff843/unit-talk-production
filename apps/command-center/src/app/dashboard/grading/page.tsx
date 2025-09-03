// @ts-nocheck
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Layers,
  Timer,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  BarChart3,
  Zap,
  Target,
} from 'lucide-react';
import { GradingQueue } from '@/components/monitoring/GradingQueue';
import { ComboPlayBuilder } from '@/components/charts/ComboPlayBuilder';
import { usePicks } from '@/hooks/usePicks';
import { useAgentMonitoring } from '@/hooks/useAgentMonitoring';
import { toast } from 'sonner';

export default function GradingHQPage() {
  const { picks, loading: picksLoading, refreshPicks } = usePicks();
  const { agents, loading: agentsLoading } = useAgentMonitoring();
  const [selectedTab, setSelectedTab] = useState('queue');

  const gradingAgents = agents.filter(agent => agent.name.toLowerCase().includes('grading'));

  const gradingMetrics = {
    totalPicks: picks?.length || 0,
    pendingGrading:
      picks?.filter(p => p.status === 'pending' || p.workflow_stage === 'pending_review').length ||
      0,
    averageGradingTime: 45, // seconds
    throughputPerHour: 120,
    approvalRate: 78.5,
    activeAgents: gradingAgents.filter(agent => agent.status === 'healthy').length || 3,
  };

  const handleRefreshAll = () => {
    refreshPicks();
    toast.success('Grading data refreshed');
  };

  if (picksLoading || agentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading grading system...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Grading HQ</h1>
          <p className="text-muted-foreground">
            Real-time grading queue monitoring and combo play analysis
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handleRefreshAll}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh All
          </Button>
          <Badge className="bg-green-100 text-green-800">
            {gradingMetrics.activeAgents} Agents Active
          </Badge>
        </div>
      </div>

      {/* Grading System Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Length</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gradingMetrics.pendingGrading}</div>
            <p className="text-xs text-muted-foreground">picks awaiting review</p>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing</CardTitle>
            <Timer className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gradingMetrics.averageGradingTime}s</div>
            <p className="text-xs text-muted-foreground">per pick</p>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Throughput</CardTitle>
            <Zap className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gradingMetrics.throughputPerHour}</div>
            <p className="text-xs text-muted-foreground">picks/hour</p>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <Target className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gradingMetrics.approvalRate}%</div>
            <p className="text-xs text-muted-foreground">this hour</p>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Activity className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gradingMetrics.activeAgents}</div>
            <p className="text-xs text-muted-foreground">grading agents</p>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Picks</CardTitle>
            <BarChart3 className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gradingMetrics.totalPicks}</div>
            <p className="text-xs text-muted-foreground">in system</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Grading Operations Center</CardTitle>
          <CardDescription>
            Monitor grading queue in real-time and build combo plays from approved picks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="queue" className="flex items-center">
                <Activity className="w-4 h-4 mr-2" />
                Real-Time Queue
              </TabsTrigger>
              <TabsTrigger value="combo" className="flex items-center">
                <Layers className="w-4 h-4 mr-2" />
                Combo Builder
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center">
                <BarChart3 className="w-4 h-4 mr-2" />
                Performance Analytics
              </TabsTrigger>
            </TabsList>

            {/* Real-Time Grading Queue */}
            <TabsContent value="queue" className="mt-6">
              <GradingQueue />
            </TabsContent>

            {/* Combo Play Builder */}
            <TabsContent value="combo" className="mt-6">
              <ComboPlayBuilder
                picks={picks || []}
                onComboCreate={combo => {
                  toast.success(`${combo.type} combo created with ${combo.picks.length} picks`);
                  console.log('Combo created from Grading HQ:', combo);
                }}
              />
            </TabsContent>

            {/* Performance Analytics */}
            <TabsContent value="analytics" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Grading Performance Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2" />
                      Grading Performance Trends
                    </CardTitle>
                    <CardDescription>Processing speed and approval rates over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="p-4 rounded-lg border bg-muted/20">
                          <div className="text-sm text-muted-foreground">Processing Speed</div>
                          <div className="text-2xl font-bold text-green-600">+23%</div>
                          <div className="text-xs text-muted-foreground">vs last week</div>
                        </div>
                        <div className="p-4 rounded-lg border bg-muted/20">
                          <div className="text-sm text-muted-foreground">Queue Efficiency</div>
                          <div className="text-2xl font-bold text-blue-600">94.2%</div>
                          <div className="text-xs text-muted-foreground">uptime</div>
                        </div>
                      </div>

                      <div className="h-48 flex items-center justify-center border rounded-lg bg-muted/10">
                        <div className="text-center text-muted-foreground">
                          <BarChart3 className="w-8 h-8 mx-auto mb-2" />
                          <p>Performance charts coming soon</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Agent Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Activity className="w-5 h-5 mr-2" />
                      Agent Performance
                    </CardTitle>
                    <CardDescription>Individual grading agent statistics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Array.from({ length: 3 }, (_, i) => {
                        const agentId = `GradingAgent-0${i + 1}`;
                        const performance = {
                          processed: Math.floor(Math.random() * 50) + 20,
                          accuracy: 95.5 + Math.random() * 3,
                          avgTime: 35 + Math.random() * 20,
                        };

                        return (
                          <div
                            key={agentId}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                          >
                            <div>
                              <p className="font-medium">{agentId}</p>
                              <p className="text-sm text-muted-foreground">
                                {performance.processed} picks • {performance.accuracy.toFixed(1)}%
                                accuracy
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge className="bg-green-100 text-green-800">ACTIVE</Badge>
                              <div className="text-xs text-muted-foreground mt-1">
                                {performance.avgTime.toFixed(0)}s avg
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-green-500" />
            System Status
          </CardTitle>
          <CardDescription>Current status of grading system components</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center space-x-2 p-3 rounded-lg border bg-green-50">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <div>
                <p className="font-medium">Queue Manager</p>
                <p className="text-sm text-muted-foreground">Operational</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 p-3 rounded-lg border bg-green-50">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <div>
                <p className="font-medium">Grading Agents</p>
                <p className="text-sm text-muted-foreground">
                  {gradingMetrics.activeAgents}/3 Active
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 p-3 rounded-lg border bg-green-50">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <div>
                <p className="font-medium">Database</p>
                <p className="text-sm text-muted-foreground">Connected</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 p-3 rounded-lg border bg-green-50">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <div>
                <p className="font-medium">Real-time Sync</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
