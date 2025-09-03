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
  unifiedPickId?: string; // v3.0.0 unified picks ID for updating grading results
  gameId?: string;
  date: string;
  sport: string;
  league: string;
  player?: string;
  marketType?: string;
  odds?: number;
  market: {
    type: string;
    odds: number;
    line: number;
  };
  // Back-compat aliases
  line?: number;
  pro_attempts?: number;

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
  bidAskSpread?: number;
  
  // 🆕 NEW: Professional Capper Data Fields
  lineMovementHistory?: Array<{timestamp: number; line: number; volume?: number}>;
  bettingPercentages?: {public: number; sharp: number; timestamp: number};
  steamMoveData?: {detected: boolean; confidence: number; timestamp: number};
  multiBookLines?: Array<{book: string; line: number; odds: number; timestamp: number}>;
  injuryNewsTimeline?: Array<{timestamp: number; severity: number; newsBreak: number}>;
  crossMarketProps?: Array<{relatedPropId: string; correlation: number}>;
  marketTimingScore?: number;
  optimalBettingWindow?: string;
  contrarianOpportunity?: boolean;

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
  dataQuality: DataQualityMetrics;

  // Enhanced Game Context
  game_date?: string;
  gameDate?: string;  // Alternative field name
  hoursToGame?: number;
  late_breaking_news?: boolean;
  public_betting_percentage?: number;
  model_agreement?: number;
  
  // Metadata
  timestamp: string;
  version: string;
  source: string;
  confidence: number;
  book?: string; // Optional book/sportsbook name
  
  // Feature Collections
  features?: {
    market?: MarketFeature[];
    player?: PlayerFeature[];
    context?: ContextFeature[];
    risk?: RiskFeature[];
  };
}