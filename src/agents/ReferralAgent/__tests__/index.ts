// src/agents/ReferralAgent/index.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { ReferralAgentConfig, ReferralPayload, ReferralStatus, ReferralEvent, ReferralMetrics } from './types';
import { BaseAgent } from '../BaseAgent/index';
import { ErrorHandlerConfig } from '../../utils/errorHandling';
import { Logger } from '../../utils/logger';
import { sendNotification } from '../NotificationAgent';

/** Generates a unique, human-friendly referral code */
function generateReferralCode(userId: string): string {
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${userId.split('-')[0]}-${random}`;
}

export class ReferralAgent extends BaseAgent {
  private logger: Logger;

  constructor(
    config: ReferralAgentConfig,
    supabase: SupabaseClient,
    errorConfig: ErrorHandlerConfig
  ) {
    super('ReferralAgent', config, supabase, errorConfig);
    this.logger = new Logger('ReferralAgent');
  }

  /** Get existing or create new referral code for inviter */
  async getOrCreateReferralCode(inviterId: string): Promise<string> {
    // Check if inviter already has a referral code
    const { data, error } = await this.supabase
      .from('referrals')
      .select('referral_code')
      .eq('inviter_id', inviterId)
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) {
      return data[0].referral_code;
    }
    // Generate and store a new code
    const code = generateReferralCode(inviterId);
    await this.supabase.from('referrals').insert([{
      inviter_id: inviterId,
      referral_code: code,
      channel: 'system',   // Or whatever default
      status: 'pending',
      meta: { autoGenerated: true }
    }]);
    return code;
  }

  /** Record a new referral event (inviter invites invitee) */
  async recordReferral(payload: ReferralPayload): Promise<{ success: boolean; eventId?: string }> {
    // 1. Check if referral already exists
    const { data: existing } = await this.supabase
      .from('referrals')
      .select('id')
      .eq('inviter_id', payload.inviterId)
      .eq('invitee_id', payload.inviteeId);

    if (existing && existing.length > 0) {
      this.logger.warn('Duplicate referral attempt', payload);
      return { success: false };
    }

    // 2. Insert new referral
    const { data, error } = await this.supabase.from('referrals').insert([{
      inviter_id: payload.inviterId,
      invitee_id: payload.inviteeId,
      channel: payload.channel,
      referral_code: payload.referralCode,
      status: 'pending',
      created_at: new Date().toISOString(),
      meta: payload.meta || {},
    }]).select();

    if (error) throw error;

    this.logger.info('Referral recorded', { id: data?.[0]?.id, ...payload });

    // 3. Notify inviter (optional)
    await sendNotification({
      type: 'referral',
      message: `Referral started: ${payload.inviterId} invited ${payload.inviteeId}`,
      channels: ['discord'],
      meta: { referralId: data?.[0]?.id }
    });

    return { success: true, eventId: data?.[0]?.id };
  }

  /** Update referral status when invitee completes onboarding (or contest rules) */
  async updateReferralStatus(inviteeId: string, status: ReferralStatus): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('referrals')
      .update({ status, completed_at: new Date().toISOString() })
      .eq('invitee_id', inviteeId)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) return false;

    // 2. Notify inviter if reward/unlock
    if (status === 'completed') {
      await sendNotification({
        type: 'referral',
        message: `🎉 Your referral (${inviteeId}) completed onboarding!`,
        channels: ['discord'],
        meta: { inviterId: data[0].inviter_id, inviteeId }
      });
    }

    this.logger.info('Referral status updated', { inviteeId, status });
    return true;
  }

  /** Get all referral stats for a user (for dashboard, contest, etc) */
  async getReferralStats(userId: string): Promise<ReferralMetrics> {
    // Aggregate by user (inviter)
    const { data, error } = await this.supabase.rpc('get_referral_metrics', { user_id: userId });
    if (error) throw error;
    return data as ReferralMetrics;
  }

  /** Log and expose referral events for contest agent, audits, etc */
  async logEvent(event: ReferralEvent): Promise<void> {
    await this.supabase.from('referral_events').insert([event]);
    this.logger.info('Referral event logged', event);
  }
}
