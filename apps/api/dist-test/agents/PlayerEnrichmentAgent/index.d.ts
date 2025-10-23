import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics, HealthCheckResult } from '../BaseAgent/types';
import { EnrichmentSummary, SupportedLeague } from '../PlayerEnrichmentAgent';
/**
 * Extended metrics for PlayerEnrichmentAgent with league-specific tracking
 */
interface PlayerEnrichmentMetrics extends BaseMetrics {
    totalPlayersProcessed: number;
    successfulEnrichments: number;
    playersNotFound: number;
    leagueMetrics: {
        mlbPlayersProcessed: number;
        nbaPlayersProcessed: number;
        nflPlayersProcessed: number;
        nhlPlayersProcessed: number;
    };
    lastEnrichmentSummary?: EnrichmentSummary;
}
/**
 * PlayerEnrichmentAgent - Handles player data enrichment operations for all major sports
 * Extends BaseAgent with multi-league player enrichment capabilities
 *
 * Supports: MLB, NBA, NFL, NHL
 */
export declare class PlayerEnrichmentAgent extends BaseAgent {
    metrics: PlayerEnrichmentMetrics;
    constructor(config: BaseAgentConfig, dependencies: BaseAgentDependencies);
    /**
     * Initialize the agent
     */
    protected initialize(): Promise<void>;
    /**
     * Process method - required by BaseAgent
     */
    protected process(): Promise<void>;
    /**
     * Cleanup method - required by BaseAgent
     */
    protected cleanup(): Promise<void>;
    /**
     * Collect metrics - required by BaseAgent
     */
    protected collectMetrics(): Promise<BaseMetrics>;
    /**
     * Health check - tests all league APIs
     */
    protected checkHealth(): Promise<HealthCheckResult>;
    /**
     * Enrich all players for a specific league or all leagues
     */
    enrichLeague(league?: SupportedLeague): Promise<EnrichmentSummary>;
    /**
     * Get headshot for a specific player and league
     */
    getPlayerHeadshot(playerName: string, league: SupportedLeague): Promise<string | null>;
    /**
     * League-specific enrichment methods
     */
    getMlbHeadshot(playerName: string): Promise<string | null>;
    getNbaHeadshot(playerName: string): Promise<string | null>;
    getNflHeadshot(playerName: string): Promise<string | null>;
    getNhlHeadshot(playerName: string): Promise<string | null>;
    /**
     * Get enrichment metrics
     */
    getEnrichmentMetrics(): PlayerEnrichmentMetrics;
}
export {};
//# sourceMappingURL=index.d.ts.map