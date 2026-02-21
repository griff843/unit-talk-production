/* eslint-disable complexity, security/detect-object-injection */
/**
 * Global Ops Status Endpoint
 *
 * SPRINT-FOUNDATION-TRUTH-LOCK-094A
 *
 * One endpoint answers "Is the system ready?" with reasons.
 * Aggregates all health signals into a single response.
 */

import express, { Response, Router } from 'express';

import { getDbModeStatus } from '../config/dbMode';
import {
  resolveDiscordRoutingConfig,
  validateDiscordRoutingReadiness,
} from '../config/discordRouting';
import { supabaseClient } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('OpsStatus');
const router: Router = express.Router();

// ============================================================================
// TYPES
// ============================================================================

interface DbModeStatus {
  mode: 'cloud' | 'local';
  target: string;
  isLocal: boolean;
  mismatchDetected: boolean;
  mismatchReason: string | null;
  requiredEnvMissing: string[];
  resolutionSource: 'env' | 'default';
}

interface OpsStatusResponse {
  overall_ready: boolean;
  reasons: string[];
  components: {
    env: EnvStatus;
    discord: DiscordStatus;
    outbox: OutboxStatus;
    database: DatabaseStatus;
    db: DbModeStatus;
  };
  supabase_fingerprint: string;
  timestamp: string;
}

interface EnvStatus {
  ready: boolean;
  missing_required: string[];
  missing_optional: string[];
}

interface DiscordStatus {
  ready: boolean;
  worker_configured: boolean;
  worker_healthy: boolean;
  webhook_configured: boolean;
  channel_configured: boolean;
  last_post_at: string | null;
  issues: string[];
}

interface OutboxStatus {
  ready: boolean;
  pending_count: number;
  processing_count: number;
  failed_count: number;
  stuck_count: number;
  oldest_pending_age_seconds: number | null;
}

interface DatabaseStatus {
  ready: boolean;
  connected: boolean;
  tables_exist: boolean;
  error: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function extractSupabaseFingerprint(): string {
  const url = process.env['SUPABASE_URL'] || process.env['NEXT_PUBLIC_SUPABASE_URL'] || '';
  const match = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  return match ? match[1] : 'unknown';
}

function checkRequiredEnvKeys(): { missing_required: string[]; missing_optional: string[] } {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const optional = [
    'DISCORD_WEBHOOK_URL',
    'DEFAULT_DISCORD_TICKET_CHANNEL_ID',
    'ENABLE_DISCORD_TICKET_WORKER',
  ];

  const missing_required = required.filter(key => !process.env[key]);
  const missing_optional = optional.filter(key => !process.env[key]);

  return { missing_required, missing_optional };
}

async function checkDatabaseStatus(): Promise<DatabaseStatus> {
  try {
    // Simple connectivity check - query a known table
    const { error } = await supabaseClient.from('tickets').select('id').limit(1);

    if (error) {
      return {
        ready: false,
        connected: false,
        tables_exist: false,
        error: error.message,
      };
    }

    return {
      ready: true,
      connected: true,
      tables_exist: true,
      error: null,
    };
  } catch (err) {
    return {
      ready: false,
      connected: false,
      tables_exist: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

async function checkOutboxStatus(): Promise<OutboxStatus> {
  try {
    // Get counts by status
    const { data: pending } = await supabaseClient
      .from('ticket_discord_outbox')
      .select('id, created_at')
      .eq('status', 'pending');

    const { data: processing } = await supabaseClient
      .from('ticket_discord_outbox')
      .select('id, claimed_at')
      .eq('status', 'processing');

    const { data: failed } = await supabaseClient
      .from('ticket_discord_outbox')
      .select('id')
      .eq('status', 'failed');

    const pendingCount = pending?.length || 0;
    const processingCount = processing?.length || 0;
    const failedCount = failed?.length || 0;

    // Check for stuck items (processing for > 60s)
    const staleThreshold = Date.now() - 60000;
    const stuckCount = (processing || []).filter(item => {
      if (!item.claimed_at) return false;
      return new Date(item.claimed_at).getTime() < staleThreshold;
    }).length;

    // Calculate oldest pending age
    let oldestPendingAge: number | null = null;
    if (pending && pending.length > 0) {
      const oldestCreated = pending.reduce((oldest, item) => {
        const created = new Date(item.created_at).getTime();
        return created < oldest ? created : oldest;
      }, Date.now());
      oldestPendingAge = Math.floor((Date.now() - oldestCreated) / 1000);
    }

    return {
      ready: failedCount === 0 && stuckCount === 0,
      pending_count: pendingCount,
      processing_count: processingCount,
      failed_count: failedCount,
      stuck_count: stuckCount,
      oldest_pending_age_seconds: oldestPendingAge,
    };
  } catch {
    return {
      ready: false,
      pending_count: 0,
      processing_count: 0,
      failed_count: 0,
      stuck_count: 0,
      oldest_pending_age_seconds: null,
    };
  }
}

async function checkDiscordStatus(): Promise<DiscordStatus> {
  const routingConfig = resolveDiscordRoutingConfig();
  const issues = validateDiscordRoutingReadiness();

  // Get worker health from heartbeats
  let workerHealthy = false;
  let lastPostAt: string | null = null;

  try {
    const { data: heartbeat } = await supabaseClient
      .from('ops_worker_heartbeats')
      .select('last_heartbeat_at, last_successful_post_at, status')
      .eq('worker_name', 'discord-ticket-worker')
      .order('last_heartbeat_at', { ascending: false })
      .limit(1)
      .single();

    if (heartbeat) {
      const heartbeatAge = Date.now() - new Date(heartbeat.last_heartbeat_at).getTime();
      workerHealthy = heartbeatAge < 30000 && heartbeat.status === 'healthy';
      lastPostAt = heartbeat.last_successful_post_at;
    }
  } catch {
    // No heartbeat data
  }

  return {
    ready: issues.length === 0 && workerHealthy,
    worker_configured: routingConfig.workerEnabled,
    worker_healthy: workerHealthy,
    webhook_configured: !!routingConfig.webhookUrl,
    channel_configured: !!routingConfig.channelId,
    last_post_at: lastPostAt,
    issues,
  };
}

// ============================================================================
// ROUTE
// ============================================================================

// eslint-disable-next-line max-lines-per-function -- Status aggregation requires multiple checks
router.get('/status', async (_req, res: Response) => {
  const timestamp = new Date().toISOString();

  try {
    // Run all checks in parallel
    const [envCheck, dbStatus, outboxStatus, discordStatus] = await Promise.all([
      Promise.resolve(checkRequiredEnvKeys()),
      checkDatabaseStatus(),
      checkOutboxStatus(),
      checkDiscordStatus(),
    ]);

    // Get DB mode status (SPRINT-DB-MODE-TRUTH-LOCK-095A)
    const dbModeResolution = getDbModeStatus();
    const dbModeStatus: DbModeStatus = {
      mode: dbModeResolution.mode,
      target: `${dbModeResolution.host}/${dbModeResolution.dbName}`,
      isLocal: dbModeResolution.isLocal,
      mismatchDetected: dbModeResolution.mismatchDetected,
      mismatchReason: dbModeResolution.mismatchReason,
      requiredEnvMissing: dbModeResolution.requiredEnvMissing,
      resolutionSource: dbModeResolution.source,
    };

    const envStatus: EnvStatus = {
      ready: envCheck.missing_required.length === 0,
      missing_required: envCheck.missing_required,
      missing_optional: envCheck.missing_optional,
    };

    // Aggregate reasons
    const reasons: string[] = [];

    if (!envStatus.ready) {
      reasons.push(`Missing required env keys: ${envCheck.missing_required.join(', ')}`);
    }
    if (!dbStatus.ready) {
      reasons.push(`Database: ${dbStatus.error || 'not connected'}`);
    }
    if (!discordStatus.ready) {
      reasons.push(`Discord: ${discordStatus.issues.join('; ') || 'not ready'}`);
    }
    if (!outboxStatus.ready) {
      if (outboxStatus.failed_count > 0) {
        reasons.push(`Outbox: ${outboxStatus.failed_count} failed items`);
      }
      if (outboxStatus.stuck_count > 0) {
        reasons.push(`Outbox: ${outboxStatus.stuck_count} stuck items`);
      }
    }
    // DB mode mismatch is critical
    if (dbModeStatus.mismatchDetected) {
      reasons.push(`DB Mode: ${dbModeStatus.mismatchReason}`);
    }
    if (dbModeStatus.requiredEnvMissing.length > 0) {
      reasons.push(`DB Mode: Missing ${dbModeStatus.requiredEnvMissing.join(', ')}`);
    }

    const dbModeReady =
      !dbModeStatus.mismatchDetected && dbModeStatus.requiredEnvMissing.length === 0;
    const overallReady =
      envStatus.ready && dbStatus.ready && discordStatus.ready && outboxStatus.ready && dbModeReady;

    const response: OpsStatusResponse = {
      overall_ready: overallReady,
      reasons,
      components: {
        env: envStatus,
        discord: discordStatus,
        outbox: outboxStatus,
        database: dbStatus,
        db: dbModeStatus,
      },
      supabase_fingerprint: extractSupabaseFingerprint(),
      timestamp,
    };

    logger.info('Ops status queried', {
      overall_ready: overallReady,
      reason_count: reasons.length,
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to get ops status', {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      overall_ready: false,
      reasons: [`Internal error: ${error instanceof Error ? error.message : 'Unknown'}`],
      components: {
        env: { ready: false, missing_required: [], missing_optional: [] },
        discord: {
          ready: false,
          worker_configured: false,
          worker_healthy: false,
          webhook_configured: false,
          channel_configured: false,
          last_post_at: null,
          issues: [],
        },
        outbox: {
          ready: false,
          pending_count: 0,
          processing_count: 0,
          failed_count: 0,
          stuck_count: 0,
          oldest_pending_age_seconds: null,
        },
        db: {
          mode: 'cloud',
          target: 'unknown/unknown',
          isLocal: false,
          mismatchDetected: false,
          mismatchReason: null,
          requiredEnvMissing: [],
          resolutionSource: 'default',
        },
        database: {
          ready: false,
          connected: false,
          tables_exist: false,
          error: 'Status check failed',
        },
      },
      supabase_fingerprint: extractSupabaseFingerprint(),
      timestamp,
    });
  }
});

export default router;
