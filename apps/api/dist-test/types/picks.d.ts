export interface UnifiedPick {
    id: string;
    created_at: string;
    updated_at?: string;
    player_name?: string;
    team_name?: string;
    matchup?: string;
    market_type: string;
    line: number;
    odds: number;
    tier: string;
    edge_score: number;
    play_status: string;
    capper?: string;
    units?: number;
    outcome?: 'win' | 'loss' | 'push' | 'pending';
    parlay_id?: string;
    is_sharp_fade?: boolean;
    tags?: string[];
    [key: string]: string | number | boolean | string[] | undefined;
}
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
    streakSparkline?: string;
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
export interface RecapConfig {
    legendFooter: boolean;
    microRecap: boolean;
    notionSync: boolean;
    clvDelta: boolean;
    streakSparkline: boolean;
    roiThreshold: number;
    microRecapCooldown: number;
    discordWebhook?: string;
    slashCommands: boolean;
    notionToken?: string;
    notionDatabaseId?: string;
    metricsEnabled: boolean;
    metricsPort: number;
}
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
export interface SlashCommandOptions {
    period: 'daily' | 'weekly' | 'monthly';
    date?: string;
    capper?: string;
    format?: 'full' | 'summary';
}
export interface RoiWatcherState {
    currentDailyRoi: number;
    lastRoiCheck: string;
    lastMicroRecapSent: string;
    picksProcessedToday: number;
    thresholdBreached: boolean;
}
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
export declare class RecapError extends Error {
    code: string;
    timestamp: string;
    context?: Record<string, unknown>;
    severity: 'low' | 'medium' | 'high';
    constructor(options: {
        code: string;
        message: string;
        timestamp: string;
        context?: Record<string, unknown>;
        severity: 'low' | 'medium' | 'high';
    });
}
export interface MigrationScript {
    version: string;
    description: string;
    up: string;
    down: string;
    dependencies?: string[];
}
export type RecapPeriod = 'daily' | 'weekly' | 'monthly';
export interface MarketReaction {
    reaction: 'sharp_agree' | 'sharp_fade' | 'neutral' | 'unknown';
    movement: number;
    movementPct?: number;
    updated_line?: number;
}
//# sourceMappingURL=picks.d.ts.map