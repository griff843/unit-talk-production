/**
 * @fileoverview Ops Discord Sender
 *
 * Sends ops notifications to Discord with:
 * - Rate limiting
 * - Retry with exponential backoff
 * - Message tracking for updates
 *
 * Part of PR7: Incident Routing + Ops Digest
 *
 * @module services/ops/OpsDiscordSender
 */

import { Client, TextChannel, EmbedBuilder, Message } from 'discord.js';

import { makeLogger } from '../../utils/logger';

import {
  buildIncidentEmbed,
  buildEscalationContent,
  buildDigestEmbed,
  buildDigestContent,
  OpsDigestData,
} from './OpsDiscordEmbedBuilder';
import { DiscordPayload, NotificationResult } from './OpsIncidentRouter';

const logger = makeLogger('OpsDiscordSender');

// ============================================================================
// Types
// ============================================================================

interface OpsDiscordSenderConfig {
  rateLimitMs: number;
  maxRetries: number;
  backoffMultiplier: number;
}

// ============================================================================
// OpsDiscordSender Class
// ============================================================================

export class OpsDiscordSender {
  private client: Client | null = null;
  private config: OpsDiscordSenderConfig;
  private lastSentTime: number = 0;
  private messageCache: Map<string, string> = new Map(); // incidentId -> messageId

  constructor(client?: Client, config?: Partial<OpsDiscordSenderConfig>) {
    this.client = client || null;
    this.config = {
      rateLimitMs: 2000, // 2 seconds between messages
      maxRetries: 3,
      backoffMultiplier: 2,
      ...config,
    };
  }

  /**
   * Set Discord client
   */
  setClient(client: Client): void {
    this.client = client;
    logger.info('Discord client attached to OpsDiscordSender');
  }

  /**
   * Enforce rate limit
   */
  private async enforceRateLimit(): Promise<void> {
    const timeSinceLastSent = Date.now() - this.lastSentTime;
    if (timeSinceLastSent < this.config.rateLimitMs) {
      const waitTime = this.config.rateLimitMs - timeSinceLastSent;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastSentTime = Date.now();
  }

  /**
   * Retry with exponential backoff
   */
  private async retryWithBackoff<T>(operation: () => Promise<T>, attempt: number = 1): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= this.config.maxRetries) {
        throw error;
      }

      const delay = Math.pow(this.config.backoffMultiplier, attempt - 1) * 1000;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(
        `Discord send failed (attempt ${attempt}/${this.config.maxRetries}), retrying in ${delay}ms`,
        {
          error: errorMessage,
        }
      );

      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retryWithBackoff(operation, attempt + 1);
    }
  }

  /**
   * Send incident notification
   */
  async sendIncidentNotification(payload: DiscordPayload): Promise<NotificationResult> {
    if (!this.client) {
      return { success: false, error: 'Discord client not initialized' };
    }

    try {
      await this.enforceRateLimit();

      const channel = await this.client.channels.fetch(payload.channelId);
      if (!channel || !channel.isTextBased()) {
        return { success: false, error: 'Channel not found or not text-based' };
      }

      const textChannel = channel as TextChannel;

      // Build embed
      const embed = buildIncidentEmbed(payload.incident, {
        correlationId: payload.correlationId,
        environment: payload.environment,
        commandCenterUrl: payload.commandCenterUrl,
        escalationRoleId: payload.escalationRoleId,
      });

      // Build content (for escalation mentions)
      const content = buildEscalationContent(payload.incident, payload.escalationRoleId);

      // Check if we have a previous message to edit
      const existingMessageId = this.messageCache.get(payload.incident.incident_id);
      let message: Message;

      if (existingMessageId && payload.incident.status !== 'open') {
        // Try to edit existing message for status updates
        try {
          const existingMessage = await textChannel.messages.fetch(existingMessageId);
          message = await existingMessage.edit({
            content: content || undefined,
            embeds: [embed],
          });
          logger.info('Updated existing incident message', {
            incidentId: payload.incident.incident_id,
            messageId: message.id,
          });
        } catch {
          // If edit fails, send new message
          message = await this.retryWithBackoff(async () => {
            return textChannel.send({
              content: content || undefined,
              embeds: [embed],
            });
          });
          logger.info('Sent new incident message (edit failed)', {
            incidentId: payload.incident.incident_id,
            messageId: message.id,
          });
        }
      } else {
        // Send new message
        message = await this.retryWithBackoff(async () => {
          return textChannel.send({
            content: content || undefined,
            embeds: [embed],
          });
        });
        logger.info('Sent new incident message', {
          incidentId: payload.incident.incident_id,
          messageId: message.id,
        });
      }

      // Cache message ID for future updates
      this.messageCache.set(payload.incident.incident_id, message.id);

      // Clean cache if too large
      if (this.messageCache.size > 1000) {
        const keys = Array.from(this.messageCache.keys());
        for (let i = 0; i < 500; i++) {
          this.messageCache.delete(keys[i]);
        }
      }

      return {
        success: true,
        messageId: message.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send incident notification', {
        incidentId: payload.incident.incident_id,
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send digest notification
   */
  async sendDigestNotification(
    digest: OpsDigestData,
    channelId: string,
    correlationId: string,
    environment: string,
    commandCenterUrl: string
  ): Promise<NotificationResult> {
    if (!this.client) {
      return { success: false, error: 'Discord client not initialized' };
    }

    try {
      await this.enforceRateLimit();

      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        return { success: false, error: 'Channel not found or not text-based' };
      }

      const textChannel = channel as TextChannel;

      // Build embed
      const embed = buildDigestEmbed(digest, {
        correlationId,
        environment,
        commandCenterUrl,
      });

      // Build content
      const content = buildDigestContent(digest);

      // Send message
      const message = await this.retryWithBackoff(async () => {
        return textChannel.send({
          content,
          embeds: [embed],
        });
      });

      logger.info('Sent digest notification', {
        messageId: message.id,
        correlationId,
      });

      return {
        success: true,
        messageId: message.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send digest notification', {
        error: errorMessage,
        correlationId,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Test connection
   */
  async testConnection(channelId: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      return channel !== null && channel.isTextBased();
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

let senderInstance: OpsDiscordSender | null = null;

export function getOpsDiscordSender(): OpsDiscordSender {
  if (!senderInstance) {
    senderInstance = new OpsDiscordSender();
  }
  return senderInstance;
}

export function initializeOpsDiscordSender(client: Client): OpsDiscordSender {
  const sender = getOpsDiscordSender();
  sender.setClient(client);
  return sender;
}

/**
 * Create sender function for OpsIncidentRouter
 */
export function createDiscordSenderFn(
  sender: OpsDiscordSender
): (payload: DiscordPayload) => Promise<NotificationResult> {
  return (payload: DiscordPayload) => sender.sendIncidentNotification(payload);
}
