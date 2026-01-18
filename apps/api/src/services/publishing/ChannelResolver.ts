/**
 * Channel Resolver Service
 *
 * Maps channel enum values ('DISCORD', 'CANARY', etc.) to actual Discord channel IDs
 *
 * SAFETY: Ensures test picks ONLY go to CANARY channel, never production channels
 */

import { Logger } from '../../shared/logger/types';

export type ChannelType = 'DISCORD' | 'CANARY' | 'WEBHOOK' | 'EMAIL';

export interface ChannelMapping {
  channelType: ChannelType;
  discordChannelId: string;
  description: string;
}

/**
 * Channel Resolver - Maps channel enum to Discord channel IDs
 */
export class ChannelResolver {
  private channelMappings: Map<ChannelType, string>;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.channelMappings = new Map();

    // Load channel mappings from environment
    this.loadChannelMappings();
  }

  /**
   * Load channel mappings from environment variables
   */
  private loadChannelMappings(): void {
    // DISCORD channel - production VIP picks channel
    const discordChannelId = process.env.VIP_PICKS_CHANNEL_ID;
    if (discordChannelId) {
      this.channelMappings.set('DISCORD', discordChannelId);
      this.logger.info('✅ DISCORD channel mapped', {
        channelId: discordChannelId,
        description: 'Production VIP picks channel'
      });
    } else {
      this.logger.warn('⚠️ VIP_PICKS_CHANNEL_ID not set, DISCORD channel not available');
    }

    // CANARY channel - testing channel (VIP channel dedicated for live-fire testing)
    const canaryChannelId = process.env.DISCORD_CANARY_CHANNEL_ID;
    if (canaryChannelId) {
      this.channelMappings.set('CANARY', canaryChannelId);
      this.logger.info('✅ CANARY channel mapped', {
        channelId: canaryChannelId,
        description: 'Live-fire testing channel (VIP canary)'
      });
    } else {
      this.logger.warn('⚠️ DISCORD_CANARY_CHANNEL_ID not set, CANARY channel not available');
    }

    this.logger.info('Channel resolver initialized', {
      mappedChannels: Array.from(this.channelMappings.keys()),
      totalMappings: this.channelMappings.size,
    });
  }

  /**
   * Resolve channel type to Discord channel ID
   *
   * @param channelType - Channel enum value ('DISCORD', 'CANARY', etc.)
   * @returns Discord channel ID or null if not mapped
   */
  resolve(channelType: ChannelType): string | null {
    const channelId = this.channelMappings.get(channelType);

    if (!channelId) {
      this.logger.error('Channel type not mapped to Discord channel ID', {
        channelType,
        availableChannels: Array.from(this.channelMappings.keys()),
      });
      return null;
    }

    this.logger.debug('Channel resolved', {
      channelType,
      channelId,
    });

    return channelId;
  }

  /**
   * Check if channel type is mapped
   */
  hasMapping(channelType: ChannelType): boolean {
    return this.channelMappings.has(channelType);
  }

  /**
   * Get all available channel mappings
   */
  getAllMappings(): ChannelMapping[] {
    return Array.from(this.channelMappings.entries()).map(([channelType, discordChannelId]) => ({
      channelType,
      discordChannelId,
      description: this.getChannelDescription(channelType),
    }));
  }

  /**
   * Get human-readable description for channel type
   */
  private getChannelDescription(channelType: ChannelType): string {
    const descriptions: Record<ChannelType, string> = {
      DISCORD: 'Production VIP picks channel',
      CANARY: 'Live-fire testing channel (VIP canary)',
      WEBHOOK: 'HTTP webhook publishing',
      EMAIL: 'Email notification publishing',
    };

    return descriptions[channelType] || 'Unknown channel type';
  }

  /**
   * Safety check: Ensure CANARY channel is NOT production channel
   *
   * This prevents accidental posting to production when using CANARY
   */
  validateCanarySafety(): boolean {
    const discordChannelId = this.channelMappings.get('DISCORD');
    const canaryChannelId = this.channelMappings.get('CANARY');

    if (!canaryChannelId) {
      this.logger.warn('⚠️ CANARY channel not configured');
      return false;
    }

    if (discordChannelId === canaryChannelId) {
      this.logger.error('🚨 SAFETY VIOLATION: CANARY and DISCORD channels are the same!', {
        channelId: canaryChannelId,
      });
      return false;
    }

    this.logger.info('✅ CANARY safety check passed', {
      canaryChannelId,
      discordChannelId,
    });

    return true;
  }
}
