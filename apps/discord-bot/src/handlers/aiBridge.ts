/**
 * AI Bridge Handler
 * Phase 12: Discord integration for AI-powered insights and notifications
 *
 * Handles posting AI-generated summaries, alerts, and insights to Discord channels
 */

import { Client, EmbedBuilder, TextChannel, WebhookClient } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';

interface DiscordNotification {
  id: string;
  notification_type: 'pick_scored' | 'pick_failed' | 'ai_insight' | 'health_alert' | 'hedge_opportunity' | 'system_alert';
  discord_channel_id: string;
  discord_webhook_url?: string;
  title: string;
  description: string;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  color: string;
  pick_id?: string;
  ai_log_id?: string;
  metadata?: Record<string, unknown>;
}

interface AIBridgeConfig {
  client: Client;
  supabase: SupabaseClient;
  tenantId: string;
  defaultChannelId?: string;
  pollIntervalMs?: number;
}

export class AIBridgeHandler {
  private client: Client;
  private supabase: SupabaseClient;
  private tenantId: string;
  private defaultChannelId?: string;
  private pollIntervalMs: number;
  private isProcessing: boolean = false;
  private pollInterval?: NodeJS.Timeout;

  // Metrics
  private metrics = {
    notificationsSent: 0,
    notificationsFailed: 0,
    avgProcessingTimeMs: 0,
  };

  constructor(config: AIBridgeConfig) {
    this.client = config.client;
    this.supabase = config.supabase;
    this.tenantId = config.tenantId;
    this.defaultChannelId = config.defaultChannelId;
    this.pollIntervalMs = config.pollIntervalMs || 5000; // 5 seconds default

    console.log('[AIBridge] Initialized', {
      tenantId: this.tenantId,
      pollIntervalMs: this.pollIntervalMs,
    });
  }

  /**
   * Start processing Discord notifications
   */
  async start(): Promise<void> {
    console.log('[AIBridge] Starting notification processor');

    // Initial processing
    await this.processNotifications();

    // Setup periodic polling
    this.pollInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processNotifications();
      }
    }, this.pollIntervalMs);

    // Setup real-time subscription for immediate processing
    this.setupRealtimeSubscription();
  }

  /**
   * Stop processing
   */
  stop(): void {
    console.log('[AIBridge] Stopping notification processor');

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
  }

  /**
   * Process pending Discord notifications
   */
  private async processNotifications(): Promise<void> {
    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // Fetch pending notifications
      const { data: notifications, error } = await this.supabase
        .from('discord_notifications')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) {
        console.error('[AIBridge] Error fetching notifications:', error);
        return;
      }

      if (!notifications || notifications.length === 0) {
        return;
      }

      console.log(`[AIBridge] Processing ${notifications.length} notifications`);

      // Process each notification
      for (const notification of notifications) {
        await this.processNotification(notification as DiscordNotification);
      }

      const processingTime = Date.now() - startTime;
      this.metrics.avgProcessingTimeMs =
        (this.metrics.avgProcessingTimeMs + processingTime) / 2;

    } catch (error) {
      console.error('[AIBridge] Error processing notifications:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single notification
   */
  private async processNotification(notification: DiscordNotification): Promise<void> {
    try {
      // Mark as processing
      await this.updateNotificationStatus(notification.id, 'processing');

      // Build Discord embed
      const embed = this.buildEmbed(notification);

      // Send notification
      if (notification.discord_webhook_url) {
        await this.sendViaWebhook(notification.discord_webhook_url, embed);
      } else {
        await this.sendViaChannel(notification.discord_channel_id, embed);
      }

      // Mark as sent
      await this.updateNotificationStatus(notification.id, 'sent');

      this.metrics.notificationsSent++;

      console.log('[AIBridge] Notification sent successfully', {
        id: notification.id,
        type: notification.notification_type,
      });

    } catch (error) {
      this.metrics.notificationsFailed++;

      console.error('[AIBridge] Error sending notification:', {
        id: notification.id,
        error: error instanceof Error ? error.message : String(error),
      });

      // Update notification with error
      await this.updateNotificationStatus(
        notification.id,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );

      // Retry logic
      await this.scheduleRetry(notification);
    }
  }

  /**
   * Build Discord embed from notification
   */
  private buildEmbed(notification: DiscordNotification): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(notification.title)
      .setDescription(notification.description)
      .setColor(this.parseColor(notification.color))
      .setTimestamp();

    // Add fields
    if (notification.fields && notification.fields.length > 0) {
      for (const field of notification.fields) {
        embed.addFields({
          name: field.name,
          value: field.value,
          inline: field.inline ?? false,
        });
      }
    }

    // Add footer based on notification type
    const footerText = this.getFooterText(notification.notification_type);
    if (footerText) {
      embed.setFooter({ text: footerText });
    }

    return embed;
  }

  /**
   * Send embed via webhook
   */
  private async sendViaWebhook(webhookUrl: string, embed: EmbedBuilder): Promise<void> {
    try {
      const webhook = new WebhookClient({ url: webhookUrl });
      await webhook.send({ embeds: [embed] });
      await webhook.destroy();
    } catch (error) {
      console.error('[AIBridge] Webhook send failed:', error);
      throw error;
    }
  }

  /**
   * Send embed via channel
   */
  private async sendViaChannel(channelId: string, embed: EmbedBuilder): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} not found or not text-based`);
      }

      await (channel as TextChannel).send({ embeds: [embed] });
    } catch (error) {
      console.error('[AIBridge] Channel send failed:', error);
      throw error;
    }
  }

  /**
   * Update notification status in database
   */
  private async updateNotificationStatus(
    notificationId: string,
    status: 'processing' | 'sent' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    const updates: any = { status };

    if (status === 'sent') {
      updates.sent_at = new Date().toISOString();
    }

    if (errorMessage) {
      updates.error_message = errorMessage;
    }

    await this.supabase
      .from('discord_notifications')
      .update(updates)
      .eq('id', notificationId);
  }

  /**
   * Schedule notification retry
   */
  private async scheduleRetry(notification: DiscordNotification): Promise<void> {
    const retryCount = (notification.metadata?.retry_count as number) || 0;
    const maxRetries = 3;

    if (retryCount >= maxRetries) {
      console.log('[AIBridge] Max retries reached for notification', {
        id: notification.id,
      });
      return;
    }

    // Exponential backoff: 1min, 5min, 15min
    const retryDelays = [60000, 300000, 900000];
    const nextRetryDelay = retryDelays[retryCount] || 900000;
    const nextRetryAt = new Date(Date.now() + nextRetryDelay);

    await this.supabase
      .from('discord_notifications')
      .update({
        status: 'pending',
        next_retry_at: nextRetryAt.toISOString(),
        retry_count: retryCount + 1,
      })
      .eq('id', notification.id);

    console.log('[AIBridge] Scheduled retry', {
      id: notification.id,
      retryCount: retryCount + 1,
      nextRetryAt: nextRetryAt.toISOString(),
    });
  }

  /**
   * Setup real-time subscription for immediate notification processing
   */
  private setupRealtimeSubscription(): void {
    this.supabase
      .channel('discord_notifications_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'discord_notifications',
          filter: `tenant_id=eq.${this.tenantId}`,
        },
        async (payload) => {
          console.log('[AIBridge] New notification received via realtime', {
            id: payload.new.id,
            type: payload.new.notification_type,
          });

          // Process immediately if not already processing
          if (!this.isProcessing) {
            await this.processNotification(payload.new as DiscordNotification);
          }
        }
      )
      .subscribe((status) => {
        console.log('[AIBridge] Realtime subscription status:', status);
      });
  }

  /**
   * Utility: Parse color string to Discord color number
   */
  private parseColor(color: string): number {
    // Remove '#' if present
    const hex = color.replace('#', '');
    return parseInt(hex, 16);
  }

  /**
   * Utility: Get footer text based on notification type
   */
  private getFooterText(type: string): string {
    switch (type) {
      case 'pick_scored':
        return '⚡ Powered by Unit Talk AI';
      case 'ai_insight':
        return '🤖 AI-Generated Insight';
      case 'health_alert':
        return '⚠️ System Health Alert';
      case 'hedge_opportunity':
        return '💰 Hedge Opportunity Detected';
      case 'system_alert':
        return '🔔 System Notification';
      default:
        return 'Unit Talk Platform';
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      notificationsSent: 0,
      notificationsFailed: 0,
      avgProcessingTimeMs: 0,
    };
  }
}

/**
 * Helper function to create AI insight notification
 */
export async function createAIInsightNotification(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    channelId: string;
    title: string;
    description: string;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    aiLogId?: string;
    pickId?: string;
    userId?: string;
    color?: string;
  }
): Promise<void> {
  await supabase.from('discord_notifications').insert({
    tenant_id: params.tenantId,
    notification_type: 'ai_insight',
    discord_channel_id: params.channelId,
    user_id: params.userId || null,
    title: params.title,
    description: params.description,
    fields: params.fields || [],
    color: params.color || '#0099ff',
    pick_id: params.pickId || null,
    ai_log_id: params.aiLogId || null,
    status: 'pending',
  });
}

/**
 * Helper function to create pick scored notification
 */
export async function createPickScoredNotification(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    channelId: string;
    pickData: {
      player_name: string;
      stat_type: string;
      line: number;
      outcome: 'win' | 'loss' | 'push';
      actual_value?: number;
      professional_score?: number;
      clv?: number;
    };
    aiSummary?: string;
    aiLogId?: string;
    userId?: string;
  }
): Promise<void> {
  const { pickData, aiSummary } = params;

  const outcomeEmoji = pickData.outcome === 'win' ? '✅' : pickData.outcome === 'loss' ? '❌' : '🔄';
  const outcomeColor = pickData.outcome === 'win' ? '#00ff00' : pickData.outcome === 'loss' ? '#ff0000' : '#ffaa00';

  const fields = [
    {
      name: 'Pick',
      value: `${pickData.player_name} - ${pickData.stat_type} ${pickData.line}`,
      inline: false,
    },
    {
      name: 'Result',
      value: `${outcomeEmoji} ${pickData.outcome.toUpperCase()}`,
      inline: true,
    },
  ];

  if (pickData.actual_value !== undefined) {
    fields.push({
      name: 'Actual Value',
      value: pickData.actual_value.toString(),
      inline: true,
    });
  }

  if (pickData.professional_score) {
    fields.push({
      name: 'Professional Score',
      value: `${pickData.professional_score}/100`,
      inline: true,
    });
  }

  if (pickData.clv !== undefined) {
    fields.push({
      name: 'CLV',
      value: `${(pickData.clv * 100).toFixed(2)}%`,
      inline: true,
    });
  }

  await supabase.from('discord_notifications').insert({
    tenant_id: params.tenantId,
    notification_type: 'pick_scored',
    discord_channel_id: params.channelId,
    user_id: params.userId || null,
    title: `${outcomeEmoji} Pick Result: ${pickData.outcome.toUpperCase()}`,
    description: aiSummary || `${pickData.player_name} ${pickData.stat_type} ${pickData.line} result is in!`,
    fields,
    color: outcomeColor,
    pick_id: null, // Set from calling code
    ai_log_id: params.aiLogId || null,
    status: 'pending',
  });
}

/**
 * Helper function to create health alert notification
 */
export async function createHealthAlertNotification(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    channelId: string;
    service: string;
    status: 'degraded' | 'unhealthy' | 'recovered';
    message: string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  const statusEmoji = params.status === 'recovered' ? '✅' : params.status === 'degraded' ? '⚠️' : '🔴';
  const statusColor = params.status === 'recovered' ? '#00ff00' : params.status === 'degraded' ? '#ffaa00' : '#ff0000';

  await supabase.from('discord_notifications').insert({
    tenant_id: params.tenantId,
    notification_type: 'health_alert',
    discord_channel_id: params.channelId,
    title: `${statusEmoji} Health Alert: ${params.service}`,
    description: params.message,
    fields: params.details
      ? Object.entries(params.details).map(([key, value]) => ({
          name: key,
          value: String(value),
          inline: true,
        }))
      : [],
    color: statusColor,
    status: 'pending',
    metadata: { service: params.service, alert_status: params.status },
  });
}
