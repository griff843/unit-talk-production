'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bot,
  Play,
  Pause,
  RotateCcw,
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings,
  Terminal,
  BarChart3,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { getStatusColor, timeAgo } from '@/lib/utils';
import { useAgentMonitoring } from '@/hooks/useAgentMonitoring';
import { useAgentLogs } from '@/hooks/useAgentLogs';
import { AgentStatus } from '@/lib/agentMonitoring';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Agent descriptions mapping
const agentDescriptions = {
  AlertAgent: 'Handles real-time Discord alerts and notifications',
  GradingAgent: 'Multi-model ensemble pick grading and scoring',
  RecapAgent: 'Daily recap generation and formatting',
  FeedAgent: 'Content feed generation and optimal data ingestion',
  NotificationAgent: 'Multi-channel user notifications and delivery',
  AnalyticsAgent: 'Data analysis and performance insights',
};

// Real-time agent logs are now fetched via useAgentLogs hook

export default function AgentDashboardPage() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState(false);
  const queryClient = useQueryClient();

  // Use the real agent monitoring hook with real-time subscriptions
  const {
    statuses,
    isMonitoring,
    lastUpdate,
    connectionStatus,
    realTimeEnabled,
    refreshAgent,
    refreshAll,
    toggleRealTime,
  } = useAgentMonitoring();

  // Use real-time agent logs hook
  const {
    logs: agentLogs,
    loading: logsLoading,
    error: logsError,
    lastUpdate: logsLastUpdate,
    realTimeEnabled: logsRealTimeEnabled,
    refreshLogs,
    getLogsByAgent,
    getRecentErrors,
  } = useAgentLogs(20); // Get recent 20 logs

  // Fetch agents from database with optional live health data
  const {
    data: agentsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['agents', liveMode],
    queryFn: async () => {
      const response = await fetch(`/api/agents?metrics=true&live=${liveMode}`);
      if (!response.ok) throw new Error('Failed to fetch agents');
      return response.json();
    },
    refetchInterval: liveMode ? 10000 : 30000, // Refresh more frequently in live mode
  });

  // Agent control mutations
  const agentActionMutation = useMutation({
    mutationFn: async ({
      action,
      agentId,
      agentName,
    }: {
      action: string;
      agentId?: string;
      agentName?: string;
    }) => {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, agentId, agentName }),
      });
      if (!response.ok) throw new Error('Agent action failed');
      return response.json();
    },
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success(data.message || 'Agent action completed');
    },
    onError: (error: any) => {
      toast.error(`Agent action failed: ${error.message}`);
    },
  });

  const handleAgentAction = (action: string, agentName: string) => {
    agentActionMutation.mutate({ action, agentName });
  };

  const agents = agentsData?.data?.agents || agentsData?.data || [];
  const metrics = agentsData?.data?.metrics || null;

  // Calculate system metrics from real data
  const systemMetrics = {
    totalAgents: agents.length,
    healthyAgents: agents.filter((a: any) => a.status === 'healthy').length,
    warningAgents: agents.filter((a: any) => a.status === 'warning').length,
    errorAgents: agents.filter((a: any) => a.status === 'error').length,
    inactiveAgents: agents.filter((a: any) => a.status === 'inactive').length,
    avgResponseTime:
      agents.length > 0
        ? Math.round(
            agents.reduce((sum: number, agent: any) => sum + (agent.avg_response_time || 0), 0) /
              agents.length
          )
        : 0,
    totalOperations: agents.reduce(
      (sum: number, agent: any) => sum + (agent.total_operations || 0),
      0
    ),
  };

  const systemHealthPercentage =
    agents.length > 0
      ? Math.round((systemMetrics.healthyAgents / systemMetrics.totalAgents) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agent Control Center</h1>
          <p className="text-muted-foreground">
            Real-time agent monitoring, control, and health checking
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleRealTime}
            className={
              realTimeEnabled && connectionStatus === 'connected'
                ? 'border-green-500 text-green-600'
                : connectionStatus === 'error'
                  ? 'border-red-500 text-red-600'
                  : ''
            }
            data-testid="websocket-status"
          >
            {realTimeEnabled && connectionStatus === 'connected' ? (
              <Wifi className="w-4 h-4 mr-2" />
            ) : (
              <WifiOff className="w-4 h-4 mr-2" />
            )}
            {realTimeEnabled && connectionStatus === 'connected'
              ? 'Real-Time Connected'
              : connectionStatus === 'error'
                ? 'Connection Error'
                : realTimeEnabled
                  ? 'Connecting...'
                  : 'Polling Mode'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refreshAll();
              queryClient.invalidateQueries({ queryKey: ['agents'] });
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Badge
            variant="outline"
            className={
              systemHealthPercentage >= 80
                ? getStatusColor('healthy')
                : systemHealthPercentage >= 60
                  ? getStatusColor('warning')
                  : getStatusColor('error')
            }
          >
            {systemHealthPercentage >= 80 ? (
              <CheckCircle className="w-3 h-3 mr-1" />
            ) : (
              <AlertTriangle className="w-3 h-3 mr-1" />
            )}
            {systemHealthPercentage}% Healthy
          </Badge>
          {lastUpdate && (
            <Badge variant="outline" className="text-xs">
              Updated {timeAgo(lastUpdate)}
            </Badge>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Loading agent data...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <XCircle className="w-5 h-5" />
              <span>Failed to load agent data: {error.message}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="metric-card" data-testid="stat-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemMetrics.totalAgents}</div>
            <div className="text-xs text-muted-foreground">
              {systemMetrics.healthyAgents} healthy, {systemMetrics.warningAgents} warning,{' '}
              {systemMetrics.errorAgents} error, {systemMetrics.inactiveAgents} inactive
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card" data-testid="stat-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Operations</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemMetrics.totalOperations.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Across all agents</div>
          </CardContent>
        </Card>

        <Card className="metric-card" data-testid="stat-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemMetrics.avgResponseTime}ms</div>
            <div className="text-xs text-muted-foreground">System-wide average</div>
          </CardContent>
        </Card>

        <Card className="metric-card" data-testid="stat-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemHealthPercentage}%</div>
            <div className="text-xs text-muted-foreground">
              {realTimeEnabled && connectionStatus === 'connected'
                ? 'Real-time monitoring'
                : connectionStatus === 'error'
                  ? 'Polling fallback'
                  : 'Database status'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent: any) => (
          <Card
            key={agent.id || agent.name}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedAgent === agent.name ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedAgent(selectedAgent === agent.name ? null : agent.name)}
            data-testid="agent-card"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg agent-name">{agent.name}</CardTitle>
                <div className="flex items-center space-x-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      agent.status === 'healthy'
                        ? 'bg-green-500'
                        : agent.status === 'warning'
                          ? 'bg-yellow-500'
                          : agent.status === 'error'
                            ? 'bg-red-500'
                            : 'bg-gray-500'
                    }`}
                  />
                  <Badge
                    variant="outline"
                    className={`${getStatusColor(agent.status)} agent-status`}
                  >
                    {agent.status}
                  </Badge>
                  {liveMode && agent.liveHealth && (
                    <Badge variant="outline" className="text-xs bg-blue-50">
                      LIVE
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription className="text-sm">
                {agentDescriptions[agent.name as keyof typeof agentDescriptions] ||
                  'Agent description not available'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Success Rate</p>
                    <p className="font-mono font-medium">{agent.success_rate || 0}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Operations</p>
                    <p className="font-mono font-medium">
                      {(agent.total_operations || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Response Time</p>
                    <p className="font-mono font-medium">{agent.avg_response_time || 0}ms</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <p className="font-mono font-medium capitalize">{agent.type || 'Unknown'}</p>
                  </div>
                </div>

                {/* Live Health Data */}
                {liveMode && agent.liveHealth && (
                  <div className="bg-blue-50 p-2 rounded text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Memory:</span>
                      <span className="font-mono">{agent.liveHealth.memory || 0}MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CPU:</span>
                      <span className="font-mono">{agent.liveHealth.cpu || 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Uptime:</span>
                      <span className="font-mono">
                        {Math.round((agent.liveHealth.uptime || 0) / 3600)}h
                      </span>
                    </div>
                  </div>
                )}

                {/* Last Run */}
                <div>
                  <p className="text-muted-foreground text-sm">Last run</p>
                  <p className="font-medium">
                    {agent.last_run ? timeAgo(new Date(agent.last_run)) : 'Never'}
                  </p>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={e => {
                        e.stopPropagation();
                        handleAgentAction('start', agent.name);
                      }}
                      disabled={agentActionMutation.isPending}
                    >
                      <Play className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={e => {
                        e.stopPropagation();
                        handleAgentAction('stop', agent.name);
                      }}
                      disabled={agentActionMutation.isPending}
                    >
                      <Pause className="h-4 w-4 text-yellow-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={e => {
                        e.stopPropagation();
                        handleAgentAction('restart', agent.name);
                      }}
                      disabled={agentActionMutation.isPending}
                    >
                      <RotateCcw className="h-4 w-4 text-blue-600" />
                    </Button>
                    {liveMode && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={e => {
                          e.stopPropagation();
                          refreshAgent(agent.name);
                        }}
                      >
                        <RefreshCw className="h-4 w-4 text-purple-600" />
                      </Button>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Terminal className="h-5 w-5" />
              <span>Live Agent Logs</span>
            </div>
            <div className="flex items-center space-x-2">
              {logsLastUpdate && (
                <Badge variant="outline" className="text-xs">
                  Updated {timeAgo(logsLastUpdate)}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={refreshLogs} disabled={logsLoading}>
                <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
              </Button>
              {logsRealTimeEnabled ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </CardTitle>
          <CardDescription>
            Real-time log streaming from all agents {logsRealTimeEnabled ? '(Live)' : '(Cached)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Loading State */}
          {logsLoading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              <span>Loading agent logs...</span>
            </div>
          )}

          {/* Error State */}
          {logsError && (
            <div className="flex items-center space-x-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-600 mb-4">
              <AlertTriangle className="w-5 h-5" />
              <span>Failed to load logs: {logsError.message}</span>
            </div>
          )}

          {/* Logs Display */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {agentLogs.length > 0 ? (
              agentLogs.map((log, index) => (
                <div
                  key={log.id || index}
                  className="flex items-start space-x-3 p-3 rounded-lg border bg-muted/20 font-mono text-sm"
                >
                  <div
                    className={`h-2 w-2 rounded-full mt-2 flex-shrink-0 ${
                      log.level === 'info'
                        ? 'bg-blue-500'
                        : log.level === 'warn'
                          ? 'bg-yellow-500'
                          : log.level === 'error'
                            ? 'bg-red-500'
                            : 'bg-gray-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-muted-foreground text-xs">
                        {timeAgo(log.timestamp)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {log.agent}
                      </Badge>
                      <Badge
                        variant={log.level === 'error' ? 'destructive' : 'outline'}
                        className="text-xs"
                      >
                        {log.level.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-foreground text-sm">{log.message}</p>
                    {log.correlationId && (
                      <p className="text-muted-foreground text-xs mt-1">ID: {log.correlationId}</p>
                    )}
                  </div>
                </div>
              ))
            ) : !logsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No agent logs available</p>
                <p className="text-xs mt-1">Logs will appear here as agents run</p>
              </div>
            ) : null}
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Total Logs: {agentLogs.length}</span>
              <span>
                Errors: {agentLogs.filter(log => log.level === 'error').length} | Warnings:{' '}
                {agentLogs.filter(log => log.level === 'warn').length}
              </span>
            </div>
            <Button variant="outline" size="sm" className="w-full">
              View Full Log History
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
