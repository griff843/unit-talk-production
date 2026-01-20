/**
 * @fileoverview Ops Incident Router Service
 *
 * Routes SLO incidents to Discord and Notion with:
 * - Idempotency via unique constraint
 * - Cooldown per incident_key and slo_id
 * - Feature flags (default OFF)
 * - Full traceability (correlation_id, incident_key, slo_id, environment)
 *
 * Part of PR7: Incident Routing + Ops Digest
 *
 * @module services/ops/OpsIncidentRouter
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { makeLogger } from '../../utils/logger';

const logger = makeLogger('OpsIncidentRouter');

// ============================================================================
// Types
// ============================================================================

export interface IncidentRecord {
  incident_id: string;
  slo_id: string;
  slo_name: string;
  severity: 'warning' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved';
  opened_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  trigger_value: number;
  trigger_threshold: number;
  evidence: Record<string, unknown>;
  needs_notification: boolean;
  notification_reason: string;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

export interface RoutingDecision {
  shouldNotify: boolean;
  destinations: string[];
  shouldEscalate: boolean;
  reason: string;
}

export interface OpsIncidentRouterConfig {
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

  // Routing config
  environment: string;
  commandCenterUrl: string;

  // Rate limiting
  cooldownMinutes: number;
  maxPerHour: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

function getDefaultConfig(): OpsIncidentRouterConfig {
  return {
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

    // Routing config
    environment: process.env.NODE_ENV || 'development',
    commandCenterUrl: process.env.COMMAND_CENTER_URL || 'http://localhost:3004',

    // Rate limiting
    cooldownMinutes: parseInt(process.env.OPS_NOTIFICATION_COOLDOWN_MINUTES || '15', 10),
    maxPerHour: parseInt(process.env.OPS_NOTIFICATION_MAX_PER_HOUR || '20', 10),
  };
}

// ============================================================================
// OpsIncidentRouter Class
// ============================================================================

export class OpsIncidentRouter {
  private supabase: SupabaseClient;
  private config: OpsIncidentRouterConfig;
  private discordSender?: (payload: DiscordPayload) => Promise<NotificationResult>;
  private notionSender?: (payload: NotionPayload) => Promise<NotificationResult>;

  constructor(
    supabaseUrl: string,
    supabaseServiceKey: string,
    config?: Partial<OpsIncidentRouterConfig>,
    discordSender?: (payload: DiscordPayload) => Promise<NotificationResult>,
    notionSender?: (payload: NotionPayload) => Promise<NotificationResult>
  ) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.config = { ...getDefaultConfig(), ...config };
    this.discordSender = discordSender;
    this.notionSender = notionSender;

    logger.info('OpsIncidentRouter initialized', {
      discordEnabled: this.config.discordEnabled,
      notionEnabled: this.config.notionEnabled,
      digestEnabled: this.config.digestEnabled,
      environment: this.config.environment,
    });
  }

  /**
   * Main polling loop entry point
   * Fetches pending incidents and routes notifications
   */
  async pollAndRoute(): Promise<{
    processed: number;
    notified: number;
    skipped: number;
    errors: number;
  }> {
    const correlationId = uuidv4();

    logger.info('Starting incident poll cycle', { correlationId });

    let processed = 0;
    let notified = 0;
    let skipped = 0;
    let errors = 0;

    try {
      // Get incidents pending notification
      const incidents = await this.getIncidentsPendingNotification();
      processed = incidents.length;

      logger.info(`Found ${incidents.length} incidents to process`, { correlationId });

      for (const incident of incidents) {
        if (!incident.needs_notification) {
          skipped++;
          continue;
        }

        const decision = this.makeRoutingDecision(incident);

        if (!decision.shouldNotify) {
          skipped++;
          continue;
        }

        try {
          const results = await this.routeIncident(incident, decision, correlationId);
          const anySuccess = results.some(r => r.success);
          const anyError = results.some(r => !r.success && !r.skipped);

          if (anySuccess) notified++;
          if (anyError) errors++;
        } catch (error) {
          errors++;
          logger.error('Failed to route incident', {
            correlationId,
            incidentId: incident.incident_id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Update cursor position
      await this.updateCursor(correlationId);

      logger.info('Poll cycle complete', {
        correlationId,
        processed,
        notified,
        skipped,
        errors,
      });

      return { processed, notified, skipped, errors };
    } catch (error) {
      logger.error('Poll cycle failed', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Fetch incidents that need notification
   */
  private async getIncidentsPendingNotification(): Promise<IncidentRecord[]> {
    const { data, error } = await this.supabase.rpc(
      'get_incidents_pending_notification',
      {
        p_destination: 'discord', // Check against primary destination
        p_limit: 50,
      }
    );

    if (error) {
      logger.error('Failed to fetch pending incidents', { error: error.message });
      return [];
    }

    return (data || []) as IncidentRecord[];
  }

  /**
   * Make routing decision based on incident severity and config
   */
  makeRoutingDecision(incident: IncidentRecord): RoutingDecision {
    const destinations: string[] = [];
    let shouldEscalate = false;

    // Discord routing
    if (this.config.discordEnabled && this.config.discordChannelId) {
      destinations.push('discord');

      // Escalate for critical incidents
      if (incident.severity === 'critical' && this.config.discordEscalationRoleId) {
        shouldEscalate = true;
      }
    }

    // Notion routing
    if (this.config.notionEnabled && this.config.notionApiKey && this.config.notionDatabaseId) {
      destinations.push('notion');
    }

    return {
      shouldNotify: destinations.length > 0,
      destinations,
      shouldEscalate,
      reason: incident.notification_reason,
    };
  }

  /**
   * Route incident to all destinations
   */
  private async routeIncident(
    incident: IncidentRecord,
    decision: RoutingDecision,
    correlationId: string
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const destination of decision.destinations) {
      try {
        // Check if we should send (cooldown + dedupe)
        const shouldSend = await this.checkShouldSend(
          incident.incident_id,
          incident.slo_id,
          destination
        );

        if (!shouldSend.shouldSend) {
          results.push({
            success: true,
            skipped: true,
            reason: shouldSend.reason,
          });
          continue;
        }

        let result: NotificationResult;

        if (destination === 'discord') {
          result = await this.sendDiscordNotification(incident, decision, correlationId);
        } else if (destination === 'notion') {
          result = await this.sendNotionNotification(incident, correlationId);
        } else {
          result = { success: false, error: `Unknown destination: ${destination}` };
        }

        if (result.success) {
          await this.recordNotificationSent(
            incident,
            destination,
            result.messageId || '',
            correlationId
          );
        }

        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Check if notification should be sent (cooldown + dedupe)
   */
  private async checkShouldSend(
    incidentKey: string,
    sloId: string,
    destination: string
  ): Promise<{ shouldSend: boolean; reason: string; existingMessageId?: string }> {
    const { data, error } = await this.supabase.rpc('should_send_notification', {
      p_incident_key: incidentKey,
      p_slo_id: sloId,
      p_destination: destination,
    });

    if (error) {
      logger.warn('Failed to check notification status, defaulting to send', { error: error.message });
      return { shouldSend: true, reason: 'check_failed' };
    }

    const result = data?.[0];
    return {
      shouldSend: result?.should_send ?? true,
      reason: result?.reason ?? 'unknown',
      existingMessageId: result?.existing_message_id,
    };
  }

  /**
   * Send Discord notification
   */
  private async sendDiscordNotification(
    incident: IncidentRecord,
    decision: RoutingDecision,
    correlationId: string
  ): Promise<NotificationResult> {
    if (!this.discordSender) {
      logger.warn('Discord sender not configured');
      return { success: false, error: 'Discord sender not configured' };
    }

    const payload: DiscordPayload = {
      incident,
      channelId: this.config.discordChannelId!,
      escalationRoleId: decision.shouldEscalate ? this.config.discordEscalationRoleId : undefined,
      correlationId,
      environment: this.config.environment,
      commandCenterUrl: this.config.commandCenterUrl,
    };

    return this.discordSender(payload);
  }

  /**
   * Send Notion notification
   */
  private async sendNotionNotification(
    incident: IncidentRecord,
    correlationId: string
  ): Promise<NotificationResult> {
    if (!this.notionSender) {
      logger.warn('Notion sender not configured');
      return { success: false, error: 'Notion sender not configured' };
    }

    const payload: NotionPayload = {
      incident,
      databaseId: this.config.notionDatabaseId!,
      correlationId,
      environment: this.config.environment,
    };

    return this.notionSender(payload);
  }

  /**
   * Record that notification was sent
   */
  private async recordNotificationSent(
    incident: IncidentRecord,
    destination: string,
    messageId: string,
    correlationId: string
  ): Promise<void> {
    const payload = {
      incident_id: incident.incident_id,
      slo_id: incident.slo_id,
      slo_name: incident.slo_name,
      severity: incident.severity,
      status: incident.status,
    };

    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');

    const { error } = await this.supabase.rpc('record_notification_sent', {
      p_incident_key: incident.incident_id,
      p_slo_id: incident.slo_id,
      p_destination: destination,
      p_message_id: messageId,
      p_correlation_id: correlationId,
      p_payload: payload,
      p_payload_hash: payloadHash,
      p_severity: incident.severity,
      p_incident_status: incident.status,
      p_routing_reason: incident.notification_reason,
    });

    if (error) {
      logger.error('Failed to record notification', { error: error.message });
    }
  }

  /**
   * Update cursor position after poll
   */
  private async updateCursor(correlationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('notification_cursor')
      .upsert({
        id: 'default',
        last_processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'default');

    if (error) {
      logger.warn('Failed to update cursor', { correlationId, error: error.message });
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerManualPoll(): Promise<{
    processed: number;
    notified: number;
    skipped: number;
    errors: number;
  }> {
    logger.info('Manual poll triggered');
    return this.pollAndRoute();
  }

  /**
   * Get router status
   */
  async getStatus(): Promise<{
    config: Partial<OpsIncidentRouterConfig>;
    cursor: { lastProcessedAt: string | null; runCount: number } | null;
    recentNotifications: number;
  }> {
    // Get cursor
    const { data: cursorData } = await this.supabase
      .from('notification_cursor')
      .select('last_processed_at, run_count')
      .eq('id', 'default')
      .single();

    // Get recent notification count
    const { count } = await this.supabase
      .from('incident_notifications')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return {
      config: {
        discordEnabled: this.config.discordEnabled,
        notionEnabled: this.config.notionEnabled,
        digestEnabled: this.config.digestEnabled,
        environment: this.config.environment,
      },
      cursor: cursorData
        ? {
            lastProcessedAt: cursorData.last_processed_at,
            runCount: cursorData.run_count,
          }
        : null,
      recentNotifications: count || 0,
    };
  }
}

// ============================================================================
// Payload Types
// ============================================================================

export interface DiscordPayload {
  incident: IncidentRecord;
  channelId: string;
  escalationRoleId?: string;
  correlationId: string;
  environment: string;
  commandCenterUrl: string;
}

export interface NotionPayload {
  incident: IncidentRecord;
  databaseId: string;
  correlationId: string;
  environment: string;
}

// ============================================================================
// Factory
// ============================================================================

let routerInstance: OpsIncidentRouter | null = null;

export function getOpsIncidentRouter(): OpsIncidentRouter {
  if (!routerInstance) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration for OpsIncidentRouter');
    }

    routerInstance = new OpsIncidentRouter(supabaseUrl, supabaseKey);
  }

  return routerInstance;
}

export function createOpsIncidentRouter(
  supabaseUrl: string,
  supabaseServiceKey: string,
  config?: Partial<OpsIncidentRouterConfig>,
  discordSender?: (payload: DiscordPayload) => Promise<NotificationResult>,
  notionSender?: (payload: NotionPayload) => Promise<NotificationResult>
): OpsIncidentRouter {
  return new OpsIncidentRouter(supabaseUrl, supabaseServiceKey, config, discordSender, notionSender);
}
