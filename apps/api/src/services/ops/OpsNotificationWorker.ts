/* eslint-disable max-lines-per-function */
/**
 * @fileoverview Ops Notification Worker
 *
 * Main worker that orchestrates:
 * - Incident polling and routing
 * - Discord/Notion notification delivery
 * - Weekly digest scheduling
 *
 * Part of PR7: Incident Routing + Ops Digest
 *
 * @module services/ops/OpsNotificationWorker
 */

import { Client } from 'discord.js';
import { makeLogger } from '../../utils/logger';
import {
  OpsIncidentRouter,
  createOpsIncidentRouter,
} from './OpsIncidentRouter';
import { OpsDiscordSender, initializeOpsDiscordSender, createDiscordSenderFn } from './OpsDiscordSender';
import { OpsNotionLogger, initializeOpsNotionLogger, createNotionSenderFn } from './OpsNotionLogger';
import { OpsDigestScheduler, createOpsDigestScheduler } from './OpsDigestScheduler';

const logger = makeLogger('OpsNotificationWorker');

// ============================================================================
// Types
// ============================================================================

interface OpsNotificationWorkerConfig {
  // Polling config
  pollIntervalMs: number;
  enabled: boolean;

  // Feature flags
  discordEnabled: boolean;
  notionEnabled: boolean;
  digestEnabled: boolean;

  // Discord config
  discordChannelId?: string;
  discordEscalationRoleId?: string;

  // Notion config
  notionApiKey?: string;
  notionDatabaseId?: string;

  // Environment
  supabaseUrl: string;
  supabaseServiceKey: string;
  environment: string;
  commandCenterUrl: string;
}

interface WorkerStatus {
  running: boolean;
  lastPollTime: string | null;
  lastPollResult: {
    processed: number;
    notified: number;
    skipped: number;
    errors: number;
  } | null;
  pollCount: number;
  discordConnected: boolean;
  notionConnected: boolean;
  digestSchedulerRunning: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

function getDefaultConfig(): OpsNotificationWorkerConfig {
  return {
    // Polling - every 60 seconds by default
    pollIntervalMs: parseInt(process.env.OPS_POLL_INTERVAL_MS || '60000', 10),
    enabled: process.env.OPS_NOTIFICATION_WORKER_ENABLED === 'true',

    // Feature flags - ALL OFF BY DEFAULT
    discordEnabled: process.env.OPS_DISCORD_ALERTS_ENABLED === 'true',
    notionEnabled: process.env.OPS_NOTION_LOGGING_ENABLED === 'true',
    digestEnabled: process.env.OPS_DIGEST_ENABLED === 'true',

    // Discord config
    discordChannelId: process.env.OPS_DISCORD_CHANNEL_ID,
    discordEscalationRoleId: process.env.OPS_DISCORD_ESCALATION_ROLE_ID,

    // Notion config
    notionApiKey: process.env.NOTION_API_KEY,
    notionDatabaseId: process.env.OPS_NOTION_DATABASE_ID,

    // Environment
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    environment: process.env.NODE_ENV || 'development',
    commandCenterUrl: process.env.COMMAND_CENTER_URL || 'http://localhost:3004',
  };
}

// ============================================================================
// OpsNotificationWorker Class
// ============================================================================

export class OpsNotificationWorker {
  private config: OpsNotificationWorkerConfig;
  private router: OpsIncidentRouter | null = null;
  private discordSender: OpsDiscordSender | null = null;
  private notionLogger: OpsNotionLogger | null = null;
  private digestScheduler: OpsDigestScheduler | null = null;
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private running: boolean = false;
  private lastPollTime: Date | null = null;
  private lastPollResult: WorkerStatus['lastPollResult'] = null;
  private pollCount: number = 0;

  constructor(config?: Partial<OpsNotificationWorkerConfig>) {
    this.config = { ...getDefaultConfig(), ...config };

    logger.info('OpsNotificationWorker initialized', {
      enabled: this.config.enabled,
      discordEnabled: this.config.discordEnabled,
      notionEnabled: this.config.notionEnabled,
      digestEnabled: this.config.digestEnabled,
      pollIntervalMs: this.config.pollIntervalMs,
    });
  }

  /**
   * Initialize Discord client
   */
  initializeDiscord(client: Client): void {
    if (!this.config.discordEnabled) {
      logger.info('Discord alerts disabled, skipping Discord initialization');
      return;
    }

    this.discordSender = initializeOpsDiscordSender(client);
    logger.info('Discord sender initialized for OpsNotificationWorker');
  }

  /**
   * Initialize Notion client
   */
  initializeNotion(): void {
    if (!this.config.notionEnabled) {
      logger.info('Notion logging disabled, skipping Notion initialization');
      return;
    }

    if (!this.config.notionApiKey || !this.config.notionDatabaseId) {
      logger.warn('Notion configuration incomplete, skipping initialization');
      return;
    }

    this.notionLogger = initializeOpsNotionLogger(
      this.config.notionApiKey,
      this.config.notionDatabaseId
    );
    logger.info('Notion logger initialized for OpsNotificationWorker');
  }

  /**
   * Initialize all components and start the worker
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('OpsNotificationWorker is disabled');
      return;
    }

    if (this.running) {
      logger.warn('OpsNotificationWorker is already running');
      return;
    }

    logger.info('Starting OpsNotificationWorker');

    // Validate Supabase config
    if (!this.config.supabaseUrl || !this.config.supabaseServiceKey) {
      throw new Error('Missing Supabase configuration for OpsNotificationWorker');
    }

    // Initialize router with senders
    this.router = createOpsIncidentRouter(
      this.config.supabaseUrl,
      this.config.supabaseServiceKey,
      {
        discordEnabled: this.config.discordEnabled,
        notionEnabled: this.config.notionEnabled,
        digestEnabled: this.config.digestEnabled,
        discordChannelId: this.config.discordChannelId,
        discordEscalationRoleId: this.config.discordEscalationRoleId,
        notionApiKey: this.config.notionApiKey,
        notionDatabaseId: this.config.notionDatabaseId,
        environment: this.config.environment,
        commandCenterUrl: this.config.commandCenterUrl,
      },
      this.discordSender ? createDiscordSenderFn(this.discordSender) : undefined,
      this.notionLogger ? createNotionSenderFn(this.notionLogger) : undefined
    );

    // Initialize digest scheduler
    if (this.config.digestEnabled) {
      this.digestScheduler = createOpsDigestScheduler(
        this.config.supabaseUrl,
        this.config.supabaseServiceKey,
        {
          enabled: this.config.digestEnabled,
          channelId: this.config.discordChannelId || '',
          environment: this.config.environment,
          commandCenterUrl: this.config.commandCenterUrl,
        }
      );
      this.digestScheduler.start();
    }

    // Start polling loop
    this.running = true;
    this.poll(); // Initial poll

    this.pollIntervalId = setInterval(() => {
      this.poll();
    }, this.config.pollIntervalMs);

    logger.info('OpsNotificationWorker started', {
      pollIntervalMs: this.config.pollIntervalMs,
    });
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    logger.info('Stopping OpsNotificationWorker');

    // Stop polling
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }

    // Stop digest scheduler
    if (this.digestScheduler) {
      this.digestScheduler.stop();
    }

    this.running = false;
    logger.info('OpsNotificationWorker stopped');
  }

  /**
   * Execute a single poll cycle
   */
  private async poll(): Promise<void> {
    if (!this.router) {
      logger.error('Router not initialized');
      return;
    }

    try {
      const result = await this.router.pollAndRoute();
      this.lastPollTime = new Date();
      this.lastPollResult = result;
      this.pollCount++;

      if (result.processed > 0 || result.errors > 0) {
        logger.info('Poll cycle completed', {
          ...result,
          pollCount: this.pollCount,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Poll cycle failed', { error: errorMessage });
      this.lastPollResult = {
        processed: 0,
        notified: 0,
        skipped: 0,
        errors: 1,
      };
    }
  }

  /**
   * Manual trigger for immediate poll
   */
  async triggerPoll(): Promise<{
    processed: number;
    notified: number;
    skipped: number;
    errors: number;
  }> {
    if (!this.router) {
      throw new Error('Router not initialized');
    }

    logger.info('Manual poll triggered');
    return this.router.pollAndRoute();
  }

  /**
   * Manual trigger for digest
   */
  async triggerDigest(): Promise<{
    success: boolean;
    digestId?: string;
    messageId?: string;
    error?: string;
  }> {
    if (!this.digestScheduler) {
      throw new Error('Digest scheduler not initialized');
    }

    logger.info('Manual digest triggered');
    return this.digestScheduler.triggerManualDigest();
  }

  /**
   * Get worker status
   */
  async getStatus(): Promise<WorkerStatus> {
    return {
      running: this.running,
      lastPollTime: this.lastPollTime?.toISOString() || null,
      lastPollResult: this.lastPollResult,
      pollCount: this.pollCount,
      discordConnected: this.discordSender !== null,
      notionConnected: this.notionLogger?.isConfigured() || false,
      digestSchedulerRunning: this.digestScheduler !== null && this.config.digestEnabled,
    };
  }

  /**
   * Get router status (includes config and recent activity)
   */
  async getRouterStatus(): Promise<{
    config: Partial<{
      discordEnabled: boolean;
      notionEnabled: boolean;
      digestEnabled: boolean;
      environment: string;
    }>;
    cursor: { lastProcessedAt: string | null; runCount: number } | null;
    recentNotifications: number;
  } | null> {
    if (!this.router) {
      return null;
    }

    return this.router.getStatus();
  }

  /**
   * Get digest scheduler status
   */
  async getDigestStatus(): Promise<{
    enabled: boolean;
    lastDigest: { generatedAt: string; sentAt: string | null } | null;
    nextScheduled: string;
    config: {
      cronSchedule?: string;
      timezone?: string;
      environment?: string;
    };
  } | null> {
    if (!this.digestScheduler) {
      return null;
    }

    return this.digestScheduler.getStatus();
  }
}

// ============================================================================
// Factory
// ============================================================================

let workerInstance: OpsNotificationWorker | null = null;

export function getOpsNotificationWorker(): OpsNotificationWorker {
  if (!workerInstance) {
    workerInstance = new OpsNotificationWorker();
  }
  return workerInstance;
}

export function createOpsNotificationWorker(
  config?: Partial<OpsNotificationWorkerConfig>
): OpsNotificationWorker {
  return new OpsNotificationWorker(config);
}
