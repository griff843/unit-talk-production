'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  RotateCcw, 
  Rewind,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ArrowLeft,
  History,
  ExternalLink,
  Shield,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

interface ReplayHistory {
  id: string;
  timestamp: string;
  actor: string;
  target: string;
  details: any;
}

interface RollbackHistory {
  id: string;
  timestamp: string;
  actor: string;
  target: string;
  details: any;
}

interface SystemStatus {
  safe_mode: boolean;
  system_freeze: boolean;
  replay_enabled: boolean;
  can_rollback_staging: boolean;
  can_rollback_prod: boolean;
}

const ReplayPanel = () => {
  const [replayType, setReplayType] = useState<'single' | 'bulk'>('single');
  const [workflowId, setWorkflowId] = useState('');
  const [failedSinceMinutes, setFailedSinceMinutes] = useState(10);
  const [reason, setReason] = useState('');
  const [replaying, setReplaying] = useState(false);
  const [replayHistory, setReplayHistory] = useState<ReplayHistory[]>([]);
  const { toast } = useToast();

  const fetchReplayStatus = async () => {
    try {
      const response = await fetch('/api/ops/replay');
      if (response.ok) {
        const data = await response.json();
        setReplayHistory(data.recent_replays || []);
      }
    } catch (error) {
      console.error('Error fetching replay status:', error);
    }
  };

  const handleReplay = async () => {
    if (replayType === 'single' && !workflowId.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a workflow ID',
        variant: 'destructive',
      });
      return;
    }

    if (replayType === 'bulk' && failedSinceMinutes < 1) {
      toast({
        title: 'Error',
        description: 'Please enter a valid time range',
        variant: 'destructive',
      });
      return;
    }

    setReplaying(true);
    try {
      const body: any = { reason };
      
      if (replayType === 'single') {
        body.workflowId = workflowId.trim();
      } else {
        body.allFailedSinceMinutes = failedSinceMinutes;
      }

      const response = await fetch('/api/ops/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });

        // Reset form
        setWorkflowId('');
        setFailedSinceMinutes(10);
        setReason('');
        
        // Refresh history
        fetchReplayStatus();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to trigger replay',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error triggering replay:', error);
      toast({
        title: 'Error',
        description: 'Failed to trigger replay',
        variant: 'destructive',
      });
    } finally {
      setReplaying(false);
    }
  };

  useEffect(() => {
    fetchReplayStatus();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Rewind className="w-5 h-5 mr-2" />
          Workflow Replay
        </CardTitle>
        <CardDescription>
          Trigger replay of failed workflows or specific workflow instances
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Replay Type Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Replay Type</label>
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                value="single"
                checked={replayType === 'single'}
                onChange={(e) => setReplayType(e.target.value as 'single' | 'bulk')}
              />
              <span>Single Workflow</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                value="bulk"
                checked={replayType === 'bulk'}
                onChange={(e) => setReplayType(e.target.value as 'single' | 'bulk')}
              />
              <span>Bulk Failed Workflows</span>
            </label>
          </div>
        </div>

        {/* Single Workflow Replay */}
        {replayType === 'single' && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Workflow ID</label>
              <Input
                placeholder="Enter workflow ID to replay..."
                value={workflowId}
                onChange={(e) => setWorkflowId(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}

        {/* Bulk Workflow Replay */}
        {replayType === 'bulk' && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Failed Since (minutes)</label>
              <Input
                type="number"
                min="1"
                max="1440"
                value={failedSinceMinutes}
                onChange={(e) => setFailedSinceMinutes(parseInt(e.target.value) || 10)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Replay all workflows that failed in the last {failedSinceMinutes} minutes
              </p>
            </div>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="text-sm font-medium">Reason (optional)</label>
          <Textarea
            placeholder="Describe why you're triggering this replay..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1"
            rows={3}
          />
        </div>

        {/* Action Button */}
        <Button 
          onClick={handleReplay} 
          disabled={replaying}
          className="w-full"
        >
          {replaying ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Rewind className="w-4 h-4 mr-2" />
          )}
          {replaying ? 'Triggering Replay...' : `Trigger ${replayType === 'single' ? 'Single' : 'Bulk'} Replay`}
        </Button>

        {/* Recent Replay History */}
        {replayHistory.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Recent Replays</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {replayHistory.slice(0, 5).map((replay) => (
                <div key={replay.id} className="p-2 border rounded-lg text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{replay.target}</span>
                    <span className="text-muted-foreground">{new Date(replay.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-muted-foreground">by {replay.actor}</div>
                  {replay.details?.type && (
                    <Badge variant="outline" className="mt-1">
                      {replay.details.type.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const RollbackPanel = ({ systemStatus }: { systemStatus: SystemStatus | null }) => {
  const [environment, setEnvironment] = useState<'staging' | 'prod'>('staging');
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [rolling, setRolling] = useState(false);
  const [rollbackHistory, setRollbackHistory] = useState<RollbackHistory[]>([]);
  const { toast } = useToast();

  const fetchRollbackStatus = async () => {
    try {
      const response = await fetch('/api/ops/rollback');
      if (response.ok) {
        const data = await response.json();
        setRollbackHistory(data.recent_rollbacks || []);
      }
    } catch (error) {
      console.error('Error fetching rollback status:', error);
    }
  };

  const handleRollback = async () => {
    if (reason.trim().length < 10) {
      toast({
        title: 'Error',
        description: 'Please provide a detailed reason (minimum 10 characters)',
        variant: 'destructive',
      });
      return;
    }

    if (confirmText !== 'ROLLBACK') {
      toast({
        title: 'Error',
        description: 'Please type "ROLLBACK" to confirm',
        variant: 'destructive',
      });
      return;
    }

    setRolling(true);
    try {
      const response = await fetch('/api/ops/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment,
          reason: reason.trim(),
          confirm: true,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });

        // Reset form
        setReason('');
        setConfirmText('');
        
        // Refresh history
        fetchRollbackStatus();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to trigger rollback',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error triggering rollback:', error);
      toast({
        title: 'Error',
        description: 'Failed to trigger rollback',
        variant: 'destructive',
      });
    } finally {
      setRolling(false);
    }
  };

  const canRollback = environment === 'staging' 
    ? systemStatus?.can_rollback_staging 
    : systemStatus?.can_rollback_prod;

  useEffect(() => {
    fetchRollbackStatus();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <RotateCcw className="w-5 h-5 mr-2" />
          Deployment Rollback
        </CardTitle>
        <CardDescription>
          Rollback to the previous deployment version
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Safety Warning */}
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>WARNING:</strong> Rollbacks are destructive operations that cannot be undone easily. 
            Only proceed if you understand the impact.
          </AlertDescription>
        </Alert>

        {/* Environment Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Environment</label>
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                value="staging"
                checked={environment === 'staging'}
                onChange={(e) => setEnvironment(e.target.value as 'staging' | 'prod')}
              />
              <span>Staging</span>
              {systemStatus?.can_rollback_staging ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              )}
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                value="prod"
                checked={environment === 'prod'}
                onChange={(e) => setEnvironment(e.target.value as 'staging' | 'prod')}
              />
              <span>Production</span>
              {systemStatus?.can_rollback_prod ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-500" />
              )}
            </label>
          </div>
        </div>

        {/* Permission Requirements */}
        {!canRollback && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {environment === 'prod' 
                ? 'Production rollbacks require Admin role and Safe Mode enabled'
                : 'Staging rollbacks require Ops or Admin role'
              }
            </AlertDescription>
          </Alert>
        )}

        {/* Reason */}
        <div>
          <label className="text-sm font-medium">Reason *</label>
          <Textarea
            placeholder="Describe in detail why you need to rollback (minimum 10 characters)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1"
            rows={4}
          />
        </div>

        {/* Confirmation */}
        <div>
          <label className="text-sm font-medium">Type "ROLLBACK" to confirm *</label>
          <Input
            placeholder="ROLLBACK"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="mt-1"
          />
        </div>

        {/* Action Button */}
        <Button 
          onClick={handleRollback} 
          disabled={rolling || !canRollback || reason.trim().length < 10 || confirmText !== 'ROLLBACK'}
          variant="destructive"
          className="w-full"
        >
          {rolling ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4 mr-2" />
          )}
          {rolling ? 'Triggering Rollback...' : `Rollback ${environment} Environment`}
        </Button>

        {/* Recent Rollback History */}
        {rollbackHistory.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Recent Rollbacks</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {rollbackHistory.slice(0, 5).map((rollback) => (
                <div key={rollback.id} className="p-2 border rounded-lg text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{rollback.target}</span>
                    <span className="text-muted-foreground">{new Date(rollback.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-muted-foreground">by {rollback.actor}</div>
                  {rollback.details?.environment && (
                    <Badge variant="outline" className="mt-1">
                      {rollback.details.environment}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function RecoveryPage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSystemStatus = async () => {
    try {
      const [replayResponse, rollbackResponse] = await Promise.all([
        fetch('/api/ops/replay'),
        fetch('/api/ops/rollback'),
      ]);

      if (replayResponse.ok && rollbackResponse.ok) {
        const [replayData, rollbackData] = await Promise.all([
          replayResponse.json(),
          rollbackResponse.json(),
        ]);

        setSystemStatus({
          safe_mode: replayData.system_status?.safe_mode || false,
          system_freeze: replayData.system_status?.system_freeze || false,
          replay_enabled: replayData.replay_enabled || false,
          can_rollback_staging: rollbackData.permissions?.can_rollback_staging || false,
          can_rollback_prod: rollbackData.permissions?.can_rollback_prod || false,
        });
      }
    } catch (error) {
      console.error('Error fetching system status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading recovery tools...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/command-center">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Command Center
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Recovery Operations</h1>
            <p className="text-muted-foreground">
              Workflow replay and deployment rollback tools
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSystemStatus}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Status
        </Button>
      </div>

      {/* System Status */}
      {systemStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span className="text-sm">Safe Mode:</span>
                <Badge variant={systemStatus.safe_mode ? 'destructive' : 'default'}>
                  {systemStatus.safe_mode ? 'ON' : 'OFF'}
                </Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span className="text-sm">System Freeze:</span>
                <Badge variant={systemStatus.system_freeze ? 'destructive' : 'default'}>
                  {systemStatus.system_freeze ? 'ON' : 'OFF'}
                </Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Rewind className="w-4 h-4" />
                <span className="text-sm">Replay:</span>
                <Badge variant={systemStatus.replay_enabled ? 'default' : 'secondary'}>
                  {systemStatus.replay_enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div className="flex items-center space-x-2">
                <RotateCcw className="w-4 h-4" />
                <span className="text-sm">Rollback:</span>
                <Badge variant={systemStatus.can_rollback_staging || systemStatus.can_rollback_prod ? 'default' : 'secondary'}>
                  {systemStatus.can_rollback_staging || systemStatus.can_rollback_prod ? 'Available' : 'Restricted'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recovery Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReplayPanel />
        <RollbackPanel systemStatus={systemStatus} />
      </div>

      {/* Documentation Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <History className="w-5 h-5 mr-2" />
            Recovery Documentation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Workflow Replay Guide</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Learn how to safely replay failed workflows and handle Temporal errors.
              </p>
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Documentation
              </Button>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Rollback Procedures</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Emergency rollback procedures and deployment recovery strategies.
              </p>
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Documentation
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}