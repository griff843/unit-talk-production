// Core Discord Types
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
    serviceKey: string;
  };
  redis: {
    url: string;
  };
  ai: {
    openaiApiKey: string;
    model: string;
  };
  token: string;
  clientId: string;
  guildId: string;
}

// User Management Types
export type UserTier = 'member' | 'vip' | 'vip_plus' | 'staff' | 'admin' | 'owner';

export interface UserProfile {
  id: string;
  discord_id: string;
  username: string;
  tier: UserTier;
  created_at: string;
  updated_at: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  sports: string[];
  notifications: boolean;
  dm_enabled: boolean;
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  betting_goals: string[];
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
}

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
}

export interface PickValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  suggestions: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// AI & Analysis Types
export interface BettingAnalysis {
  confidence_score: number;
  expected_value: number;
  risk_assessment: 'low' | 'medium' | 'high';
  key_factors: string[];
  recommendations: string[];
  market_context: string;
}

export interface AICoachingInsight {
  type: 'strategy' | 'bankroll' | 'selection' | 'timing';
  title: string;
  description: string;
  actionable_steps: string[];
  priority: 'low' | 'medium' | 'high';
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
  status: 'won' | 'lost' | 'void' | 'pushed';
  actual_result: string;
  expected_value: number;
  profit_loss: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  notes?: string;
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
  confidence: { required: true, type: 'number', min: 1, max: 10 }
};

export const pickValidationSchema = {
  user_id: { required: true, type: 'string' },
  sport: { required: true, type: 'string' },
  bet_type: { required: true, type: 'string' },
  selection: { required: true, type: 'string' },
  odds: { required: true, type: 'number' },
  stake: { required: true, type: 'number', min: 0.01 },
  confidence: { required: true, type: 'number', min: 1, max: 10 }
};

export type UserTier = 'free' | 'premium' | 'vip' | 'vip_plus';

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