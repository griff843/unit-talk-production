/**
 * Discord Bot Integration Service
 * 
 * Provides integration with the Discord bot for sending messages,
 * managing channels, and handling Discord-related operations.
 * 
 * @module services/DiscordBotIntegration
 * @since Phase 4 - Compile Green Stabilization
 */

import { env } from '../config/env';

/**
 * Discord message payload
 */
export interface DiscordMessage {
  content: string;
  channelId?: string;
  threadId?: string;
  embeds?: DiscordEmbed[];
}

/**
 * Discord embed structure
 */
export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  timestamp?: string;
}

/**
 * Discord Bot Integration Service
 */
export class DiscordBotIntegration {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    // In production, these would come from environment variables
    this.baseUrl = process.env.DISCORD_BOT_API_URL || 'http://localhost:3001';
    this.apiKey = process.env.DISCORD_BOT_API_KEY || '';
  }

  /**
   * Send a message to a Discord channel or thread
   * 
   * @param message - Message payload
   * @returns Promise resolving to message ID
   */
  async sendMessage(message: DiscordMessage): Promise<string> {
    // TODO: Implement actual Discord API integration
    // For now, this is a stub that logs the message
    console.log('[DiscordBotIntegration] Sending message:', {
      content: message.content.substring(0, 100),
      channelId: message.channelId,
      threadId: message.threadId
    });

    // Return a mock message ID
    return `msg_${Date.now()}`;
  }

  /**
   * Send a message to a capper's thread
   * 
   * @param capperName - Name of the capper
   * @param content - Message content
   * @returns Promise resolving to message ID
   */
  async sendToCapperThread(capperName: string, content: string): Promise<string> {
    const threadId = env.capperThreads[capperName];
    
    if (!threadId) {
      throw new Error(`No thread ID configured for capper: ${capperName}`);
    }

    return this.sendMessage({
      content,
      threadId
    });
  }

  /**
   * Send an alert to the alerts channel
   * 
   * @param content - Alert content
   * @param embed - Optional embed for rich formatting
   * @returns Promise resolving to message ID
   */
  async sendAlert(content: string, embed?: DiscordEmbed): Promise<string> {
    const channelId = env.alertsChannelId;

    if (!channelId) {
      throw new Error('No alerts channel ID configured');
    }

    return this.sendMessage({
      content,
      channelId,
      embeds: embed ? [embed] : undefined
    });
  }

  /**
   * Send a system alert to the system alerts thread
   * 
   * @param content - Alert content
   * @returns Promise resolving to message ID
   */
  async sendSystemAlert(content: string): Promise<string> {
    const threadId = env.systemAlertsThreadId;

    if (!threadId) {
      throw new Error('No system alerts thread ID configured');
    }

    return this.sendMessage({
      content,
      threadId
    });
  }

  /**
   * Create a Discord embed for a pick
   * 
   * @param pick - Pick data
   * @returns Discord embed
   */
  createPickEmbed(pick: any): DiscordEmbed {
    return {
      title: `${pick.player_name} - ${pick.stat_type}`,
      description: `Line: ${pick.line}`,
      color: 0x00ff00, // Green
      fields: [
        {
          name: 'Over Odds',
          value: pick.over_odds?.toString() || 'N/A',
          inline: true
        },
        {
          name: 'Under Odds',
          value: pick.under_odds?.toString() || 'N/A',
          inline: true
        },
        {
          name: 'Sport',
          value: pick.sport || 'N/A',
          inline: true
        }
      ],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create a Discord embed for an alert
   * 
   * @param alertType - Type of alert (hedge, middle, injury, steam)
   * @param data - Alert data
   * @returns Discord embed
   */
  createAlertEmbed(alertType: string, data: any): DiscordEmbed {
    const colors = {
      hedge: 0xffa500, // Orange
      middle: 0x0000ff, // Blue
      injury: 0xff0000, // Red
      steam: 0x800080  // Purple
    };

    return {
      title: `🚨 ${alertType.toUpperCase()} Alert`,
      description: data.description || '',
      color: colors[alertType as keyof typeof colors] || 0x808080,
      fields: data.fields || [],
      footer: {
        text: 'Unit Talk Alert System'
      },
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Singleton instance of DiscordBotIntegration
 */
let discordBotInstance: DiscordBotIntegration | null = null;

/**
 * Get or create the singleton DiscordBotIntegration instance
 * 
 * @returns DiscordBotIntegration instance
 */
export function getDiscordBot(): DiscordBotIntegration {
  if (!discordBotInstance) {
    discordBotInstance = new DiscordBotIntegration();
  }
  return discordBotInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetDiscordBot(): void {
  discordBotInstance = null;
}

/**
 * Singleton instance for direct import
 * @deprecated Use getDiscordBot() instead for better testability
 */
export const discordBotIntegration = getDiscordBot();

export default DiscordBotIntegration;

