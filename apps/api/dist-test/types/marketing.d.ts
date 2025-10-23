export interface Campaign {
    id: string;
    name: string;
    type: 'email' | 'social' | 'content' | 'paid';
    status: 'draft' | 'active' | 'paused' | 'completed';
    startDate: string;
    endDate: string;
    budget?: number;
    metrics: {
        impressions: number;
        clicks: number;
        conversions: number;
        cost: number;
    };
    targeting: {
        audience: string[];
        platforms: string[];
        locations: string[];
    };
    content: {
        title: string;
        description: string;
        cta: string;
        assets: string[];
    };
}
export interface ReferralProgram {
    id: string;
    name: string;
    status: 'active' | 'paused';
    rewards: {
        referrer: {
            type: 'credit' | 'discount' | 'points';
            value: number;
        };
        referee: {
            type: 'credit' | 'discount' | 'points';
            value: number;
        };
    };
    metrics: {
        totalReferrals: number;
        activeReferrers: number;
        conversionRate: number;
        revenueGenerated: number;
    };
    conditions: {
        minDeposit: number;
        validityDays: number;
        maxRewards: number;
    };
}
export interface EngagementMetrics {
    id: string;
    period: {
        start: string;
        end: string;
    };
    metrics: {
        activeUsers: number;
        sessionDuration: number;
        bounceRate: number;
        retentionRate: number;
        churnRate: number;
    };
    channels: {
        name: string;
        engagement: number;
        reach: number;
        interactions: number;
    }[];
    segments: {
        name: string;
        size: number;
        engagement: number;
        ltv: number;
    }[];
    trends: {
        metric: string;
        values: number[];
        change: number;
    }[];
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
//# sourceMappingURL=marketing.d.ts.map