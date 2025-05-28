// src/agents/OnboardingAgent/index.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { OnboardingAgentConfig, OnboardingPayload, OnboardingStep, OnboardingResult, UserType } from './types';
import { BaseAgent } from '../BaseAgent';
import { ErrorHandlerConfig } from '../../utils/errorHandling';
import { Logger } from '../../utils/logger';
import { sendNotification } from '../NotificationAgent';

export class OnboardingAgent extends BaseAgent {
  private logger: Logger;

  constructor(
    config: OnboardingAgentConfig,
    supabase: SupabaseClient,
    errorConfig: ErrorHandlerConfig
  ) {
    super('OnboardingAgent', config, supabase, errorConfig);
    this.logger = new Logger('OnboardingAgent');
  }

  /**
   * Starts onboarding for a new user of any type.
   */
  async startOnboarding(payload: OnboardingPayload): Promise<OnboardingResult> {
    // 1. Choose workflow by user type
    const steps = this.getWorkflowSteps(payload.userType);

    // 2. Insert onboarding record
    const { data, error } = await this.supabase.from('onboarding').insert([{
      user_id: payload.userId,
      user_type: payload.userType,
      steps,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      meta: payload.meta ?? {},
    }]);

    if (error) throw error;

    // 3. Notify (optional): Welcome message, Discord role, etc.
    await sendNotification({
      type: 'onboarding',
      message: `Welcome ${payload.userType}: ${payload.userId}. Please complete your onboarding steps.`,
      channels: ['discord', 'notion'],
      meta: { onboardingId: data?.[0]?.id, ...payload.meta }
    });

    this.logger.info('Onboarding started', { userId: payload.userId, userType: payload.userType });

    return { success: true, onboardingId: data?.[0]?.id, steps };
  }

  /**
   * Marks an onboarding step as complete for a given user.
   */
  async completeStep(userId: string, stepId: string): Promise<boolean> {
    // Fetch onboarding record
    const { data, error } = await this.supabase
      .from('onboarding')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) throw error || new Error('Onboarding record not found');

    // Update steps
    const steps: OnboardingStep[] = data.steps.map((s: OnboardingStep) =>
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

    // Notify on completion
    if (allComplete) {
      await sendNotification({
        type: 'onboarding',
        message: `🎉 ${data.user_type} ${userId} completed onboarding!`,
        channels: ['discord', 'notion'],
        meta: { userId }
      });
    }

    this.logger.info('Onboarding step completed', { userId, stepId, allComplete });

    return allComplete;
  }

  /**
   * Returns onboarding workflow steps based on userType/role.
   */
  private getWorkflowSteps(userType: UserType): OnboardingStep[] {
    switch (userType) {
      case 'customer':
        return [
          { id: 'accept_tos', label: 'Accept Terms of Service', completed: false },
          { id: 'profile', label: 'Complete Profile', completed: false },
          { id: 'intro', label: 'Post Introduction', completed: false }
        ];
      case 'capper':
        return [
          { id: 'accept_tos', label: 'Accept Terms', completed: false },
          { id: 'kyc', label: 'KYC/Identity Verification', completed: false },
          { id: 'training', label: 'Complete Training', completed: false },
          { id: 'access', label: 'System Access Setup', completed: false }
        ];
      case 'staff':
      case 'mod':
      case 'va':
        return [
          { id: 'accept_tos', label: 'Accept Terms', completed: false },
          { id: 'training', label: 'Complete Staff Training', completed: false },
          { id: 'permissions', label: 'Permissions & Role Setup', completed: false }
        ];
      case 'vip':
        return [
          { id: 'accept_tos', label: 'Accept VIP Agreement', completed: false },
          { id: 'profile', label: 'Complete Profile', completed: false },
          { id: 'welcome', label: 'Schedule Welcome Call', completed: false }
        ];
      default:
        return [
          { id: 'accept_tos', label: 'Accept Terms', completed: false }
        ];
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
