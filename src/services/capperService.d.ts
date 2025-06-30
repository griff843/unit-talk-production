// Type definitions for CapperService

interface CapperProfile {
    id: string;
    discord_id: string;
    username: string;
    display_name?: string;
    tier?: string;
    created_at: string;
    updated_at: string;
}

interface Pick {
    id: string;
    capper_id: string;
    game: string;
    bet_type: string;
    selection: string;
    odds: number;
    units: number;
    status: 'pending' | 'won' | 'lost' | 'void';
    created_at: string;
}

interface AnalyticsEvent {
    event_type: string;
    capper_id: string;
    event_data: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
}

interface PerformanceMetrics {
    queryCount: number;
    averageResponseTime: number;
    errorCount: number;
    lastHealthCheck: Date;
    cacheHitRate?: string;
}

interface AnalyticsData {
    event_type: string;
    capper_id: string;
    timestamp: string;
    data: Record<string, unknown>;
}

interface CapperStats {
    capper_id: string;
    total_picks: number;
    wins: number;
    losses: number;
    win_rate: number;
    total_units: number;
    roi: number;
}

interface ComprehensiveReport {
    capper: CapperProfile | null;
    picks: Pick[];
    analytics: AnalyticsData[];
    stats: CapperStats;
    generatedAt: string;
    reportId: string;
}

interface DateRange {
    start: string;
    end: string;
}

interface PickData {
    capper_id: string;
    game: string;
    bet_type: string;
    selection: string;
    odds: number;
    units: number;
    analysis?: string;
}

declare class CapperService {
    private supabase;
    private performanceMetrics: PerformanceMetrics;
    private cache: Map<string, unknown>;
    private cacheTimeout: number;

    constructor();
    
    // Core CRUD operations
    getCapperByDiscordId(discordId: string): Promise<CapperProfile | null>;
    getCapperById(id: string): Promise<CapperProfile | null>;
    createCapper(data: {
        discordId: string;
        username: string;
        displayName: string;
        tier?: string;
    }): Promise<CapperProfile | null>;
    createDailyPick(pickData: PickData): Promise<Pick | null>;
    getCapperPicks(capperId: string, date?: string, status?: string): Promise<Pick[]>;
    
    // Analytics and stats
    getCapperStats(capperId: string): Promise<CapperStats>;
    logAnalyticsEvent(event: AnalyticsEvent): Promise<boolean>;
    getRecentAnalytics(capperId?: string, limit?: number): Promise<AnalyticsData[]>;
    
    // Cache management
    getCacheKey(method: string, params: Record<string, unknown>): string;
    setCache(key: string, data: unknown): void;
    getCache(key: string): unknown;
    clearCache(): void;
    
    // Performance monitoring
    startHealthMonitoring(): void;
    getPerformanceMetrics(): Promise<PerformanceMetrics>;
    
    // Fortune 100 production features
    bulkUpdateCapperStats(): Promise<boolean>;
    generateComprehensiveReport(capperId: string, dateRange?: DateRange): Promise<ComprehensiveReport | null>;
    finalizePicks(pickIds: string[]): Promise<boolean>;
}

export declare const capperService: CapperService;
export { CapperService, PerformanceMetrics, ComprehensiveReport, AnalyticsEvent, CapperProfile, Pick, CapperStats, AnalyticsData, DateRange, PickData };