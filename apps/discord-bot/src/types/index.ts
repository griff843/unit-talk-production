// All types are defined as exports below
/** Core Discord Types */
export interface BotConfig {
  prefix: string;
  channels: {
    general: string;
    picks: string;
    vip: string;
    vipPlus: string;
    admin: string;
    logs: string;
    announcements: string;
    freePicks: string;
    vipPicks: string;
    vipGeneral: string;
    vipPlusPicks: string;
    vipPlusGeneral: string;
    threads: string;
  };
  roles: {
    member: string;
    vip: string;
    vipPlus: string;
    staff: string;
    admin: string;
    owner: string;
    moderator: string;
  };
  features: {
    vipNotifications: boolean;
    autoThreads: boolean;
    keywordDMs: boolean;
    aiGrading: boolean;
    analytics: boolean;
    autoGrading: boolean;
  };
  cooldowns: {
    picks: number;
    commands: number;
    dms: number;
  };
  limits: {
    maxPicksPerDay: number;
    maxDMsPerHour: number;
    maxThreadsPerDay: number;
    maxUnitsPerPick: number;
    threadAutoArchiveMinutes: number;
  };
  supabase: {
    url: string;
    key: string;
    serviceRoleKey: string;
  };
  discord: {
    token: string;
    clientId: string;
    guildId: string;
  };
  agents: {
    enabled: boolean;
    endpoints: {
      grading: string;
      analytics: string;
    };
    baseUrl: string;
    apiKey: string;
  };
}

// User Management Types
/** Force TypeScript to refresh UserTier type */
// User tier system - Updated to include trial and capper tiers
export type UserTier =
  | 'member'
  | 'trial'
  | 'vip'
  | 'vip_plus'
  | 'capper'
  | 'staff'
  | 'admin'
  | 'owner';

export interface BotUserProfile {
  id?: string;
  discord_id: string;
  display_name?: string;
  tier: UserTier;
  total_messages?: number;
  total_reactions?: number;
  activity_score?: number;
  last_active?: Date | string;
  winning_picks?: number;
  total_profit?: number;
  created_at?: Date | string;
  updated_at?: Date | string;
  // Allow any additional properties from database
  [key: string]: any;
}

// Simplified UserProfile interface (removed BotUserProfile alias)
export interface UserProfile {
  id?: string;
  discord_id: string;
  display_name?: string;
  tier: UserTier;
  total_messages?: number;
  total_reactions?: number;
  activity_score?: number;
  last_active?: Date | string;
  winning_picks?: number;
  total_profit?: number;
  created_at?: Date | string;
  updated_at?: Date | string;
  // Allow any additional properties from database
  [key: string]: any;
}

export interface UserPreferences {
  sports: string[];
  notifications: boolean;
  dm_enabled: boolean;
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  betting_goals: string[];
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
}

// User Permissions Types
export interface UserPermissions {
  tier: UserTier;
  canSubmitPicks: boolean;
  canViewVIPContent: boolean;
  canViewVipPlusContent: boolean;
  canUseCommand: boolean;
  canCreateThreads: boolean;
  canViewAnalytics: boolean;
  canAccessAnalytics: boolean;
  canEditConfig: boolean;
  canUseAdminCommands: boolean;
  canUseModeratorCommands: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  roles: string[];
  canAccessVIP: boolean;
  canAccessVIPPlus: boolean;
  canAccessCoaching: boolean;
  canUseDMs: boolean;
  maxPicksPerDay: number;
  maxDMsPerHour: number;
  isRateLimited: boolean;
  canUsePicks: boolean;
  canUseAdmin: boolean;
  canModerate: boolean;
  cooldownSeconds: number;
}

// Onboarding Types

// Onboarding Types
export type OnboardingStep = 'welcome' | 'profile' | 'preferences' | 'tutorial' | 'completion';

export interface OnboardingProgress {
  user_id: string;
  current_step: OnboardingStep;
  completed_steps: OnboardingStep[];
  started_at: string;
  completed_at?: string;
  preferences?: Partial<UserPreferences>;
}

// Sports & Betting Types
export interface SportConfig {
  name: string;
  displayName: string;
  betTypes: BetType[];
  positions: string[];
  leagues: string[];
  season: {
    start: string;
    end: string;
  };
  color?: string;
  imageAssets?: {
    playerPath?: string;
    teamPath?: string;
    [key: string]: string | undefined;
  };
  validation?: {
    maxParlay?: number;
    minOdds?: number;
    maxOdds?: number;
    [key: string]: any;
  };
}

export interface BetType {
  id: string;
  name: string;
  displayName?: string;
  description: string;
  category: 'spread' | 'total' | 'moneyline' | 'prop' | 'futures';
  requiresLine?: boolean;
  requiresPlayer?: boolean;
  requiresTeam?: boolean;
}

// Pick Management Types
export interface PickData {
  id?: string;
  user_id: string;
  sport: string;
  bet_type: string;
  selection: string;
  odds: number;
  stake: number;
  confidence: number;
  reasoning?: string;
  status: 'pending' | 'won' | 'lost' | 'void' | 'pushed';
  created_at: string;
  graded_at?: string;
  expected_value?: number;
  risk_level?: 'low' | 'medium' | 'high';
  description?: string;
  units?: number;
  team1?: string;
  team2?: string;
  league?: string;
  pick_type?: string;
  legs?: any[];
  timestamp?: string;
}

export interface PickValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  suggestions: string[];
  confidenceScore?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity?: 'ERROR' | 'WARNING' | 'INFO';
}

// AI & Analysis Types
export interface BettingAnalysis {
  pickId?: string;
  period?: string;
  confidence_score: number;
  confidence?: number; // Alias for confidence_score
  expected_value: number;
  expectedValue?: number; // Alias for expected_value
  risk_assessment: 'low' | 'medium' | 'high';
  riskLevel?: 'low' | 'medium' | 'high'; // Alias for risk_assessment
  risk_level?: string; // Alias for risk_assessment
  key_factors: string[];
  factors?: GradingFactor[];
  recommendations: string[];
  recommendation?: 'strong_buy' | 'buy' | 'hold' | 'avoid';
  market_context: string;
  summary: string;
  insights: string[];
  improvements: string[];
  totalBets: number;
  winRate: number;
  avgUnits: number;
  sportBreakdown: Record<string, number>;
  edge?: number;
  profitLoss?: number;
  avgOdds?: number;
  avgEdge?: number;
  strengths?: string[];
  weaknesses?: string[];
  trends?: string[];
  riskAssessment?: any;
  userId?: string;
}

export interface AICoachingInsight {
  type: 'strategy' | 'bankroll' | 'selection' | 'timing';
  title: string;
  description: string;
  actionable_steps: string[];
  priority: 'low' | 'medium' | 'high';
  actionable?: boolean;
  category?: string;
}

// Enhanced Form Types
export interface EnhancedTicketFormData {
  sport: string;
  bet_type: string;
  legs: EnhancedTicketLeg[];
  stake: number;
  confidence: number;
  reasoning?: string;
  image_attachments?: File[];
}

export interface EnhancedTicketLeg {
  id: string;
  sport: string;
  bet_type: string;
  selection: string;
  odds: number;
  player?: string;
  team?: string;
  game?: string;
  line?: number;
}

// Search & Autocomplete Types
export interface PlayerSearchResult {
  id: string;
  name: string;
  team: string;
  position: string;
  sport: string;
}

export interface GameSearchResult {
  id: string;
  home_team: string;
  away_team: string;
  date: string;
  sport: string;
  league: string;
}

export interface SearchResults {
  players: PlayerSearchResult[];
  games: GameSearchResult[];
  teams: string[];
}

// Submission & Response Types
export interface SubmissionResult {
  success: boolean;
  pick_id?: string;
  message: string;
  analysis?: BettingAnalysis;
  coaching_insights?: AICoachingInsight[];
}

// Grading Types
export interface GradingResult {
  pick_id: string;
  pickId?: string; // For backward compatibility
  status: 'won' | 'lost' | 'void' | 'pushed';
  actual_result: string;
  expected_value: number;
  profit_loss: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  notes?: string;
  graded_at?: string;
  graded_by?: string;
  actual_odds?: number;
  payout?: number;
  // Additional properties used by gradingService
  edge?: number;
  tier?: string;
  confidence?: number;
  factors?: GradingFactor[];
  feedback?: string;
  coachNotes?: string;
  improvementAreas?: string[];
  analysis?: string;
  reasoning?: string;
  risk_assessment?: 'low' | 'medium' | 'high';
  created_at?: Date;
}

export interface GradingFactor {
  name: string;
  value: number;
  weight: number;
  description?: string;
  score?: number;
  professional_score?: number;
  category?: string;
}

export interface CoachingRecommendation {
  id?: string;
  type: 'improvement' | 'strength' | 'warning' | 'timing' | 'bankroll' | 'research' | 'sport_focus';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionItems?: string[];
  category?: string;
  expectedImpact?: string;
}

export interface RiskFactor {
  name: string;
  level: 'low' | 'medium' | 'high';
  description: string;
  impact: number;
}

export interface RiskAssessment {
  overall: 'low' | 'medium' | 'high';
  level?: 'low' | 'medium' | 'high' | 'conservative' | 'moderate' | 'aggressive' | 'reckless'; // For backward compatibility
  factors: RiskFactor[];
  score: number;
  recommendations: string[];
  warnings?: string[];
  maxRecommendedUnits?: number;
}

// Chart & Analytics Types
export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}

// Permission & Access Types
export interface EnhancedPermissions {
  canSubmitPicks: boolean;
  canViewAnalytics: boolean;
  canAccessAI: boolean;
  canCreateParlays: boolean;
  canViewCoaching: boolean;
  canExportData: boolean;
  canUploadImages: boolean;
  canAccessPremiumFeatures: boolean;
  maxPicksPerDay: number;
  maxStakeAmount: number;
}

// Notification Types
export interface NotificationPreferences {
  pick_results: boolean;
  daily_recap: boolean;
  market_alerts: boolean;
  coaching_tips: boolean;
  community_updates: boolean;
  dm_notifications: boolean;
}

// Error Handling Types
export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Database Types
export interface DatabaseConfig {
  url: string;
  key: string;
  schema: string;
}

// Logging Types
export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// Export validation schemas
export const enhancedTicketFormSchema = {
  sport: { required: true, type: 'string' },
  bet_type: { required: true, type: 'string' },
  legs: { required: true, type: 'array', minLength: 1 },
  stake: { required: true, type: 'number', min: 0.01 },
  confidence: { required: true, type: 'number', min: 1, max: 10 },
};

export const pickValidationSchema = {
  user_id: { required: true, type: 'string' },
  sport: { required: true, type: 'string' },
  bet_type: { required: true, type: 'string' },
  selection: { required: true, type: 'string' },
  odds: { required: true, type: 'number' },
  stake: { required: true, type: 'number', min: 0.01 },
  confidence: { required: true, type: 'number', min: 1, max: 10 },
};

export type StrategyType = 'strategy' | 'bankroll' | 'selection' | 'timing';

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

export interface DashboardData {
  totalUsers: number;
  activeUsers: number;
  totalPicks: number;
  winRate: number;
  recentActivity: ActivityLog[];
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

export interface UserStats {
  user_id: string;
  username: string;
  tier: UserTier;
  total_picks: number;
  win_rate: number;
  last_active: string;
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
  type?: string;
  trigger?: string;
  template?: string | any;
  conditions?: {
    timeWindow?: any;
    tiers?: string[];
    cooldown?: number;
    channels?: string[];
  };
}

export interface DMConditions {
  timeWindow?: any;
  tiers?: string[];
  cooldown?: number;
  channels?: string[];
}

export interface DMTemplate {
  id: string;
  name: string;
  content: string;
  variables?: string[];
  created_by: string;
  created_at: string;
}

export interface ThreadLinkingRule {
  id: string;
  name: string;
  conditions: any[];
  actions: any[];
}

export interface DMTemplate {
  id: string;
  name: string;
  content: string;
  variables?: string[];
  created_by: string;
  created_at: string;
  embeds?: any[];
  enabled: boolean;
}

export interface ThreadLinkingRule {
  id: string;
  name: string;
  conditions: any[];
  actions: any[];
  enabled: boolean;
  targetChannels?: string[];
}

export interface CrossPostConfig {
  enabled: boolean;
  channels: string[];
  rules: ThreadLinkingRule[];
  conditions?: any;
  targetChannels?: string[];
}

export interface MultiLangResponse {
  en: string;
  es?: string;
  fr?: string;
  [key: string]: any;
}

// Cooldown Types
export interface CooldownData {
  user_id: string;
  command: string;
  expires_at: number;
}

// User Permissions Types
export interface UserPermissions {
  canUsePicks: boolean;
  canUseAdmin: boolean;
  canModerate: boolean;
  canAccessVIP: boolean;
  canAccessVIPPlus: boolean;
  maxPicksPerDay: number;
  cooldownSeconds: number;
}

export interface VIPNotificationSequence {
  id: string;
  name: string;
  description: string;
  tier: UserTier;
  trigger: 'join' | 'upgrade' | 'activity' | 'manual';
  steps: VIPNotificationStep[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VIPNotificationStep {
  id: string;
  order: number;
  type: 'message' | 'reaction' | 'command' | 'delay';
  title?: string;
  description?: string;
  content?: string;
  delayMinutes?: number;
  requiredReaction?: string;
  requiredCommand?: string;
  completed: boolean;
  completedAt?: Date;
}

export interface VIPWelcomeFlow {
  id: string;
  name: string;
  description?: string;
  tier: UserTier;
  steps: VIPWelcomeStep[];
  isActive: boolean;
  enabled?: boolean;
  userId?: string;
  currentStep?: number;
  completed?: boolean;
  startedAt?: Date;
  trigger_type?: string;
  target_tiers?: UserTier[];
  createdAt: string;
  updatedAt: string;
}

export interface VIPWelcomeStep {
  id: string;
  order: number;
  delay: number; // in minutes
  type:
    | 'welcome'
    | 'features_tour'
    | 'first_pick_reminder'
    | 'engagement_check'
    | 'upgrade_suggestion'
    | 'message'
    | 'reaction'
    | 'command'
    | 'delay';
  title?: string;
  description?: string;
  content?: any; // Can be embed, string, or other content
  delayMinutes?: number;
  requiredReaction?: string;
  requiredCommand?: string;
  requiresResponse?: boolean;
  completed?: boolean;
  completedAt?: Date;
}

import { ChatInputCommandInteraction, User, GuildMember, Guild } from 'discord.js';

// Sports Pick Type (missing from imports)
export interface SportsPick {
  id: string;
  user_id: string;
  sport: string;
  bet_type: string;
  selection: string;
  odds: number;
  stake: number;
  confidence: number;
  reasoning?: string;
  status: 'pending' | 'won' | 'lost' | 'void' | 'pushed';
  game_date?: string;
  team_home?: string;
  team_away?: string;
  player_name?: string;
  line?: number;
  created_at: string;
  updated_at: string;
  graded_at?: string;
  profit?: number;
}

export interface CommandContext {
  interaction?: ChatInputCommandInteraction;
  user: User;
  member: GuildMember;
  channel: any;
  guild?: Guild;
  permissions: any;
  userProfile?: UserProfile;
}

// Game Thread type with additional properties for local caching
export interface GameThread {
  id: string;
  thread_id: string;
  game_id?: string;
  sport?: string;
  home_team?: string;
  away_team?: string;
  game_time?: string;
  status?: string;
  created_at: string;
  updated_at?: string;
  last_activity?: string;
  pick_count?: number;
  user_count?: number;
  is_pinned?: boolean;
  channel_id?: string;
  league?: string;
  teams?: any[];
  // Additional properties for local caching
  lastActivity?: Date;
  pickCount?: number;
  userCount?: number;
  isPinned?: boolean;
  name?: string;
  threadId?: string; // Alias for thread_id
}

// Pick Submission Types
export interface UserPickSubmission {
  id?: string;
  user_id: string;
  sport: string;
  bet_type: string;
  selection: string;
  odds: number;
  stake: number;
  confidence: number;
  reasoning?: string;
  status: 'pending' | 'won' | 'lost' | 'void' | 'pushed';
  created_at: string;
  expected_value?: number;
  risk_level?: 'low' | 'medium' | 'high';
  pick_data: PickData;
  submitted_at: string;
  gameId?: string;
  description?: string;
  units?: number;
  timestamp?: string;
  legs?: any[];
  pick?: any;
}

// Keyword and Emoji DM Service Types
export interface KeywordTrigger {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  template_id: string;
  templateId?: string; // Alias for template_id
  conditions?: TriggerCondition[];
  cooldownMinutes?: number;
  cooldown_minutes?: number;
  priority?: 'low' | 'medium' | 'high';
  matchType?: 'contains' | 'exact' | 'regex' | 'partial';
  match_type?: 'contains' | 'exact' | 'regex' | 'partial';
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  isActive?: boolean; // Alias for is_active
}

export interface EmojiTrigger {
  id: string;
  name: string;
  description: string;
  emoji: string;
  templateId: string;
  template_id: string;
  conditions?: TriggerCondition[];
  cooldownMinutes?: number;
  cooldown_minutes?: number;
  priority?: 'low' | 'medium' | 'high';
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  isActive?: boolean; // Alias for is_active
}

export interface AutoDMTemplate {
  id: string;
  name: string;
  content: string;
  embed_data?: any;
  embeds?: any[];
  components_data?: any;
  variables?: string[];
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface CreateAutoDMTemplate {
  name: string;
  description: string;
  subject: string;
  content: string;
  embed_data?: any;
  components_data?: any;
  variables?: string[];
}

export interface TriggerCondition {
  type: 'role' | 'channel' | 'time' | 'user_tier';
  value: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
}

// Quick Edit Config Service Types
export interface ConfigUpdate {
  id: string;
  adminId: string;
  sessionId: string;
  userId?: string;
  applied: boolean;
  field: string;
  key: string;
  value: any;
  oldValue?: any;
  newValue?: any;
  updateType: string;
  configType: string;
  timestamp: string;
  reason: string;
  result?: any;
  completedAt?: Date;
  updated_by?: string;
}

export interface AdminOverride {
  id: string;
  admin_id: string;
  adminId: string; // Alias for admin_id
  target_user_id?: string;
  action?: string;
  command: ExtendedSystemCommand;
  parameters: Record<string, any>;
  reason: string;
  timestamp: string;
  status: 'executing' | 'completed' | 'failed';
  created_at: string;
  expires_at?: string;
  is_active: boolean;
  result?: any;
  completedAt?: Date;
}

export interface QuickEditSession {
  id: string;
  user_id: string;
  userId?: string; // Alias for user_id
  config_key: string;
  configType?: string;
  changes?: ConfigUpdate[];
  started_at: string;
  startedAt?: string; // Alias for started_at
  expires_at: string;
  is_active: boolean;
  status?: string;
  completedAt?: string;
  currentConfig?: any;
}

// System Command Types
export interface SystemCommand {
  name: string;
  parameters: Record<string, any>;
  reason: string;
}

export type ExtendedSystemCommand =
  | 'force_user_tier_change'
  | 'emergency_shutdown'
  | 'force_channel_cleanup'
  | 'override_permissions'
  | 'force_data_sync'
  | 'emergency_broadcast'
  | 'force_user_reset'
  | 'override_rate_limits'
  | 'force_cache_clear'
  | 'emergency_maintenance';

export interface AIGradingResult {
  grade: string | number;
  score: number;
  reasoning: string;
  createdAt: string | string;
  confidence: number | string;
  [key: string]: any;
}

export interface AICoachingSession {
  id: string;
  userId: string;
  sessionType: string;
  startedAt: string | string;
  endedAt?: Date | string;
  insights: any[];
  recommendations: string[];
  status: string;
  lastActivity?: Date;
  messages?: any[];
  userProfile?: any;
  improvementAreas?: any[];
  currentFocus?: string;
  goals?: any[];
}

export interface OnboardingSequence {
  id: string;
  userId: string;
  tier: string;
  messages: OnboardingMessage[];
  totalMessages: number;
  currentMessage: number;
  isComplete: boolean;
  startedAt: Date;
}

export interface OnboardingMessage {
  id: string;
  delay: number;
  content: any;
  embed?: any;
  components?: any[];
  type:
    | 'welcome'
    | 'features'
    | 'tutorial'
    | 'reminder'
    | 'engagement'
    | 'discovery'
    | 'capper_welcome'
    | 'admin_welcome'
    | 'followup'
    | 'conversion'
    | 'personalized_welcome'
    | 'personalized_followup'
    | 'personalized_conversion';
}
