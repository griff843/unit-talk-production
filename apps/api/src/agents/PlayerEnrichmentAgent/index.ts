// src/agents/PlayerEnrichmentAgent/index.ts

import { BaseAgent } from '../BaseAgent/index';
import {
  BaseAgentConfig,
  BaseAgentDependencies,
  BaseMetrics,
  HealthCheckResult,
} from '../BaseAgent/types';
import { enrichAllPlayers, EnrichmentSummary, SupportedLeague } from '../PlayerEnrichmentAgent';

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
export class PlayerEnrichmentAgent extends BaseAgent {
  public override metrics: PlayerEnrichmentMetrics;

  constructor(config: BaseAgentConfig, dependencies: BaseAgentDependencies) {
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
  protected async initialize(): Promise<void> {
    this.logger.info('PlayerEnrichmentAgent initialized with multi-league support');
  }

  /**
   * Process method - required by BaseAgent
   */
  protected async process(): Promise<void> {
    // This agent is primarily used for on-demand enrichment
    // No continuous processing needed
    this.logger.debug(
      'PlayerEnrichmentAgent process method called - no continuous processing needed'
    );
  }

  /**
   * Cleanup method - required by BaseAgent
   */
  protected async cleanup(): Promise<void> {
    this.logger.info('PlayerEnrichmentAgent cleanup completed');
  }

  /**
   * Collect metrics - required by BaseAgent
   */
  protected async collectMetrics(): Promise<BaseMetrics> {
    const memoryUsage = process.memoryUsage();
    this.metrics.memoryUsageMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    return this.metrics;
  }

  /**
   * Health check - tests all league APIs
   */
  protected async checkHealth(): Promise<HealthCheckResult> {
    try {
      // Test each league API with a known player
      const testPlayers = {
        MLB: 'Mike Trout',
        NBA: 'LeBron James',
        NFL: 'Tom Brady',
        NHL: 'Connor McDavid',
      };

      const leagueTests = await Promise.allSettled([
        this.getMlbHeadshot(testPlayers.MLB),
        this.getNbaHeadshot(testPlayers.NBA),
        this.getNflHeadshot(testPlayers.NFL),
        this.getNhlHeadshot(testPlayers.NHL),
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
              error: result.status === 'rejected' ? result.reason?.message : null,
            })),
          },
        };
      }

      return {
        status: 'healthy',
        details: {
          message: 'PlayerEnrichmentAgent healthy - all league APIs accessible',
          supportedLeagues: ['MLB', 'NBA', 'NFL', 'NHL'],
          leagueApiTests: 'All passed',
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          message: 'PlayerEnrichmentAgent health check failed',
          err: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Enrich all players for a specific league or all leagues
   */
  public async enrichLeague(league?: SupportedLeague): Promise<EnrichmentSummary> {
    this.logger.info(`Starting player enrichment${league ? ` for ${league}` : ' for all leagues'}`);

    try {
      const summary = await enrichAllPlayers(league);
      this.metrics.lastEnrichmentSummary = summary;
      this.metrics.totalPlayersProcessed += summary.totalProcessed;
      this.metrics.successfulEnrichments += summary.successfulEnrichments;
      this.metrics.playersNotFound += summary.notFound;

      // Update league-specific metrics
      Object.entries(summary.leagueBreakdown).forEach(([leagueKey, breakdown]) => {
        const metricKey =
          `${leagueKey.toLowerCase()}PlayersProcessed` as keyof typeof this.metrics.leagueMetrics;
        this.metrics.leagueMetrics[metricKey] += breakdown.processed;
      });

      this.logger.info(
        `Player enrichment completed: ${summary.successfulEnrichments}/${summary.totalProcessed} successful`
      );
      return summary;
    } catch (error) {
      this.logger.error('Error during player enrichment:', error);
      this.metrics.errorCount++;
      throw error;
    }
  }

  /**
   * Get headshot for a specific player and league
   */
  public async getPlayerHeadshot(
    playerName: string,
    league: SupportedLeague
  ): Promise<string | null> {
    this.logger.info(`Getting headshot for ${playerName} (${league})`);

    try {
      let result: string | null = null;

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
      const leagueKey =
        `${league.toLowerCase()}PlayersProcessed` as keyof typeof this.metrics.leagueMetrics;
      this.metrics.leagueMetrics[leagueKey]++;

      if (result) {
        this.metrics.successfulEnrichments++;
      } else {
        this.metrics.playersNotFound++;
        this.metrics.warningCount++;
      }

      return result;
    } catch (error) {
      this.logger.error(`Error getting headshot for ${playerName} (${league}):`, error);
      this.metrics.errorCount++;
      throw error;
    }
  }

  /**
   * League-specific enrichment methods
   */
  public async getMlbHeadshot(playerName: string): Promise<string | null> {
    return this.getPlayerHeadshot(playerName, 'MLB');
  }

  public async getNbaHeadshot(playerName: string): Promise<string | null> {
    return this.getPlayerHeadshot(playerName, 'NBA');
  }

  public async getNflHeadshot(playerName: string): Promise<string | null> {
    return this.getPlayerHeadshot(playerName, 'NFL');
  }

  public async getNhlHeadshot(playerName: string): Promise<string | null> {
    return this.getPlayerHeadshot(playerName, 'NHL');
  }

  /**
   * Get enrichment metrics
   */
  public getEnrichmentMetrics(): PlayerEnrichmentMetrics {
    return { ...this.metrics };
  }
}
