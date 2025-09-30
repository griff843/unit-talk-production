export type PlayerStatMap = {
  [playerIdOrName: string]: {
    [stat: string]: number;
  };
};

export interface LeagueAdapter {
  /**
   * Fetch game statistics for all players in a game
   * @param gameId External game ID from the data provider
   * @returns Map of player IDs/names to their stats
   */
  fetchGameStats(gameId: string): Promise<PlayerStatMap>;

  /**
   * Get the name of this adapter for logging/tracking
   */
  getName(): string;

  /**
   * Get the rate limit for this adapter (requests per second)
   */
  getRateLimit(): number;
}

export abstract class BaseAdapter implements LeagueAdapter {
  protected rateLimit: number = 4; // Default 4 RPS
  protected maxRetries: number = 3;
  protected retryDelay: number = 1000; // Start with 1 second

  abstract fetchGameStats(gameId: string): Promise<PlayerStatMap>;
  abstract getName(): string;

  getRateLimit(): number {
    return this.rateLimit;
  }

  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= this.maxRetries) {
        throw error;
      }

      const delay = this.retryDelay * Math.pow(2, attempt - 1);
      await this.sleep(delay);
      
      return this.retryWithBackoff(fn, attempt + 1);
    }
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected normalizePlayerName(name: string): string {
    return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }
}