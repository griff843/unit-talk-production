import {
  Client,
  GuildMember,
  Message,
  User,
  ButtonInteraction,
  SelectMenuInteraction,
  ModalSubmitInteraction,
  CommandInteraction,
  AutocompleteInteraction,
  ColorResolvable
} from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';

// User and Permission Types
export type UserTier = 'member' | 'vip' | 'vip_plus' | 'staff' | 'admin' | 'owner';

export interface UserPermissions {
  tier: UserTier;
  roles: string[];
  canAccessVIP: boolean;
  canAccessVIPPlus: boolean;
  canSubmitPicks: boolean;
  canAccessCoaching: boolean;
  canUseDMs: boolean;
  canCreateThreads: boolean;
  canViewVIPContent: boolean;
  canViewVipPlusContent: boolean;
  canUseAdminCommands: boolean;
  canUseModeratorCommands: boolean;
  canUseCommand: boolean;
  canViewAnalytics: boolean;
  canEditConfig: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  // Additional properties used in permissions service
  maxPicksPerDay?: number;
  canAccessAnalytics?: boolean;
  maxDMsPerHour?: number;
  isRateLimited?: boolean;
  canModerate?: boolean;
}

export interface UserProfile {
  id: string;
  user_id: string;
  discord_id?: string;
  username: string;
  display_name?: string;
  discriminator: string;
  tier: UserTier;
  tier_expires_at?: Date;
  total_messages?: number;
  total_reactions?: number;
  total_picks?: number;
  successful_picks?: number;
  total_units_wagered?: number;
  total_units_won?: number;
  win_rate?: number;
  roi?: number;
  streak?: number;
  longest_streak?: number;
  favorite_sports?: string[];
  preferred_bet_types?: string[];
  risk_tolerance?: 'low' | 'medium' | 'high';
  activity_score?: number;
  created_at: Date;
  updated_at: Date;
  last_active: Date;
  is_active: boolean;
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
  // Additional properties used in supabase service
  avatar_url?: string;
  winning_picks?: number;
  losing_picks?: number;
  pending_picks?: number;
  total_units?: number;
  units_won?: number;
  units_lost?: number;
  best_streak?: number;
  worst_streak?: number;
  average_odds?: number;
  total_profit?: number;
}

// Pick and Grading Types
export interface Pick {
  id: string;
  user_id: string;
  message_id: string;
  channel_id: string;
  sport: string;
  league: string;
  game: string;
  pick_type: string;
  selection: string;
  odds?: string;
  units?: number;
  confidence?: number;
  reasoning?: string;
  status: 'pending' | 'won' | 'lost' | 'void' | 'graded';
  result?: 'win' | 'loss' | 'void';
  grade?: number;
  graded_by?: string;
  graded_at?: Date;
  payout?: number;
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, any>;
}

export interface SportsPick extends Pick {
  description?: string;
  tier?: UserTier;
  pick?: string;
  teams?: string[];
  submittedAt?: Date;
  submittedBy?: string;
}

export interface UserPickSubmission {
  userId: string;
  pick: Pick;
  analysis?: BettingAnalysis;
  id?: string;
  description?: string;
  confidence?: number;
  odds?: string;
  units?: number;
  gameId?: string;
  submittedAt?: Date;
}

export interface BettingAnalysis {
  edge: number;
  confidence: number;
  factors: GradingFactor[];
  riskLevel: 'low' | 'medium' | 'high';
  userId?: string;
  winRate?: number;
  profitLoss?: number;
  totalBets?: number;
  riskAssessment?: string;
  avgUnits?: number;
  avgOdds?: number;
  avgEdge?: number;
  recommendations?: CoachingRecommendation[];
  sportBreakdown?: Record<string, any>;
  period?: string;
  strengths?: string[];
  weaknesses?: string[];
  trends?: any;
}

export interface GradingFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
  category?: string;
}

export interface GradingResult {
  pick_id: string;
  result: 'win' | 'loss' | 'void';
  confidence: number;
  reasoning: string;
  grade: number;
  feedback: {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
  risk_assessment: 'high' | 'medium' | 'low';
  expected_value: number;
  market_analysis?: Record<string, any>;
  created_at: Date;
  // Additional properties for compatibility
  pickId?: string;
  edge?: number;
  tier?: string;
  factors?: GradingFactor[];
  coachNotes?: string;
  improvementAreas?: string[];
}

export interface CoachingRecommendation {
  id?: string;
  category?: string;
  type: 'bankroll_management' | 'pick_selection' | 'risk_management' | 'strategy_improvement' | 'bankroll' | 'research' | 'sport_focus' | 'timing';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionItems: string[];
  resources?: string[];
  timeline?: string;
  expectedImpact?: string;
}

export type RiskAssessment = 'high' | 'medium' | 'low' | {
  level: 'conservative' | 'moderate' | 'aggressive' | 'reckless';
  score: number;
  factors: string[];
  warnings: string[];
  maxRecommendedUnits: number;
};

// Analytics Types
export interface AnalyticsEvent {
  id: string;
  type: string;
  userId: string;
  guildId: string;
  channelId?: string;
  action: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  vipUsers: number;
  total?: number;
  byTier?: Record<UserTier, number>;
  activeToday?: number;
  newThisWeek?: number;
}

export interface ActivityStats {
  totalMessages: number;
  totalCommands: number;
  averageSessionLength: number;
  peakConcurrentUsers: number;
  messagesTotal?: number;
  reactionsTotal?: number;
  threadsActive?: number;
  dmsToday?: number;
}

export interface SystemStats {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  errors?: number;
  warnings?: number;
  lastError?: string;
}

export interface SystemMetrics extends SystemStats {
  // Additional system metrics
}

export interface DashboardData {
  userStats: UserStats;
  activityStats: ActivityStats;
  systemStats: SystemStats;
}


export interface PickStats {
  totalPicks: number;
  winningPicks: number;
  losingPicks: number;
  pendingPicks: number;
  winRate: number;
  profitLoss: number;
  averageOdds: number;
  averageUnits: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  details: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AdminDashboardData {
  userStats: UserStats;
  pickStats: PickStats;
  systemStats: SystemStats;
  recentActivity: ActivityLog[];
  engagementStats: {
    totalMessages: number;
    totalReactions: number;
    activeThreads: number;
    dailyActiveUsers: number;
  };
  systemHealth: {
    uptime: number;
    memoryUsage: number;
    errorRate: number;
  };
}

export interface UserEngagementMetrics {
  userId: string;
  messagesCount: number;
  reactionsGiven: number;
  reactionsReceived: number;
  threadsCreated: number;
  threadsParticipated: number;
  commandsUsed: number;
  averageSessionLength: number;
  lastActive: Date;
  engagementScore: number;
  totalMessages?: number;
  totalReactions?: number;
  picksSubmitted?: number;
  mostActiveHours?: number[];
}

export interface UserBehaviorPattern {
  userId: string;
  patterns: Record<string, any>;
  predictions: Record<string, any>;
  recommendations: string[];
  mostActiveTimeOfDay: number;
  preferredChannels: string[];
  engagementStyle: 'active' | 'moderate' | 'passive';
  activityFrequency: 'daily' | 'weekly' | 'sporadic';
  interactionPreferences: Record<string, number>;
}

export interface UserAnalytics {
  userId: string;
  username: string;
  tier: UserTier;
  joinDate: Date;
  totalMessages: number;
  totalReactions: number;
  totalPicks: number;
  winRate: number;
  profitLoss: number;
  engagementScore: number;
  lastActive?: Date;
  favoriteChannels?: string[];
  activityPattern?: Record<string, any>;
}

export interface ChannelAnalytics {
  channelId: string;
  channelName: string;
  messageCount: number;
  uniqueUsers: number;
  averageMessagesPerUser: number;
  peakActivity: Date;
  totalMessages?: number;
  totalReactions?: number;
  activeUsers?: number;
  topUsers?: Array<{ userId: string; messageCount: number; }>;
  userTierBreakdown?: Record<string, number>;
}

export type AnalyticsTimeframe = '1h' | '24h' | '7d' | '30d' | '90d';

export interface AnalyticsTimeframeConfig {
  start: Date;
  end: Date;
  period: 'hour' | 'day' | 'week' | 'month';
}

export interface EngagementTrend {
  period: string;
  value: number;
  change: number;
}

export interface RealTimeStats {
  activeUsers: number;
  onlineUsers: number;
  messagesLastHour: number;
  commandsLastHour: number;
  lastUpdated: Date;
  totalMessages?: number;
  channelActivity?: Record<string, number>;
  picksSubmitted?: number;
  threadsCreated?: number;
  dmsSent?: number;
  commandsExecuted?: number;
  errorsCount?: number;
  tierDistribution?: Record<UserTier, number>;
  hourlyMetrics?: Array<{ 
    hour: number; 
    count: number;
    messages?: number;
    picks?: number;
    users?: number;
  }>;
  uptime?: number;
}

export interface AnalyticsDashboard {
  id?: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  permissions: UserTier[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'text';
  title: string;
  data: any;
  config?: any;
  position: { x: number; y: number; width: number; height: number; };
}

export interface AnalyticsWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'heatmap';
  title: string;
  data: any;
  config: Record<string, any>;
  position: { x: number; y: number; width: number; height: number };
}

export interface AnalyticsFilter {
  id: string;
  name: string;
  type: 'select' | 'date' | 'range' | 'text';
  options?: string[];
  defaultValue?: any;
}

export interface ErrorLog {
  id: string;
  timestamp: Date;
  level: 'error' | 'warning' | 'info';
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userId?: string;
  guildId?: string;
}

export interface EventLog {
  id: string;
  timestamp: Date;
  type: string;
  userId?: string;
  action: string;
  metadata?: Record<string, any>;
}

// Thread and Automation Types
export interface ThreadRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggers: ThreadTrigger[];
  conditions: ThreadCondition[];
  actions: ThreadAction[];
  cooldown: number;
  maxExecutions?: number;
  targetChannels?: string[];
  requiredRoles?: string[];
  excludedRoles?: string[];
  priority: number;
  created_at: Date;
  updated_at: Date;
}

export interface ThreadTrigger {
  type: 'message' | 'reaction' | 'user_join' | 'scheduled' | 'keyword' | 'emoji';
  config: Record<string, any>;
}

export interface ThreadCondition {
  type: 'user_tier' | 'channel' | 'time' | 'message_count' | 'custom';
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'regex';
  value: any;
  tier?: UserTier;
}

export interface ThreadAction {
  type: 'create_thread' | 'send_message' | 'add_reaction' | 'assign_role' | 'send_dm';
  config: Record<string, any>;
  delay?: number;
}

export interface ThreadLinkingRule {
  id: string;
  sourceChannels: string[];
  targetChannels: string[];
  conditions: ThreadCondition[];
}

export interface CrossPostConfig {
  enabled: boolean;
  targetChannels?: string[];
  conditions?: Record<string, any>;
}

export interface GameThread {
  id: string;
  thread_id: string;
  threadId?: string; // For backward compatibility
  channel_id: string;
  name: string;
  sport: string;
  league: string;
  teams: string[];
  game_time: Date;
  gameTime?: Date; // For backward compatibility
  gameId?: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  pick_count?: number;
  pickCount?: number; // For backward compatibility
  participant_count?: number;
  userCount?: number;
  created_at: Date;
  createdAt?: Date; // For backward compatibility
  updated_at: Date;
  archived_at?: Date;
  lastActivity?: Date;
  isPinned?: boolean;
  metadata?: Record<string, any>;
  // Additional properties used in services
  isActive?: boolean;
  messageCount?: number;
  description?: string;
}

export interface ThreadTemplate {
  id: string;
  name: string;
  description: string;
  title_template: string;
  message_template: string;
  auto_archive_duration: number;
  slowmode_delay?: number;
  tags?: string[];
  permissions?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// VIP and Notification Types
export interface VIPNotification {
  id: string;
  user_id: string;
  type: 'pick_alert' | 'exclusive_content' | 'personal_message' | 'promotion';
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  scheduled_for?: Date;
  sent_at?: Date;
  read_at?: Date;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface VIPNotificationFlow {
  id: string;
  name: string;
  description: string;
  trigger_type: 'manual' | 'scheduled' | 'event_based';
  target_tiers: UserTier[];
  steps?: VIPNotificationStep[];
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface VIPNotificationStep {
  id: string;
  order: number;
  type: 'message' | 'embed' | 'button' | 'delay' | 'welcome' | 'features_tour' | 'first_pick_reminder' | 'engagement_check' | 'upgrade_suggestion';
  message?: string;
  content?: string;
  delay?: number;
  embedData?: any;
  buttonData?: any;
  requiresResponse?: boolean;
  conditions?: Record<string, any>;
}

export interface VIPNotificationSequence extends VIPNotificationFlow {
  // Additional sequence-specific properties
}

export interface VIPWelcomeFlow extends VIPNotificationFlow {
  id: string;
  userId: string;
  tier: UserTier;
  currentStep: number;
  completed: boolean;
  startedAt: Date;
  completedAt?: Date;
  steps?: VIPNotificationStep[];
}

// DM and Keyword Types
export interface DMTrigger {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger_type: 'keyword' | 'emoji' | 'reaction' | 'mention';
  trigger?: string;
  type?: string; // For backward compatibility
  keywords?: string[];
  emojis?: string[];
  target_tiers: UserTier[];
  target_channels?: string[];
  exclude_channels?: string[];
  cooldown: number;
  max_triggers_per_user?: number;
  max_triggers_per_hour?: number;
  message_template: string;
  template?: string; // For backward compatibility
  embed_config?: Record<string, any>;
  conditions?: DMConditions;
  created_at: Date;
  updated_at: Date;
}

export interface DMTemplate {
  id: string;
  name: string;
  content: string;
  variables: string[];
  embeds?: any[];
  components?: any[];
}

export interface DMConditions {
  channelIds?: string[];
  tiers?: UserTier[];
  cooldown?: number;
  timeWindow?: {
    start: number;
    end: number;
    days: number[];
    timezone: string;
  };
  channels?: string[];
}

export interface KeywordTrigger {
  id: string;
  name: string;
  description?: string;
  keywords: string[];
  matchType: 'exact' | 'partial' | 'regex';
  templateId: string;
  conditions: DMConditions;
  cooldownMinutes: number;
  priority: number;
  isActive: boolean;
}

export interface EmojiTrigger {
  id: string;
  name: string;
  description?: string;
  emoji: string;
  templateId: string;
  conditions: DMConditions;
  cooldownMinutes: number;
  priority: number;
  isActive: boolean;
}

export interface AutoDMTemplate {
  id: string;
  name: string;
  description?: string;
  subject?: string;
  content: string;
  embedData?: any;
  componentsData?: any;
  variables?: string[];
  embeds?: any[];
  components?: any[];
}

export interface TriggerCondition {
  type: string;
  value: any;
  operator: string;
}

export interface DMLog {
  id: string;
  user_id: string;
  trigger_id: string;
  trigger_type: string;
  message_content: string;
  status: 'sent' | 'failed' | 'blocked';
  error_message?: string;
  sent_at: Date;
  metadata?: Record<string, any>;
}

// Configuration Types
export interface BotConfig {
  prefix: string;
  discord: {
    token: string;
    clientId: string;
    guildId: string;
  };
  supabase?: {
    url: string;
    key: string;
    serviceRoleKey: string;
  };
  roles: {
    member: string;
    vip: string;
    vipPlus: string;
    staff: string;
    admin: string;
    moderator: string;
    owner: string;
  };
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

// Service Types
export interface ServiceManager {
  client: Client;
  supabase: SupabaseClient;
  config: BotConfig;
  services: Map<string, any>;
  
  initialize(): Promise<void>;
  getService<T>(name: string): T;
  registerService(name: string, service: any): void;
  shutdown(): Promise<void>;
}

// Database Types
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfile;
        Insert: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserProfile, 'id' | 'created_at'>>;
      };
      picks: {
        Row: Pick;
        Insert: Omit<Pick, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Pick, 'id' | 'created_at'>>;
      };
      analytics_events: {
        Row: AnalyticsEvent;
        Insert: Omit<AnalyticsEvent, 'id' | 'timestamp'>;
        Update: Partial<Omit<AnalyticsEvent, 'id' | 'timestamp'>>;
      };
      vip_notifications: {
        Row: VIPNotification;
        Insert: Omit<VIPNotification, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<VIPNotification, 'id' | 'created_at'>>;
      };
      dm_triggers: {
        Row: DMTrigger;
        Insert: Omit<DMTrigger, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<DMTrigger, 'id' | 'created_at'>>;
      };
      thread_rules: {
        Row: ThreadRule;
        Insert: Omit<ThreadRule, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ThreadRule, 'id' | 'created_at'>>;
      };
      game_threads: {
        Row: GameThread;
        Insert: Omit<GameThread, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<GameThread, 'id' | 'created_at'>>;
      };
      user_cooldowns: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          last_used: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          action: string;
          last_used: string;
          expires_at: string;
        };
        Update: Partial<{
          last_used: string;
          expires_at: string;
        }>;
      };
      trigger_activation_logs: {
        Row: {
          id: string;
          trigger_id: string;
          user_id: string;
          channel_id: string;
          message_id: string;
          activated_at: string;
          metadata: Record<string, any>;
        };
        Insert: {
          trigger_id: string;
          user_id: string;
          channel_id: string;
          message_id: string;
          activated_at: string;
          metadata?: Record<string, any>;
        };
        Update: Partial<{
          metadata: Record<string, any>;
        }>;
      };
    };
  };
};

export interface EmbedColors {
  member: ColorResolvable;
  vip: ColorResolvable;
  vip_plus: ColorResolvable;
  staff: ColorResolvable;
  admin: ColorResolvable;
  owner: ColorResolvable;
  free: ColorResolvable;
  success: ColorResolvable;
  error: ColorResolvable;
  warning: ColorResolvable;
  info: ColorResolvable;
  pending: ColorResolvable;
}

// Utility Types
export interface CooldownData {
  userId: string;
  action: string;
  lastUsed: number;
  expiresAt: number;
}

import { Guild } from 'discord.js';

export interface CommandContext {
  message?: Message;
  args?: string[];
  user: User;
  member: GuildMember;
  channel?: any;
  guild?: Guild;
  interaction?: CommandInteraction;
  permissions?: UserPermissions;
  userProfile?: UserProfile;
}

// Handler Types
export interface CommandHandler {
  handleCommand(message: Message): Promise<void>;
  handleSlashCommand?(interaction: CommandInteraction): Promise<void>;
}

export interface EventHandler {
  handleMessage(message: Message): Promise<void>;
  handleReaction(reaction: any, user: User): Promise<void>;
  handleMemberJoin(member: GuildMember): Promise<void>;
  handleMemberLeave(member: GuildMember): Promise<void>;
}

export interface InteractionHandler {
  handleInteraction(interaction: any): Promise<void>;
  handleButton(interaction: ButtonInteraction): Promise<void>;
  handleSelectMenu(interaction: SelectMenuInteraction): Promise<void>;
  handleModal(interaction: ModalSubmitInteraction): Promise<void>;
  handleAutocomplete(interaction: AutocompleteInteraction): Promise<void>;
}

export interface SupabaseService {
  client: SupabaseClient<Database>;

  // User methods
  getUserProfile(userId: string): Promise<UserProfile | null>;
  createUserProfile(profile: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>): Promise<UserProfile>;
  updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null>;
  createOrUpdateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<UserProfile>;
  updateUserTier(userId: string, tier: UserTier): Promise<void>;
  updateUserStatus(userId: string, status: string): Promise<void>;
  updateUserActivity(userId: string, activity: any): Promise<void>;
  incrementUserStats(userId: string, stats: Partial<UserProfile>): Promise<void>;

  // Pick methods
  createPick(pick: Omit<Pick, 'id' | 'created_at' | 'updated_at'>): Promise<Pick>;
  updatePick(pickId: string, updates: Partial<Pick>): Promise<Pick | null>;
  getUserPicks(userId: string, limit?: number): Promise<Pick[]>;

  // Analytics methods
  logEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): Promise<void>;
  getAnalyticsEvents(filters?: any): Promise<AnalyticsEvent[]>;

  // VIP methods
  createVIPNotification(notification: Omit<VIPNotification, 'id' | 'created_at' | 'updated_at'>): Promise<VIPNotification>;
  getVIPNotifications(userId: string): Promise<VIPNotification[]>;

  // DM methods
  createDMTrigger(trigger: Omit<DMTrigger, 'id' | 'created_at' | 'updated_at'>): Promise<DMTrigger>;
  getDMTriggers(): Promise<DMTrigger[]>;

  // Thread methods
  createGameThread(thread: Omit<GameThread, 'id' | 'created_at' | 'updated_at'>): Promise<GameThread>;
  getGameThreads(): Promise<GameThread[]>;

  // Cooldown methods
  upsertUserCooldown(cooldown: Database['public']['Tables']['user_cooldowns']['Insert']): Promise<void>;
  getUserCooldown(userId: string, action: string): Promise<any>;

  // Trigger activation methods
  logTriggerActivation(log: Database['public']['Tables']['trigger_activation_logs']['Insert']): Promise<void>;
}


// AI-Powered Service Types
export interface AICoachingSession {
  id: string;
  userId: string;
  sessionType: string;
  startedAt: Date;
  lastActivity: Date;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  status: 'active' | 'completed' | 'expired';
  metadata?: Record<string, any>;
  userProfile?: any;
  improvementAreas?: string[];
  currentFocus?: string;
  goals?: string[];
}

export interface AIGradingResult {
  pickId: string;
  grade: number;
  accuracy: number;
  reasoning: string;
  suggestions: string[];
  confidence: number;
  analysis: {
    strengths: string[];
    weaknesses: string[];
    marketAnalysis: string;
    riskAssessment: string;
  };
  gradedAt: Date;
  gradedBy: 'ai';
  accuracyScore?: number;
  reasoningScore?: number;
  improvementSuggestions?: string[];
  userId?: string;
  detailedAnalysis?: any;
}

export interface MultiLangResponse {
  id: string;
  originalContent: string;
  translatedContent: string;
  sourceLanguage: string;
  targetLanguage: string;
  userId: string;
  createdAt: Date;
  confidence: number;
}

// Admin Override types
export interface AdminOverride {
  id: string;
  adminId: string;
  command?: ExtendedSystemCommand;
  reason?: string;
  timestamp: Date;
  status?: 'pending' | 'executing' | 'completed' | 'error' | 'success';
  result?: string;
  parameters?: Record<string, any>;
  completedAt?: Date;
}

export interface ConfigUpdate {
  id: string;
  userId: string;
  configType: string;
  field: string;
  path?: string;
  oldValue: any;
  newValue: any;
  reason: string;
  adminId: string;
  timestamp: Date;
  sessionId?: string;
  updateType?: string;
  applied?: boolean;
}

export interface SystemCommand {
  id: string;
  command: string;
  arguments: string[];
  adminId: string;
  result: any;
  timestamp: Date;
  name?: string;
  parameters?: string[];
  reason?: string;
  status?: 'success' | 'error' | 'pending';
  completedAt?: Date;
}

// Quick Edit Configuration Types
export interface QuickEditSession {
  id: string;
  userId: string;
  configType: string;
  startedAt: string;
  status: 'active' | 'completed' | 'cancelled';
  currentStep?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  currentConfig?: any;
  completedAt?: Date;
}

// Logger types
export interface LogContext {
  userId?: string;
  guildId?: string;
  channelId?: string;
  messageId?: string;
  commandId?: string;
  interactionId?: string;
  [key: string]: any;
}

// Extended interfaces to fix missing properties
export interface ExtendedCrossPostConfig extends CrossPostConfig {
  triggerType?: string;
  targetChannels?: string[];
}

export interface ExtendedDMConditions extends DMConditions {
  tiers?: UserTier[];
  channels?: string[];
  timeWindow?: {
    start: number;
    end: number;
    days: number[];
    timezone: string;
  };
  cooldown?: number;
}

export interface ExtendedDMTemplate extends DMTemplate {
  embeds?: any[];
}

export interface ExtendedKeywordTrigger {
  id: string;
  name: string;
  description?: string;
  keywords: string[];
  matchType: 'exact' | 'partial' | 'regex' | 'fuzzy' | 'contains' | 'starts_with';
  templateId?: string;
  template?: ExtendedDMTemplate;
  trigger?: string;
  conditions: ExtendedDMConditions;
  cooldownMinutes: number;
  priority: number;
  isActive: boolean;
}

export interface ExtendedEmojiTrigger {
  id: string;
  name: string;
  description?: string;
  emoji: string;
  templateId: string;
  conditions: ExtendedDMConditions;
  cooldownMinutes: number;
  priority: number;
  isActive: boolean;
}

export interface ExtendedAutoDMTemplate extends AutoDMTemplate {
  description?: string;
  subject?: string;
  embedData?: any;
  componentsData?: any;
  variables?: string[];
}

export interface ExtendedVIPWelcomeFlow extends VIPNotificationFlow {
  startedAt?: Date;
  completed?: boolean;
  currentStep?: number;
  userId?: string;
  steps?: ExtendedVIPNotificationStep[];
}

export interface ExtendedVIPNotificationStep extends VIPNotificationStep {
  type: 'message' | 'embed' | 'button' | 'delay' | 'welcome' | 'features_tour' | 'first_pick_reminder' | 'engagement_check' | 'upgrade_suggestion';
  content?: string;
  delay?: number;
}

export interface ExtendedUserEngagementMetrics extends UserEngagementMetrics {
  totalMessages?: number;
  picksSubmitted?: number;
  totalReactions?: number;
  averageMessageLength?: number;
  averageSessionLength: number;
}

export interface ExtendedChannelAnalytics extends ChannelAnalytics {
  totalMessages?: number;
  uniqueUsers: number;
}

export interface ExtendedUserStats extends UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  vipUsers: number;
  byTier?: Record<UserTier, number>;
}

export interface ExtendedSystemHealth {
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  errors?: number;
  warnings?: number;
  lastError?: string;
}

export interface ExtendedEngagementStats {
  totalMessages: number;
  totalReactions: number;
  averageEngagement: number;
  topChannels: string[];
  messagesTotal?: number;
  reactionsTotal?: number;
  threadsActive?: number;
  dmsToday?: number;
}

export interface ExtendedUserPermissions extends UserPermissions {
  canSubmitPicks: boolean;
  canViewAnalytics: boolean;
  canEditConfig: boolean;
  canUseCommands: boolean;
  canCreateThreads: boolean;
  canAccessVIPFeatures: boolean;
  canViewAdminPanel: boolean;
  canManageUsers: boolean;
  canOverrideSettings: boolean;
  canViewLogs: boolean;
  roles: string[];
  ADMIN?: boolean;
}

export interface ExtendedAnalyticsDashboard extends AnalyticsDashboard {
  generatedAt?: Date;
}

export interface ExtendedUserAnalytics extends UserAnalytics {
  unitsWonLost?: number;
}

export interface ExtendedUserBehaviorPattern {
  userId: string;
  patterns: Record<string, any>;
  predictions: Record<string, any>;
  recommendations: string[];
  mostActiveTimeOfDay: number;
  preferredChannels: string[];
  engagementStyle: 'passive' | 'moderate' | 'active';
  activityFrequency: 'sporadic' | 'weekly' | 'daily';
  interactionPreferences: Record<string, any>;
}

export interface ExtendedCoachingRecommendation extends CoachingRecommendation {
  category?: string;
}

export interface ExtendedAIGradingResult extends AIGradingResult {
  accuracyScore: number;
  reasoningScore: number;
  improvementSuggestions?: string[];
}

export interface ExtendedAICoachingSession extends AICoachingSession {
  startedAt: Date;
  userProfile?: any;
  currentFocus?: string;
  improvementAreas?: string[];
}

export type ExtendedSystemCommand =
  | 'restart_bot'
  | 'clear_cache'
  | 'reload_config'
  | 'backup_data'
  | 'maintenance_mode'
  | 'force_sync'
  | 'emergency_stop'
  | 'health_check'
  | 'update_permissions'
  | 'reset_cooldowns';

export interface ExtendedAdminOverride extends AdminOverride {
  command: ExtendedSystemCommand;
  status: 'success' | 'error' | 'pending';
  result?: 'success' | 'error' | 'pending';
  completedAt?: Date;
  timestamp: Date;
}

export interface ExtendedConfigUpdate extends ConfigUpdate {
  sessionId: string;
  userId: string;
  configType: string;
  updateType: string;
  applied: boolean;
}

export interface ExtendedQuickEditSession {
  startedAt: string;
  completedAt?: Date;
}

export interface ExtendedThreadCondition extends ThreadCondition {
  league?: string;
  teams?: string[];
  dayOfWeek?: number;
  tier?: UserTier;
}

export interface ExtendedVIPBenefits {
  member: string[];
  vip: string[];
  vip_plus: string[];
  staff: string[];
  admin: string[];
  owner: string[];
}

export interface ExtendedHourlyMetric {
  hour: number;
  count: number;
  messages?: number;
  picks?: number;
  users?: number;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string | undefined;
      DISCORD_TOKEN: string;
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
      SUPABASE_SERVICE_ROLE_KEY?: string;
      GENERAL_CHANNEL_ID?: string;
      PICKS_CHANNEL_ID?: string;
      VIP_CHANNEL_ID?: string;
      VIP_PLUS_CHANNEL_ID?: string;
      ADMIN_CHANNEL_ID?: string;
      LOGS_CHANNEL_ID?: string;
      ANNOUNCEMENTS_CHANNEL_ID?: string;
      FREE_PICKS_CHANNEL_ID?: string;
      VIP_PICKS_CHANNEL_ID?: string;
      VIP_GENERAL_CHANNEL_ID?: string;
      VIP_PLUS_PICKS_CHANNEL_ID?: string;
      VIP_PLUS_GENERAL_CHANNEL_ID?: string;
      THREADS_CHANNEL_ID?: string;
      MEMBER_ROLE_ID?: string;
      VIP_ROLE_ID?: string;
      VIP_PLUS_ROLE_ID?: string;
      STAFF_ROLE_ID?: string;
      ADMIN_ROLE_ID?: string;
      OWNER_ROLE_ID?: string;
      MODERATOR_ROLE_ID?: string;
      ENABLE_VIP_NOTIFICATIONS?: string;
      ENABLE_AUTO_THREADS?: string;
      ENABLE_KEYWORD_DMS?: string;
      ENABLE_AI_GRADING?: string;
      ENABLE_ANALYTICS?: string;
      ENABLE_AUTO_GRADING?: string;
      PICK_COOLDOWN_MINUTES?: string;
      COMMAND_COOLDOWN_SECONDS?:string;
      DM_COOLDOWN_MINUTES?: string;
      MAX_PICKS_PER_DAY?: string;
      MAX_DMS_PER_HOUR?: string;
      MAX_THREADS_PER_DAY?: string;
      MAX_UNITS_PER_PICK?: string;
      THREAD_AUTO_ARCHIVE_MINUTES?: string;
      DISCORD_CLIENT_ID?: string;
      DISCORD_GUILD_ID?: string;
      ENABLE_AGENTS?: string;
      GRADING_AGENT_ENDPOINT?: string;
      ANALYTICS_AGENT_ENDPOINT?: string;
      AI_API_KEY?: string;
      AI_BASE_URL?: string;
      LOG_LEVEL?: string;
      NODE_ENV?: string;
    }
  }
}