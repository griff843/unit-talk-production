import { Client, GatewayIntentBits, EmbedBuilder, TextChannel } from 'discord.js';
import { createLogger } from '../utils/logger';
import { getPlayerHeadshotUrl } from '../agents/AlertAgent/parlayEmbedBuilder';
import { env } from '../config/env';

interface DiscordConfig {
  token: string;
  channelId: string;
  enabled: boolean;
}

interface PickData {
  capper_name: string;
  sport: string;
  bet_slip_id: string;
  selections: Array<{
    player_name?: string;
    team_name?: string;
    stat_type: string;
    line: number | string;
    selection: string;
    leg_odds?: number;
  }>;
  selection_count: number;
  total_units: number;
  notes?: string;
  source?: string;
}

export class DiscordBotIntegration {
  private client: Client;
  private config: DiscordConfig;
  private logger = createLogger('DiscordBotIntegration');
  private isReady: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    // Support CANARY_CHANNEL_ID for canary deployments
    const canaryChannelId = process.env.CANARY_CHANNEL_ID;
    const isCanaryMode = !!canaryChannelId && process.env.CANARY_TAG;

    this.config = {
      token: process.env.DISCORD_TOKEN || '',
      channelId: canaryChannelId || process.env.ALERTS_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID || '',
      enabled: process.env.PUBLISH_TO_DISCORD === 'true' && !!process.env.DISCORD_TOKEN
    };

    if (isCanaryMode) {
      this.logger.info('Running in canary mode', {
        canaryTag: process.env.CANARY_TAG,
        channelId: canaryChannelId
      });
    }

    if (!this.config.enabled) {
      this.logger.warn('Discord bot integration disabled - missing token or disabled in config');
      return;
    }

    if (!this.config.channelId) {
      // Fail fast if CANARY_TAG is set but no CANARY_CHANNEL_ID
      if (process.env.CANARY_TAG && !process.env.CANARY_CHANNEL_ID) {
        this.logger.error('CANARY_TAG is set but CANARY_CHANNEL_ID is missing!');
        throw new Error('CANARY_CHANNEL_ID must be set when CANARY_TAG is configured');
      }

      this.logger.warn('Discord bot integration disabled - no channel ID configured');
      this.config.enabled = false;
      return;
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
      ],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once('ready', () => {
      this.isReady = true;
      this.logger.info('Discord bot integration ready', {
        botTag: this.client.user?.tag,
        guildCount: this.client.guilds.cache.size
      });
    });

    this.client.on('error', (error) => {
      this.logger.error('Discord client error', {
        error: error.message,
        stack: error.stack
      });
    });

    this.client.on('disconnect', () => {
      this.isReady = false;
      this.logger.warn('Discord client disconnected');
    });
  }

  public async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Discord bot integration skipped - disabled');
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      this.logger.info('Initializing Discord bot integration...');

      await this.client.login(this.config.token);

      // Wait for ready state
      await new Promise<void>((resolve, reject) => {
        if (this.isReady) {
          resolve();
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('Discord bot connection timeout'));
        }, 30000);

        this.client.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.logger.info('Discord bot integration initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Discord bot integration', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.config.enabled = false;
      throw error;
    }
  }

  public async postPick(pickData: PickData): Promise<{ success: boolean; messageId?: string; error?: string; headshotIncluded?: boolean }> {
    if (!this.config.enabled) {
      return {
        success: false,
        error: 'Discord bot integration disabled'
      };
    }

    if (!this.isReady) {
      try {
        await this.initialize();
      } catch (error) {
        return {
          success: false,
          error: 'Failed to initialize Discord bot'
        };
      }
    }

    try {
      this.logger.info('Posting pick to Discord', {
        capper: pickData.capper_name,
        sport: pickData.sport,
        betSlipId: pickData.bet_slip_id
      });

      // Determine target channel: capper thread or fallback to alerts channel
      const targetChannelId = this.getCapperThreadId(pickData.capper_name) || this.config.channelId;

      this.logger.info('Discord routing decision', {
        capper: pickData.capper_name,
        targetChannelId,
        isCapperThread: !!this.getCapperThreadId(pickData.capper_name)
      });

      // Get the Discord channel
      const channel = this.client.channels.cache.get(targetChannelId) as TextChannel;

      if (!channel) {
        this.logger.error('Could not find Discord channel', {
          targetChannelId,
          fallbackChannelId: this.config.channelId
        });
        return {
          success: false,
          error: 'Could not find Discord channel'
        };
      }

      // Create enhanced embed with headshots
      const embed = new EmbedBuilder()
        .setTitle('🎯 New Pick Submitted!')
        .setColor(0x00FF00)
        .addFields([
          { name: '🎪 Capper', value: pickData.capper_name, inline: true },
          { name: '🏈 Sport', value: pickData.sport, inline: true },
          { name: '🎫 Ticket ID', value: pickData.bet_slip_id || 'Unknown', inline: true },
        ])
        .setTimestamp()
        .setFooter({ text: 'Unit Talk Smart Form - Enhanced with Headshots!' });

      // Process selections with headshot enrichment
      let headshotUrl = null;

      if (pickData.selections && pickData.selections.length > 0) {
        const selections = pickData.selections.slice(0, 5); // Limit to first 5 selections

        for (let index = 0; index < selections.length; index++) {
          const selection = selections[index];
          const playerName = selection.player_name || selection.team_name || 'Unknown';
          const statType = selection.stat_type || 'Unknown';
          const line = selection.line || 'Unknown';
          const selectionType = selection.selection || 'Unknown';

          // Try to get player headshot URL if we have a player name and sport
          if (selection.player_name && pickData.sport && index === 0) {
            try {
              // Fix parameter order: sport first, then playerId, then playerName
              headshotUrl = getPlayerHeadshotUrl(pickData.sport, undefined, selection.player_name);

              // Validate URL format for Discord
              if (headshotUrl && this.isValidUrl(headshotUrl)) {
                this.logger.info('Retrieved valid headshot URL', {
                  player: selection.player_name,
                  sport: pickData.sport,
                  url: headshotUrl
                });
              } else {
                headshotUrl = null;
                this.logger.debug('Invalid or no headshot URL found', {
                  playerName: selection.player_name,
                  sport: pickData.sport
                });
              }
            } catch (error) {
              headshotUrl = null;
              this.logger.debug('Failed to get headshot for player', {
                playerName: selection.player_name,
                sport: pickData.sport,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }

          embed.addFields([{
            name: `📊 Selection ${index + 1}`,
            value: `**${playerName}** ${statType}\n**Line:** ${line} (${selectionType})`,
            inline: false
          }]);

          // Set player headshot as thumbnail for the first selection with a valid headshot
          if (index === 0 && headshotUrl) {
            embed.setThumbnail(headshotUrl);
            this.logger.info('Added headshot to embed', { headshotUrl });
          }
        }

        if (pickData.selections.length > 5) {
          embed.addFields([{
            name: '📋 Additional Selections',
            value: `... and ${pickData.selections.length - 5} more selections`,
            inline: false
          }]);
        }
      }

      // Add units if available
      if (pickData.total_units) {
        embed.addFields([{
          name: '💰 Units',
          value: `${pickData.total_units} unit${pickData.total_units === 1 ? '' : 's'}`,
          inline: true
        }]);
      }

      // Add selection count
      if (pickData.selection_count) {
        embed.addFields([{
          name: '🔢 Selections',
          value: `${pickData.selection_count} pick${pickData.selection_count === 1 ? '' : 's'}`,
          inline: true
        }]);
      }

      // Add notes if available
      if (pickData.notes) {
        embed.addFields([{
          name: '📝 Notes',
          value: pickData.notes.substring(0, 1000), // Limit to 1000 chars
          inline: false
        }]);
      }

      // Send to Discord channel
      const message = await channel.send({ embeds: [embed] });

      this.logger.info('Successfully posted pick to Discord', {
        channelId: this.config.channelId,
        messageId: message.id,
        capper: pickData.capper_name,
        sport: pickData.sport,
        headshotIncluded: !!headshotUrl
      });

      return {
        success: true,
        messageId: message.id,
        headshotIncluded: !!headshotUrl
      };

    } catch (error) {
      this.logger.error('Failed to post pick to Discord', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  public async testConnection(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      if (!this.isReady) {
        await this.initialize();
      }

      // Test if we can access the channel
      const channel = this.client.channels.cache.get(this.config.channelId) as TextChannel;
      return !!channel;
    } catch (error) {
      this.logger.error('Discord connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Post a pre-built rich embed (e.g., from AlertAgent's DiscordRichEmbeds)
   * Routes to capper-specific threads based on capper name
   */
  public async postRichEmbed(embed: EmbedBuilder, capperName?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.config.enabled) {
      return {
        success: false,
        error: 'Discord bot integration disabled'
      };
    }

    if (!this.isReady) {
      try {
        await this.initialize();
      } catch (error) {
        return {
          success: false,
          error: 'Failed to initialize Discord bot'
        };
      }
    }

    try {
      this.logger.info('Posting rich embed to Discord', {
        capper: capperName,
        embedTitle: embed.data.title
      });

      // Determine target channel: capper thread or fallback to alerts channel
      const targetChannelId = this.getCapperThreadId(capperName || '') || this.config.channelId;

      this.logger.info('Discord routing decision for rich embed', {
        capper: capperName,
        targetChannelId,
        isCapperThread: !!this.getCapperThreadId(capperName || '')
      });

      // Get the Discord channel
      const channel = this.client.channels.cache.get(targetChannelId) as TextChannel;

      if (!channel) {
        this.logger.error('Could not find Discord channel for rich embed', {
          targetChannelId,
          fallbackChannelId: this.config.channelId
        });
        return {
          success: false,
          error: 'Could not find Discord channel'
        };
      }

      // Send the pre-built rich embed directly
      const message = await channel.send({ embeds: [embed] });

      this.logger.info('Successfully posted rich embed to Discord', {
        channelId: targetChannelId,
        messageId: message.id,
        capper: capperName,
        embedTitle: embed.data.title
      });

      return {
        success: true,
        messageId: message.id
      };

    } catch (error) {
      this.logger.error('Failed to post rich embed to Discord', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        capper: capperName
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  public async destroy(): Promise<void> {
    if (this.client && this.isReady) {
      await this.client.destroy();
      this.isReady = false;
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'https:' && urlObj.hostname.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get capper thread ID from environment configuration
   * Routes picks to capper-specific threads instead of general alerts channel
   */
  private getCapperThreadId(capperName: string): string | null {
    if (!capperName) return null;

    // Look up capper thread from environment configuration
    const threadId = (env.capperThreads as any)[capperName];

    this.logger.debug('Capper thread lookup', {
      capperName,
      threadId,
      availableCappers: Object.keys(env.capperThreads)
    });

    return threadId || null;
  }

  public getStatus() {
    return {
      enabled: this.config.enabled,
      ready: this.isReady,
      channelId: this.config.channelId,
      hasToken: !!this.config.token
    };
  }
}

// Create singleton instance
export const discordBotIntegration = new DiscordBotIntegration();