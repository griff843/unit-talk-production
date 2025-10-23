export interface ReferralAgentConfig {
    agentName: string;
    enabled: boolean;
}
export interface ReferralPayload {
    inviterId: string;
    inviteeId: string;
    channel: 'discord' | 'web' | 'other';
    referralCode?: string;
    meta?: Record<string, unknown>;
}
export type ReferralStatus = 'pending' | 'completed' | 'invalid' | 'duplicate' | 'rewarded';
export interface ReferralEvent {
    id?: string;
    inviterId: string;
    inviteeId: string;
    eventType: 'created' | 'converted' | 'rewarded' | 'invalid' | 'audit';
    timestamp: string;
    meta?: Record<string, unknown>;
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
//# sourceMappingURL=types.d.ts.map