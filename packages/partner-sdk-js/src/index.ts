/**
 * Unit Talk Partner SDK - JavaScript/TypeScript
 * Official SDK for interacting with Unit Talk Partner API
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

export interface ClientConfig {
  apiKey: string;
  environment?: 'production' | 'staging' | 'development';
  baseURL?: string;
  timeout?: number;
}

export interface Pick {
  id?: string;
  sport: string;
  market_type: string;
  selection: string;
  line?: number;
  odds: number;
  stake?: number;
  player_name?: string;
  team?: string;
  opponent?: string;
  game_date: string;
  game_time?: string;
  external_id?: string;
  metadata?: Record<string, any>;
}

export interface Market {
  id: string;
  sport: string;
  player_name: string;
  stat_type: string;
  line: number;
  over_odds: number;
  under_odds: number;
  game_date: string;
}

export interface Stats {
  overall: {
    totalPicks: number;
    wins: number;
    losses: number;
    pushes: number;
    winRate: number;
    totalStaked: number;
    totalPayout: number;
    netProfit: number;
    roi: number;
  };
  breakdown: {
    byTier: Record<string, number>;
    bySport: Record<string, number>;
  };
}

export interface Webhook {
  id?: string;
  url: string;
  events: string[];
  secret?: string;
  is_active?: boolean;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  sport?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  player_name?: string;
  market_type?: string;
  game_date?: string;
}

export class UnitTalkAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public correlationId?: string
  ) {
    super(message);
    this.name = 'UnitTalkAPIError';
  }
}

export class UnitTalkClient {
  private client: AxiosInstance;

  constructor(config: ClientConfig) {
    const baseURL = config.baseURL || this.getBaseURL(config.environment);

    this.client = axios.create({
      baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'UnitTalk-Partner-SDK-JS/1.0.0'
      }
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const errorData = error.response?.data as any;
        throw new UnitTalkAPIError(
          errorData?.message || error.message,
          error.response?.status,
          errorData?.correlationId
        );
      }
    );
  }

  private getBaseURL(environment?: string): string {
    switch (environment) {
      case 'production':
        return 'https://api.unittalk.com/v1/partners';
      case 'staging':
        return 'https://staging-api.unittalk.com/v1/partners';
      case 'development':
      default:
        return 'http://localhost:3000/v1/partners';
    }
  }

  /**
   * Picks API
   */
  public picks = {
    /**
     * List picks with optional filters
     */
    list: async (options?: ListOptions) => {
      const response = await this.client.get('/picks', { params: options });
      return response.data;
    },

    /**
     * Get a specific pick by ID
     */
    get: async (id: string) => {
      const response = await this.client.get(`/picks/${id}`);
      return response.data;
    },

    /**
     * Create a new pick
     */
    create: async (pick: Pick) => {
      const response = await this.client.post('/picks', pick);
      return response.data;
    }
  };

  /**
   * Markets API
   */
  public markets = {
    /**
     * List available markets with optional filters
     */
    list: async (options?: ListOptions) => {
      const response = await this.client.get('/markets', { params: options });
      return response.data;
    }
  };

  /**
   * Stats API
   */
  public stats = {
    /**
     * Get performance statistics
     */
    get: async (options?: { date_from?: string; date_to?: string; sport?: string }) => {
      const response = await this.client.get('/stats', { params: options });
      return response.data as { success: boolean; data: Stats };
    }
  };

  /**
   * Webhooks API
   */
  public webhooks = {
    /**
     * List all webhooks
     */
    list: async () => {
      const response = await this.client.get('/webhooks');
      return response.data;
    },

    /**
     * Create a new webhook
     */
    create: async (webhook: Webhook) => {
      const response = await this.client.post('/webhooks', webhook);
      return response.data;
    },

    /**
     * Delete a webhook
     */
    delete: async (id: string) => {
      const response = await this.client.delete(`/webhooks/${id}`);
      return response.data;
    }
  };
}

export default UnitTalkClient;
