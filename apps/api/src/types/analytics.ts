export interface AnalyticsConfig {
  dailyInterval: number;
  weeklyInterval: number;
  monthlyInterval: number;
  retentionPeriod: number;
  minSampleSize: number;
}

export interface PerformanceMetrics {
  accuracy: number;
  roi: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalPicks: number;
  winningPicks: number;
  losingPicks: number;
  totalProfit: number;
  averageBetSize: number;
  bestSport: string;
  worstSport: string;
  bestMarket: string;
  worstMarket: string;
  confidenceAccuracy: Record<string, number>;
}

export interface SubscriberMetrics {
  totalSubscribers: number;
  activeSubscribers: number;
  newSubscribers: number;
  churnedSubscribers: number;
  retentionRate: number;
  churnRate: number;
  monthlyRecurringRevenue: number;
  averageRevenuePerUser: number;
  subscriberGrowth: number;
  lifetimeValue: number;
  acquisitionCost: number;
  paybackPeriod: number;
  engagementScore: number;
  satisfactionScore: number;
  referralRate: number;
  subscriptionTiers: Record<string, { count: number; revenue: number }>;
}

export interface MarketAnalysis {
  marketSize: number;
  marketGrowth: number;
  marketShare: number;
  competitivePosition: string;
  marketTrends: Record<string, number>;
  seasonality: Record<string, { peak: string; low: string }>;
  regulatoryEnvironment: string;
  technologyTrends: string[];
  customerSegments: Record<string, { percentage: number; growth: number }>;
}

export interface CompetitiveAnalysis {
  competitors: Competitor[];
  competitiveAdvantages: string[];
  competitiveThreats: string[];
  marketPosition: string;
  differentiation: string;
  pricingStrategy: string;
  growthStrategy: string;
}

export interface Competitor {
  name: string;
  marketShare: number;
  accuracy: number;
  pricing: number;
  strengths: string[];
  weaknesses: string[];
}

export interface PredictiveAnalytics {
  subscriberGrowth: GrowthPrediction;
  revenueProjections: RevenuePrediction;
  performancePredictions: PerformancePrediction;
  marketPredictions: MarketPrediction;
}

export interface GrowthPrediction {
  nextMonth: number;
  nextQuarter: number;
  nextYear: number;
  confidence: number;
}

export interface RevenuePrediction {
  nextMonth: number;
  nextQuarter: number;
  nextYear: number;
  confidence: number;
}

export interface PerformancePrediction {
  nextMonthAccuracy: number;
  nextQuarterAccuracy: number;
  nextYearAccuracy: number;
  confidence: number;
}

export interface MarketPrediction {
  marketGrowth: number;
  competitiveThreats: string;
  regulatoryChanges: string;
  confidence: number;
}

export interface AnalyticsReport {
  type: 'daily' | 'weekly' | 'monthly';
  timestamp: string;
  performance: PerformanceMetrics;
  subscribers: SubscriberMetrics;
  market?: MarketAnalysis;
  competitive?: CompetitiveAnalysis;
  predictions?: PredictiveAnalytics;
  summary: string;
}

export interface AnalyticsDashboard {
  timestamp: string;
  performance: PerformanceMetrics;
  subscribers: SubscriberMetrics;
  market: MarketAnalysis;
  competitive: CompetitiveAnalysis;
  predictions: PredictiveAnalytics;
  kpis: KeyPerformanceIndicators;
}

export interface KeyPerformanceIndicators {
  accuracy: number;
  roi: number;
  retention: number;
  growth: number;
  marketShare: number;
  satisfaction: number;
  engagement: number;
}

export interface TrendAnalysis {
  performanceTrend: string;
  subscriberTrend: string;
  marketTrend: string;
  competitiveTrend: string;
  confidence: number;
} 