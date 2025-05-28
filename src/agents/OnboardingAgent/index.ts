// src/agents/OnboardingAgent/index.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from '../BaseAgent';
import { Logger } from '../../utils/logger';
import { 
  AgentCommand, 
  HealthCheckResult, 
  BaseAgentDependencies,
  AgentMetrics,
  AgentStatus 
} from '../../types/agent';
import { 
  OnboardingStep, 
  OnboardingPayload, 
  OnboardingResult, 
  UserType 
} from './types';
import { sendNotification } from '../NotificationAgent';

export class OnboardingAgent extends BaseAgent {
  protected readonly logger: Logger;

  constructor(dependencies: BaseAgentDependencies) {
    super(dependencies);
    this.logger = dependencies.logger || new Logger('OnboardingAgent');
  }

  public async initialize(): Promise<void> {
    await this.validateDependencies();
    await this.initializeResources();
    this.logger.info('OnboardingAgent initialized successfully');
  }

  public async cleanup(): Promise<void> {
    // No cleanup needed
  }

  public async checkHealth(): Promise<HealthCheckResult> {
    return this.healthCheck();
  }

  protected async validateDependencies(): Promise<void> {
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

  protected async initializeResources(): Promise<void> {
    // No additional resources needed
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

  protected async healthCheck(): Promise<HealthCheckResult> {
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
      if (health.details) {
        health.details.errors.push(`Database connectivity issue: ${error.message}`);
      }
    }

    return health;
  }

  protected async collectMetrics(): Promise<AgentMetrics> {
    const { data: onboardingStats } = await this.supabase
      .from('onboarding')
      .select('status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const baseMetrics = this.metrics;
    const status: AgentStatus = baseMetrics.errorCount > 0 ? 'degraded' : 'healthy';

    return {
      ...baseMetrics,
      status,
      agentName: this.config.name,
      successCount: (onboardingStats || []).filter(s => s.status === 'complete').length,
      warningCount: (onboardingStats || []).filter(s => s.status === 'in_progress').length,
      errorCount: (onboardingStats || []).filter(s => s.status === 'failed').length
    };
  }

  public async handleCommand(command: AgentCommand): Promise<void> {
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

  private async processOnboardingTask(task: any): Promise<void> {
    // Implement task processing logic
  }

  async startOnboarding(payload: OnboardingPayload): Promise<OnboardingResult> {
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

  async completeStep(userId: string, stepId: string): Promise<boolean> {
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
      case 'staff':
      case 'mod':
      case 'va':
        return [
          ...baseSteps,
          { id: 'training', label: 'Complete Staff Training', completed: false },
          { id: 'permissions', label: 'Permissions & Role Setup', completed: false }
        ];
      case 'vip':
        return [
          ...baseSteps,
          { id: 'profile', label: 'Complete Profile', completed: false },
          { id: 'welcome', label: 'Schedule Welcome Call', completed: false }
        ];
      default:
        return baseSteps;
    }
  }

  /** Escalate if onboarding is stuck or failed. */
  async escalateStuckOnboarding(userId: string, reason: string) {
    await sendNotification({
      type: 'incident',
      message: `🚨 Onboarding stuck for ${userId}: ${reason}`,
      channels: ['discord', 'notion'],
      priority: 'high',
      meta: { userId, reason }
    });
    this.logger.warn('Onboarding escalation', { userId, reason });
  }
}
