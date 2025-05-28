import { HealthCheckResult } from '../../types/agent';

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  startDate: Date;
  endDate?: Date;
  target: CampaignTarget;
  budget?: number;
  metrics: CampaignMetrics;
  rules: CampaignRule[];
  notifications: NotificationConfig[];
}

export type CampaignType = 
  | 'email'
  | 'social'
  | 'push'
  | 'referral'
  | 'promotion'
  | 'contest'
  | 'custom';

export type CampaignStatus = 
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface CampaignTarget {
  userSegments: string[];
  geographies?: string[];
  platforms?: string[];
  customFilters?: Record<string, any>;
}

export interface CampaignMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  roi: number;
  engagementRate: number;
  costPerAcquisition: number;
}

export interface CampaignRule {
  type: string;
  condition: Record<string, any>;
  action: Record<string, any>;
  priority: number;
}

export interface NotificationConfig {
  type: 'email' | 'slack' | 'discord' | 'custom';
  triggers: string[];
  recipients: string[];
  template: string;
  config: Record<string, any>;
}

export interface ReferralProgram {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'ended';
  rewards: ReferralReward[];
  rules: ReferralRule[];
  metrics: ReferralMetrics;
}

export interface ReferralReward {
  type: 'cash' | 'credit' | 'subscription' | 'custom';
  value: number;
  conditions: Record<string, any>;
  expiryDays?: number;
}

export interface ReferralRule {
  type: string;
  conditions: Record<string, any>;
  rewards: ReferralReward[];
}

export interface ReferralMetrics {
  totalReferrals: number;
  activeReferrers: number;
  conversionRate: number;
  revenueGenerated: number;
  averageRewardValue: number;
}

export interface EngagementMetrics {
  period: 'daily' | 'weekly' | 'monthly';
  activeUsers: number;
  retentionRate: number;
  churnRate: number;
  userSentiment: number;
  platformMetrics: Record<string, number>;
  segmentMetrics: Record<string, number>;
}

export interface MarketingEvent {
  type: MarketingEventType;
  timestamp: Date;
  campaign?: string;
  user?: string;
  platform?: string;
  data: Record<string, any>;
  metrics?: Record<string, number>;
}

export type MarketingEventType =
  | 'campaign_triggered'
  | 'referral_created'
  | 'reward_issued'
  | 'engagement_recorded'
  | 'notification_sent'
  | 'conversion_tracked'
  | 'metric_updated';

export interface MarketingAgentMetrics {
  campaigns: {
    active: number;
    completed: number;
    successRate: number;
    averageRoi: number;
  };
  referrals: {
    activePrograms: number;
    totalReferrals: number;
    conversionRate: number;
    revenueGenerated: number;
  };
  engagement: {
    activeUsers: number;
    retentionRate: number;
    satisfactionScore: number;
    growthRate: number;
  };
  healthStatus: HealthCheckResult;
}

// Event types for logging and monitoring
export type MarketingAgentEventType =
  | 'campaign_started'
  | 'campaign_completed'
  | 'campaign_failed'
  | 'referral_program_updated'
  | 'engagement_report_generated'
  | 'promotion_triggered'
  | 'system_error';

export interface MarketingAgentEvent {
  type: MarketingAgentEventType;
  timestamp: Date;
  details: Record<string, any>;
  severity: 'info' | 'warn' | 'error';
  correlationId: string;
} 