// Discord.js types
export interface CommandInteraction {
  user: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
  };
  guild: {
    id: string;
    name: string;
  } | null;
  channel: {
    id: string;
    type: number;
  } | null;
  reply: (options: any) => Promise<any>;
  followUp: (options: any) => Promise<any>;
  deferReply: (options?: any) => Promise<any>;
  editReply: (options: any) => Promise<any>;
  options: {
    getString: (name: string) => string | null;
    getNumber: (name: string) => number | null;
    getBoolean: (name: string) => boolean | null;
    getUser: (name: string) => any | null;
    getChannel: (name: string) => any | null;
    getRole: (name: string) => any | null;
    getMentionable: (name: string) => any | null;
    getAttachment: (name: string) => any | null;
  };
}

// User and subscription types
export interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  subscription_tier: 'FREE' | 'VIP' | 'VIP_PLUS';
  created_at: string;
  updated_at: string;
}

export interface UserStats {
  totalPicks: number;
  winRate: number;
  profitLoss: number;
  roi: number;
  streak: number;
  bestStreak: number;
  totalStaked: number;
  totalWon: number;
}

// Pick and bet types
export interface Pick {
  id: string;
  user_id: string;
  sport: string;
  bet_type: string;
  description: string;
  odds: number;
  stake: number;
  confidence: number;
  reasoning?: string;
  status: 'PENDING' | 'WON' | 'LOST' | 'VOID' | 'PUSHED' | 'pending' | 'won' | 'lost' | 'void' | 'pushed';
  created_at: string;
  updated_at: string;
  legs?: BetLeg[];
  ai_analysis?: AIAnalysis;
  validation_result?: ValidationResult;
}

export interface BetLeg {
  id: string;
  sport: string;
  betType: string;
  selection: string;
  odds: number;
  player?: string;
  game?: string;
  line?: number;
  confidence: number;
  status: 'PENDING' | 'WON' | 'LOST' | 'VOID' | 'PUSHED' | 'pending' | 'won' | 'lost' | 'void' | 'pushed';
  result?: string;
  payout?: number;
}


export interface PickData {
  id: string;
  userId: string;
  user_id?: string; // Alias for database compatibility
  sport: string;
  betType: string;
  bet_type?: string; // Alias for database compatibility
  selection: string;
  odds: number;
  stake: number;
  confidence: number;
  status: 'PENDING' | 'WON' | 'LOST' | 'VOID' | 'PUSHED' | 'pending' | 'won' | 'lost' | 'void' | 'pushed';
  timestamp: string;
  created_at?: string; // Alias for database compatibility
  description?: string;
  reasoning?: string;
  tags?: string[];
  legs?: BetLeg[];
  submittedAt?: string;
  submitted_at?: string; // Alias for database compatibility
  gradedAt?: string;
  graded_at?: string; // Alias for database compatibility
  result?: GradingResult;
  aiAnalysis?: BettingAnalysis;
  ai_analysis?: BettingAnalysis; // Alias for database compatibility
  notes?: string;
  imageUrls?: string[];
  image_urls?: string[]; // Alias for database compatibility
  followUpReminder?: boolean;
  follow_up_reminder?: boolean; // Alias for database compatibility
  riskTolerance?: 'LOW' | 'MEDIUM' | 'HIGH';
  risk_tolerance?: 'LOW' | 'MEDIUM' | 'HIGH'; // Alias for database compatibility
  expectedValue?: number;
  expected_value?: number; // Alias for database compatibility
  actualResult?: string;
  actual_result?: string; // Alias for database compatibility
  profitLoss?: number;
  profit_loss?: number; // Alias for database compatibility
  grade?: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  edge?: number;
  tier?: string;
  updated_at?: string;
}

// AI Analysis types
export interface AIAnalysis {
  confidence_score: number;
  key_factors: string[];
  risk_assessment: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'AVOID';
  analysis_summary: string;
  historical_performance: {
    similar_bets_count: number;
    win_rate: number;
    avg_odds: number;
  };
}

export interface ValidationResult {
  is_valid: boolean;
  confidence_level: number;
  warnings: string[];
  suggestions: string[];
  risk_factors: string[];
  expected_value: number;
}

// Sports data types
export interface SportsData {
  sport: string;
  league: string;
  teams: Team[];
  games: Game[];
  odds: OddsData[];
}

export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  city: string;
  conference?: string;
  division?: string;
  stats: TeamStats;
}

export interface TeamStats {
  wins: number;
  losses: number;
  points_per_game: number;
  points_allowed: number;
  field_goal_percentage?: number;
  three_point_percentage?: number;
  free_throw_percentage?: number;
  rebounds_per_game?: number;
  assists_per_game?: number;
  turnovers_per_game?: number;
}

export interface Game {
  id: string;
  home_team: string;
  away_team: string;
  date: string;
  time: string;
  status: 'SCHEDULED' | 'LIVE' | 'FINAL' | 'POSTPONED';
  home_score?: number;
  away_score?: number;
  quarter?: number;
  time_remaining?: string;
}

export interface OddsData {
  game_id: string;
  sportsbook: string;
  spread: {
    home: number;
    away: number;
    home_odds: number;
    away_odds: number;
  };
  moneyline: {
    home: number;
    away: number;
  };
  total: {
    over: number;
    under: number;
    over_odds: number;
    under_odds: number;
  };
  updated_at: string;
}

// Dashboard types
export interface DashboardData {
  user: User;
  stats: UserStats;
  recentPicks: Pick[];
  performance: PerformanceData;
  insights: InsightData[];
  totalUsers?: number;
  activeUsers?: number;
  totalPicks?: number;
  winRate?: number;
  recentActivity?: ActivityLog[];
}

export interface PerformanceData {
  daily: { date: string; profit: number; picks: number }[];
  weekly: { week: string; profit: number; picks: number }[];
  monthly: { month: string; profit: number; picks: number }[];
  by_sport: { sport: string; profit: number; win_rate: number }[];
  by_bet_type: { bet_type: string; profit: number; win_rate: number }[];
}

export interface InsightData {
  id: string;
  type: 'TREND' | 'OPPORTUNITY' | 'WARNING' | 'ACHIEVEMENT';
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  created_at: string;
}

// Form types
export interface SubmitTicketFormData {
  sport: string;
  bet_type: string;
  legs: BetLegInput[];
  stake: number;
  confidence: number;
  reasoning?: string;
  images?: File[];
}

export interface BetLegInput {
  sport: string;
  betType: string;
  selection: string;
  odds: number;
  player?: string;
  game?: string;
  line?: number;
  confidence: number;
}

// Service response types
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Notification types
export interface Notification {
  id: string;
  user_id: string;
  type: 'PICK_RESULT' | 'ACHIEVEMENT' | 'PROMOTION' | 'SYSTEM';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

// Analytics types
export interface AnalyticsData {
  user_id: string;
  event_type: string;
  event_data: Record<string, any>;
  timestamp: string;
  session_id?: string;
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Configuration types
export interface BotConfig {
  discord: {
    token: string;
    clientId: string;
    guildId: string;
  };
  channels: {
    vipPlusPicks: string;
    vipPlusGeneral: string;
    vipPicks: string;
    vipGeneral: string;
    admin: string;
    general: string;
    picks: string;
    announcements: string;
  };
  roles: {
    admin: string;
    moderator: string;
    vipPlus: string;
    vip: string;
    member: string;
  };
  database: {
    url: string;
    apiKey: string;
  };
  features: {
    aiAnalysis: boolean;
    advancedAnalytics: boolean;
    automatedThreads: boolean;
    dmTriggers: boolean;
    gradingSystem: boolean;
  };
  limits: {
    maxPicksPerDay: number;
    maxStakeAmount: number;
    rateLimitWindow: number;
    rateLimitRequests: number;
  };
}

export type SubscriptionTier = 'FREE' | 'PREMIUM' | 'VIP' | 'VIP_PLUS';
export type UserTier = 'member' | 'trial' | 'vip' | 'vip_plus' | 'capper' | 'staff' | 'admin' | 'owner';
export type PickStatus = 'PENDING' | 'WON' | 'LOST' | 'VOID';
export type BetType = 'SPREAD' | 'MONEYLINE' | 'TOTAL' | 'PROP' | 'PARLAY';
export type Sport = 'NFL' | 'NBA' | 'MLB' | 'NHL' | 'NCAAF' | 'NCAAB' | 'UFC' | 'SOCCER';

// Additional types for validation and enhanced functionality
export interface PickValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  suggestions: string[];
  confidenceScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

// EnhancedTicketFormData definition moved to line 990 to avoid duplication

export interface EnhancedPermissions {
  maxPicksPerDay: number;
  maxStakeAmount: number;
  canCreateParlays: boolean;
  canAccessAI: boolean;
  canUploadImages: boolean;
  canViewAnalytics: boolean;
  canAccessPremiumFeatures: boolean;
  canSubmitPicks: boolean;
}

// Additional missing types
export interface EnhancedTicketLeg {
  id?: string;
  team: string;
  opponent: string;
  bet_type: string;
  line: number;
  odds: number;
  player?: string;
  player_name?: string; // Added missing property
  stat_type?: string; // Added missing property
  stat_value?: number;
  confidence?: number;
  sport: string;
  betType: string;
  selection: string;
  game?: string;
  game_context?: string; // Added missing property
  touchdown_type?: string; // Added missing property
  validation_status?: 'VALID' | 'INVALID' | 'PENDING'; // Added missing property
  ai_analysis?: any; // Added missing property
}

export interface EnhancedPickData extends PickData {
  legs: PickLeg[];
  aiAnalysis?: BettingAnalysis;
  riskAssessment?: RiskAssessment;
  followUpReminders?: FollowUpReminder[];
  imageAttachments?: string[];
  socialMetrics?: SocialMetrics;
}

export interface BettingAnalysis {
  pickId?: string;
  pick_id?: string; // Alias for database compatibility
  confidence_score: number;
  overallRating?: number;
  overall_rating?: number; // Alias for database compatibility
  confidence?: number;
  expected_value: number;
  expectedValue?: number; // Alias for database compatibility
  risk_assessment: 'LOW' | 'MEDIUM' | 'HIGH';
  riskAssessment: 'LOW' | 'MEDIUM' | 'HIGH'; // Alias for compatibility
  key_factors: string[];
  keyFactors?: string[]; // Alias for compatibility
  winRate: number;
  profitLoss: number;
  totalBets: number;
  avgUnits: number;
  recommendations: string[];
  warnings?: string[];
  marketAnalysis?: string;
  market_analysis?: string; // Alias for database compatibility
  market_context?: string; // Added missing property
  valueAssessment?: string;
  value_assessment?: string; // Alias for database compatibility
  riskFactors?: string[];
  risk_factors?: string[]; // Alias for database compatibility
  historicalPerformance?: string;
  historical_performance?: string | {
    similar_bets: number;
    win_rate: number;
    avg_return: number;
  };
  weatherImpact?: string;
  weather_impact?: string; // Alias for database compatibility
  injuryReport?: string;
  injury_report?: string; // Alias for database compatibility
  publicBettingTrends?: string;
  public_betting_trends?: string; // Alias for database compatibility
  sharpMoney?: string;
  sharp_money?: string; // Alias for database compatibility
  lineMovement?: string;
  line_movement?: string; // Alias for database compatibility
  modelPrediction?: string;
  model_prediction?: string; // Alias for database compatibility
  edge?: number;
  tier?: string;
  grade?: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  notes?: string;
  created_at?: string;
  updated_at?: string;
  sportBreakdown: { [sport: string]: any };
  market_analysis_detailed?: {
    line_movement: string;
    public_betting_percentage: number;
    sharp_money_indicator: boolean;
  };
  // Added missing properties for coaching
  summary?: string;
  insights?: string[];
  improvements?: string[];
  strengths?: string[];
  weaknesses?: string[];
  trends?: string[];
  userId?: string; // Add userId property
}

// Add missing interfaces for validation and analysis
export interface AdvancedValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  suggestions: string[];
  confidence: number;
  processingTime: number;
}

export interface AIAnalysisResult {
  confidence: number;
  insights: AICoachingInsight[];
  riskFactors: RiskFactor[];
  recommendations: string[];
  marketAnalysis?: MarketAnalysis;
  historicalComparison?: HistoricalComparison;
}

export interface MarketAnalysis {
  marketTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  volatility: number;
  liquidity: number;
  publicSentiment: number;
  sharpMoney: number;
}

export interface HistoricalComparison {
  similarPicks: PickData[];
  averageOdds: number;
  winRate: number;
  averageROI: number;
  sampleSize: number;
}


export interface BetTypeConfig {
  id?: string; // Added missing property
  name: string;
  displayName: string;
  description?: string;
  category?: string; // Added missing property
  requiresLine?: boolean;
  requiresPlayer?: boolean;
  validation?: {
    minOdds?: number;
    maxOdds?: number;
  };
}

export interface PlayerSearchResult {
  id: string;
  name: string;
  team: string;
  position: string;
  sport: string;
  player_name?: string; // Added missing property
  player_id?: string; // Added missing property
  image_url?: string; // Added missing property
  team_logo?: string; // Added missing property
  recent_performance?: string; // Added missing property
  injury_status?: string; // Added missing property
}


export interface GameSearchResult {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  sport: string;
  league: string;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'POSTPONED' | 'FINAL';
  matchup?: string;
  home_logo?: string;
  away_logo?: string;
  home_team?: string; // for database compatibility
  away_team?: string; // for database compatibility
  game_date?: string;
  game_time?: string;
  weather?: any;
  lines?: any;
}

export interface RiskFactor {
  type: string;
  severity: ValidationSeverity;
  description: string;
  impact: number;
  category?: string;
}

export interface FollowUpReminder {
  id: string;
  pickId: string;
  userId: string;
  reminderTime: string;
  message: string;
  isActive: boolean;
  createdAt: string;
}

export interface SocialMetrics {
  likes: number;
  comments: number;
  shares: number;
  views: number;
  engagement: number;
}

export interface SubmissionResult {
  success: boolean;
  pick_id?: string;
  ticketId?: string;
  ticket_id?: string; // Added missing property
  message: string;
  warnings?: string[];
  errors?: ValidationError[];
  analysis?: BettingAnalysis;
  coaching_insights?: AICoachingInsight[];
}

export interface SearchResults {
  players: Player[];
  teams: Team[];
  games: Game[];
  total_results: number;
}

export interface Player {
  id: string;
  name: string;
  team: string;
  position: string;
  jersey_number?: number;
  stats?: PlayerStats;
}

export interface PlayerStats {
  games_played: number;
  points_per_game?: number;
  rebounds_per_game?: number;
  assists_per_game?: number;
  field_goal_percentage?: number;
  three_point_percentage?: number;
  free_throw_percentage?: number;
  // Additional sport-specific stats
  yards_per_game?: number;
  touchdowns?: number;
  interceptions?: number;
  completion_percentage?: number;
}

export interface FormValidationError {
  field: string;
  message: string;
  code: string;
}

export interface TicketLeg {
  team: string;
  opponent: string;
  betType: string;
  line: number;
  odds: number;
  player?: string;
  statType?: string;
  statValue?: number;
}

export interface ParlayValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  maxLegs: number;
  correlationWarnings: string[];
}

export interface ImageValidationResult {
  isValid: boolean;
  errors: string[];
  fileSize: number;
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface OnboardingProgress {
  userId: string;
  currentStep: string;
  completedSteps: string[];
  completedAt?: string;
  isComplete: boolean;
  startedAt: string;
  lastUpdated: string;
}

export interface UserPreferences {
  favoriteTeams: string[];
  favoriteSports: string[];
  notificationSettings: {
    pickResults: boolean;
    achievements: boolean;
    promotions: boolean;
    coaching: boolean;
  };
  displaySettings: {
    theme: 'light' | 'dark';
    timezone: string;
    currency: string;
  };
  bettingPreferences: {
    defaultStake: number;
    riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH';
    preferredOddsFormat: 'DECIMAL' | 'AMERICAN' | 'FRACTIONAL';
  };
  experienceLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  sports?: string[];
}

export interface CoachingInsight {
  type: 'TIP' | 'WARNING' | 'OPPORTUNITY' | 'PATTERN';
  title: string;
  description: string;
  actionable: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  category: 'BANKROLL' | 'STRATEGY' | 'RESEARCH' | 'PSYCHOLOGY';
}

export interface AICoachingInsight {
  type: 'TIP' | 'WARNING' | 'OPPORTUNITY' | 'PATTERN';
  title: string;
  description: string;
  actionable: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  category: 'BANKROLL' | 'STRATEGY' | 'RESEARCH' | 'PSYCHOLOGY';
}

// Additional utility types
export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';
export type AnalysisType = 'BASIC' | 'ADVANCED' | 'PREMIUM';
export type NotificationType = 'PICK_RESULT' | 'ACHIEVEMENT' | 'PROMOTION' | 'SYSTEM' | 'COACHING';

// SportConfig definition moved to line 994 to avoid duplication

// Fix PlayerSearchResult and GameSearchResult
export interface PlayerSearchResult {
  id: string;
  name: string;
  team: string;
  position: string;
  sport: string;
  league: string;
}



// BetTypeConfig definition moved to line 856 to avoid duplication

// Admin Dashboard Types
export interface AdminDashboardData {
  totalUsers: number;
  activeUsers: number;
  totalPicks: number;
  winRate: number;
  recentActivity: ActivityLog[];
  systemHealth: SystemHealth;
  userStats: UserStats[];
  performanceMetrics: PerformanceMetrics;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  timestamp: string;
  details?: any;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  memory: number;
  cpu: number;
  database: 'connected' | 'disconnected';
}

export interface PerformanceMetrics {
  response_time: number;
  error_rate: number;
  throughput: number;
  active_connections: number;
}

// DM Trigger Types
export interface DMTrigger {
  id: string;
  keyword: string;
  response: string;
  enabled: boolean;
  created_by: string;
  created_at: string;
  usage_count: number;
}

// Cooldown Types
export interface CooldownData {
  user_id: string;
  command: string;
  expires_at: number;
}

export interface UserPickSubmission {
  id: string;
  userId: string;
  gameId: string;
  description: string;
  odds: string;
  units: number;
  confidence: number;
  submittedAt?: string; // ISO string format
  timestamp?: Date; // Add timestamp property
  status?: string; // Add status property
  sport?: string; // Add sport property
  betType: string;
  legs: BetLegInput[];
  stake: number;
  pick: {
    id: string;
    user_id: string;
    message_id: string;
    channel_id: string;
    sport: string;
    league: string;
    team1: string;
    team2: string;
    pick_type: string;
    description: string;
    odds: number;
    units: number;
    confidence: number;
    reasoning?: string;
    result?: string;
    profit_loss?: number;
    created_at: Date;
    updated_at: Date;
  };
}

export interface GradingResult {
  pick_id: string;
  pickId?: string; // For backward compatibility
  status: 'won' | 'lost' | 'void' | 'pushed';
  actual_result: string;
  expected_value: number;
  profit_loss: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  notes?: string;
  // Additional properties used by gradingService
  edge?: number;
  tier?: string;
  confidence?: number;
  factors?: GradingFactor[];
  feedback?: string;
  coachNotes?: string;
  improvementAreas?: string[];
  analysis?: string;
}

// User Permissions Types
export interface UserPermissions {
  tier?: UserTier;
  canUsePicks: boolean;
  canUseAdmin: boolean;
  canModerate: boolean;
  canAccessVIP: boolean;
  canAccessVIPPlus: boolean;
  canSubmitPicks: boolean;
  canAccessCoaching: boolean;
  canUseDMs: boolean;
  canCreateThreads: boolean;
  canViewVIPContent: boolean;
  canViewVipPlusContent: boolean;
  canUseCommand: boolean;
  canViewAnalytics: boolean;
  canEditConfig: boolean;
  canUseAdminCommands: boolean;
  canUseModeratorCommands: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  maxPicksPerDay: number;
  maxDMsPerHour?: number;
  cooldownSeconds: number;
  roles?: string[];
  isRateLimited?: boolean;
}

// Additional missing types
export interface PickLeg {
  id: string;
  sport: string;
  betType: string;
  selection: string;
  odds: number;
  player?: string;
  game?: string;
  line?: number;
  confidence: number;
  status: 'PENDING' | 'WON' | 'LOST' | 'VOID' | 'PUSHED' | 'pending' | 'won' | 'lost' | 'void' | 'pushed';
  result?: string;
  payout?: number;
}

// Schema types
export interface TicketFormSchema {
  [key: string]: any;
}

export const ticketFormSchema = {} as TicketFormSchema;
export const enhancedTicketFormSchema = ticketFormSchema;

// Add missing BetTypeConfig interface
export interface BetTypeConfig {
  id?: string; // Added missing property
  name: string;
  displayName: string;
  requiresPlayer?: boolean;
  requiresGame?: boolean;
  requiresLine?: boolean;
  minOdds?: number;
  maxOdds?: number;
  description?: string;
  category?: string; // Added missing property
}

// Add missing UserProfile interface
export interface UserProfile {
  userId: string;
  username: string;
  discriminator: string;
  avatar?: string;
  avatar_url?: string; // Added for Discord avatar URL
  subscription_tier: SubscriptionTier;
  tier: UserTier; // Added for tier compatibility
  preferences?: UserPreferences;
  created_at: string;
  updated_at: string;
  last_active?: string; // Added for last activity tracking
  total_picks?: number; // Added for stats
  total_wins?: number; // Added for stats
  total_losses?: number; // Added for stats
  total_profit?: number; // Added for stats
  win_rate?: number; // Added for stats
  trial_ends_at?: string; // Added for trial tracking
}

// Update OnboardingProgress to include missing properties
export interface OnboardingProgress {
  userId: string;
  user_id?: string; // Alias for database compatibility
  currentStep: string;
  current_step?: string; // Alias for database compatibility
  completedSteps: string[];
  completed_steps?: string[]; // Alias for database compatibility
  completedAt?: string;
  completed_at?: string; // Alias for database compatibility
  isComplete: boolean;
  startedAt: string;
  lastUpdated: string;
  preferences?: UserPreferences;
}

// Update ValidationError to include missing properties
export interface ValidationError {
  field: string;
  message: string;
  severity: ValidationSeverity;
  code?: string;
  legIndex?: number;
}

// Update EnhancedPermissions to include missing properties
export interface EnhancedPermissions {
  maxPicksPerDay: number;
  maxStakeAmount: number;
  canCreateParlays: boolean;
  canAccessAI: boolean;
  canUploadImages: boolean; // Added missing property
  canViewAnalytics: boolean;
  canAccessPremiumFeatures: boolean; // Added missing property
  canSubmitPicks: boolean;
  canViewCoaching?: boolean;
  canExportData?: boolean; // Added missing property
}

// Update AICoachingInsight to include missing properties
export interface AICoachingInsight {
  type: 'TIP' | 'WARNING' | 'OPPORTUNITY' | 'PATTERN';
  title: string;
  description: string;
  actionable: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  category: 'BANKROLL' | 'STRATEGY' | 'RESEARCH' | 'PSYCHOLOGY';
  actionable_steps?: string[];
}

// Update OnboardingStep to include missing values
export type OnboardingStep =
  | 'WELCOME'
  | 'PROFILE_SETUP'
  | 'PREFERENCES'
  | 'SPORTS_SELECTION'
  | 'TUTORIAL'
  | 'FIRST_PICK'
  | 'COMPLETE'
  | 'profile'
  | 'preferences'
  | 'tutorial'
  | 'completion';

export interface PlayerSearchResult {
  id: string;
  name: string;
  player_name?: string; // Added missing property
  player_id?: string; // Added missing property
  team: string;
  position: string;
  sport: string;
  league: string;
  image_url?: string; // Added missing property
  team_logo?: string; // Added missing property
  recent_performance?: string; // Changed from any to string for consistency
  injury_status?: string; // Added missing property
}



// Update EnhancedTicketFormData to include missing properties
export interface EnhancedTicketFormData {
  capper?: string; // Added missing property
  ticket_type?: string; // Added missing property
  unit_size?: number; // Added missing property
  auto_parlay?: boolean; // Added missing property
  sport?: string; // Added missing property
  game_date?: string; // Added missing property
  confidence_level?: number; // Added missing property
  legs?: EnhancedTicketLeg[]; // Added missing property
  imageAttachments?: File[]; // Added missing property
  betType?: string; // Added missing property
  bet_type?: string; // Added missing property
  stake?: number; // Added missing property
  confidence?: number; // Added missing property
  betTypes?: string[]; // Added missing property
}

// Update SportConfig to include betTypes as objects
export interface SportConfig {
  name: string;
  displayName: string; // Added missing property
  betTypes: (string | BetTypeConfig)[];
  positions?: string[]; // Added missing property
  leagues?: string[]; // Added missing property
  season?: {
    start: string;
    end: string;
  }; // Added missing property
  requiresPlayer?: boolean;
  requiresGame?: boolean;
  requiresLine?: boolean;
  minOdds?: number;
  maxOdds?: number;
  logo?: string; // Added missing property
  dynamicFields?: any; // Added missing property
  imageAssets?: any; // Added missing property
  validation?: {
    minOdds?: number;
    maxOdds?: number;
    maxParlay?: number;
  }; // Added missing property
}


// ... existing code ...

// Removed duplicate UserPickSubmission interface - consolidated above

// ... existing code ...

// Keyword and Emoji DM Service Types
export interface KeywordTrigger {
  id: string;
  name: string;
  description?: string;
  keywords: string[];
  matchType: 'EXACT' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'exact' | 'partial' | 'regex';
  template_id: string;
  templateId: string; // Alias for compatibility
  conditions?: TriggerCondition[];
  cooldownMinutes?: number;
  priority?: number;
  is_active: boolean;
  isActive: boolean; // Alias for compatibility
  created_by: string;
  created_at: string;
  updated_at: string;
  activation_count?: number;
}

export interface EmojiTrigger {
  id: string;
  name: string;
  description?: string;
  emoji: string[];
  emoji_identifiers: string[];
  template_id: string;
  templateId: string; // Alias for compatibility
  conditions?: TriggerCondition[];
  cooldownMinutes?: number;
  priority?: number;
  is_active: boolean;
  isActive: boolean; // Alias for compatibility
  created_by: string;
  created_at: string;
  updated_at: string;
  activation_count?: number;
}

export interface AutoDMTemplate {
  id: string;
  name: string;
  title: string;
  subject?: string;
  description?: string;
  content: string;
  embed_color?: string;
  embed_data?: any; // Changed from embedData
  buttons?: DMButton[];
  components_data?: any; // Changed from componentsData
  variables?: Record<string, any>;
  embeds?: any[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  usage_count?: number;
}

export interface DMButton {
  label: string;
  style: 'PRIMARY' | 'SECONDARY' | 'SUCCESS' | 'DANGER' | 'LINK';
  emoji?: string;
  custom_id?: string;
  url?: string;
}

export interface TriggerCondition {
  type: 'ROLE' | 'CHANNEL' | 'TIME' | 'USER_TIER' | 'MESSAGE_LENGTH';
  operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'NOT_CONTAINS' | 'GREATER_THAN' | 'LESS_THAN';
  value: string | number;
}

// Quick Edit Config Service Types
export interface ConfigUpdate {
  key: string;
  value: any;
  previous_value?: any;
  updated_by: string;
  updated_at: string;
}

export interface QuickEditSession {
  id: string;
  user_id: string;
  config_section: string;
  changes: ConfigUpdate[];
  is_active: boolean;
  created_at: string;
  expires_at: string;
}

// Template creation types
export interface CreateAutoDMTemplate {
  name: string;
  title: string;
  description?: string;
  subject?: string;
  content: string;
  embed_color?: string;
  embed_data?: any;
  buttons?: DMButton[];
  components_data?: any;
  variables?: Record<string, any>;
  embeds?: any[];
}

// Thread Service Types
export interface GameThread {
  id: string;
  game_id: string;

  channel_id: string;
  thread_id: string;
  sport: string;
  teams: string[];
  game_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Additional Grading Types
export interface GradingFactor {
  name: string;
  value: number;
  weight: number;
  description?: string;
  category?: string; // Add category property
  score?: number; // Add score property
}

export interface CoachingRecommendation {
  type: 'improvement' | 'strength' | 'warning' | 'bankroll' | 'research' | 'sport_focus' | 'timing'; // Add missing types
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionItems?: string[];
}

export interface RiskFactor {
  name: string;
  level: 'low' | 'medium' | 'high';
  description: string;
  impact: number;
}

export interface RiskAssessment {
  overall: 'low' | 'medium' | 'high' | 'conservative' | 'moderate' | 'aggressive' | 'reckless';
  level?: 'low' | 'medium' | 'high' | 'conservative' | 'moderate' | 'aggressive' | 'reckless'; // For backward compatibility
  overallRisk?: 'LOW' | 'MEDIUM' | 'HIGH'; // Legacy compatibility
  overall_risk?: 'LOW' | 'MEDIUM' | 'HIGH'; // Alias for compatibility
  factors: RiskFactor[];
  score: number;
  recommendations: string[];
}