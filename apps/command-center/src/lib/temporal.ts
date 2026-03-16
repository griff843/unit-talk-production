/**
 * Temporal Integration for Command Center
 * Real-time workflow monitoring and management via secure API routes
 */

import React from 'react';

export interface WorkflowInfo {
  workflowId: string;
  runId: string;
  workflowType: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED' | 'TERMINATED' | 'TIMED_OUT';
  startTime: Date;
  executionTime?: number;
  taskQueue: string;
  memo?: Record<string, any>;
}

export interface WorkflowSummary {
  total: number;
  running: number;
  completed: number;
  failed: number;
  healthy: number;
  criticalWorkflows: string[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class TemporalService {
  private baseUrl = '/api/temporal';

  async getWorkflowList(): Promise<WorkflowInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/workflows?action=list`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: ApiResponse<WorkflowInfo[]> = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch workflows');
      }

      // Convert startTime strings back to Date objects
      return result.data!.map(workflow => ({
        ...workflow,
        startTime: new Date(workflow.startTime),
      }));
    } catch (error) {
      console.error('❌ Failed to list workflows:', error);
      throw error;
    }
  }

  async getWorkflowSummary(): Promise<WorkflowSummary> {
    try {
      const response = await fetch(`${this.baseUrl}/workflows?action=summary`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: ApiResponse<WorkflowSummary> = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch workflow summary');
      }

      return result.data!;
    } catch (error) {
      console.error('❌ Failed to get workflow summary:', error);
      throw error;
    }
  }

  async getWorkflowDetails(workflowId: string): Promise<WorkflowInfo | null> {
    try {
      // For now, we'll get all workflows and filter
      // TODO: Add a specific endpoint for individual workflow details
      const workflows = await this.getWorkflowList();
      return workflows.find(w => w.workflowId === workflowId) || null;
    } catch (error) {
      console.error(`❌ Failed to get workflow details for ${workflowId}:`, error);
      return null;
    }
  }

  async startWorkflow(
    workflowType: string,
    workflowId: string,
    args: unknown[]
  ): Promise<{ workflowId: string; runId: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start', workflowType, workflowId, args }),
      });

      const result: ApiResponse<{ workflowId: string; runId: string }> = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to start workflow');
      }

      console.log(`✅ Started workflow via API: ${workflowId}`);
      return result.data!;
    } catch (error) {
      console.error(`❌ Failed to start workflow ${workflowType} (${workflowId}):`, error);
      throw error;
    }
  }

  async terminateWorkflow(
    workflowId: string,
    reason: string = 'Manual termination from Command Center'
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'terminate',
          workflowId,
          reason,
        }),
      });

      const result: ApiResponse<{ terminated: boolean }> = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to terminate workflow');
      }

      console.log(`✅ Terminated workflow: ${workflowId}`);
      return result.data!.terminated;
    } catch (error) {
      console.error(`❌ Failed to terminate workflow ${workflowId}:`, error);
      return false;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: ApiResponse<{ status: string }> = await response.json();
      return result.success && result.data?.status === 'healthy';
    } catch (error) {
      console.error('❌ Temporal health check failed:', error);
      return false;
    }
  }

  // No-op for API-based service - connection handled server-side
  disconnect(): void {
    console.log('🔌 Client-side Temporal service uses API routes - no connection to close');
  }
}

// Export singleton instance
export const temporalService = new TemporalService();

// Monitoring service for temporal operations
export class TemporalMonitoringService {
  static async getRecentFailures(limit: number = 10): Promise<any[]> {
    try {
      // Import supabase dynamically to avoid circular imports
      const { supabase } = await import('./supabase');

      const { data, error } = await supabase
        .from('temporal_workflow_health')
        .select('*')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching recent failures:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getRecentFailures:', error);
      return [];
    }
  }

  static async getStuckWorkflows(limit: number = 10): Promise<any[]> {
    try {
      // Import supabase dynamically to avoid circular imports
      const { supabase } = await import('./supabase');

      const stuckThreshold = new Date(Date.now() - 30 * 60 * 1000);

      const { data, error } = await supabase
        .from('temporal_workflow_health')
        .select('*')
        .eq('status', 'running')
        .lt('started_at', stuckThreshold.toISOString())
        .order('started_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error fetching stuck workflows:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getStuckWorkflows:', error);
      return [];
    }
  }
}

// React hook for workflow monitoring
export function useWorkflowMonitoring() {
  const [workflows, setWorkflows] = React.useState<WorkflowInfo[]>([]);
  const [summary, setSummary] = React.useState<WorkflowSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);

  const refreshWorkflows = async () => {
    try {
      setLoading(true);
      setError(null);

      const [workflowList, workflowSummary] = await Promise.all([
        temporalService.getWorkflowList(),
        temporalService.getWorkflowSummary(),
      ]);

      setWorkflows(workflowList);
      setSummary(workflowSummary);
      setLastUpdate(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('❌ Failed to refresh workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // Initial load
    refreshWorkflows();

    // Set up periodic refresh every 30 seconds
    const interval = setInterval(refreshWorkflows, 30000);

    return () => {
      clearInterval(interval);
      temporalService.disconnect();
    };
  }, []);

  const terminateWorkflow = async (workflowId: string, reason?: string) => {
    const success = await temporalService.terminateWorkflow(workflowId, reason);
    if (success) {
      // Refresh the list after termination
      await refreshWorkflows();
    }
    return success;
  };

  return {
    workflows,
    summary,
    loading,
    error,
    lastUpdate,
    refreshWorkflows,
    terminateWorkflow,
  };
}

export default temporalService;
