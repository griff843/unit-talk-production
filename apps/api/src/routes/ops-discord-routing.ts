/**
 * Discord Routing Status Endpoint
 *
 * SPRINT-END-TO-END-TICKET-LIFECYCLE-TRUTH-093
 * SPRINT-FOUNDATION-TRUTH-LOCK-094A (resolved_from tracking)
 *
 * Self-verification endpoint for Discord pipeline health.
 */

import express, { Response, Router } from 'express';

import { resolveDiscordRoutingConfig } from '../config/discordRouting';
import { supabaseClient } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('OpsDiscordRouting');
const router: Router = express.Router();

// ---- TYPES ----

interface DiscordRoutingStatus {
  success: boolean;
  routing: {
    channel_from_db: boolean;
    channel_from_env: boolean;
    channel_id_resolved: boolean;
    webhook_configured: boolean;
    resolved_from: { webhook: string; channel: string; worker: string };
  };
  worker: {
    configured: boolean;
    healthy: boolean;
    health_status: 'healthy' | 'degraded' | 'unhealthy';
    worker_id: string | null;
    last_heartbeat_at: string | null;
    heartbeat_age_seconds: number | null;
    recent_error: { message: string | null; timestamp: string | null };
  };
  queue: {
    pending_count: number;
    processing_count: number;
    posted_count: number;
    failed_count: number;
  };
  activity: { last_post_at: string | null; items_processed_total: number };
  overall_health: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
}

// ---- HELPERS ----

function getEnvConfig() {
  const routingConfig = resolveDiscordRoutingConfig();
  return {
    channelFromEnv: !!routingConfig.channelId,
    webhookConfigured: !!routingConfig.webhookUrl,
    workerConfigured: routingConfig.workerEnabled,
    resolution: routingConfig.resolution,
  };
}

function calculateWorkerHealth(heartbeatAgeSec: number | null): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  healthy: boolean;
} {
  if (heartbeatAgeSec === null) return { status: 'unhealthy', healthy: false };
  if (heartbeatAgeSec < 30) return { status: 'healthy', healthy: true };
  if (heartbeatAgeSec < 120) return { status: 'degraded', healthy: false };
  return { status: 'unhealthy', healthy: false };
}

interface HealthCheckParams {
  channelResolved: boolean;
  webhookConfigured: boolean;
  workerConfigured: boolean;
  workerHealth: 'healthy' | 'degraded' | 'unhealthy';
  failedCount: number;
}

function determineOverallHealth(params: HealthCheckParams): 'healthy' | 'degraded' | 'unhealthy' {
  const { channelResolved, webhookConfigured, workerConfigured, workerHealth, failedCount } =
    params;
  if (!channelResolved || !webhookConfigured) return 'unhealthy';
  if (!workerConfigured || workerHealth === 'unhealthy') return 'unhealthy';
  if (workerHealth === 'degraded' || failedCount > 0) return 'degraded';
  return 'healthy';
}

function buildErrorResponse(
  errorMsg: string,
  timestamp: string
): DiscordRoutingStatus & { error: string } {
  const env = getEnvConfig();
  return {
    success: false,
    routing: {
      channel_from_db: false,
      channel_from_env: env.channelFromEnv,
      channel_id_resolved: env.channelFromEnv,
      webhook_configured: env.webhookConfigured,
      resolved_from: {
        webhook: env.resolution.webhookUrl,
        channel: env.resolution.channelId,
        worker: env.resolution.workerEnabled,
      },
    },
    worker: {
      configured: env.workerConfigured,
      healthy: false,
      health_status: 'unhealthy',
      worker_id: null,
      last_heartbeat_at: null,
      heartbeat_age_seconds: null,
      recent_error: { message: errorMsg, timestamp },
    },
    queue: { pending_count: 0, processing_count: 0, posted_count: 0, failed_count: 0 },
    activity: { last_post_at: null, items_processed_total: 0 },
    overall_health: 'unhealthy',
    error: errorMsg,
    timestamp,
  };
}

// ---- ROUTE ----
// eslint-disable-next-line complexity, max-lines-per-function -- Status aggregation handler
router.get('/discord-routing-status', async (_req, res: Response) => {
  const timestamp = new Date().toISOString();

  try {
    const { data: dbStatus, error: dbError } = await supabaseClient.rpc(
      'get_discord_routing_status'
    );

    if (dbError) {
      logger.error('Failed to query discord routing status', { error: dbError.message });
      return res.status(503).json(buildErrorResponse(dbError.message, timestamp));
    }

    const env = getEnvConfig();
    const status = dbStatus as Record<string, unknown> | null;
    const channelFromDb = Boolean(status?.channel_from_db);
    const channelIdResolved = env.channelFromEnv || channelFromDb;
    const lastHeartbeat = status?.worker_last_heartbeat as string | null;
    const heartbeatAgeMs = lastHeartbeat
      ? Date.now() - new Date(lastHeartbeat).getTime()
      : Infinity;
    const heartbeatAgeSec = heartbeatAgeMs === Infinity ? null : Math.floor(heartbeatAgeMs / 1000);
    const workerHealth = calculateWorkerHealth(heartbeatAgeSec);
    const failedCount = (status?.failed_count as number) || 0;
    const overallHealth = determineOverallHealth({
      channelResolved: channelIdResolved,
      webhookConfigured: env.webhookConfigured,
      workerConfigured: env.workerConfigured,
      workerHealth: workerHealth.status,
      failedCount,
    });

    const response: DiscordRoutingStatus = {
      success: true,
      routing: {
        channel_from_db: channelFromDb,
        channel_from_env: env.channelFromEnv,
        channel_id_resolved: channelIdResolved,
        webhook_configured: env.webhookConfigured,
        resolved_from: {
          webhook: env.resolution.webhookUrl,
          channel: channelFromDb ? 'db' : env.resolution.channelId,
          worker: env.resolution.workerEnabled,
        },
      },
      worker: {
        configured: env.workerConfigured,
        healthy: workerHealth.healthy,
        health_status: workerHealth.status,
        worker_id: (status?.worker_id as string) || null,
        last_heartbeat_at: lastHeartbeat,
        heartbeat_age_seconds: heartbeatAgeSec,
        recent_error: {
          message: (status?.worker_last_error as string) || null,
          timestamp: lastHeartbeat,
        },
      },
      queue: {
        pending_count: (status?.pending_count as number) || 0,
        processing_count: (status?.processing_count as number) || 0,
        posted_count: (status?.posted_count as number) || 0,
        failed_count: failedCount,
      },
      activity: {
        last_post_at: (status?.last_post_at as string) || null,
        items_processed_total: (status?.items_processed_total as number) || 0,
      },
      overall_health: overallHealth,
      timestamp,
    };

    logger.info('Discord routing status queried', {
      overall_health: overallHealth,
      worker_healthy: workerHealth.healthy,
      pending_count: response.queue.pending_count,
    });
    res.json(response);
  } catch (error) {
    logger.error('Unexpected error in discord-routing-status', {
      error: error instanceof Error ? error.message : String(error),
    });
    res
      .status(500)
      .json(
        buildErrorResponse(error instanceof Error ? error.message : 'Unknown error', timestamp)
      );
  }
});

export default router;
