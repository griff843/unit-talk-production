/* eslint-disable max-lines, max-lines-per-function, complexity */
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Wrench,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Zap,
  FileText,
  History,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

type PlaybookId =
  | 'MV_REFRESH_LAG'
  | 'PIPELINE_LAG_THROTTLE'
  | 'CREDIT_BURN_THROTTLE'
  | 'DISCORD_BACKLOG_NUDGE'
  | 'SLO_EVALUATOR_STUCK';

type ExecutionType = 'EXECUTABLE' | 'RECOMMENDATION_ONLY';
type ExecutionStatus = 'pending' | 'approved' | 'executed' | 'failed' | 'skipped' | 'rollback';

interface PlaybookDefinition {
  playbook_id: PlaybookId;
  name: string;
  description: string;
  execution_type: ExecutionType;
  required_knobs: string[];
  cooldown_seconds: number;
  max_per_hour: number;
  status: 'active' | 'disabled' | 'deprecated';
  version: number;
}

interface ExecutionRecord {
  execution_id: string;
  playbook_id: PlaybookId;
  incident_id: string;
  correlation_id: string;
  status: ExecutionStatus;
  execution_type: ExecutionType;
  triggered_by: string;
  dry_run: boolean;
  actions_taken: unknown[];
  recommendations?: string[];
  error_message?: string;
  approved_by?: string;
  duration_ms?: number;
  created_at: string;
}

interface RemediationStats {
  total_executions: number;
  successful: number;
  failed: number;
  pending_approval: number;
  recommendations_given: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusBadge(status: ExecutionStatus) {
  switch (status) {
    case 'executed':
      return <Badge className="bg-green-500">Executed</Badge>;
    case 'failed':
      return <Badge className="bg-red-500">Failed</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-500">Pending</Badge>;
    case 'approved':
      return <Badge className="bg-blue-500">Approved</Badge>;
    case 'skipped':
      return <Badge className="bg-gray-500">Skipped</Badge>;
    case 'rollback':
      return <Badge className="bg-purple-500">Rollback</Badge>;
    default:
      return <Badge className="bg-gray-500">{status}</Badge>;
  }
}

function getExecutionTypeBadge(type: ExecutionType) {
  if (type === 'EXECUTABLE') {
    return <Badge className="bg-blue-600"><Zap className="w-3 h-3 mr-1" />Executable</Badge>;
  }
  return <Badge className="bg-orange-500"><FileText className="w-3 h-3 mr-1" />Recommendation</Badge>;
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ============================================================================
// Main Component
// ============================================================================

export default function RemediationDashboardPage() {
  const [selectedPlaybook, setSelectedPlaybook] = useState<PlaybookId | null>(null);
  const queryClient = useQueryClient();

  // Fetch dashboard data
  const {
    data: dashboardData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['remediation-dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/admin/remediation?view=dashboard');
      if (!response.ok) throw new Error('Failed to fetch remediation data');
      const json = await response.json();
      return json.data;
    },
    refetchInterval: 30000,
  });

  // Trigger playbook mutation
  const triggerMutation = useMutation({
    mutationFn: async ({
      playbookId,
      incidentId,
      dryRun = true,
    }: {
      playbookId: PlaybookId;
      incidentId: string;
      dryRun?: boolean;
    }) => {
      const response = await fetch('/api/admin/remediation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trigger',
          playbook_id: playbookId,
          incident_id: incidentId,
          dry_run: dryRun,
        }),
      });
      if (!response.ok) throw new Error('Failed to trigger playbook');
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Playbook triggered successfully');
      queryClient.invalidateQueries({ queryKey: ['remediation-dashboard'] });
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (executionId: string) => {
      const response = await fetch('/api/admin/remediation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          execution_id: executionId,
        }),
      });
      if (!response.ok) throw new Error('Failed to approve remediation');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Remediation approved');
      queryClient.invalidateQueries({ queryKey: ['remediation-dashboard'] });
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  // Toggle playbook status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({
      playbookId,
      status,
    }: {
      playbookId: PlaybookId;
      status: 'active' | 'disabled';
    }) => {
      const response = await fetch('/api/admin/remediation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playbook_id: playbookId,
          status,
        }),
      });
      if (!response.ok) throw new Error('Failed to update playbook');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Playbook status updated');
      queryClient.invalidateQueries({ queryKey: ['remediation-dashboard'] });
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const playbooks = dashboardData?.playbooks as PlaybookDefinition[] || [];
  const executions = dashboardData?.executions as ExecutionRecord[] || [];
  const pending = dashboardData?.pending as ExecutionRecord[] || [];
  const stats = dashboardData?.stats as RemediationStats || {
    total_executions: 0,
    successful: 0,
    failed: 0,
    pending_approval: 0,
    recommendations_given: 0,
  };
  const config = dashboardData?.config || { enabled: false, dry_run_only: true };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle className="text-red-500">Error Loading Remediation Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{(error as Error).message}</p>
            <Button onClick={() => refetch()} className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wrench className="w-8 h-8" />
            Auto-Remediation Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            PR8: Auto-Remediation Playbooks - Manage and monitor automated incident response
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={config.enabled ? 'bg-green-500' : 'bg-gray-500'}>
            {config.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
          <Badge className={config.dry_run_only ? 'bg-yellow-500' : 'bg-red-500'}>
            {config.dry_run_only ? 'DRY RUN ONLY' : 'LIVE MODE'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Executions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_executions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Successful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.successful}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats.pending_approval}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.recommendations_given}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="playbooks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="playbooks">
            <Wrench className="w-4 h-4 mr-2" />
            Playbooks
          </TabsTrigger>
          <TabsTrigger value="pending">
            <Clock className="w-4 h-4 mr-2" />
            Pending ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            Execution History
          </TabsTrigger>
        </TabsList>

        {/* Playbooks Tab */}
        <TabsContent value="playbooks" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playbooks.map((playbook) => (
              <Card
                key={playbook.playbook_id}
                className={`cursor-pointer transition-all ${
                  selectedPlaybook === playbook.playbook_id ? 'ring-2 ring-blue-500' : ''
                } ${playbook.status === 'disabled' ? 'opacity-60' : ''}`}
                onClick={() => setSelectedPlaybook(
                  selectedPlaybook === playbook.playbook_id ? null : playbook.playbook_id
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{playbook.name}</CardTitle>
                    <Badge className={playbook.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}>
                      {playbook.status}
                    </Badge>
                  </div>
                  <CardDescription>{playbook.playbook_id}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{playbook.description}</p>

                  <div className="flex items-center gap-2">
                    {getExecutionTypeBadge(playbook.execution_type)}
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Required Knobs: {playbook.required_knobs.join(', ')}</div>
                    <div>Cooldown: {playbook.cooldown_seconds}s | Max/hour: {playbook.max_per_hour}</div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerMutation.mutate({
                          playbookId: playbook.playbook_id,
                          incidentId: `manual-${Date.now()}`,
                          dryRun: true,
                        });
                      }}
                      disabled={playbook.status === 'disabled' || triggerMutation.isPending}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Test (Dry Run)
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStatusMutation.mutate({
                          playbookId: playbook.playbook_id,
                          status: playbook.status === 'active' ? 'disabled' : 'active',
                        });
                      }}
                      disabled={toggleStatusMutation.isPending}
                    >
                      {playbook.status === 'active' ? (
                        <ToggleRight className="w-4 h-4" />
                      ) : (
                        <ToggleLeft className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Pending Approvals Tab */}
        <TabsContent value="pending" className="space-y-4">
          {pending.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                <p>No pending approvals</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pending.map((execution) => (
                <Card key={execution.execution_id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{execution.playbook_id}</CardTitle>
                        <CardDescription>
                          Incident: {execution.incident_id} | {timeAgo(execution.created_at)}
                        </CardDescription>
                      </div>
                      {getStatusBadge(execution.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <Badge className={execution.dry_run ? 'bg-yellow-500' : 'bg-red-500'}>
                        {execution.dry_run ? 'DRY RUN' : 'LIVE'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Triggered by: {execution.triggered_by}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <Button
                        onClick={() => approveMutation.mutate(execution.execution_id)}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve & Execute
                      </Button>
                      <Button variant="outline">
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Execution History Tab */}
        <TabsContent value="history" className="space-y-4">
          {executions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-4" />
                <p>No execution history</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {executions.map((execution) => (
                <Card key={execution.execution_id} className="hover:bg-accent/50 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="font-medium">{execution.playbook_id}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {execution.incident_id}
                          </span>
                        </div>
                        {getStatusBadge(execution.status)}
                        {getExecutionTypeBadge(execution.execution_type)}
                        {execution.dry_run && (
                          <Badge variant="outline">DRY RUN</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {timeAgo(execution.created_at)}
                        {execution.duration_ms && (
                          <span className="ml-2">({execution.duration_ms}ms)</span>
                        )}
                      </div>
                    </div>
                    {execution.error_message && (
                      <div className="mt-2 text-sm text-red-500">
                        Error: {execution.error_message}
                      </div>
                    )}
                    {execution.recommendations && execution.recommendations.length > 0 && (
                      <div className="mt-2 text-sm bg-blue-50 dark:bg-blue-950 p-2 rounded">
                        <strong>Recommendations:</strong>
                        <pre className="text-xs whitespace-pre-wrap mt-1">
                          {execution.recommendations.slice(0, 5).join('\n')}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Feature Flag Warning */}
      {!config.enabled && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <AlertTriangle className="w-5 h-5" />
              <span>
                Auto-remediation is currently <strong>disabled</strong>.
                Set <code className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">REMEDIATION_ENABLED=true</code> to enable.
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
