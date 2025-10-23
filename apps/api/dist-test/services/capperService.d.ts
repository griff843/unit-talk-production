export interface CapperStats {
    totalPicks: number;
    wins: number;
    losses: number;
    pushes: number;
    winRate: number;
    totalUnits: number;
    roi: number;
    currentStreak: number;
    bestStreak: number;
    worstStreak: number;
}
export interface CapperData {
    id: string;
    name?: string;
    discord_id: string;
    username: string;
    display_name: string;
    tier: 'rookie' | 'pro' | 'elite' | 'legend';
    status: string;
    total_picks: number;
    wins: number;
    losses: number;
    pushes: number;
    total_units: number;
    roi: number;
    win_rate: number;
    current_streak: number;
    best_streak: number;
    worst_streak: number;
    created_at?: string;
    updated_at?: string;
}
export interface PickData {
    id?: string;
    user_id: string;
    game?: string;
    pick_type?: string;
    status?: string;
    confidence?: string;
    units?: number;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
}
export declare class CapperService {
    private performanceMetrics;
    /**
     * Test database connection
     */
    testConnection(): Promise<boolean>;
    /**
     * Get capper by Discord ID
     */
    getCapperByDiscordId(discordId: string): Promise<CapperData | null>;
    /**
     * Create new capper profile
     */
    createCapperProfile(capperData: {
        discordId: string;
        name?: string;
        username: string;
        displayName: string;
        tier?: 'rookie' | 'pro' | 'elite' | 'legend';
    }): Promise<CapperData | null>;
    /**
     * Get capper picks
     */
    getCapperPicks(capperId: string, date?: string, status?: string): Promise<PickData[]>;
    /**
     * Submit a pick
     */
    submitPick(pickData: PickData): Promise<PickData | null>;
    /**
     * Update a pick
     */
    updatePick(pickId: string, updates: Partial<PickData>): Promise<PickData | null>;
    /**
     * Delete a pick
     */
    deletePick(pickId: string): Promise<boolean>;
    /**
     * Check if user has capper permissions
     */
    hasCapperPermissions(discordId: string): Promise<boolean>;
    /**
     * Create daily pick (alias for submitPick)
     */
    createDailyPick(pickData: PickData): Promise<PickData | null>;
    /**
     * Finalize picks
     */
    finalizePicks(pickIds: string[]): Promise<boolean>;
    /**
     * Get capper by ID
     */
    getCapperById(capperId: string): Promise<CapperData | null>;
    /**
     * Get capper statistics
     */
    getCapperStats(capperId: string): Promise<CapperStats | null>;
    /**
     * Log analytics event (placeholder)
     */
    logAnalyticsEvent(event: string, data: any): Promise<void>;
    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): {
        queryCount: number;
        averageResponseTime: number;
        errorCount: number;
        lastHealthCheck: string;
    };
}
export declare const capperService: CapperService;
//# sourceMappingURL=capperService.d.ts.map