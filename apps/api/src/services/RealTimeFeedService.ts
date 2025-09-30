/**
 * Real-Time Feed Service
 *
 * Provides 30-60 second polling intervals for real-time alert features
 * Fetches ALL available markets from Odds API with massive credit buffer
 *
 * Configuration:
 * - 5,000,000 credits/month ($119/month plan)
 * - 30-second polling during live game windows
 * - Complete market coverage (core + all player props)
 * - Game metadata sync to games table
 */

import { logger } from '../shared/logger';
import { fetchOddsCoreMarkets } from '../agents/FeedAgent/oddsApi';

interface SportPollingConfig {
  sport: string;
  sportKey: string;
  pollInterval: number; // milliseconds
  markets: string[];
  enabled: boolean;
}

interface PollingSummary {
  sport: string;
  lastPoll: Date;
  nextPoll: Date;
  propsProcessed: number;
  gamesUpdated: number;
  errors: string[];
}

export class RealTimeFeedService {
  private pollInterval: number = 30 * 1000; // 30 seconds default
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private pollingSummaries: Map<string, PollingSummary> = new Map();
  private isRunning: boolean = false;

  private sportConfigs: SportPollingConfig[] = [
    {
      sport: 'nfl',
      sportKey: 'americanfootball_nfl',
      pollInterval: 30 * 1000, // 30 seconds
      markets: ['h2h', 'spreads', 'totals', 'player-props'],
      enabled: true,
    },
    {
      sport: 'mlb',
      sportKey: 'baseball_mlb',
      pollInterval: 30 * 1000, // 30 seconds
      markets: ['h2h', 'spreads', 'totals', 'player-props'],
      enabled: true,
    },
    {
      sport: 'wnba',
      sportKey: 'basketball_wnba',
      pollInterval: 30 * 1000, // 30 seconds
      markets: ['h2h', 'spreads', 'totals', 'player-props'],
      enabled: true,
    },
  ];

  constructor(pollInterval?: number) {
    if (pollInterval) {
      this.pollInterval = pollInterval;
    }
  }

  /**
   * Start polling for all configured sports
   */
  async startPolling(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[RealTimeFeedService] Already running');
      return;
    }

    this.isRunning = true;
    logger.info('[RealTimeFeedService] Starting real-time polling for all sports', {
      pollInterval: this.pollInterval,
      sports: this.sportConfigs.filter(c => c.enabled).map(c => c.sport),
    });

    for (const config of this.sportConfigs) {
      if (config.enabled) {
        // Initial poll
        await this.pollSport(config);

        // Schedule recurring polls
        const timer = setInterval(
          () => this.pollSport(config),
          config.pollInterval
        );
        this.timers.set(config.sport, timer);

        logger.info(`[RealTimeFeedService] Started polling for ${config.sport}`, {
          interval: config.pollInterval / 1000 + 's',
          markets: config.markets,
        });
      }
    }
  }

  /**
   * Stop all polling timers
   */
  stopPolling(): void {
    logger.info('[RealTimeFeedService] Stopping all polling timers');

    for (const [sport, timer] of this.timers.entries()) {
      clearInterval(timer);
      logger.info(`[RealTimeFeedService] Stopped polling for ${sport}`);
    }

    this.timers.clear();
    this.isRunning = false;
  }

  /**
   * Poll a specific sport for latest odds
   */
  private async pollSport(config: SportPollingConfig): Promise<void> {
    const startTime = Date.now();
    let propsProcessed = 0;
    let gamesUpdated = 0;
    const errors: string[] = [];

    try {
      logger.info(`[RealTimeFeedService] Polling ${config.sport}...`, {
        markets: config.markets,
      });

      // Fetch latest odds with full market coverage
      const result = await fetchOddsCoreMarkets({
        sportKey: config.sportKey,
        markets: config.markets,
        regions: 'us',
        bookmakers: ['draftkings', 'fanduel', 'betmgm', 'caesars'],
        oddsFormat: 'american',
        dateFormat: 'iso',
        eventBatchSize: 20,
        eventLookaheadHours: 48,
        writeEnabled: true,
      });

      propsProcessed = result.picks?.length || 0;
      gamesUpdated = result.games?.length || 0;

      logger.info(`[RealTimeFeedService] ${config.sport} poll complete`, {
        propsProcessed,
        gamesUpdated,
        duration: Date.now() - startTime + 'ms',
      });
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown polling error';
      logger.error(`[RealTimeFeedService] ${config.sport} poll failed`, {
        error: errorMsg,
      });
      errors.push(errorMsg);
    }

    // Update polling summary
    this.pollingSummaries.set(config.sport, {
      sport: config.sport,
      lastPoll: new Date(),
      nextPoll: new Date(Date.now() + config.pollInterval),
      propsProcessed,
      gamesUpdated,
      errors,
    });
  }

  /**
   * Get current polling status for all sports
   */
  getStatus(): {
    isRunning: boolean;
    pollInterval: number;
    activeSports: string[];
    summaries: PollingSummary[];
  } {
    return {
      isRunning: this.isRunning,
      pollInterval: this.pollInterval,
      activeSports: Array.from(this.timers.keys()),
      summaries: Array.from(this.pollingSummaries.values()),
    };
  }

  /**
   * Update polling interval for a specific sport
   */
  updateSportInterval(sport: string, interval: number): boolean {
    const config = this.sportConfigs.find(c => c.sport === sport);
    if (!config) {
      logger.warn(`[RealTimeFeedService] Sport not found: ${sport}`);
      return false;
    }

    config.pollInterval = interval;

    // Restart timer if running
    if (this.timers.has(sport)) {
      clearInterval(this.timers.get(sport)!);
      const timer = setInterval(() => this.pollSport(config), interval);
      this.timers.set(sport, timer);

      logger.info(`[RealTimeFeedService] Updated ${sport} interval to ${interval / 1000}s`);
    }

    return true;
  }

  /**
   * Enable/disable polling for a specific sport
   */
  setSportEnabled(sport: string, enabled: boolean): boolean {
    const config = this.sportConfigs.find(c => c.sport === sport);
    if (!config) {
      logger.warn(`[RealTimeFeedService] Sport not found: ${sport}`);
      return false;
    }

    config.enabled = enabled;

    if (enabled && this.isRunning && !this.timers.has(sport)) {
      // Start polling for this sport
      this.pollSport(config);
      const timer = setInterval(() => this.pollSport(config), config.pollInterval);
      this.timers.set(sport, timer);
      logger.info(`[RealTimeFeedService] Enabled polling for ${sport}`);
    } else if (!enabled && this.timers.has(sport)) {
      // Stop polling for this sport
      clearInterval(this.timers.get(sport)!);
      this.timers.delete(sport);
      logger.info(`[RealTimeFeedService] Disabled polling for ${sport}`);
    }

    return true;
  }
}

// Export singleton instance
export const realTimeFeedService = new RealTimeFeedService();