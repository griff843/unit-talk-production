// SPRINT-HULY-WORKOS-V1-LOCAL-001: JSONL audit logger with traced() wrapper

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import type { AuditEntry } from './adapters/types.js';

export class AuditLogger {
  private entries: AuditEntry[] = [];

  /** Log a pre-built entry */
  log(entry: Omit<AuditEntry, 'ts'> & { ts?: string }): void {
    this.entries.push({
      ts: entry.ts ?? new Date().toISOString(),
      source: entry.source,
      op: entry.op,
      target: entry.target,
      ok: entry.ok,
      latencyMs: entry.latencyMs,
      ...(entry.error !== undefined && { error: entry.error }),
      ...(entry.meta !== undefined && { meta: entry.meta }),
    });
  }

  /**
   * Wrap an async operation with automatic timing and audit logging.
   * Every external call MUST go through this.
   */
  async traced<T>(
    source: AuditEntry['source'],
    op: string,
    target: string,
    fn: () => Promise<T>,
    meta?: Record<string, unknown>
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const latencyMs = Math.round(performance.now() - start);
      this.log({ source, op, target, ok: true, latencyMs, meta });
      return result;
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.log({ source, op, target, ok: false, latencyMs, error: errorMsg, meta });
      throw err;
    }
  }

  /** Flush all buffered entries to a JSONL file */
  flush(filepath: string): void {
    mkdirSync(dirname(filepath), { recursive: true });
    const lines = this.entries.map(e => JSON.stringify(e)).join('\n');
    writeFileSync(filepath, lines + '\n', 'utf-8');
  }

  /** Get aggregate stats */
  stats(): { totalCalls: number; failedCalls: number; totalLatencyMs: number } {
    let failedCalls = 0;
    let totalLatencyMs = 0;
    for (const e of this.entries) {
      if (!e.ok) failedCalls++;
      totalLatencyMs += e.latencyMs;
    }
    return { totalCalls: this.entries.length, failedCalls, totalLatencyMs };
  }

  /** Get raw entries (for testing) */
  getEntries(): ReadonlyArray<AuditEntry> {
    return this.entries;
  }
}
