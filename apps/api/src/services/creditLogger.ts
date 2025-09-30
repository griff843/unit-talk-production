import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

type Provider = 'oddsapi' | 'sgo' | 'optimal';

interface CreditAccumulator {
  credits: number;
  calls: number;
  dedupKeys: Set<string>;
}

class CreditLogger {
  private static instance: CreditLogger;
  private accumulators: Map<Provider, CreditAccumulator> = new Map();
  private runId: string;
  private enabled: boolean;

  private constructor() {
    this.runId = new Date().toISOString().replace(/[:.]/g, '-');
    this.enabled = process.env.CREDIT_LOGGING_ENABLED !== 'false';
  }

  static getInstance(): CreditLogger {
    if (!CreditLogger.instance) {
      CreditLogger.instance = new CreditLogger();
    }
    return CreditLogger.instance;
  }

  private normalizeProvider(provider: string): Provider {
    const normalized = provider.toLowerCase()
      .replace(/[_\s-]/g, '')
      .replace('api', '');

    const mapping: Record<string, Provider> = {
      'odds': 'oddsapi',
      'oddsapi': 'oddsapi',
      'sgo': 'sgo',
      'sportsgameodds': 'sgo',
      'optimal': 'optimal',
      'optimalapi': 'optimal'
    };

    return mapping[normalized] || 'oddsapi';
  }

  beginRun(provider: string): void {
    const normalized = this.normalizeProvider(provider);
    if (!this.accumulators.has(normalized)) {
      this.accumulators.set(normalized, {
        credits: 0,
        calls: 0,
        dedupKeys: new Set()
      });
    }
  }

  addCall(
    provider: string,
    credits: number = 1,
    calls: number = 1,
    dedupKey?: string
  ): void {
    if (!this.enabled) return;

    const normalized = this.normalizeProvider(provider);
    this.beginRun(normalized);

    const accumulator = this.accumulators.get(normalized)!;

    // Deduplicate if key provided
    if (dedupKey) {
      if (accumulator.dedupKeys.has(dedupKey)) {
        return; // Skip duplicate
      }
      accumulator.dedupKeys.add(dedupKey);
    }

    accumulator.credits += credits;
    accumulator.calls += calls;
  }

  async flush(): Promise<void> {
    if (!this.enabled || this.accumulators.size === 0) {
      return;
    }

    const timestamp = Date.now();
    const outDir = path.resolve(process.cwd(), 'out', 'ops', 'credits');
    fs.mkdirSync(outDir, { recursive: true });

    const results: any[] = [];

    for (const [provider, accumulator] of this.accumulators) {
      if (accumulator.calls === 0) continue;

      try {
        // Try RPC first
        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(url, key, { auth: { persistSession: false } });

        const { data, error } = await supabase.rpc('log_credit_usage', {
          provider,
          credits: accumulator.credits,
          calls: accumulator.calls
        });

        if (error?.code === 'PGRST202' || error?.code === '42883') {
          // RPC doesn't exist, fallback to direct insert
          const insertResult = await supabase
            .from('credit_usage')
            .insert({
              provider,
              credits: accumulator.credits,
              calls: accumulator.calls
            })
            .select();

          results.push({
            provider,
            method: 'insert',
            credits: accumulator.credits,
            calls: accumulator.calls,
            success: !insertResult.error,
            error: insertResult.error
          });
        } else {
          results.push({
            provider,
            method: 'rpc',
            credits: accumulator.credits,
            calls: accumulator.calls,
            success: !error,
            error
          });
        }
      } catch (e: any) {
        results.push({
          provider,
          method: 'error',
          credits: accumulator.credits,
          calls: accumulator.calls,
          success: false,
          error: e.message
        });
      }
    }

    // Write flush summary
    const summaryFile = path.join(outDir, `credit-flush-${timestamp}.json`);
    fs.writeFileSync(summaryFile, JSON.stringify({
      runId: this.runId,
      timestamp: new Date().toISOString(),
      providers: results,
      totals: {
        credits: results.reduce((sum, r) => sum + r.credits, 0),
        calls: results.reduce((sum, r) => sum + r.calls, 0)
      }
    }, null, 2));

    // Clear accumulators
    this.accumulators.clear();
  }

  getStats(): Record<Provider, { credits: number; calls: number }> {
    const stats: Record<string, { credits: number; calls: number }> = {};
    for (const [provider, acc] of this.accumulators) {
      stats[provider] = {
        credits: acc.credits,
        calls: acc.calls
      };
    }
    return stats;
  }
}

export const creditLogger = CreditLogger.getInstance();
export type { Provider };