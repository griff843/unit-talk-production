import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies } from '../BaseAgent/types';
import { RecapFormatter } from './recapFormatter';
import { RecapService } from './recapService';
import { RecapState } from './recapStateManager';
interface MicroRecapData {
    summary: string;
    picks: any[];
    performance: {
        winRate: number;
        roi: number;
        totalPicks: number;
    };
    timestamp: string;
}
interface RecapStateManager {
    loadState(): Promise<RecapState>;
    saveState(state: RecapState): Promise<void>;
    updateState(updates: Partial<RecapState>): Promise<boolean>;
}
export interface RecapAgentType {
    processRecap(): Promise<void>;
    generateRecap(): Promise<MicroRecapData>;
    triggerDailyRecap(dateStr?: string): Promise<void>;
    triggerWeeklyRecap(): Promise<void>;
    triggerMonthlyRecap(): Promise<void>;
    getRecapService(): RecapService;
    getRecapFormatter(): RecapFormatter;
    getRecapState(): RecapState;
    updateRecapState(newState: Partial<RecapState>): Promise<void>;
    monitorUnifiedPicks(): Promise<void>;
    postLivePick(pickData: any): Promise<void>;
    postScheduledPicks(): Promise<void>;
    formatPickEmbed(pickData: any): any;
    routeToThread(pickData: any): Promise<string>;
    notifyVIPUsers(pickData: any): Promise<void>;
    flagLowTierPicks(): Promise<void>;
    get recapState(): RecapState;
}
export declare class RecapAgent extends BaseAgent implements RecapAgentType {
    private recapService;
    private recapFormatter;
    private stateManager;
    private _recapState;
    private monitoringInterval;
    constructor(config: BaseAgentConfig, dependencies: BaseAgentDependencies, recapService: RecapService, recapFormatter: RecapFormatter, stateManager: RecapStateManager);
    get recapState(): RecapState;
    getRecapState(): RecapState;
    updateRecapState(newState: Partial<RecapState>): Promise<void>;
    processRecap(): Promise<void>;
    generateRecap(): Promise<MicroRecapData>;
    triggerDailyRecap(dateStr?: string): Promise<void>;
    triggerWeeklyRecap(): Promise<void>;
    triggerMonthlyRecap(): Promise<void>;
    getRecapService(): RecapService;
    getRecapFormatter(): RecapFormatter;
    initialize(): Promise<void>;
    process(): Promise<void>;
    cleanup(): Promise<void>;
    checkHealth(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details?: any;
    }>;
    collectMetrics(): Promise<any>;
    /**
     * Start monitoring unified_picks table for new submissions
     */
    private startPicksMonitoring;
    /**
     * Monitor unified_picks table for new picks ready to post
     */
    monitorUnifiedPicks(): Promise<void>;
    /**
     * @deprecated This method has been moved to AlertAgent for proper separation of concerns
     * RecapAgent now focuses on post-game results and daily summaries only
     * Live pick posting is handled by AlertAgent.postLivePick()
     */
    postLivePick(pickData: any): Promise<void>;
    /**
     * Monitor scheduled picks - ARCHITECTURAL CHANGE: Delegated to AlertAgent
     * @deprecated Scheduled pick posting moved to AlertAgent for proper separation
     */
    postScheduledPicks(): Promise<void>;
    /**
     * Format pick data into Discord embed
     */
    formatPickEmbed(pickData: any): any;
    /**
     * Route pick to appropriate Discord thread
     */
    routeToThread(pickData: any): Promise<string>;
    /**
     * Notify VIP users about high-tier picks
     */
    notifyVIPUsers(pickData: any): Promise<void>;
    /**
     * Flag low-tier picks for manual review
     */
    flagLowTierPicks(): Promise<void>;
    /**
     * Build pick description from pick data
     */
    private buildPickDescription;
    /**
     * Post to Discord thread via Discord bot integration
     */
    private _postToDiscordThread;
    /**
     * Update pick with Discord posting information
     */
    private _updatePickWithDiscordInfo;
    /**
     * Send alert to admin channel
     */
    private sendAdminAlert;
}
export {};
//# sourceMappingURL=index.d.ts.map