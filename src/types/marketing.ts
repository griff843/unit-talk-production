// Marketing types for MarketingAgent
export interface Campaign {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'social';
  status: 'draft' | 'active' | 'paused' | 'completed';
  startDate: string;
  endDate?: string;
  targetAudience: string[];
  content: {
    subject?: string;
    body: string;
    template?: string;
  };
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
  };
}

export interface EngagementMetrics {
  userId: string;
  campaignId: string;
  action: 'sent' | 'delivered' | 'opened' | 'clicked' | 'converted';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MarketingConfig {
  campaigns: {
    enabled: boolean;
    maxActive: number;
    defaultTemplate: string;
  };
  engagement: {
    trackingEnabled: boolean;
    retentionDays: number;
  };
  channels: {
    email: boolean;
    sms: boolean;
    push: boolean;
    social: boolean;
  };
}

export interface ReferralProgram {
  id: string;
  name: string;
  enabled: boolean;
  rewards: {
    referrer: number;
    referee: number;
  };
  conditions: {
    minDeposit?: number;
    validityDays?: number;
  };
}