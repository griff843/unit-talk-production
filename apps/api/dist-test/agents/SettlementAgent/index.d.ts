import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics, HealthStatus } from '../BaseAgent/types';
export declare class SettlementAgent extends BaseAgent {
    private settlementMetrics;
    private readonly SETTLEMENT_INTERVALS;
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    protected initialize(): Promise<void>;
    protected cleanup(): Promise<void>;
    protected collectMetrics(): Promise<BaseMetrics>;
    checkHealth(): Promise<HealthStatus>;
    protected process(): Promise<void>;
    /**
     * Process games that have recently completed
     */
    private processCompletedGames;
    /**
     * Process settlement for a specific game
     */
    private processGameSettlement;
    /**
     * Fetch settlement data for a specific game
     */
    private fetchGameSettlementData;
    /**
     * Update game result with latest settlement data
     */
    private updateGameResult;
    /**
     * Process all props for a completed game
     */
    private processGameProps;
    /**
     * Settle an individual prop bet
     */
    private settleProp;
    /**
     * Calculate prop settlement result
     */
    private calculatePropSettlement;
    /**
     * Update final pick settlement status
     */
    private updateUnifiedPickSettlement;
    /**
     * Process delayed settlements (30min, 3hr, 24hr checks)
     */
    private processDelayedSettlements;
    /**
     * Validate existing settlements for accuracy
     */
    private validateExistingSettlements;
    /**
     * Manual settlement override (for disputed cases)
     */
    manualSettle(propId: string, result: 'win' | 'loss' | 'push' | 'void', actualValue?: number, notes?: string): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map