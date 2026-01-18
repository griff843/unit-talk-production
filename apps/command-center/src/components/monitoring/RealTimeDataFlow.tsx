'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Database,
  Bot,
  Target,
  FileCheck,
  Clock,
  Zap,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Play,
  Pause,
  ArrowRight,
  Eye,
  Users,
  FileText,
  Settings,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface DataFlowMetrics {
  feedIngestion: {
    propsReceived: number;
    propsProcessed: number;
    propsFailed: number;
    lastRun: string;
    processingRate: number;
    sources: string[];
  };
  gradingResults: {
    totalGraded: number;
    tierA: number;
    tierB: number;
    tierC: number;
    pending: number;
    avgGradingTime: number;
    successRate: number;
  };
  approvalQueue: {
    awaitingApproval: number;
    approved: number;
    rejected: number;
    avgApprovalTime: number;
    highPriority: number;
  };
  formSubmissions: {
    totalSubmissions: number;
    validated: number;
    processing: number;
    errors: number;
    lastSubmission: string;
    submissionRate: number;
  };
  agentActivity: {
    feedAgent: { status: string; lastRun: string; opsCount: number };
    gradingAgent: { status: string; lastRun: string; opsCount: number };
    alertAgent: { status: string; lastRun: string; opsCount: number };
    recapAgent: { status: string; lastRun: string; opsCount: number };
    operatorAgent: { status: string; lastRun: string; opsCount: number };
    analyticsAgent: { status: string; lastRun: string; opsCount: number };
    professionalProcessor: { status: string; lastRun: string; opsCount: number };
  };
}

interface RealTimeDataFlowProps {
  className?: string;
}

// Helper function to transform agent health data to expected format
function transformAgentHealth(
  agent: any
): { status: string; lastRun: string; opsCount: number } | null {
  if (!agent) return null;

  return {
    status: String(agent.status || 'unknown'),
    lastRun: String(agent.last_updated || agent.created_at || new Date().toISOString()),
    opsCount: Number(agent.total_operations || 0),
  };
}

export function RealTimeDataFlow({ className }: RealTimeDataFlowProps) {
  const [metrics, setMetrics] = useState<DataFlowMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [dataSource, setDataSource] = useState<'real' | 'unknown'>('unknown');

  const fetchRealTimeMetrics = async () => {
    try {
      setLoading(true);

      if (!supabase) {
        console.error('Supabase client not available');
        setDataSource('unknown');
        setMetrics(null);
        toast.error('Database connection unavailable');
        return;
      }

      // Fetch raw_props for feed ingestion data (last 24 hours)
      const { data: rawProps, error: rawPropsError } = await supabase
        .from('raw_props')
        .select('id, status, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (rawPropsError) {
        console.error('Error fetching raw_props:', rawPropsError);
      }

      // Fetch unified_picks for grading and approval data (last 24 hours)
      const { data: picks, error: picksError } = await supabase
        .from('unified_picks')
        .select('id, grade, tier, status, workflow_stage, priority, created_at, updated_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (picksError) {
        console.error('Error fetching unified_picks:', picksError);
      }

      // Fetch agent_health for agent status
      const { data: agentHealth, error: agentError } = await supabase
        .from('agent_health')
        .select('agent_name, status, last_heartbeat, created_at, total_operations')
        .order('last_heartbeat', { ascending: false })
        .limit(20);

      if (agentError) {
        console.error('Error fetching agent_health:', agentError);
      }

      // Calculate processing rate if we have enough data
      let processingRate: number | null = null;
      if (rawProps && rawProps.length > 1) {
        const sortedProps = [...rawProps].sort(
          (a, b) =>
            new Date(String(a.created_at || 0)).getTime() -
            new Date(String(b.created_at || 0)).getTime()
        );
        const firstTime = new Date(String(sortedProps[0]?.created_at || 0)).getTime();
        const lastTime = new Date(
          String(sortedProps[sortedProps.length - 1]?.created_at || 0)
        ).getTime();
        const minutesElapsed = Math.max(1, (lastTime - firstTime) / (1000 * 60));
        processingRate = rawProps.length / minutesElapsed;
      }

      // Calculate grading metrics from picks with timestamps
      let avgGradingTime: number | null = null;
      let successRate: number | null = null;
      if (picks && picks.length > 0) {
        const gradedPicks = picks.filter(
          p => p.grade && p.created_at && p.updated_at
        );
        if (gradedPicks.length > 0) {
          const gradingTimes = gradedPicks.map(
            p =>
              (new Date(String(p.updated_at || 0)).getTime() -
                new Date(String(p.created_at || 0)).getTime()) /
              1000
          );
          avgGradingTime =
            gradingTimes.reduce((sum, time) => sum + time, 0) / gradingTimes.length;

          const successfulGrades = gradedPicks.filter(p => p.grade !== 'failed' && p.grade !== 'error').length;
          successRate = (successfulGrades / gradedPicks.length) * 100;
        }
      }

      // Calculate approval metrics
      let avgApprovalTime: number | null = null;
      if (picks && picks.length > 0) {
        const approvedPicks = picks.filter(
          p => p.status === 'approved' && p.created_at && p.updated_at
        );
        if (approvedPicks.length > 0) {
          const approvalTimes = approvedPicks.map(
            p =>
              (new Date(String(p.updated_at || 0)).getTime() -
                new Date(String(p.created_at || 0)).getTime()) /
              (1000 * 60)
          );
          avgApprovalTime =
            approvalTimes.reduce((sum, time) => sum + time, 0) / approvalTimes.length;
        }
      }

      // Build metrics from real data only
      const realMetrics: DataFlowMetrics = {
        feedIngestion: {
          propsReceived: rawProps?.length || 0,
          propsProcessed: rawProps?.filter(p => p.status === 'processed').length || 0,
          propsFailed: rawProps?.filter(p => p.status === 'failed').length || 0,
          lastRun: rawProps?.[0]?.created_at
            ? String(rawProps[0].created_at)
            : new Date(0).toISOString(),
          processingRate: processingRate || 0,
          sources: ['Optimal Sports', 'DraftKings', 'FanDuel', 'Caesars'], // TODO: Get from config
        },
        gradingResults: {
          totalGraded: picks?.filter(p => p.grade).length || 0,
          tierA: picks?.filter(p => p.tier === 'A').length || 0,
          tierB: picks?.filter(p => p.tier === 'B').length || 0,
          tierC: picks?.filter(p => p.tier === 'C').length || 0,
          pending: picks?.filter(p => !p.grade || p.workflow_stage === 'pending_review').length || 0,
          avgGradingTime: avgGradingTime || 0,
          successRate: successRate || 0,
        },
        approvalQueue: {
          awaitingApproval:
            picks?.filter(p => p.status === 'pending_approval' || p.workflow_stage === 'pending_review').length || 0,
          approved: picks?.filter(p => p.status === 'approved').length || 0,
          rejected: picks?.filter(p => p.status === 'rejected').length || 0,
          avgApprovalTime: avgApprovalTime || 0,
          highPriority: picks?.filter(p => p.priority === 'high').length || 0,
        },
        formSubmissions: {
          totalSubmissions: 0, // NO DATA - smart form submissions not tracked in database
          validated: 0,
          processing: 0,
          errors: 0,
          lastSubmission: new Date(0).toISOString(),
          submissionRate: 0,
        },
        agentActivity: {
          feedAgent:
            transformAgentHealth(agentHealth?.find(a => a.agent_name === 'FeedAgent')) || {
              status: 'unknown',
              lastRun: new Date(0).toISOString(),
              opsCount: 0,
            },
          gradingAgent:
            transformAgentHealth(agentHealth?.find(a => a.agent_name === 'GradingAgent')) || {
              status: 'unknown',
              lastRun: new Date(0).toISOString(),
              opsCount: 0,
            },
          alertAgent:
            transformAgentHealth(agentHealth?.find(a => a.agent_name === 'AlertAgent')) || {
              status: 'unknown',
              lastRun: new Date(0).toISOString(),
              opsCount: 0,
            },
          recapAgent:
            transformAgentHealth(agentHealth?.find(a => a.agent_name === 'RecapAgent')) || {
              status: 'unknown',
              lastRun: new Date(0).toISOString(),
              opsCount: 0,
            },
          operatorAgent:
            transformAgentHealth(agentHealth?.find(a => a.agent_name === 'OperatorAgent')) || {
              status: 'unknown',
              lastRun: new Date(0).toISOString(),
              opsCount: 0,
            },
          analyticsAgent:
            transformAgentHealth(agentHealth?.find(a => a.agent_name === 'AnalyticsAgent')) || {
              status: 'unknown',
              lastRun: new Date(0).toISOString(),
              opsCount: 0,
            },
          professionalProcessor:
            transformAgentHealth(
              agentHealth?.find(a => a.agent_name === 'ProfessionalPropProcessor')
            ) || {
              status: 'unknown',
              lastRun: new Date(0).toISOString(),
              opsCount: 0,
            },
        },
      };

      setMetrics(realMetrics);
      setDataSource('real');
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch real-time metrics:', error);
      setDataSource('unknown');
      setMetrics(null);
      toast.error(`Failed to load metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealTimeMetrics();

    // Set up real-time subscriptions
    if (supabase) {
      const rawPropsSubscription = supabase
        .channel('raw_props_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'raw_props' }, () => {
          fetchRealTimeMetrics();
        })
        .subscribe();

      const picksSubscription = supabase
        .channel('picks_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'unified_picks' }, () => {
          fetchRealTimeMetrics();
        })
        .subscribe();

      const agentHealthSubscription = supabase
        .channel('agent_health_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_health' }, () => {
          fetchRealTimeMetrics();
        })
        .subscribe();

      return () => {
        rawPropsSubscription.unsubscribe();
        picksSubscription.unsubscribe();
        agentHealthSubscription.unsubscribe();
      };
    }
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchRealTimeMetrics, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'idle':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'idle':
        return <Clock className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading real-time data...</span>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64 text-red-400">
          <AlertCircle className="w-8 h-8 mr-2" />
          <span>Failed to load real-time metrics</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Real-Time Data Flow Monitor
            </div>
            <div className="flex items-center space-x-2">
              <Badge
                className={
                  dataSource === 'real'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }
              >
                {dataSource === 'real' ? '✓ REAL DATA' : '? UNKNOWN'}
              </Badge>
              <Badge className="bg-blue-100 text-blue-800">
                Updated {lastUpdate.toLocaleTimeString()}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => setAutoRefresh(!autoRefresh)}>
                {autoRefresh ? (
                  <Pause className="w-4 h-4 mr-2" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                {autoRefresh ? 'Pause' : 'Resume'}
              </Button>
              <Button variant="outline" size="sm" onClick={fetchRealTimeMetrics}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Live tracking of data ingestion, processing, grading, and approval workflows
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Feed Ingestion Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="w-5 h-5 mr-2" />
            FeedAgent Props Ingestion
          </CardTitle>
          <CardDescription>
            Real-time tracking of props received from external sources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-lg border bg-blue-50">
              <div className="flex items-center justify-between">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <Badge className="bg-blue-100 text-blue-800">
                  +{metrics.feedIngestion.processingRate}/min
                </Badge>
              </div>
              <div className="text-2xl font-bold text-blue-900 mt-2">
                {metrics.feedIngestion.propsReceived.toLocaleString()}
              </div>
              <div className="text-sm text-blue-700">Props Received Today</div>
            </div>

            <div className="p-4 rounded-lg border bg-green-50">
              <div className="flex items-center justify-between">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <Badge className="bg-green-100 text-green-800">
                  {Math.round(
                    (metrics.feedIngestion.propsProcessed / metrics.feedIngestion.propsReceived) *
                      100
                  )}
                  %
                </Badge>
              </div>
              <div className="text-2xl font-bold text-green-900 mt-2">
                {metrics.feedIngestion.propsProcessed.toLocaleString()}
              </div>
              <div className="text-sm text-green-700">Successfully Processed</div>
            </div>

            <div className="p-4 rounded-lg border bg-red-50">
              <div className="flex items-center justify-between">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <Badge className="bg-red-100 text-red-800">
                  {Math.round(
                    (metrics.feedIngestion.propsFailed / metrics.feedIngestion.propsReceived) * 100
                  )}
                  %
                </Badge>
              </div>
              <div className="text-2xl font-bold text-red-900 mt-2">
                {metrics.feedIngestion.propsFailed}
              </div>
              <div className="text-sm text-red-700">Processing Failures</div>
            </div>

            <div className="p-4 rounded-lg border bg-purple-50">
              <div className="flex items-center justify-between">
                <Clock className="w-5 h-5 text-purple-600" />
                <Badge className="bg-purple-100 text-purple-800">Live</Badge>
              </div>
              <div className="text-sm font-bold text-purple-900 mt-2">
                {new Date(metrics.feedIngestion.lastRun).toLocaleTimeString()}
              </div>
              <div className="text-sm text-purple-700">Last FeedAgent Run</div>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Data Sources</h4>
            <div className="flex flex-wrap gap-2">
              {metrics.feedIngestion.sources.map(source => (
                <Badge key={source} variant="outline" className="bg-muted/50">
                  {source}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grading Results Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Grading Results & Performance
          </CardTitle>
          <CardDescription>AI grading results and tier distribution analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="p-4 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                <Badge className="bg-blue-100 text-blue-800">Total</Badge>
              </div>
              <div className="text-2xl font-bold mt-2">{metrics.gradingResults.totalGraded}</div>
              <div className="text-sm text-muted-foreground">Graded Today</div>
            </div>

            <div className="p-4 rounded-lg border bg-green-50">
              <div className="flex items-center justify-between">
                <Target className="w-5 h-5 text-green-600" />
                <Badge className="bg-green-100 text-green-800">Tier A</Badge>
              </div>
              <div className="text-2xl font-bold text-green-900 mt-2">
                {metrics.gradingResults.tierA}
              </div>
              <div className="text-sm text-green-700">Premium Picks</div>
            </div>

            <div className="p-4 rounded-lg border bg-blue-50">
              <div className="flex items-center justify-between">
                <Target className="w-5 h-5 text-blue-600" />
                <Badge className="bg-blue-100 text-blue-800">Tier B</Badge>
              </div>
              <div className="text-2xl font-bold text-blue-900 mt-2">
                {metrics.gradingResults.tierB}
              </div>
              <div className="text-sm text-blue-700">Quality Picks</div>
            </div>

            <div className="p-4 rounded-lg border bg-gray-50">
              <div className="flex items-center justify-between">
                <Target className="w-5 h-5 text-gray-600" />
                <Badge className="bg-gray-100 text-gray-800">Tier C</Badge>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {metrics.gradingResults.tierC}
              </div>
              <div className="text-sm text-gray-700">Standard Picks</div>
            </div>

            <div className="p-4 rounded-lg border bg-yellow-50">
              <div className="flex items-center justify-between">
                <Clock className="w-5 h-5 text-yellow-600" />
                <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
              </div>
              <div className="text-2xl font-bold text-yellow-900 mt-2">
                {metrics.gradingResults.pending}
              </div>
              <div className="text-sm text-yellow-700">Awaiting Grade</div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="text-sm text-muted-foreground">Average Grading Time</div>
              <div className="text-lg font-bold">{metrics.gradingResults.avgGradingTime}s</div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="text-sm text-muted-foreground">Success Rate</div>
              <div className="text-lg font-bold text-green-600">
                {metrics.gradingResults.successRate}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approval Queue Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileCheck className="w-5 h-5 mr-2" />
            Approval Queue Status
          </CardTitle>
          <CardDescription>Picks awaiting human review and approval workflow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="p-4 rounded-lg border bg-orange-50">
              <div className="flex items-center justify-between">
                <Clock className="w-5 h-5 text-orange-600" />
                <Badge className="bg-orange-100 text-orange-800">Queue</Badge>
              </div>
              <div className="text-2xl font-bold text-orange-900 mt-2">
                {metrics.approvalQueue.awaitingApproval}
              </div>
              <div className="text-sm text-orange-700">Awaiting Approval</div>
            </div>

            <div className="p-4 rounded-lg border bg-red-50">
              <div className="flex items-center justify-between">
                <Zap className="w-5 h-5 text-red-600" />
                <Badge className="bg-red-100 text-red-800">Priority</Badge>
              </div>
              <div className="text-2xl font-bold text-red-900 mt-2">
                {metrics.approvalQueue.highPriority}
              </div>
              <div className="text-sm text-red-700">High Priority</div>
            </div>

            <div className="p-4 rounded-lg border bg-green-50">
              <div className="flex items-center justify-between">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <Badge className="bg-green-100 text-green-800">Approved</Badge>
              </div>
              <div className="text-2xl font-bold text-green-900 mt-2">
                {metrics.approvalQueue.approved}
              </div>
              <div className="text-sm text-green-700">Approved Today</div>
            </div>

            <div className="p-4 rounded-lg border bg-red-50">
              <div className="flex items-center justify-between">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <Badge className="bg-red-100 text-red-800">Rejected</Badge>
              </div>
              <div className="text-2xl font-bold text-red-900 mt-2">
                {metrics.approvalQueue.rejected}
              </div>
              <div className="text-sm text-red-700">Rejected Today</div>
            </div>

            <div className="p-4 rounded-lg border bg-blue-50">
              <div className="flex items-center justify-between">
                <Clock className="w-5 h-5 text-blue-600" />
                <Badge className="bg-blue-100 text-blue-800">Time</Badge>
              </div>
              <div className="text-lg font-bold text-blue-900 mt-2">
                {metrics.approvalQueue.avgApprovalTime}min
              </div>
              <div className="text-sm text-blue-700">Avg Approval Time</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Smart Form Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Smart Form Submissions
          </CardTitle>
          <CardDescription>Form submission tracking and validation status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-center">
            <div>
              <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p className="text-lg font-semibold text-gray-600">NO DATA AVAILABLE</p>
              <p className="text-sm text-gray-500 mt-1">
                Smart form submissions are not tracked in the database
              </p>
              <Badge className="mt-2 bg-gray-100 text-gray-800">Feature Not Implemented</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Activity Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bot className="w-5 h-5 mr-2" />
            Live Agent Activity Monitor
          </CardTitle>
          <CardDescription>
            Real-time status and operation counts for all system agents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(metrics.agentActivity).map(([agentKey, agent]) => (
              <div key={agentKey} className="p-4 rounded-lg border bg-card/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Bot className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium capitalize">
                      {agentKey.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </div>
                  <Badge className={getStatusColor(agent.status)}>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(agent.status)}
                      <span>{agent.status}</span>
                    </div>
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Operations Today:</span>
                    <span className="font-mono font-medium">{agent.opsCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Last Activity:</span>
                    <span className="font-mono text-xs">
                      {new Date(agent.lastRun).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
