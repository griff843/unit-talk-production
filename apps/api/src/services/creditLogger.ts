/**
 * Credit Logger
 *
 * Stub implementation for TypeScript compilation.
 * Logs API credit usage for provider gateway.
 *
 * @module creditLogger
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('CreditLogger');

/**
 * Credit usage record
 */
export interface CreditUsage {
  provider: string;
  endpoint: string;
  creditsUsed: number;
  creditsRemaining?: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Credit Logger Interface
 */
export interface CreditLogger {
  logUsage(usage: CreditUsage): void;
  getUsage(provider: string, startDate?: Date, endDate?: Date): CreditUsage[];
  getTotalUsage(provider: string): number;
  getRemainingCredits(provider: string): number | undefined;
  addCall(provider: string, creditsUsed: number, creditsRemaining: number, dedupKey?: string): void;
}

/**
 * In-Memory Credit Logger
 *
 * Stub implementation - provides minimal logging for compilation
 */
class InMemoryCreditLogger implements CreditLogger {
  private usageLog: CreditUsage[] = [];
  private remainingCredits: Map<string, number> = new Map();

  constructor() {
    logger.info('InMemoryCreditLogger initialized (stub)');
  }

  logUsage(usage: CreditUsage): void {
    this.usageLog.push(usage);

    if (usage.creditsRemaining !== undefined) {
      this.remainingCredits.set(usage.provider, usage.creditsRemaining);
    }

    logger.debug('Credit usage logged', {
      provider: usage.provider,
      creditsUsed: usage.creditsUsed,
      creditsRemaining: usage.creditsRemaining,
    });

    // Keep last 10000 records
    if (this.usageLog.length > 10000) {
      this.usageLog.shift();
    }
  }

  getUsage(provider: string, startDate?: Date, endDate?: Date): CreditUsage[] {
    let filtered = this.usageLog.filter(u => u.provider === provider);

    if (startDate) {
      filtered = filtered.filter(u => new Date(u.timestamp) >= startDate);
    }

    if (endDate) {
      filtered = filtered.filter(u => new Date(u.timestamp) <= endDate);
    }

    return filtered;
  }

  getTotalUsage(provider: string): number {
    return this.usageLog
      .filter(u => u.provider === provider)
      .reduce((sum, u) => sum + u.creditsUsed, 0);
  }

  getRemainingCredits(provider: string): number | undefined {
    return this.remainingCredits.get(provider);
  }

  addCall(
    provider: string,
    creditsUsed: number,
    creditsRemaining: number,
    dedupKey?: string
  ): void {
    this.logUsage({
      provider,
      endpoint: 'unknown',
      creditsUsed,
      creditsRemaining,
      timestamp: new Date().toISOString(),
      metadata: dedupKey ? { dedupKey } : undefined,
    });
  }
}

/**
 * Singleton credit logger instance
 */
export const creditLogger: CreditLogger = new InMemoryCreditLogger();
