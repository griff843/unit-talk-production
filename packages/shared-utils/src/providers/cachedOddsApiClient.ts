/*
 * Cache-first wrapper for OddsAPI-like provider
 * - Checks Redis game snapshot by game key
 * - Falls back to provider fetch on miss and stores snapshot with TTL
 * - Logs credit usage via public.log_credit_usage RPC (hour-bucketed)
 * - Provides thin writer to cache.book_quotes via public.write_book_quote RPC
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getGameSnapshot, setGameSnapshot } from '../cache/redisClient';

export interface OddsApiProvider {
  fetchGameSnapshot: (externalGameId: string) => Promise<any>;
}

export interface SupabaseLike {
  rpc: (fn: string, args?: Record<string, any>) => Promise<{ data: any; error: { message?: string } | null }>;
}

export interface CacheOptions {
  ttlSeconds?: number; // default 90
  providerName?: string; // default 'oddsapi'
  creditEstimate?: number; // default 1
}

export class CachedOddsApiClient {
  private provider: OddsApiProvider;
  private supabase?: SupabaseLike;
  private defaultTTL: number;
  private providerName: string;
  private creditEstimate: number;

  constructor(provider: OddsApiProvider, options?: { supabase?: SupabaseLike } & CacheOptions) {
    this.provider = provider;
    if (options?.supabase) {
      this.supabase = options.supabase;
    }
    this.defaultTTL = options?.ttlSeconds || Number(process.env['CACHE_TTL_SNAPSHOTS'] || 90);
    this.providerName = options?.providerName || 'oddsapi';
    this.creditEstimate = options?.creditEstimate || 1;
  }

  async getGame(externalGameId: string): Promise<any> {
    // 1) Cache lookup
    const cached = await getGameSnapshot(externalGameId);
    if (cached) return cached;

    // 2) Provider fetch
    const payload = await this.provider.fetchGameSnapshot(externalGameId);

    // 3) Store in cache and record credits
    await setGameSnapshot(externalGameId, payload, this.defaultTTL);
    await this.logCreditUsage();

    return payload;
  }

  async logCreditUsage(): Promise<void> {
    if (!this.supabase) return;
    try {
      const { error } = await this.supabase.rpc('log_credit_usage', {
        p_provider: this.providerName,
        p_credits: this.creditEstimate,
      });
      if (error) {
        // non-fatal
        // eslint-disable-next-line no-console
        console.warn('[cache-first] credit log failed:', error.message);
      }
    } catch {}
  }

  async writeBookQuote(params: {
    external_game_id: string;
    book: string;
    market_key: string;
    outcome: string;
    line?: number | null;
    price?: number | null;
    fetched_at?: string;
  }): Promise<boolean> {
    if (!this.supabase) return false;
    try {
      const { error } = await this.supabase.rpc('write_book_quote', {
        p_external_game_id: params.external_game_id,
        p_book: params.book,
        p_market_key: params.market_key,
        p_outcome: params.outcome,
        p_line: params.line ?? null,
        p_price: params.price ?? null,
        p_fetched_at: params.fetched_at ?? null,
      });
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[cache-first] write_book_quote failed:', error.message);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}

