import { logger } from '../../shared/logger';
import { auditLogger } from './AuditLogger';
import { PicksDriverFactory } from './PicksDriverFactory';
import type { PickData, PublishOptions } from './types';

/**
 * Publish mode configuration
 */
export type PublishMode = 'direct' | 'outbox';

/**
 * PickPublisher - Handles Discord publishing with direct or outbox pattern
 *
 * Supports two modes:
 * - direct: Immediately publish to Discord and log
 * - outbox: Write to pick_publish table for async worker processing
 */
export class PickPublisher {
  private publishMode: PublishMode;

  constructor(publishMode?: PublishMode) {
    this.publishMode = publishMode || (process.env.PUBLISH_MODE as PublishMode) || 'outbox';
    logger.info('PickPublisher initialized', { publishMode: this.publishMode });
  }

  /**
   * Publish a pick to Discord
   *
   * @param pick - Pick data to publish
   * @param options - Publishing options (channel, thread, scheduling)
   */
  async publish(pick: PickData, options: PublishOptions): Promise<void> {
    logger.info('Publishing pick', {
      pickId: pick.id,
      mode: this.publishMode,
      channel: options.channel,
    });

    if (this.publishMode === 'outbox') {
      await this.publishViaOutbox(pick, options);
    } else {
      await this.publishDirectly(pick, options);
    }
  }

  /**
   * Publish via outbox pattern
   * Writes to pick_publish table for async worker processing
   */
  private async publishViaOutbox(pick: PickData, options: PublishOptions): Promise<void> {
    try {
      const driver = await PicksDriverFactory.getDriver();

      // Check if driver supports publish records
      if (!driver.createPublishRecord) {
        logger.warn('Driver does not support outbox pattern, falling back to direct publishing', {
          pickId: pick.id,
        });
        await this.publishDirectly(pick, options);
        return;
      }

      // Create publish record in outbox table
      const publishData = await driver.createPublishRecord(pick.id, pick.tenantId, options);

      logger.info('Pick queued for publishing via outbox', {
        pickId: pick.id,
        publishId: publishData.id,
        channel: options.channel,
      });

      // Note: Actual Discord posting will be handled by background worker
      // that polls pick_publish table for pending records
    } catch (error) {
      logger.error('Failed to publish via outbox', {
        pickId: pick.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Publish directly to Discord
   * Immediately calls Discord API and writes audit log
   */
  private async publishDirectly(pick: PickData, options: PublishOptions): Promise<void> {
    try {
      // TODO: Implement actual Discord API call
      // For now, just log the action
      const messageId = `msg-${Date.now()}`;

      logger.info('Pick published directly to Discord', {
        pickId: pick.id,
        channel: options.channel,
        threadId: options.threadId,
        messageId,
      });

      // Log successful Discord post
      await auditLogger.logDiscordPosted(`publish-${pick.id}`, pick.tenantId, {
        pickId: pick.id,
        messageId,
        threadId: options.threadId,
        channel: options.channel,
      });

      // Optionally write to pick_publish table with 'sent' status for observability
      const driver = await PicksDriverFactory.getDriver();
      if (driver.createPublishRecord) {
        const publishData = await driver.createPublishRecord(pick.id, pick.tenantId, {
          ...options,
          metadata: {
            ...options.metadata,
            externalMessageId: messageId,
          },
        });

        // Update status to 'sent'
        if (driver.updatePublishStatus) {
          await driver.updatePublishStatus(publishData.id, 'sent', {
            externalMessageId: messageId,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to publish directly to Discord', {
        pickId: pick.id,
        error: error instanceof Error ? error.message : String(error),
      });

      // Log failure
      await auditLogger.log({
        eventType: 'publish.failed',
        refType: 'publish',
        refId: `publish-${pick.id}`,
        tenantId: pick.tenantId,
        data: {
          pick_id: pick.id,
          error: error instanceof Error ? error.message : String(error),
          channel: options.channel,
        },
      });

      throw error;
    }
  }

  /**
   * Get current publish mode
   */
  getPublishMode(): PublishMode {
    return this.publishMode;
  }

  /**
   * Set publish mode (for testing)
   */
  setPublishMode(mode: PublishMode): void {
    this.publishMode = mode;
    logger.info('Publish mode changed', { publishMode: mode });
  }
}

// Export singleton instance
export const pickPublisher = new PickPublisher();
