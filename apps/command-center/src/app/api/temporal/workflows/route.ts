/**
 * Server-side API route for Temporal workflow operations
 * Moves Temporal client from frontend to backend for security
 */

import { NextRequest, NextResponse } from 'next/server';
import { Client, Connection } from '@temporalio/client';

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

class ServerTemporalService {
  private client: Client | null = null;
  private connectionRetries = 0;
  private maxRetries = 3;
  private retryDelay = 1000;

  async connect(): Promise<void> {
    try {
      this.client = new Client({
        connection: Connection.lazy({
          address: process.env.TEMPORAL_SERVER_URL || 'localhost:7233',
        }),
      });

      console.log('✅ Server Temporal client initialized');
      this.connectionRetries = 0;
    } catch (error) {
      console.error('❌ Failed to connect to Temporal:', error);

      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        console.log(`🔄 Retrying connection (${this.connectionRetries}/${this.maxRetries})...`);

        await new Promise(resolve => setTimeout(resolve, this.retryDelay * this.connectionRetries));
        return this.connect();
      }

      throw new Error(`Failed to connect to Temporal after ${this.maxRetries} attempts`);
    }
  }

  async getWorkflowList(): Promise<WorkflowInfo[]> {
    if (!this.client) {
      await this.connect();
    }

    try {
      const workflows: WorkflowInfo[] = [];

      // List all workflows
      for await (const workflow of this.client!.workflow.list()) {
        const workflowInfo: WorkflowInfo = {
          workflowId: workflow.workflowId,
          runId: workflow.runId,
          workflowType: workflow.type || 'Unknown',
          status: workflow.status.name as WorkflowInfo['status'],
          startTime: workflow.startTime ? new Date(workflow.startTime) : new Date(),
          executionTime: workflow.executionTime ? Number(workflow.executionTime) : undefined,
          taskQueue: workflow.taskQueue,
          memo: workflow.memo,
        };

        workflows.push(workflowInfo);
      }

      return workflows;
    } catch (error) {
      console.error('❌ Failed to list workflows:', error);
      // Reset client for next attempt
      this.client = null;
      throw error;
    }
  }

  async getWorkflowSummary(): Promise<WorkflowSummary> {
    const workflows = await this.getWorkflowList();

    // Critical workflows that should always be running
    const criticalWorkflows = [
      'syndicate-scheduler-main',
      'live-game-detector',
      'quota-monitoring',
      'health-monitoring',
    ];

    const runningCritical = workflows
      .filter(w => criticalWorkflows.includes(w.workflowId) && w.status === 'RUNNING')
      .map(w => w.workflowId);

    const summary: WorkflowSummary = {
      total: workflows.length,
      running: workflows.filter(w => w.status === 'RUNNING').length,
      completed: workflows.filter(w => w.status === 'COMPLETED').length,
      failed: workflows.filter(w => w.status === 'FAILED').length,
      healthy: runningCritical.length,
      criticalWorkflows: runningCritical,
    };

    return summary;
  }

  async terminateWorkflow(
    workflowId: string,
    reason: string = 'Manual termination from Command Center'
  ): Promise<boolean> {
    if (!this.client) {
      await this.connect();
    }

    try {
      const handle = this.client!.workflow.getHandle(workflowId);
      await handle.terminate(reason);
      console.log(`✅ Terminated workflow: ${workflowId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to terminate workflow ${workflowId}:`, error);
      return false;
    }
  }

  disconnect(): void {
    if (this.client) {
      this.client.connection.close();
      this.client = null;
      console.log('🔌 Disconnected from Temporal server');
    }
  }
}

// Singleton instance
const serverTemporalService = new ServerTemporalService();

// API Route Handlers
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'list':
        const workflows = await serverTemporalService.getWorkflowList();
        return NextResponse.json({ success: true, data: workflows });

      case 'summary':
        const summary = await serverTemporalService.getWorkflowSummary();
        return NextResponse.json({ success: true, data: summary });

      default:
        // Default to combined data (both workflows and summary)
        const [workflowList, workflowSummary] = await Promise.all([
          serverTemporalService.getWorkflowList(),
          serverTemporalService.getWorkflowSummary(),
        ]);

        return NextResponse.json({
          success: true,
          data: {
            workflows: workflowList,
            summary: workflowSummary,
          },
        });
    }
  } catch (error) {
    console.error('❌ Temporal API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, workflowId, reason } = body;

    switch (action) {
      case 'terminate':
        if (!workflowId) {
          return NextResponse.json(
            {
              success: false,
              error: 'workflowId is required for terminate action',
            },
            { status: 400 }
          );
        }

        const success = await serverTemporalService.terminateWorkflow(workflowId, reason);
        return NextResponse.json({ success, data: { terminated: success } });

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ Temporal API POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Clean up on exit
process.on('exit', () => {
  serverTemporalService.disconnect();
});
