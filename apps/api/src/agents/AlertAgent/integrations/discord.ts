import { WebhookClient, EmbedBuilder } from 'discord.js';
import { isShadowMode, shadowPublishPreview } from '../../../shadow/ShadowMode';
// import { env } from '../../../config/env';

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

  public async sendAlert(embed: EmbedBuilder): Promise<void> {
    // In shadow mode, route to shadow preview instead of public channels
    if (isShadowMode()) {
      await shadowPublishPreview(embed.data);
      return;
    }

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
    const batches = [];
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
export async function sendDiscordAlert(embed: EmbedBuilder): Promise<void> {
  // In shadow mode, route to shadow preview instead of public channels
  if (isShadowMode()) {
    await shadowPublishPreview(embed.data);
    return;
  }
  
  return discordService.sendAlert(embed);
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