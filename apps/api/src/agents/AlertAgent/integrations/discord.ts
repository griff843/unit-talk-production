import { WebhookClient, EmbedBuilder } from 'discord.js';
import { isShadowMode, shadowPublishPreview } from '../../../shadow/ShadowMode';
import { discordBotIntegration } from '../../../services/DiscordBotIntegration';
import { env } from '../../../config/env';

interface DiscordConfig {
  webhookUrl: string;
  rateLimitMs: number;
  maxRetries: number;
  backoffMultiplier: number;
}

class DiscordAlertService {
  private client?: WebhookClient;
  private config: DiscordConfig;
  private lastSentTime: number = 0;
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue: boolean = false;

  constructor(config?: Partial<DiscordConfig>) {
    // Priority: Use dedicated alerts channel ID if available, fallback to webhook
    const alertsChannelId = process.env.ALERTS_CHANNEL_ID;
    const webhookUrl = process.env.DISCORD_ALERT_WEBHOOK;
    
    // In development mode, allow startup without valid Discord webhooks
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (!isDevelopment && !alertsChannelId && !webhookUrl) {
      throw new Error('Either ALERTS_CHANNEL_ID or DISCORD_ALERT_WEBHOOK environment variable is required');
    }

    this.config = {
      webhookUrl: webhookUrl || '',
      rateLimitMs: 2000, // 2 seconds between requests (Discord allows 30/min)
      maxRetries: 3,
      backoffMultiplier: 2,
      ...config
    };

    // Only create webhook client in production or with valid webhook URL
    if (webhookUrl && !isDevelopment && webhookUrl.includes('discord.com/api/webhooks/') && !webhookUrl.includes('placeholder')) {
      this.client = new WebhookClient({ url: this.config.webhookUrl });
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const timeSinceLastSent = Date.now() - this.lastSentTime;
    if (timeSinceLastSent < this.config.rateLimitMs) {
      const waitTime = this.config.rateLimitMs - timeSinceLastSent;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastSentTime = Date.now();
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= this.config.maxRetries) {
        throw error;
      }

      const delay = Math.pow(this.config.backoffMultiplier, attempt - 1) * 1000;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Discord send failed (attempt ${attempt}/${this.config.maxRetries}), retrying in ${delay}ms:`, errorMessage);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retryWithBackoff(operation, attempt + 1);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        try {
          await this.enforceRateLimit();
          await request();
        } catch (error) {
          console.error('Failed to process Discord queue item:', error);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  public async sendAlert(embed: EmbedBuilder, capperName?: string): Promise<void> {
    // In shadow mode, route to shadow preview instead of public channels
    if (isShadowMode()) {
      await shadowPublishPreview(embed.data);
      return;
    }

    // Use bot token approach for direct channel posting with capper thread routing
    if (discordBotIntegration) {
      try {
        // Post the rich embed directly to preserve formatting
        const result = await discordBotIntegration.postRichEmbed(embed, capperName);

        if (!result.success) {
          throw new Error(result.error || 'Discord bot posting failed');
        }

        console.log('✅ Rich embed posted via bot token', {
          messageId: result.messageId,
          capper: capperName,
          embedTitle: embed.data.title
        });
        return;
      } catch (error) {
        console.warn('Bot token approach failed, falling back to webhook:', error);
        // Fall through to webhook approach as backup
      }
    }

    // Fallback to webhook approach
    return new Promise((resolve, reject) => {
      const request = async () => {
        try {
          if (!this.client) {
            throw new Error('Discord client not initialized');
          }
          await this.retryWithBackoff(async () => {
            await this.client!.send({ embeds: [embed] });
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      this.requestQueue.push(request);
      this.processQueue();
    });
  }

  public async sendBatchAlerts(embeds: EmbedBuilder[]): Promise<void> {
    // In shadow mode, route to shadow preview instead of public channels
    if (isShadowMode()) {
      // Send each embed to shadow preview
      for (const embed of embeds) {
        await shadowPublishPreview(embed.data);
      }
      return;
    }

    // Discord allows up to 10 embeds per message
    const batches: Array<EmbedBuilder[]> = [];
    for (let i = 0; i < embeds.length; i += 10) {
      batches.push(embeds.slice(i, i + 10));
    }

    const batchPromises = batches.map(batch => 
      new Promise<void>((resolve, reject) => {
        const request = async () => {
          try {
            if (!this.client) {
              throw new Error('Discord client not initialized');
            }
            await this.retryWithBackoff(async () => {
              await this.client!.send({ embeds: batch });
            });
            resolve();
          } catch (error) {
            reject(error);
          }
        };

        this.requestQueue.push(request);
      })
    );

    this.processQueue();
    await Promise.all(batchPromises);
  }

  public getQueueStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessingQueue
    };
  }

  /**
   * Convert Discord embed to pick data format for bot integration
   * This preserves the rich embed content while using bot token posting
   */
  private convertEmbedToPickData(embed: EmbedBuilder, capperName?: string): any {
    const embedData = embed.data;
    const title = embedData.title || 'Alert';
    const description = embedData.description || '';

    // Extract player name and sport from embed if available
    let playerName = 'Unknown Player';
    let sport = 'Unknown';
    let statType = 'Unknown Stat';

    // Try to parse from description or fields
    if (description) {
      const playerMatch = description.match(/\*\*(.*?)\*\*/);
      if (playerMatch) {
        playerName = playerMatch[1];
      }
    }

    // Extract sport from title or description
    const sportsMap: { [key: string]: string } = {
      '🏈': 'NFL',
      '🏀': 'NBA',
      '⚾': 'MLB',
      '🏒': 'NHL'
    };

    for (const [emoji, sportName] of Object.entries(sportsMap)) {
      if (title.includes(emoji) || description.includes(emoji)) {
        sport = sportName;
        break;
      }
    }

    // Extract from fields if available
    if (embedData.fields) {
      for (const field of embedData.fields) {
        if (field.name?.includes('Selection') && field.value) {
          const lines = field.value.split('\n');
          if (lines[0]) {
            playerName = lines[0].replace(/\*\*/g, '');
          }
          if (lines[1]) {
            statType = lines[1];
          }
        }
      }
    }

    return {
      capper_name: capperName || 'AlertAgent',
      sport: sport,
      bet_slip_id: `alert-${Date.now()}`,
      selections: [{
        player_name: playerName,
        stat_type: statType,
        line: 'Alert',
        selection: 'Alert'
      }],
      selection_count: 1,
      total_units: 1,
      notes: `Rich Alert: ${title}`,
      source: 'alert_agent',
      // Preserve the original rich embed for enhanced formatting
      _richEmbed: embedData
    };
  }

  public async testConnection(): Promise<boolean> {
    try {
      // Send a minimal test embed
      const testEmbed = new EmbedBuilder()
        .setTitle('🔧 Discord Connection Test')
        .setDescription('This is a test message to verify webhook connectivity')
        .setColor(0x00FF00)
        .setTimestamp();

      // In shadow mode, test goes to shadow preview
      if (isShadowMode()) {
        await shadowPublishPreview(testEmbed.data);
        return true;
      }

      await this.sendAlert(testEmbed);
      return true;
    } catch (error) {
      console.error('Discord connection test failed:', error);
      return false;
    }
  }
}

// Create singleton instance
const discordService = new DiscordAlertService();

// Export the main function for backward compatibility
export async function sendDiscordAlert(embed: EmbedBuilder, capperName?: string): Promise<void> {
  // In shadow mode, route to shadow preview instead of public channels
  if (isShadowMode()) {
    await shadowPublishPreview(embed.data);
    return;
  }

  return discordService.sendAlert(embed, capperName);
}

// Export additional functions for enhanced functionality
export async function sendBatchDiscordAlerts(embeds: EmbedBuilder[]): Promise<void> {
  // In shadow mode, route to shadow preview instead of public channels
  if (isShadowMode()) {
    for (const embed of embeds) {
      await shadowPublishPreview(embed.data);
    }
    return;
  }
  
  return discordService.sendBatchAlerts(embeds);
}

export function getDiscordQueueStatus() {
  return discordService.getQueueStatus();
}

export async function testDiscordConnection(): Promise<boolean> {
  return discordService.testConnection();
}

// Export the service instance for advanced usage
export { discordService };