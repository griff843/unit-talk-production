'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, StopCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkflowMonitoring, WorkflowInfo } from '@/lib/temporal';

const WorkflowStatusBadge: React.FC<{ status: WorkflowInfo['status'] }> = ({ status }) => {
  const statusConfig = {
    RUNNING: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-500' },
    COMPLETED: { variant: 'secondary' as const, icon: CheckCircle, color: 'text-blue-500' },
    FAILED: { variant: 'destructive' as const, icon: AlertTriangle, color: 'text-red-500' },
    CANCELED: { variant: 'secondary' as const, icon: StopCircle, color: 'text-gray-500' },
    TERMINATED: { variant: 'destructive' as const, icon: StopCircle, color: 'text-red-500' },
    TIMED_OUT: { variant: 'destructive' as const, icon: Clock, color: 'text-orange-500' },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon className={`w-3 h-3 ${config.color}`} />
      {status}
    </Badge>
  );
};

const WorkflowCard: React.FC<{ 
  workflow: WorkflowInfo; 
  onTerminate: (workflowId: string) => void;
}> = ({ workflow, onTerminate }) => {
  const formatDuration = (startTime: Date) => {
    const now = new Date();
    const diff = now.getTime() - startTime.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const isCritical = [
    'syndicate-scheduler-main',
    'live-game-detector',
    'quota-monitoring',
    'health-monitoring'
  ].includes(workflow.workflowId);

  return (
    <Card className={`${isCritical ? 'border-blue-200 bg-blue-50/50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {workflow.workflowType}
            {isCritical && (
              <Badge variant="outline" className="ml-2 text-xs">
                CRITICAL
              </Badge>
            )}
          </CardTitle>
          <WorkflowStatusBadge status={workflow.status} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 text-sm text-gray-600">
          <div>
            <span className="font-medium">ID:</span> {workflow.workflowId}
          </div>
          <div>
            <span className="font-medium">Queue:</span> {workflow.taskQueue}
          </div>
          <div>
            <span className="font-medium">Running:</span> {formatDuration(workflow.startTime)}
          </div>
          <div>
            <span className="font-medium">Started:</span> {workflow.startTime.toLocaleString()}
          </div>
          
          {workflow.status === 'RUNNING' && (
            <Button
              variant="destructive"
              size="sm"
              className="w-full mt-3"
              onClick={() => onTerminate(workflow.workflowId)}
            >
              <StopCircle className="w-3 h-3 mr-1" />
              Terminate
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const WorkflowMonitoring: React.FC = () => {
  const {
    workflows,
    summary,
    loading,
    error,
    lastUpdate,
    refreshWorkflows,
    terminateWorkflow,
  } = useWorkflowMonitoring();

  const handleTerminateWorkflow = async (workflowId: string) => {
    try {
      const success = await terminateWorkflow(workflowId, 'Terminated from Command Center');
      if (success) {
        toast.success(`Workflow ${workflowId} terminated successfully`);
      } else {
        toast.error(`Failed to terminate workflow ${workflowId}`);
      }
    } catch (error) {
      toast.error(`Error terminating workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshWorkflows();
      toast.success('Workflow status refreshed');
    } catch (error) {
      toast.error(`Failed to refresh: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Temporal Connection Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Connection
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {summary?.running || 0}
            </div>
            <p className="text-xs text-gray-500">Running Workflows</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {summary?.healthy || 0}
            </div>
            <p className="text-xs text-gray-500">Critical Healthy</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600">
              {summary?.total || 0}
            </div>
            <p className="text-xs text-gray-500">Total Workflows</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {summary?.failed || 0}
            </div>
            <p className="text-xs text-gray-500">Failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Temporal Workflows</h2>
          {lastUpdate && (
            <p className="text-sm text-gray-500">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('http://localhost:8088', '_blank')}
          >
            Open Temporal UI
          </Button>
        </div>
      </div>

      {/* Workflow Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Loading workflows...</span>
        </div>
      ) : workflows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">No workflows found</p>
            <Button onClick={handleRefresh} variant="outline" className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={`${workflow.workflowId}-${workflow.runId}`}
              workflow={workflow}
              onTerminate={handleTerminateWorkflow}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowMonitoring;