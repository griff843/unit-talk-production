/**
 * Agent Control Hook
 *
 * Phase 1 Agent Control Plane - React hook for UI integration.
 * Provides state management and API calls for agent lifecycle control.
 *
 * @module useAgentControl
 */

import { useState, useCallback, useEffect } from 'react';

import { useToast } from '@/components/ui/use-toast';

/**
 * Agent desired/current states
 */
export type AgentState = 'running' | 'paused' | 'stopped' | 'draining' | 'killed';

/**
 * Agent info from agent_registry
 */
export interface AgentControlInfo {
  agentId: string;
  agentType: string;
  displayName: string;
  desiredState: AgentState;
  currentState: AgentState;
  lastHeartbeat: string | null;
  isHealthy: boolean;
  heartbeatAgeMs?: number | null;
}

/**
 * Control command result
 */
export interface ControlCommandResult {
  success: boolean;
  agentId: string;
  command: string;
  previousState?: AgentState;
  newState?: AgentState;
  error?: string;
  timestamp: string;
}

/**
 * Kill confirmation result
 */
export interface KillConfirmationResult {
  agentId: string;
  confirmationToken: string;
  expiresAt: string;
  expiresInSeconds: number;
}

/**
 * Agent summary
 */
export interface AgentSummary {
  total: number;
  running: number;
  paused: number;
  stopped: number;
  draining: number;
  killed: number;
  healthy: number;
  unhealthy: number;
}

/**
 * API response types
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  permissionDenied?: boolean;
  latencyMs?: number;
}

/**
 * Hook state
 */
interface AgentControlState {
  agents: AgentControlInfo[];
  summary: AgentSummary | null;
  loading: boolean;
  error: string | null;
  pendingKillConfirmation: KillConfirmationResult | null;
}

/**
 * Agent Control Hook
 */
export function useAgentControl() {
  const { toast } = useToast();

  const [state, setState] = useState<AgentControlState>({
    agents: [],
    summary: null,
    loading: false,
    error: null,
    pendingKillConfirmation: null,
  });

  /**
   * Fetch all agents from control API
   */
  const fetchAgents = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch('/api/agents/control');
      const result: ApiResponse<{ agents: AgentControlInfo[]; summary: AgentSummary }> =
        await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch agents');
      }

      setState(prev => ({
        ...prev,
        agents: result.data?.agents || [],
        summary: result.data?.summary || null,
        loading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        loading: false,
        error: message,
      }));

      toast({
        title: 'Failed to fetch agents',
        description: message,
        variant: 'destructive',
      });
    }
  }, [toast]);

  /**
   * Get single agent details
   */
  const getAgent = useCallback(
    async (
      agentId: string,
      options?: { includeMetrics?: boolean; includeEvents?: boolean }
    ): Promise<AgentControlInfo | null> => {
      try {
        const params = new URLSearchParams({ agentId });
        if (options?.includeMetrics) params.append('includeMetrics', 'true');
        if (options?.includeEvents) params.append('includeEvents', 'true');

        const response = await fetch(`/api/agents/control?${params}`);
        const result: ApiResponse<AgentControlInfo> = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch agent');
        }

        return result.data || null;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast({
          title: 'Failed to fetch agent',
          description: message,
          variant: 'destructive',
        });
        return null;
      }
    },
    [toast]
  );

  /**
   * Execute control command
   */
  const executeCommand = useCallback(
    async (
      action: 'pause' | 'resume' | 'stop' | 'drain',
      agentId: string,
      reason?: string
    ): Promise<ControlCommandResult | null> => {
      setState(prev => ({ ...prev, loading: true }));

      try {
        const response = await fetch('/api/agents/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, agentId, reason }),
        });

        const result: ApiResponse<ControlCommandResult> = await response.json();

        if (!result.success) {
          if (result.permissionDenied) {
            toast({
              title: 'Permission Denied',
              description: result.error,
              variant: 'destructive',
            });
          } else {
            throw new Error(result.error || `Failed to ${action} agent`);
          }
          return null;
        }

        // Update local state
        setState(prev => ({
          ...prev,
          loading: false,
          agents: prev.agents.map(agent =>
            agent.agentId === agentId
              ? {
                  ...agent,
                  desiredState: result.data?.newState || agent.desiredState,
                }
              : agent
          ),
        }));

        toast({
          title: `Agent ${action} successful`,
          description: result.message || `${agentId} is now ${result.data?.newState}`,
        });

        // Refresh to get accurate state
        setTimeout(() => fetchAgents(), 1000);

        return result.data || null;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({ ...prev, loading: false, error: message }));

        toast({
          title: `Failed to ${action} agent`,
          description: message,
          variant: 'destructive',
        });

        return null;
      }
    },
    [toast, fetchAgents]
  );

  /**
   * Pause agent
   */
  const pauseAgent = useCallback(
    (agentId: string, reason?: string) => executeCommand('pause', agentId, reason),
    [executeCommand]
  );

  /**
   * Resume agent
   */
  const resumeAgent = useCallback(
    (agentId: string, reason?: string) => executeCommand('resume', agentId, reason),
    [executeCommand]
  );

  /**
   * Stop agent
   */
  const stopAgent = useCallback(
    (agentId: string, reason?: string) => executeCommand('stop', agentId, reason),
    [executeCommand]
  );

  /**
   * Drain agent
   */
  const drainAgent = useCallback(
    (agentId: string, reason?: string) => executeCommand('drain', agentId, reason),
    [executeCommand]
  );

  /**
   * Request kill confirmation (step 1 of 2)
   */
  const requestKillConfirmation = useCallback(
    async (agentId: string, reason: string): Promise<KillConfirmationResult | null> => {
      setState(prev => ({ ...prev, loading: true }));

      try {
        const response = await fetch('/api/agents/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'kill_request', agentId, reason }),
        });

        const result: ApiResponse<KillConfirmationResult> = await response.json();

        if (!result.success) {
          if (result.permissionDenied) {
            toast({
              title: 'Permission Denied',
              description: result.error,
              variant: 'destructive',
            });
          } else {
            throw new Error(result.error || 'Failed to request kill confirmation');
          }
          return null;
        }

        setState(prev => ({
          ...prev,
          loading: false,
          pendingKillConfirmation: result.data || null,
        }));

        toast({
          title: 'Kill confirmation required',
          description: `You have 60 seconds to confirm killing ${agentId}`,
        });

        return result.data || null;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({ ...prev, loading: false, error: message }));

        toast({
          title: 'Failed to request kill confirmation',
          description: message,
          variant: 'destructive',
        });

        return null;
      }
    },
    [toast]
  );

  /**
   * Confirm kill (step 2 of 2)
   */
  const confirmKill = useCallback(
    async (confirmationToken: string): Promise<ControlCommandResult | null> => {
      setState(prev => ({ ...prev, loading: true }));

      try {
        const response = await fetch('/api/agents/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'kill_confirm', confirmationToken }),
        });

        const result: ApiResponse<ControlCommandResult> = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to confirm kill');
        }

        setState(prev => ({
          ...prev,
          loading: false,
          pendingKillConfirmation: null,
        }));

        toast({
          title: 'Agent killed',
          description: result.message || `${result.data?.agentId} has been killed`,
          variant: 'destructive',
        });

        // Refresh to get accurate state
        setTimeout(() => fetchAgents(), 1000);

        return result.data || null;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({ ...prev, loading: false, error: message }));

        toast({
          title: 'Failed to kill agent',
          description: message,
          variant: 'destructive',
        });

        return null;
      }
    },
    [toast, fetchAgents]
  );

  /**
   * Cancel pending kill confirmation
   */
  const cancelKillConfirmation = useCallback(() => {
    setState(prev => ({ ...prev, pendingKillConfirmation: null }));
    toast({
      title: 'Kill cancelled',
      description: 'Kill confirmation has been cancelled',
    });
  }, [toast]);

  /**
   * Emergency stop all agents
   */
  const emergencyStopAll = useCallback(
    async (reason: string): Promise<boolean> => {
      setState(prev => ({ ...prev, loading: true }));

      try {
        const response = await fetch('/api/agents/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'emergency_stop', reason }),
        });

        const result: ApiResponse<{ agentsStopped: number }> = await response.json();

        if (!result.success) {
          if (result.permissionDenied) {
            toast({
              title: 'Permission Denied',
              description: 'Emergency stop requires super_admin role',
              variant: 'destructive',
            });
          } else {
            throw new Error(result.error || 'Emergency stop failed');
          }
          return false;
        }

        setState(prev => ({ ...prev, loading: false }));

        toast({
          title: 'Emergency stop activated',
          description: result.message || `${result.data?.agentsStopped} agents stopped`,
          variant: 'destructive',
        });

        // Refresh to get accurate state
        setTimeout(() => fetchAgents(), 1000);

        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({ ...prev, loading: false, error: message }));

        toast({
          title: 'Emergency stop failed',
          description: message,
          variant: 'destructive',
        });

        return false;
      }
    },
    [toast, fetchAgents]
  );

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  /**
   * Auto-expire pending kill confirmation
   */
  useEffect(() => {
    if (!state.pendingKillConfirmation) return;

    const expiresAt = new Date(state.pendingKillConfirmation.expiresAt).getTime();
    const now = Date.now();
    const timeLeft = expiresAt - now;

    if (timeLeft <= 0) {
      setState(prev => ({ ...prev, pendingKillConfirmation: null }));
      return;
    }

    const timer = setTimeout(() => {
      setState(prev => ({ ...prev, pendingKillConfirmation: null }));
      toast({
        title: 'Kill confirmation expired',
        description: 'The 60-second confirmation window has expired',
      });
    }, timeLeft);

    return () => clearTimeout(timer);
  }, [state.pendingKillConfirmation, toast]);

  return {
    // State
    agents: state.agents,
    summary: state.summary,
    loading: state.loading,
    error: state.error,
    pendingKillConfirmation: state.pendingKillConfirmation,

    // Actions
    fetchAgents,
    getAgent,
    pauseAgent,
    resumeAgent,
    stopAgent,
    drainAgent,
    requestKillConfirmation,
    confirmKill,
    cancelKillConfirmation,
    emergencyStopAll,
  };
}
