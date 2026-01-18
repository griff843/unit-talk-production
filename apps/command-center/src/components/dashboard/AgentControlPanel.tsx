'use client';

/**
 * Agent Control Panel
 *
 * Phase 1 Agent Control Plane - Real enforcement UI.
 * Provides RBAC-gated agent lifecycle controls:
 * - View agent status from agent_registry
 * - Pause/Resume/Stop/Drain agents (operator+)
 * - Kill with confirmation (admin+)
 * - Emergency stop all (super_admin)
 *
 * @module AgentControlPanel
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Skull,
  AlertTriangle,
  CheckCircle,
  Timer,
  Activity,
  RefreshCw,
  Shield,
  ShieldAlert,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  useAgentControl,
  type AgentControlInfo,
  type AgentState,
} from '@/hooks/useAgentControl';

interface AgentControlPanelProps {
  className?: string;
}

/**
 * Get status icon for agent state
 */
function getStateIcon(state: AgentState, isHealthy: boolean) {
  if (!isHealthy) {
    return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  }

  switch (state) {
    case 'running':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'paused':
      return <Pause className="w-4 h-4 text-blue-500" />;
    case 'stopped':
      return <Square className="w-4 h-4 text-gray-500" />;
    case 'draining':
      return <Timer className="w-4 h-4 text-orange-500 animate-pulse" />;
    case 'killed':
      return <Skull className="w-4 h-4 text-red-500" />;
    default:
      return <Activity className="w-4 h-4 text-gray-400" />;
  }
}

/**
 * Get badge variant for agent state
 */
function getStateBadgeClass(state: AgentState, isHealthy: boolean): string {
  if (!isHealthy) {
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }

  const variants: Record<AgentState, string> = {
    running: 'bg-green-100 text-green-800 border-green-200',
    paused: 'bg-blue-100 text-blue-800 border-blue-200',
    stopped: 'bg-gray-100 text-gray-800 border-gray-200',
    draining: 'bg-orange-100 text-orange-800 border-orange-200',
    killed: 'bg-red-100 text-red-800 border-red-200',
  };

  return variants[state] || 'bg-gray-100 text-gray-800';
}

/**
 * Format heartbeat age
 */
function formatHeartbeatAge(lastHeartbeat: string | null): string {
  if (!lastHeartbeat) return 'Never';

  const age = Date.now() - new Date(lastHeartbeat).getTime();

  if (age < 1000) return 'Just now';
  if (age < 60000) return `${Math.floor(age / 1000)}s ago`;
  if (age < 3600000) return `${Math.floor(age / 60000)}m ago`;

  return `${Math.floor(age / 3600000)}h ago`;
}

export function AgentControlPanel({ className = '' }: AgentControlPanelProps) {
  const { toast } = useToast();
  const {
    agents,
    summary,
    loading,
    pendingKillConfirmation,
    fetchAgents,
    pauseAgent,
    resumeAgent,
    stopAgent,
    drainAgent,
    requestKillConfirmation,
    confirmKill,
    cancelKillConfirmation,
    emergencyStopAll,
  } = useAgentControl();

  // Dialog states
  const [killDialogOpen, setKillDialogOpen] = useState(false);
  const [killTarget, setKillTarget] = useState<AgentControlInfo | null>(null);
  const [killReason, setKillReason] = useState('');
  const [emergencyDialogOpen, setEmergencyDialogOpen] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Countdown for kill confirmation
  const [killCountdown, setKillCountdown] = useState<number | null>(null);

  // Update countdown timer
  useEffect(() => {
    if (!pendingKillConfirmation) {
      setKillCountdown(null);
      return;
    }

    const expiresAt = new Date(pendingKillConfirmation.expiresAt).getTime();

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setKillCountdown(remaining);

      if (remaining === 0) {
        setKillDialogOpen(false);
        setKillTarget(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [pendingKillConfirmation]);

  /**
   * Handle pause/resume/stop/drain actions
   */
  const handleAction = async (
    agent: AgentControlInfo,
    action: 'pause' | 'resume' | 'stop' | 'drain'
  ) => {
    setActionInProgress(agent.agentId);

    try {
      switch (action) {
        case 'pause':
          await pauseAgent(agent.agentId, 'Operator pause command');
          break;
        case 'resume':
          await resumeAgent(agent.agentId, 'Operator resume command');
          break;
        case 'stop':
          await stopAgent(agent.agentId, 'Operator stop command');
          break;
        case 'drain':
          await drainAgent(agent.agentId, 'Operator drain command');
          break;
      }
    } finally {
      setActionInProgress(null);
    }
  };

  /**
   * Initiate kill flow
   */
  const handleKillRequest = async (agent: AgentControlInfo) => {
    if (!killReason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason for killing this agent',
        variant: 'destructive',
      });
      return;
    }

    const result = await requestKillConfirmation(agent.agentId, killReason);

    if (result) {
      // Keep dialog open for confirmation step
    }
  };

  /**
   * Confirm kill
   */
  const handleKillConfirm = async () => {
    if (!pendingKillConfirmation) return;

    await confirmKill(pendingKillConfirmation.confirmationToken);
    setKillDialogOpen(false);
    setKillTarget(null);
    setKillReason('');
  };

  /**
   * Handle emergency stop
   */
  const handleEmergencyStop = async () => {
    if (!emergencyReason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason for the emergency stop',
        variant: 'destructive',
      });
      return;
    }

    const confirmed = await emergencyStopAll(emergencyReason);

    if (confirmed) {
      setEmergencyDialogOpen(false);
      setEmergencyReason('');
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with refresh and emergency stop */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Agent Control Plane
          </h2>
          <p className="text-muted-foreground">
            Phase 1 - Real enforcement with RBAC
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAgents()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setEmergencyDialogOpen(true)}
          >
            <ShieldAlert className="w-4 h-4 mr-2" />
            Emergency Stop
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-800">{summary.running}</div>
              <div className="text-sm text-green-600">Running</div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-800">{summary.paused}</div>
              <div className="text-sm text-blue-600">Paused</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-800">{summary.stopped}</div>
              <div className="text-sm text-gray-600">Stopped</div>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-800">{summary.draining}</div>
              <div className="text-sm text-orange-600">Draining</div>
            </CardContent>
          </Card>
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-800">{summary.killed}</div>
              <div className="text-sm text-red-600">Killed</div>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 border-emerald-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-800">{summary.healthy}</div>
              <div className="text-sm text-emerald-600">Healthy</div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-800">{summary.unhealthy}</div>
              <div className="text-sm text-yellow-600">Unhealthy</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Agent list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Registered Agents
          </CardTitle>
          <CardDescription>
            Control agent lifecycle - data from agent_registry table
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading agents...
                </div>
              ) : (
                <div>
                  <p>No agents registered in agent_registry.</p>
                  <p className="text-sm mt-2">
                    Run `supabase db push` to apply the Phase 1 migration.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.agentId}
                  className="flex items-center justify-between p-4 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStateIcon(agent.currentState, agent.isHealthy)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{agent.displayName}</span>
                        <Badge variant="outline" className="text-xs">
                          {agent.agentType}
                        </Badge>
                        {!agent.isHealthy && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200"
                          >
                            Unhealthy
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="mr-3">ID: {agent.agentId}</span>
                        <span>Heartbeat: {formatHeartbeatAge(agent.lastHeartbeat)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Current state badge */}
                    <Badge className={getStateBadgeClass(agent.currentState, agent.isHealthy)}>
                      {agent.currentState.toUpperCase()}
                    </Badge>

                    {/* Desired state indicator */}
                    {agent.desiredState !== agent.currentState && (
                      <Badge variant="outline" className="text-xs">
                        → {agent.desiredState}
                      </Badge>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-1 ml-2">
                      {agent.currentState === 'running' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(agent, 'pause')}
                            disabled={actionInProgress === agent.agentId}
                            title="Pause"
                          >
                            <Pause className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(agent, 'drain')}
                            disabled={actionInProgress === agent.agentId}
                            title="Drain"
                          >
                            <Timer className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(agent, 'stop')}
                            disabled={actionInProgress === agent.agentId}
                            title="Stop"
                          >
                            <Square className="w-3 h-3" />
                          </Button>
                        </>
                      )}

                      {agent.currentState === 'paused' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(agent, 'resume')}
                            disabled={actionInProgress === agent.agentId}
                            title="Resume"
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(agent, 'stop')}
                            disabled={actionInProgress === agent.agentId}
                            title="Stop"
                          >
                            <Square className="w-3 h-3" />
                          </Button>
                        </>
                      )}

                      {agent.currentState === 'stopped' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(agent, 'resume')}
                          disabled={actionInProgress === agent.agentId}
                          title="Resume"
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                      )}

                      {agent.currentState === 'draining' && (
                        <Badge variant="outline" className="text-xs animate-pulse">
                          Draining...
                        </Badge>
                      )}

                      {/* Kill button (always available except for killed agents) */}
                      {agent.currentState !== 'killed' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setKillTarget(agent);
                            setKillDialogOpen(true);
                          }}
                          disabled={actionInProgress === agent.agentId}
                          title="Kill (requires confirmation)"
                        >
                          <Skull className="w-3 h-3" />
                        </Button>
                      )}

                      {/* Loading indicator */}
                      {actionInProgress === agent.agentId && (
                        <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kill confirmation dialog */}
      <Dialog open={killDialogOpen} onOpenChange={setKillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Skull className="w-5 h-5" />
              Kill Agent: {killTarget?.displayName}
            </DialogTitle>
            <DialogDescription>
              {!pendingKillConfirmation ? (
                <>
                  This will immediately terminate the agent. This action cannot be undone.
                  A reason is required for audit purposes.
                </>
              ) : (
                <>
                  Kill confirmation received. You have{' '}
                  <span className="font-bold text-red-600">{killCountdown}s</span> to confirm.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {!pendingKillConfirmation ? (
            <>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Reason (required)</label>
                  <Input
                    value={killReason}
                    onChange={(e) => setKillReason(e.target.value)}
                    placeholder="Enter reason for killing this agent..."
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setKillDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => killTarget && handleKillRequest(killTarget)}
                  disabled={!killReason.trim()}
                >
                  Request Kill Confirmation
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                <div className="text-4xl font-bold text-red-600 mb-2">{killCountdown}s</div>
                <p className="text-sm text-red-700">
                  Click &quot;Confirm Kill&quot; to terminate the agent
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    cancelKillConfirmation();
                    setKillDialogOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleKillConfirm}>
                  <Skull className="w-4 h-4 mr-2" />
                  Confirm Kill
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Emergency stop dialog */}
      <Dialog open={emergencyDialogOpen} onOpenChange={setEmergencyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="w-5 h-5" />
              Emergency Stop All Agents
            </DialogTitle>
            <DialogDescription>
              This will immediately stop ALL running agents. This is a critical operation
              and requires super_admin role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reason (required)</label>
              <Input
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
                placeholder="Enter reason for emergency stop..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmergencyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleEmergencyStop}
              disabled={!emergencyReason.trim()}
            >
              <ShieldAlert className="w-4 h-4 mr-2" />
              Emergency Stop All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
