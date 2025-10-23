"use strict";
// src/agents/PlayerEnrichmentAgent/index.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerEnrichmentAgent = void 0;
const index_1 = require("../BaseAgent/index");
const PlayerEnrichmentAgent_1 = require("../PlayerEnrichmentAgent");
/**
 * PlayerEnrichmentAgent - Handles player data enrichment operations for all major sports
 * Extends BaseAgent with multi-league player enrichment capabilities
 *
 * Supports: MLB, NBA, NFL, NHL
 */
class PlayerEnrichmentAgent extends index_1.BaseAgent {
    constructor(config, dependencies) {
        super(config, dependencies);
        // Initialize extended metrics with league-specific tracking
        this.metrics = {
            agentName: this.config.name,
            errorCount: 0,
            successCount: 0,
            warningCount: 0,
            processingTimeMs: 0,
            memoryUsageMb: 0,
            totalPlayersProcessed: 0,
            successfulEnrichments: 0,
            playersNotFound: 0,
            leagueMetrics: {
                mlbPlayersProcessed: 0,
                nbaPlayersProcessed: 0,
                nflPlayersProcessed: 0,
                nhlPlayersProcessed: 0,
            },
        };
    }
    /**
     * Initialize the agent
     */
    async initialize() {
        this.logger.info('PlayerEnrichmentAgent initialized with multi-league support');
    }
    /**
     * Process method - required by BaseAgent
     */
    async process() {
        // This agent is primarily used for on-demand enrichment
        // No continuous processing needed
        this.logger.debug('PlayerEnrichmentAgent process method called - no continuous processing needed');
    }
    /**
     * Cleanup method - required by BaseAgent
     */
    async cleanup() {
        this.logger.info('PlayerEnrichmentAgent cleanup completed');
    }
    /**
     * Collect metrics - required by BaseAgent
     */
    async collectMetrics() {
        const memoryUsage = process.memoryUsage();
        this.metrics.memoryUsageMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        return this.metrics;
    }
    /**
     * Health check - tests all league APIs
     */
    async checkHealth() {
        try {
            // Test each league API with a known player
            const testPlayers = {
                MLB: 'Mike Trout',
                NBA: 'LeBron James',
                NFL: 'Tom Brady',
                NHL: 'Connor McDavid'
            };
            const leagueTests = await Promise.allSettled([
                this.getMlbHeadshot(testPlayers.MLB),
                this.getNbaHeadshot(testPlayers.NBA),
                this.getNflHeadshot(testPlayers.NFL),
                this.getNhlHeadshot(testPlayers.NHL)
            ]);
            const failedTests = leagueTests.filter(result => result.status === 'rejected');
            if (failedTests.length > 0) {
                return {
                    status: 'degraded',
                    details: {
                        message: `${failedTests.length} league API(s) failed health check`,
                        leagueApiTests: leagueTests.map((result, index) => ({
                            league: Object.keys(testPlayers)[index],
                            status: result.status,
                            error: result.status === 'rejected' ? result.reason?.message : null
                        }))
                    }
                };
            }
            return {
                status: 'healthy',
                details: {
                    message: 'PlayerEnrichmentAgent healthy - all league APIs accessible',
                    supportedLeagues: ['MLB', 'NBA', 'NFL', 'NHL'],
                    leagueApiTests: 'All passed'
                }
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    message: 'PlayerEnrichmentAgent health check failed',
                    err: error instanceof Error ? error.message : 'Unknown error'
                }
            };
        }
    }
    /**
     * Enrich all players for a specific league or all leagues
     */
    async enrichLeague(league) {
        this.logger.info(`Starting player enrichment${league ? ` for ${league}` : ' for all leagues'}`);
        try {
            const summary = await (0, PlayerEnrichmentAgent_1.enrichAllPlayers)(league);
            this.metrics.lastEnrichmentSummary = summary;
            this.metrics.totalPlayersProcessed += summary.totalProcessed;
            this.metrics.successfulEnrichments += summary.successfulEnrichments;
            this.metrics.playersNotFound += summary.notFound;
            // Update league-specific metrics
            Object.entries(summary.leagueBreakdown).forEach(([leagueKey, breakdown]) => {
                const metricKey = `${leagueKey.toLowerCase()}PlayersProcessed`;
                this.metrics.leagueMetrics[metricKey] += breakdown.processed;
            });
            this.logger.info(`Player enrichment completed: ${summary.successfulEnrichments}/${summary.totalProcessed} successful`);
            return summary;
        }
        catch (error) {
            this.logger.error('Error during player enrichment:', error);
            this.metrics.errorCount++;
            throw error;
        }
    }
    /**
     * Get headshot for a specific player and league
     */
    async getPlayerHeadshot(playerName, league) {
        this.logger.info(`Getting headshot for ${playerName} (${league})`);
        try {
            let result = null;
            switch (league) {
                case 'MLB':
                    result = await this.getMlbHeadshot(playerName);
                    break;
                case 'NBA':
                    result = await this.getNbaHeadshot(playerName);
                    break;
                case 'NFL':
                    result = await this.getNflHeadshot(playerName);
                    break;
                case 'NHL':
                    result = await this.getNhlHeadshot(playerName);
                    break;
                default:
                    throw new Error(`Unsupported league: ${league}`);
            }
            // Update metrics
            const leagueKey = `${league.toLowerCase()}PlayersProcessed`;
            this.metrics.leagueMetrics[leagueKey]++;
            if (result) {
                this.metrics.successfulEnrichments++;
            }
            else {
                this.metrics.playersNotFound++;
                this.metrics.warningCount++;
            }
            return result;
        }
        catch (error) {
            this.logger.error(`Error getting headshot for ${playerName} (${league}):`, error);
            this.metrics.errorCount++;
            throw error;
        }
    }
    /**
     * League-specific enrichment methods
     */
    async getMlbHeadshot(playerName) {
        return this.getPlayerHeadshot(playerName, 'MLB');
    }
    async getNbaHeadshot(playerName) {
        return this.getPlayerHeadshot(playerName, 'NBA');
    }
    async getNflHeadshot(playerName) {
        return this.getPlayerHeadshot(playerName, 'NFL');
    }
    async getNhlHeadshot(playerName) {
        return this.getPlayerHeadshot(playerName, 'NHL');
    }
    /**
     * Get enrichment metrics
     */
    getEnrichmentMetrics() {
        return { ...this.metrics };
    }
}
exports.PlayerEnrichmentAgent = PlayerEnrichmentAgent;
