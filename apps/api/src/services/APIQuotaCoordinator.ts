/**
 * API Quota Coordinator
 *
 * Stub implementation for TypeScript compilation.
 * Coordinates API quota management across providers.
 *
 * @module APIQuotaCoordinator
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('APIQuotaCoordinator');

/**
 * Quota configuration for a provider
 */
export interface QuotaConfig {
  provider: string;
  dailyLimit: number;
  monthlyLimit: number;
  requestsPerSecond: number;
  burstLimit: number;
}

/**
 * Quota status for a provider
 */
export interface QuotaStatus {
  provider: string;
  dailyUsed: number;
  dailyRemaining: number;
  monthlyUsed: number;
  monthlyRemaining: number;
  resetTime: string;
  throttled: boolean;
}

/**
 * API Quota Coordinator Interface
 */
export interface APIQuotaCoordinator {
  checkQuota(provider: string): Promise<boolean>;
  recordUsage(provider: string, count?: number): Promise<void>;
  getStatus(provider: string): Promise<QuotaStatus>;
  resetQuota(provider: string): Promise<void>;
  requestAPIAccess(
    provider: string,
    endpoint: string,
    priority: number,
    metadata: Record<string, any>
  ): Promise<{ allowed: boolean; reason?: string }>;
}

/**
 * In-Memory API Quota Coordinator
 *
 * Stub implementation - provides minimal quota management for compilation
 */
class InMemoryAPIQuotaCoordinator implements APIQuotaCoordinator {
  private quotas: Map<string, QuotaConfig> = new Map();
  private usage: Map<string, { daily: number; monthly: number; lastReset: Date }> = new Map();

  constructor() {
    logger.info('InMemoryAPIQuotaCoordinator initialized (stub)');

    // Default quotas for common providers
    this.quotas.set('odds-api', {
      provider: 'odds-api',
      dailyLimit: 500,
      monthlyLimit: 10000,
      requestsPerSecond: 10,
      burstLimit: 50,
    });
  }

  async checkQuota(provider: string): Promise<boolean> {
    const config = this.quotas.get(provider);
    if (!config) {
      logger.warn('No quota config for provider', { provider });
      return true; // Allow if no config
    }

    const usage = this.getOrCreateUsage(provider);

    // Check daily limit
    if (usage.daily >= config.dailyLimit) {
      logger.warn('Daily quota exceeded', {
        provider,
        usage: usage.daily,
        limit: config.dailyLimit,
      });
      return false;
    }

    // Check monthly limit
    if (usage.monthly >= config.monthlyLimit) {
      logger.warn('Monthly quota exceeded', {
        provider,
        usage: usage.monthly,
        limit: config.monthlyLimit,
      });
      return false;
    }

    return true;
  }

  async recordUsage(provider: string, count: number = 1): Promise<void> {
    const usage = this.getOrCreateUsage(provider);
    usage.daily += count;
    usage.monthly += count;

    logger.debug('Quota usage recorded', {
      provider,
      count,
      daily: usage.daily,
      monthly: usage.monthly,
    });
  }

  async getStatus(provider: string): Promise<QuotaStatus> {
    const config = this.quotas.get(provider) || {
      provider,
      dailyLimit: 1000,
      monthlyLimit: 30000,
      requestsPerSecond: 10,
      burstLimit: 50,
    };

    const usage = this.getOrCreateUsage(provider);

    return {
      provider,
      dailyUsed: usage.daily,
      dailyRemaining: Math.max(0, config.dailyLimit - usage.daily),
      monthlyUsed: usage.monthly,
      monthlyRemaining: Math.max(0, config.monthlyLimit - usage.monthly),
      resetTime: new Date(usage.lastReset.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      throttled: usage.daily >= config.dailyLimit || usage.monthly >= config.monthlyLimit,
    };
  }

  async resetQuota(provider: string): Promise<void> {
    this.usage.delete(provider);
    logger.info('Quota reset', { provider });
  }

  async requestAPIAccess(
    provider: string,
    endpoint: string,
    priority: number,
    metadata: Record<string, any>
  ): Promise<{ allowed: boolean; reason?: string }> {
    const hasQuota = await this.checkQuota(provider);

    if (!hasQuota) {
      return {
        allowed: false,
        reason: 'Quota exceeded',
      };
    }

    return {
      allowed: true,
    };
  }

  private getOrCreateUsage(provider: string): { daily: number; monthly: number; lastReset: Date } {
    let usage = this.usage.get(provider);

    if (!usage) {
      usage = { daily: 0, monthly: 0, lastReset: new Date() };
      this.usage.set(provider, usage);
    }

    // Reset daily if needed
    const now = new Date();
    const hoursSinceReset = (now.getTime() - usage.lastReset.getTime()) / (1000 * 60 * 60);
    if (hoursSinceReset >= 24) {
      usage.daily = 0;
      usage.lastReset = now;
    }

    return usage;
  }
}

/**
 * Singleton API quota coordinator instance
 */
export const apiQuotaCoordinator: APIQuotaCoordinator = new InMemoryAPIQuotaCoordinator();
