export interface BaseFeature {
  id: string;
  value: number;
  confidence: number;
  timestamp: string;
}

export interface MarketFeature extends BaseFeature {
  type: 'market';
  odds: number;
  line: number;
  volume: number;
  sharpAction: number;
  marketEfficiency: number;
}

export interface PlayerFeature extends BaseFeature {
  type: 'player';
  form: number;
  fatigue: number;
  matchupRating: number;
  roleStability: number;
  recentUsage: number;
  situationalPerformance: number;
}

export interface ContextFeature extends BaseFeature {
  type: 'context';
  venueAdvantage: number;
  weatherImpact: number;
  injuryImpact: number;
  refereeImpact: number;
  motivationalFactors: number;
}

export interface RiskFeature extends BaseFeature {
  type: 'risk';
  correlationRisk: number;
  volatility: number;
  portfolioImpact: number;
}

export interface DataQualityMetrics {
  dataValidationScore: number;
  outlierScore: number;
  consistencyScore: number;
  completeness: number;
}

export interface GradingFeatureSet {
  propId: string;
  date: string;
  sport: string;
  league: string;
  market: {
    type: string;
    odds: number;
    line: number;
  };

  // Prop outcome - OPTIONAL for backward compatibility
  outcome?: 'over' | 'under';

  // Core Features
  expectedValue: number;
  lineMovement: number;
  matchupRating: number;
  playerForm: number;
  injuryImpact: number;
  weatherImpact: number;

  // Market Intelligence
  marketIntelligence: number;
  sharpMoney: number;
  volumeProfile: number;
  closingLineValue: number;
  crossBookVariance?: number;
  marketEfficiency?: number;

  // Player & Game Context
  playerFatigue: number;
  playerFatigueScore?: number; // Alias for compatibility
  venueAdvantage: number;
  refereeImpact: number;
  paceImpact: number;
  motivationalFactors: number;
  recentUsage?: number;
  situationalPerformance?: number;
  trendMomentum?: number;
  restAdvantage?: number;

  // Risk & Correlation
  correlationRisk: number;
  volatility: number;
  portfolioImpact: number;
  valueAtRisk?: number;
  expectedShortfall?: number;
  teamTotalCorrelation?: number;
  gameScriptDependency?: number;
  playerCorrelations?: Record<string, number>;
  marketCorrelations?: Record<string, number>;

  // Data Quality
  dataValidationScore?: number;
  outlierScore?: number;
  consistencyScore?: number;

  // Additional properties for compatibility
  player?: string;
  marketType?: string;
  odds?: number;
  bidAskSpread?: number;

  // Raw Features
  marketFeatures: MarketFeature[];
  playerFeatures: PlayerFeature[];
  contextFeatures: ContextFeature[];
  riskFeatures: RiskFeature[];

  // Metadata
  source: string;
  version: string;
  lastUpdated: string;
}