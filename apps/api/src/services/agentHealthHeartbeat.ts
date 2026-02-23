/**
 * Agent Health Heartbeat Service
 *
 * Production-grade heartbeat implementation that:
 * - Upserts per agent/service at 30s intervals
 * - Tracks: agent name, status, last_heartbeat, version (commit hash), meta
 * - Single row per agent (no insert spam)
 */

import { supabase } from './supabaseClient';
import { logger } from './logging';

// SPRINT-SCHEMA-ENV-GATES-002: Lazy env access
function getCommitHash(): string {
  return process.env.COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'dev';
}
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

interface AgentHeartbeatMeta {
  version: string;
  environment: string;
  hostname?: string;
  pid?: number;
  uptime_seconds?: number;
  memory_mb?: number;
  [key: string]: unknown;
}

interface HeartbeatConfig {
  agentName: string;
  status?: 'healthy' | 'degraded' | 'unhealthy';
  getMeta?: () => AgentHeartbeatMeta;
}

class AgentHealthHeartbeat {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private startTimes: Map<string, number> = new Map();

  /**
   * Start heartbeat for an agent
   */
  async startHeartbeat(config: HeartbeatConfig): Promise<void> {
    const { agentName, status = 'healthy', getMeta } = config;

    // Don't start duplicate heartbeats
    if (this.intervals.has(agentName)) {
      logger.warn({ agentName }, 'Heartbeat already running for agent');
      return;
    }

    this.startTimes.set(agentName, Date.now());

    // Initial heartbeat
    await this.sendHeartbeat(agentName, status, getMeta);

    // Schedule recurring heartbeat
    const interval = setInterval(async () => {
      await this.sendHeartbeat(agentName, status, getMeta);
    }, HEARTBEAT_INTERVAL_MS);

    this.intervals.set(agentName, interval);
    logger.info({ agentName, intervalMs: HEARTBEAT_INTERVAL_MS }, 'Agent heartbeat started');
  }

  /**
   * Send a single heartbeat upsert
   */
  async sendHeartbeat(
    agentName: string,
    status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy',
    getMeta?: () => AgentHeartbeatMeta
  ): Promise<boolean> {
    try {
      const startTime = this.startTimes.get(agentName) || Date.now();
      const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
      const memoryUsage = process.memoryUsage();

      const meta: AgentHeartbeatMeta = getMeta ? getMeta() : {
        version: getCommitHash(),
        environment: process.env.NODE_ENV || 'development',
        hostname: process.env.HOSTNAME || 'unknown',
        pid: process.pid,
        uptime_seconds: uptimeSeconds,
        memory_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024)
      };

      // Ensure version is always set
      if (!meta.version) {
        meta.version = getCommitHash();
      }

      const now = new Date().toISOString();

      // Manual upsert: check if exists, then update or insert
      const { data: existing } = await supabase
        .from('agent_health')
        .select('id')
        .eq('agent', agentName)
        .maybeSingle();

      let error;
      if (existing) {
        // Update existing row
        const result = await supabase
          .from('agent_health')
          .update({
            status,
            details: meta,
            last_heartbeat: now,
            updated_at: now
          })
          .eq('agent', agentName);
        error = result.error;
      } else {
        // Insert new row
        const result = await supabase
          .from('agent_health')
          .insert({
            agent: agentName,
            status,
            details: meta,
            last_heartbeat: now,
            updated_at: now
          });
        error = result.error;
      }

      if (error) {
        logger.error({ agentName, error: error.message }, 'Failed to send heartbeat');
        return false;
      }

      logger.debug({ agentName, status }, 'Heartbeat sent');
      return true;
    } catch (err) {
      logger.error({ agentName, error: err instanceof Error ? err.message : String(err) }, 'Heartbeat error');
      return false;
    }
  }

  /**
   * Stop heartbeat for an agent
   */
  stopHeartbeat(agentName: string): void {
    const interval = this.intervals.get(agentName);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(agentName);
      this.startTimes.delete(agentName);
      logger.info({ agentName }, 'Agent heartbeat stopped');
    }
  }

  /**
   * Stop all heartbeats
   */
  stopAll(): void {
    for (const [agentName, interval] of this.intervals.entries()) {
      clearInterval(interval);
      logger.info({ agentName }, 'Agent heartbeat stopped');
    }
    this.intervals.clear();
    this.startTimes.clear();
  }

  /**
   * Get list of active heartbeats
   */
  getActiveHeartbeats(): string[] {
    return Array.from(this.intervals.keys());
  }
}

// Singleton instance
export const agentHealthHeartbeat = new AgentHealthHeartbeat();

/**
 * Quick start function for common services
 */
export async function startServiceHeartbeats(): Promise<void> {
  const services = [
    'api-server',
    'temporal-worker',
    'bridge-worker',
    'feed-agent',
    'grading-agent',
    'settlement-agent',
    'alert-agent',
    'scoring-agent'
  ];

  // Only start heartbeats for services that are actually running in this process
  // This is determined by checking environment variables or module presence
  const isWorker = process.env.WORKER_MODE === 'true';
  const isApi = !isWorker;

  if (isApi) {
    await agentHealthHeartbeat.startHeartbeat({ agentName: 'api-server' });
  }

  if (isWorker) {
    await agentHealthHeartbeat.startHeartbeat({ agentName: 'temporal-worker' });
    await agentHealthHeartbeat.startHeartbeat({ agentName: 'bridge-worker' });
  }

  logger.info({ isApi, isWorker }, 'Service heartbeats initialized');
}

export default agentHealthHeartbeat;
