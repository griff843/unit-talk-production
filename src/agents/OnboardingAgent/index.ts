// src/agents/OnboardingAgent/index.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentDependencies, AgentCommand, HealthCheckResult, Metrics } from '../BaseAgent/types';
import { 
  OnboardingStep, 
  OnboardingPayload, 
  OnboardingResult, 
  UserType 
} from './types';
import { sendNotification } from '../NotificationAgent';

export class OnboardingAgent extends BaseAgent {
  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    // Initialize agent-specific properties here
  }

  protected async initializeResources(): Promise<void> {
    await this.validateDependencies();
    this.logger.info('OnboardingAgent resources initialized successfully');
  }

  protected async process(): Promise<void> {
    // Process any pending onboarding tasks
    const { data: pendingTasks, error } = await this.supabase
      .from('onboarding')
      .select('*')
      .eq('status', 'in_progress');

    if (error) {
      throw new Error(`Failed to fetch pending tasks: ${error.message}`);
    }

    for (const task of pendingTasks || []) {
      try {
        await this.processOnboardingTask(task);
        this.metrics.successCount++;
      } catch (error) {
        this.metrics.errorCount++;
        if (error instanceof Error) {
          this.logger.error(`Error processing task ${task.id}:`, error);
        }
      }
    }
  }

  protected async cleanup(): Promise<void> {
    // No cleanup needed
  }

  protected async checkHealth(): Promise<HealthCheckResult> {
    const health: HealthCheckResult = {
      status: 'healthy',
      details: {
        errors: [],
        warnings: [],
        info: {
          lastCheck: new Date().toISOString()
        }
      },
      timestamp: new Date().toISOString()
    };

    // Check database connectivity
    const { error } = await this.supabase
      .from('onboarding')
      .select('id')
      .limit(1);

    if (error) {
      health.status = 'unhealthy';
      health.details.errors.push(`Database connectivity issue: ${error.message}`);
    }

    return health;
  }

  protected async collectMetrics(): Promise<Metrics> {
    const { data: onboardingStats } = await this.supabase
      .from('onboarding')
      .select('status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return {
      errorCount: (onboardingStats || []).filter(s => s.status === 'failed').length,
      warningCount: (onboardingStats || []).filter(s => s.status === 'in_progress').length,
      successCount: (onboardingStats || []).filter(s => s.status === 'complete').length,
      onboardingStats: {
        total: onboardingStats?.length || 0,
        byStatus: onboardingStats?.reduce((acc, curr) => {
          acc[curr.status] = (acc[curr.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {}
      }
    };
  }

  protected async processCommand(command: AgentCommand): Promise<void> {
    switch (command.type) {
      case 'START_ONBOARDING':
        await this.startOnboarding(command.payload);
        break;
      case 'COMPLETE_STEP':
        await this.completeStep(command.payload.userId, command.payload.stepId);
        break;
      default:
        throw new Error(`Unknown command type: ${command.type}`);
    }
  }

  private async validateDependencies(): Promise<void> {
    // Verify access to required tables
    const requiredTables = ['onboarding', 'users'];
    for (const table of requiredTables) {
      const { error } = await this.supabase
        .from(table)
        .select('id')
        .limit(1);

      if (error) {
        throw new Error(`Failed to access table ${table}: ${error.message}`);
      }
    }
  }

  private async processOnboardingTask(task: any): Promise<void> {
    // Implement task processing logic
  }

  private async startOnboarding(payload: OnboardingPayload): Promise<OnboardingResult> {
    const steps = this.getWorkflowSteps(payload.userType);

    const { data, error } = await this.supabase.from('onboarding').insert([{
      user_id: payload.userId,
      user_type: payload.userType,
      steps,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      meta: payload.meta ?? {},
    }]).select();

    if (error) throw error;

    // Send welcome notification
    await sendNotification({
      type: 'onboarding',
      message: `Welcome ${payload.userType}: ${payload.userId}. Please complete your onboarding steps.`,
      channels: ['discord', 'notion'],
      priority: 'low',
      meta: { onboardingId: data[0].id, ...payload.meta }
    });

    this.logger.info('Onboarding started', { userId: payload.userId, userType: payload.userType });

    return { 
      success: true, 
      onboardingId: data[0].id, 
      steps 
    };
  }

  private async completeStep(userId: string, stepId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('onboarding')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) throw error || new Error('Onboarding record not found');

    const steps = data.steps.map((s: OnboardingStep) =>
      s.id === stepId ? { ...s, completed: true, completedAt: new Date().toISOString() } : s
    );
    const allComplete = steps.every((s: OnboardingStep) => s.completed);

    await this.supabase
      .from('onboarding')
      .update({
        steps,
        status: allComplete ? 'complete' : 'in_progress',
        completed_at: allComplete ? new Date().toISOString() : null
      })
      .eq('user_id', userId);

    if (allComplete) {
      await sendNotification({
        type: 'onboarding',
        message: `🎉 ${data.user_type} ${userId} completed onboarding!`,
        channels: ['discord', 'notion'],
        priority: 'low',
        meta: { userId }
      });
    }

    this.logger.info('Onboarding step completed', { userId, stepId, allComplete });

    return allComplete;
  }

  private getWorkflowSteps(userType: UserType): OnboardingStep[] {
    const baseSteps: OnboardingStep[] = [
      { id: 'accept_tos', label: 'Accept Terms of Service', completed: false }
    ];

    switch (userType) {
      case 'customer':
        return [
          ...baseSteps,
          { id: 'profile', label: 'Complete Profile', completed: false },
          { id: 'intro', label: 'Post Introduction', completed: false }
        ];
      case 'capper':
        return [
          ...baseSteps,
          { id: 'kyc', label: 'KYC/Identity Verification', completed: false },
          { id: 'training', label: 'Complete Training', completed: false },
          { id: 'access', label: 'System Access Setup', completed: false }
        ];
      default:
        return baseSteps;
    }
  }

  protected async initialize(): Promise<void> {
    // TODO: Restore business logic here after base migration (initialize)
  }

  protected async initialize(): Promise<void> {
    // TODO: Restore business logic here after base migration (initialize)
  }

  protected async process(): Promise<void> {
    // TODO: Restore business logic here after base migration (process)
  }

  protected async cleanup(): Promise<void> {
    // TODO: Restore business logic here after base migration (cleanup)
  }

  protected async checkHealth(): Promise<HealthStatus> {
    // TODO: Restore business logic here after base migration (checkHealth)
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {}
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    // TODO: Restore business logic here after base migration (collectMetrics)
    return {
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  protected async initialize(): Promise<void> {
    // TODO: Restore business logic here after base migration (initialize)
  }

  protected async process(): Promise<void> {
    // TODO: Restore business logic here after base migration (process)
  }

  protected async cleanup(): Promise<void> {
    // TODO: Restore business logic here after base migration (cleanup)
  }

  protected async checkHealth(): Promise<HealthStatus> {
    // TODO: Restore business logic here after base migration (checkHealth)
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {}
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    // TODO: Restore business logic here after base migration (collectMetrics)
    return {
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }
}