/**
 * Smart Form Types - Data structures for smart form integration
 */

export interface SmartTicket {
  id: string;
  bet_slip_id: string;
  capper: string;
  ticket_type: 'single' | 'parlay' | 'teaser' | 'round_robin';
  sport: string;
  game_date: string;
  unit_size: number;
  confidence_level: number; // 1-10 scale
  odds_format: 'american' | 'decimal' | 'fractional';
  auto_parlay: boolean;
  bet_type: string;
  market_type: 'pre_game' | 'live' | 'futures' | 'player_prop' | 'team_prop' | 'game_prop';
  game_selections: SmartGameSelection[];
  legs: SmartTicketLeg[];
  user_tier: 'free' | 'vip' | 'vip_plus';
  current_step: number;
  completed_steps: number[];
  status: 'pending' | 'submitted' | 'processed' | 'error';
  insights?: SmartTicketInsights;
  error_message?: string;
  created_at: string;
  updated_at?: string;
}

export interface SmartGameSelection {
  id: string;
  game_id?: string;
  team_home?: string;
  team_away?: string;
  game_time?: string;
  selection: string;
  odds: string;
  line?: string;
  notes?: string;
}

export interface SmartTicketLeg {
  id: string;
  sport: string;
  bet_category: string;
  selection: string;
  odds: string;
  line?: string;
  player_id?: string;
  stat_type?: string;
  status: 'open' | 'win' | 'loss' | 'push' | 'void';
}

export interface SmartTicketInsights {
  systemGrade: string;
  systemConfidence: number;
  capperConfidence: number;
  expectedValue: number;
  riskFactors: string[];
  marketIntelligence: string;
  featureScores: Record<string, number>;
  timestamp: string;
}

/**
 * Bridge processing status tracking
 */
export interface BridgeProcessingStatus {
  ticketId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  pickId?: string;
  threadId?: string;
  error?: string;
  processedAt?: string;
  insights?: SmartTicketInsights;
}

/**
 * System-wide tracking for AI training
 */
export interface SystemTrackingData {
  id: string;
  pick_id: string;
  smart_ticket_id: string;
  capper: string;
  system_prediction: {
    grade: string;
    confidence: number;
    expectedValue: number;
  };
  capper_prediction: {
    confidence: number;
    reasoning?: string;
  };
  market_data: {
    opening_odds: number;
    closing_odds: number;
    line_movement: number;
    sharp_money_percentage: number;
  };
  outcome?: {
    result: 'win' | 'loss' | 'push';
    actual_value?: number;
    settled_at?: string;
  };
  performance_delta: {
    system_accuracy: number;
    capper_accuracy: number;
    confidence_calibration: number;
  };
  created_at: string;
  updated_at?: string;
}