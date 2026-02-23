// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Use canonical types from shared-types
// SPRINT-RUNTIME-TRUTH-008: Removed extends clause to avoid Json type conflicts
import type { UnifiedPicksRow } from '@unit-talk/shared-types';

/**
 * UnifiedPick - Extended for recap/analytics use cases
 * Standalone interface for internal use (not extending canonical type due to Json compatibility)
 */
export interface UnifiedPick {
  id: string;
  created_at: string;
  updated_at?: string;
  player_name?: string;
  team_name?: string;
  matchup?: string;
  market_type?: string;
  line?: number;
  odds?: number;
  tier?: string;
  edge_score?: number;
  play_status?: string;
  capper?: string;
  units?: number;
  outcome?: 'win' | 'loss' | 'push' | 'pending';
  parlay_id?: string;
  is_sharp_fade?: boolean;
  tags?: string[];
  meta?: Record<string, unknown> | null;
  data_quality_reasons?: Record<string, unknown> | null;
  feature_contributions?: Record<string, unknown> | null;
  manual_fields_blob?: Record<string, unknown> | null;
  [key: string]: string | number | boolean | string[] | Record<string, unknown> | undefined | null;
}

// Re-export canonical type for code that needs the actual DB shape
export type { UnifiedPicksRow };

// Enhanced recap interfaces
export type RecapType = 'daily' | 'weekly' | 'monthly';

export interface RecapSummary {
  date: string;
  period: 'daily' | 'weekly' | 'monthly';
  totalPicks: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  totalUnits: number;
  netUnits: number;
  roi: number;
  avgEdge: number;
  avgClvDelta?: number;
  capperBreakdown: CapperStats[];
  tierBreakdown: TierStats[];
  hotStreaks: HotStreak[];
  bestPick?: UnifiedPick;
  worstPick?: UnifiedPick;
  biggestWin?: UnifiedPick;
  badBeat?: UnifiedPick;
  metadata?: RecapMetadata;
}

export interface CapperStats {
  capper: string;
  picks: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  totalUnits: number;
  netUnits: number;
  roi: number;
  avgEdge: number;
  avgClvDelta?: number;
  currentStreak: number;
  streakType: 'win' | 'loss' | 'none';
  streakSparkline?: string; // Visual representation of recent performance
  bestPick?: UnifiedPick;
  worstPick?: UnifiedPick;
}

export interface TierStats {
  tier: string;
  picks: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  totalUnits: number;
  netUnits: number;
  roi: number;
  avgEdge: number;
}

export interface HotStreak {
  capper: string;
  streakLength: number;
  streakType: 'win' | 'loss';
  totalUnits: number;
  startDate: string;
  endDate?: string;
  picks: UnifiedPick[];
}

export interface ParlayGroup {
  parlay_id: string;
  picks: UnifiedPick[];
  totalOdds: number;
  units: number;
  outcome?: 'win' | 'loss' | 'push' | 'pending';
  profit_loss?: number;
  capper?: string;
  created_at?: string;
  settled_at?: string;
}

export interface RecapMetadata {
  generatedAt: string;
  processingTimeMs: number;
  dataSource: string;
  version: string;
  features: {
    legendFooter: boolean;
    microRecap: boolean;
    clvDelta: boolean;
    streakSparkline: boolean;
    notionSync: boolean;
  };
}

// Micro-recap specific interfaces
export interface MicroRecapData {
  trigger: 'last_pick_graded' | 'roi_threshold' | 'manual';
  dailyRoi: number;
  roiChange: number;
  winLoss: string;
  unitBreakdown: {
    solo: number;
    parlay: number;
    total: number;
  };
  topCapper: {
    name: string;
    netUnits: number;
    winRate: number;
  };
  timestamp: string;
}

// Configuration interfaces
export interface RecapConfig {
  // Feature toggles
  legendFooter: boolean;
  microRecap: boolean;
  notionSync: boolean;
  clvDelta: boolean;
  streakSparkline: boolean;

  // Thresholds
  roiThreshold: number;
  microRecapCooldown: number; // minutes

  // Discord settings
  discordWebhook?: string;
  slashCommands: boolean;

  // Notion settings
  notionToken?: string;
  notionDatabaseId?: string;

  // Prometheus settings
  metricsEnabled: boolean;
  metricsPort: number;
}

// Notion sync interfaces
export interface NotionRecapEntry {
  id?: string;
  title: string;
  date: string;
  period: 'daily' | 'weekly' | 'monthly';
  summary: RecapSummary;
  embedData: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

// Prometheus metrics interfaces
export interface RecapMetrics {
  recapsSent: number;
  recapsFailed: number;
  microRecapsSent: number;
  avgProcessingTimeMs: number;
  dailyRecaps: number;
  weeklyRecaps: number;
  monthlyRecaps: number;
  notionSyncs: number;
  slashCommandsUsed: number;
  lastProcessedAt?: string;
}

// Slash command interfaces
export interface SlashCommandOptions {
  period: 'daily' | 'weekly' | 'monthly';
  date?: string;
  capper?: string;
  format?: 'full' | 'summary';
}

// Real-time ROI watcher interfaces
export interface RoiWatcherState {
  currentDailyRoi: number;
  lastRoiCheck: string;
  lastMicroRecapSent: string;
  picksProcessedToday: number;
  thresholdBreached: boolean;
}

// CLV and streak analysis
export interface ClvAnalysis {
  avgClvDelta: number;
  positiveClvCount: number;
  negativeClvCount: number;
  bestClvPick?: UnifiedPick;
  worstClvPick?: UnifiedPick;
}

export interface StreakAnalysis {
  currentStreak: number;
  streakType: 'win' | 'loss' | 'none';
  longestWinStreak: number;
  longestLossStreak: number;
  sparkline: string;
  recentForm: ('W' | 'L' | 'P')[];
}

// Error handling
// Add RecapError as a class, not just an interface
export class RecapError extends Error {
  public code: string;
  public timestamp: string;
  public context?: Record<string, unknown>;
  public severity: 'low' | 'medium' | 'high';

  constructor(options: {
    code: string;
    message: string;
    timestamp: string;
    context?: Record<string, unknown>;
    severity: 'low' | 'medium' | 'high';
  }) {
    super(options.message);
    this.name = 'RecapError';
    this.code = options.code;
    this.timestamp = options.timestamp;
    this.context = options.context || {};
    this.severity = options.severity;
  }
}

// Database migration interfaces
export interface MigrationScript {
  version: string;
  description: string;
  up: string;
  down: string;
  dependencies?: string[];
}

export type RecapPeriod = 'daily' | 'weekly' | 'monthly';

// Market resistance analysis types
export interface MarketReaction {
  reaction: 'sharp_agree' | 'sharp_fade' | 'neutral' | 'unknown';
  movement: number;
  movementPct?: number;
  updated_line?: number;
}
