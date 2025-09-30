import fs from 'node:fs';
import path from 'node:path';
import { creditLogger } from './creditLogger.js';
import { cacheClient } from './cacheClient.js';

export interface AgentRunReport {
  agentName: string;
  runId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  inputs: {
    mode?: string;
    sport?: string;
    since?: string;
    limits?: any;
    cacheFirst?: boolean;
    [key: string]: any;
  };
  summary: {
    processed: number;
    noOps: number;
    errors: number;
    success: boolean;
  };
  creditStats?: Record<string, { credits: number; calls: number }>;
  cacheStats?: {
    hits: number;
    misses: number;
    sets: number;
    hitRate: string;
  };
  error?: string;
}

class AgentRunner {
  private static instance: AgentRunner;
  private currentReport: AgentRunReport | null = null;

  static getInstance(): AgentRunner {
    if (!AgentRunner.instance) {
      AgentRunner.instance = new AgentRunner();
    }
    return AgentRunner.instance;
  }

  beginRun(agentName: string, inputs: any = {}): string {
    const runId = `${agentName}-${new Date().toISOString().replace(/[:.]/g, '-')}`;

    this.currentReport = {
      agentName,
      runId,
      startTime: new Date().toISOString(),
      inputs: {
        mode: inputs.mode || 'production',
        sport: inputs.sport,
        since: inputs.since,
        limits: inputs.limits,
        cacheFirst: inputs.cacheFirst,
        ...inputs
      },
      summary: {
        processed: 0,
        noOps: 0,
        errors: 0,
        success: false
      }
    };

    return runId;
  }

  updateSummary(updates: Partial<AgentRunReport['summary']>): void {
    if (!this.currentReport) return;
    this.currentReport.summary = {
      ...this.currentReport.summary,
      ...updates
    };
  }

  recordError(error: string | Error): void {
    if (!this.currentReport) return;

    this.currentReport.summary.errors++;
    this.currentReport.error = typeof error === 'string' ? error : error.message;
    this.currentReport.summary.success = false;
  }

  async endRun(success: boolean = true): Promise<string> {
    if (!this.currentReport) {
      throw new Error('No active run to end');
    }

    const endTime = new Date().toISOString();
    const startMs = new Date(this.currentReport.startTime).getTime();
    const endMs = new Date(endTime).getTime();

    this.currentReport.endTime = endTime;
    this.currentReport.duration = endMs - startMs;
    this.currentReport.summary.success = success && this.currentReport.summary.errors === 0;

    // Capture credit and cache stats
    this.currentReport.creditStats = creditLogger.getStats();
    this.currentReport.cacheStats = {
      ...cacheClient.getStats(),
      hitRate: cacheClient.getStats().hits + cacheClient.getStats().misses > 0
        ? ((cacheClient.getStats().hits / (cacheClient.getStats().hits + cacheClient.getStats().misses)) * 100).toFixed(1) + '%'
        : '0%'
    };

    // Write report to file
    const outDir = path.resolve(process.cwd(), 'out', 'ops', 'agents');
    fs.mkdirSync(outDir, { recursive: true });

    const reportFile = path.join(outDir, `${this.currentReport.agentName.toLowerCase()}-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(this.currentReport, null, 2));

    const result = reportFile;
    this.currentReport = null; // Clear current report

    return result;
  }

  getCurrentReport(): AgentRunReport | null {
    return this.currentReport;
  }
}

export const agentRunner = AgentRunner.getInstance();