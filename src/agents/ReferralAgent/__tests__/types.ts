// src/agents/ReferralAgent/types.ts

export interface ReferralAgentConfig {
  agentName: string;
  enabled: boolean;
  // Add contest, reward config as needed
}

export interface ReferralPayload {
  inviterId: string; // user who is inviting
  inviteeId: string; // user being invited
  channel: 'discord' | 'web' | 'other';
  referralCode?: string; // unique referral code/invite link
  meta?: Record<string, any>;
}

export type ReferralStatus = 'pending' | 'completed' | 'invalid' | 'duplicate' | 'rewarded';

export interface ReferralEvent {
  id?: string;
  inviterId: string;
  inviteeId: string;
  eventType: 'created' | 'converted' | 'rewarded' | 'invalid' | 'audit';
  timestamp: string;
  meta?: Record<string, any>;
}

export interface ReferralMetrics {
  inviterId: string;
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  rewardsIssued: number;
  contestPoints?: number;
  breakdown?: {
    [status in ReferralStatus]?: number;
  };
}
