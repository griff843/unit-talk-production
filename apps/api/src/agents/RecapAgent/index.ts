import { toISOString } from '../../utils/dateUtils';
import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies } from '../BaseAgent/types';

import { RecapFormatter } from './recapFormatter';
import { RecapService } from './recapService';
import { RecapState } from './recapStateManager';

// Define missing types
interface MicroRecapData {
  summary: string;
  picks: any[];
  performance: {
    winRate: number;
    roi: number;
    totalPicks: number;
  };
  timestamp: string;
}

interface RecapStateManager {
  loadState(): Promise<RecapState>;
  saveState(state: RecapState): Promise<void>;
  updateState(updates: Partial<RecapState>): Promise<boolean>;
}

export interface RecapAgentType {
  processRecap(): Promise<void>;
  generateRecap(): Promise<MicroRecapData>;
  triggerDailyRecap(dateStr?: string): Promise<void>;
  triggerWeeklyRecap(): Promise<void>;
  triggerMonthlyRecap(): Promise<void>;
  getRecapService(): RecapService;
  getRecapFormatter(): RecapFormatter;
  getRecapState(): RecapState;
  updateRecapState(newState: Partial<RecapState>): Promise<void>;
  
  // ARCHITECTURAL CHANGE: Discord posting moved to AlertAgent
  // RecapAgent now focuses on post-game results and daily summaries
  monitorUnifiedPicks(): Promise<void>; // Now delegates to AlertAgent
  postLivePick(pickData: any): Promise<void>; // @deprecated - Use AlertAgent
  postScheduledPicks(): Promise<void>; // @deprecated - Use AlertAgent
  formatPickEmbed(pickData: any): any; // Still used for recap formatting
  routeToThread(pickData: any): Promise<string>;
  notifyVIPUsers(pickData: any): Promise<void>;
  flagLowTierPicks(): Promise<void>;
  
  // Remove explicit recapState property
  // Add a getter for recapState
  get recapState(): RecapState;
}

export class RecapAgent extends BaseAgent implements RecapAgentType {
  private recapService: RecapService;
  private recapFormatter: RecapFormatter;
  private stateManager: RecapStateManager;
  private _recapState: RecapState;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(
    config: BaseAgentConfig,
    dependencies: BaseAgentDependencies,
    recapService: RecapService,
    recapFormatter: RecapFormatter,
    stateManager: RecapStateManager
  ) {
    super(config, dependencies);

    this.recapService = recapService;
    this.recapFormatter = recapFormatter;
    this.stateManager = stateManager;
    this._recapState = {
      manualTriggers: {
        daily: 0,
        weekly: 0,
        monthly: 0
      }
    };
    // Load state asynchronously in initialize method
  }

  // Getter for recapState
  public get recapState(): RecapState {
    return this._recapState;
  }

  public getRecapState(): RecapState {
    return this._recapState;
  }

  public async updateRecapState(newState: Partial<RecapState>): Promise<void> {
    this._recapState = { ...this._recapState, ...newState };
    await this.stateManager.updateState(this._recapState);
  }

  public async processRecap(): Promise<void> {
    const currentState = await this.stateManager.loadState();
    this._recapState = currentState || this._recapState;
    await this.updateRecapState(this._recapState);
  }

  public async generateRecap(): Promise<MicroRecapData> {
    const currentState = await this.stateManager.loadState();
    this._recapState = currentState || this._recapState;
    return {} as MicroRecapData;
  }

  public async triggerDailyRecap(dateStr?: string): Promise<void> {
    const updatedState: Partial<RecapState> = {
      manualTriggers: {
        ...this._recapState.manualTriggers,
        daily: (this._recapState.manualTriggers?.daily || 0) + 1
      }
    };

    if (dateStr) {
      updatedState.lastDailyRecap = dateStr;
    } else {
      updatedState.lastDailyRecap = new Date().toISOString().split('T')[0]!;
    }

    await this.updateRecapState(updatedState);
    await this.processRecap();
  }

  public async triggerWeeklyRecap(): Promise<void> {
    const updatedState: Partial<RecapState> = {
      lastWeeklyRecap: toISOString(new Date()),
      manualTriggers: {
        ...this._recapState.manualTriggers,
        weekly: (this._recapState.manualTriggers?.weekly || 0) + 1
      }
    };
    await this.updateRecapState(updatedState);
    await this.processRecap();
  }

  public async triggerMonthlyRecap(): Promise<void> {
    const updatedState: Partial<RecapState> = {
      lastMonthlyRecap: toISOString(new Date()),
      manualTriggers: {
        ...this._recapState.manualTriggers,
        monthly: (this._recapState.manualTriggers?.monthly || 0) + 1
      }
    };
    await this.updateRecapState(updatedState);
    await this.processRecap();
  }

  public getRecapService(): RecapService {
    return this.recapService;
  }

  public getRecapFormatter(): RecapFormatter {
    return this.recapFormatter;
  }

  // Implement abstract methods from BaseAgent
  public async initialize(): Promise<void> {
    // Initialize recap agent
    this.logger.info('Initializing RecapAgent');
    
    // Start monitoring unified_picks table for new submissions
    await this.startPicksMonitoring();
  }

  public async process(): Promise<void> {
    // Main processing logic - delegate to processRecap
    await this.processRecap();
  }

  public async cleanup(): Promise<void> {
    // Cleanup logic
    this.logger.info('Cleaning up RecapAgent');
    
    // Stop monitoring interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  public async checkHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: any }> {
    // Health check logic
    return {
      status: 'healthy',
      details: {
        lastRecapState: this._recapState,
        timestamp: toISOString(new Date())
      }
    };
  }

  public async collectMetrics(): Promise<any> {
    // Collect metrics
    return {
      agentName: 'RecapAgent',
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
      lastRecapTriggers: this._recapState.manualTriggers
    };
  }

  // ============================================================================
  // DISCORD POSTING WORKFLOW METHODS
  // ============================================================================

  /**
   * Start monitoring unified_picks table for new submissions
   */
  private async startPicksMonitoring(): Promise<void> {
    this.logger.info('Starting Discord picks monitoring');
    
    // Monitor every 30 seconds for new picks
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.monitorUnifiedPicks();
        await this.postScheduledPicks();
        await this.flagLowTierPicks();
      } catch (error) {
        this.logger.error('Error in picks monitoring cycle', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }, 30000); // 30 seconds
  }

  /**
   * Monitor unified_picks table for new picks ready to post
   */
  public async monitorUnifiedPicks(): Promise<void> {
    try {
      const supabase = this.deps.supabase;
      
      // Get picks ready for live posting
      const { data: livePicks, error: liveError } = await supabase
        .from('unified_picks')
        .select('*')
        .eq('play_status', 'pending')
        .eq('source', 'smart_form_bridge')
        .is('message_id', null) // Not yet posted to Discord
        .lte('created_at', toISOString(new Date()));

      if (liveError) {
        throw liveError;
      }

      if (livePicks && livePicks.length > 0) {
        this.logger.info(`Found ${livePicks.length} live picks - delegating to AlertAgent`);
        
        // ARCHITECTURAL CHANGE: Live picks are now handled by AlertAgent
        // RecapAgent focuses on post-game results and summaries only
        this.logger.info('🔄 Live pick posting delegated to AlertAgent for proper separation of concerns');
        
        // Alert the AlertAgent about live picks (if integrated)
        // For now, AlertAgent will monitor unified_picks table directly
      }

    } catch (error) {
      this.logger.error('Error monitoring final picks', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * @deprecated This method has been moved to AlertAgent for proper separation of concerns
   * RecapAgent now focuses on post-game results and daily summaries only
   * Live pick posting is handled by AlertAgent.postLivePick()
   */
  public async postLivePick(pickData: any): Promise<void> {
    this.logger.warn('⚠️ DEPRECATED: postLivePick called on RecapAgent', {
      pickId: pickData.id,
      message: 'Live pick posting has been moved to AlertAgent for proper architectural separation',
      action: 'Use AlertAgent.postLivePick() instead'
    });
    
    // For backwards compatibility, log the request but don't process
    this.logger.info('🔄 Live pick posting request redirected to AlertAgent', {
      pickId: pickData.id,
      capper: pickData.capper_username,
      tier: pickData.tier
    });
  }

  /**
   * Monitor scheduled picks - ARCHITECTURAL CHANGE: Delegated to AlertAgent
   * @deprecated Scheduled pick posting moved to AlertAgent for proper separation
   */
  public async postScheduledPicks(): Promise<void> {
    this.logger.info('🔄 ARCHITECTURAL CHANGE: Scheduled pick posting delegated to AlertAgent', {
      reason: 'Scheduled posting is alerting functionality, not recap functionality',
      currentAgent: 'RecapAgent',
      correctAgent: 'AlertAgent',
      newResponsibility: 'RecapAgent focuses on post-game results and daily summaries'
    });
    
    // RecapAgent no longer handles pick posting - focus on results and recaps
    return;
  }

  /**
   * Format pick data into Discord embed
   */
  public formatPickEmbed(pickData: any): any {
    const confidenceColor = pickData.tier === 'S-tier' ? 0xFFD700 : // Gold
                           pickData.tier === 'A-tier' ? 0x00FF00 : // Green  
                           pickData.tier === 'B-tier' ? 0xFFFF00 : // Yellow
                           0xFF6B6B; // Red for C-tier and below

    const embed = {
      title: `🎯 ${pickData.sport || 'Sports'} Pick - ${pickData.tier}`,
      description: this.buildPickDescription(pickData),
      color: confidenceColor,
      fields: [
        {
          name: '💰 Units',
          value: `${pickData.stake || 1}U`,
          inline: true
        },
        {
          name: '📊 Confidence',
          value: `${pickData.confidence || 0}/10`,
          inline: true
        },
        {
          name: '⚡ Expected Value',
          value: `${pickData.expected_value || 0}%`,
          inline: true
        },
        {
          name: '👤 Capper',
          value: pickData.capper_username || 'Unknown',
          inline: true
        },
        {
          name: '⏰ Posted',
          value: new Date().toLocaleTimeString(),
          inline: true
        }
      ],
      footer: {
        text: `Unit Talk ${pickData.review_required ? '⚠️ Flagged for Review' : '✅ Approved'}`
      },
      timestamp: toISOString(new Date())
    };

    // Add odds if available
    if (pickData.total_odds) {
      embed.fields.push({
        name: '🎲 Odds',
        value: `${pickData.total_odds > 0 ? '+' : ''}${pickData.total_odds}`,
        inline: true
      });
    }

    return embed;
  }

  /**
   * Route pick to appropriate Discord thread
   */
  public async routeToThread(pickData: any): Promise<string> {
    try {
      // Use thread_id if already determined by SmartFormBridge
      if (pickData.thread_id) {
        return pickData.thread_id;
      }

      // Default routing logic based on sport/capper
      const defaultThreads = {
        'NFL': process.env.NFL_THREAD_ID,
        'NBA': process.env.NBA_THREAD_ID,
        'MLB': process.env.MLB_THREAD_ID,
        'NHL': process.env.NHL_THREAD_ID,
        'NCAAF': process.env.NCAAF_THREAD_ID,
        'default': process.env.GENERAL_PICKS_THREAD_ID
      };

      const sport = pickData.sport?.toUpperCase() || 'default';
      const threadId = defaultThreads[sport as keyof typeof defaultThreads] || defaultThreads.default;

      if (!threadId) {
        throw new Error(`No thread ID configured for sport: ${sport}`);
      }

      return threadId;

    } catch (error) {
      this.logger.error('Error routing to thread', {
        pickId: pickData.id,
        sport: pickData.sport,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Fallback to general picks thread
      return process.env.GENERAL_PICKS_THREAD_ID || '';
    }
  }

  /**
   * Notify VIP users about high-tier picks
   */
  public async notifyVIPUsers(pickData: any): Promise<void> {
    try {
      this.logger.info('VIP notification triggered', {
        pickId: pickData.id,
        tier: pickData.tier,
        capper: pickData.capper_username
      });

      // Get VIP+ users from database
      const supabase = this.deps.supabase;
      const { data: vipUsers, error } = await supabase
        .from('user_profiles')
        .select('discord_id, tier')
        .in('tier', ['vip_plus', 'vip']);

      if (error) {
        throw error;
      }

      if (!vipUsers || vipUsers.length === 0) {
        this.logger.info('No VIP users found for notifications');
        return;
      }

      // Create VIP notification embed
      const vipEmbed = {
        color: pickData.tier === 'S-tier' ? 0xFFD700 : 0x00FF00,
        title: `🔥 ${pickData.tier} Pick Alert`,
        description: `New premium pick available in <#${pickData.thread_id}>`,
        fields: [
          {
            name: '🎯 Pick',
            value: pickData.player_name ? `${pickData.player_name} - ${pickData.market_type}` : 'Premium Pick',
            inline: true
          },
          {
            name: '💰 Units',
            value: `${pickData.stake || 1}U`,
            inline: true
          },
          {
            name: '⚡ Tier',
            value: pickData.tier,
            inline: true
          }
        ],
        footer: {
          text: 'Unit Talk VIP+ Alert'
        },
        timestamp: toISOString(new Date())
      };

      // Import Discord components
      const { Client, GatewayIntentBits } = await import('discord.js');
      
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.GuildMembers
        ]
      });

      const discordToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
      if (!discordToken) {
        throw new Error('Discord token not found for VIP notifications');
      }

      await client.login(discordToken);
      await new Promise((resolve) => {
        if (client.isReady()) {
          resolve(void 0);
        } else {
          client.once('ready', () => resolve(void 0));
        }
      });

      // Send DMs to VIP users
      let notificationsSent = 0;
      for (const vipUser of vipUsers) {
        try {
          const user = await client.users.fetch(vipUser.discord_id);
          if (user) {
            const dmChannel = await user.createDM();
            await dmChannel.send({
              content: `🚨 **${pickData.tier} PICK ALERT** 🚨`,
              embeds: [vipEmbed]
            });
            notificationsSent++;
          }
        } catch (dmError) {
          this.logger.warn('Failed to send VIP DM', {
            userId: vipUser.discord_id,
            tier: vipUser.tier,
            error: dmError instanceof Error ? dmError.message : String(dmError)
          });
        }
      }

      await client.destroy();

      this.logger.info('VIP notifications completed', {
        pickId: pickData.id,
        totalVipUsers: vipUsers.length,
        notificationsSent
      });

    } catch (error) {
      this.logger.error('Error notifying VIP users', {
        pickId: pickData.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Flag low-tier picks for manual review
   */
  public async flagLowTierPicks(): Promise<void> {
    try {
      const supabase = this.deps.supabase;
      
      const { data: lowTierPicks, error } = await supabase
        .from('unified_picks')
        .select('id, tier, capper_username, created_at')
        .eq('source', 'smart_form_bridge')
        .eq('review_required', true)
        .is('review_completed_at', null)
        .gte('created_at', toISOString(new Date(Date.now() - 24 * 60 * 60 * 1000)));

      if (error) throw error;

      if (lowTierPicks && lowTierPicks.length > 0) {
        this.logger.warn(`Found ${lowTierPicks.length} picks flagged for review`, {
          picks: lowTierPicks.map((p: any) => ({
            id: p.id,
            tier: p.tier,
            capper: p.capper_username
          }))
        });

        // Send alert to admin channel
        await this.sendAdminAlert('Low Tier Picks Review Required', {
          count: lowTierPicks.length,
          picks: lowTierPicks,
          timestamp: toISOString(new Date())
        });
      }

    } catch (error) {
      this.logger.error('Error flagging low tier picks', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Build pick description from pick data
   */
  private buildPickDescription(pickData: any): string {
    let description = '';

    if (pickData.player_name && pickData.market_type) {
      description = `**${pickData.player_name}** - ${pickData.market_type}`;
      
      if (pickData.line) {
        description += ` ${pickData.line}`;
      }
    } else if (pickData.legs && Array.isArray(pickData.legs)) {
      // Handle parlay legs
      description = pickData.legs.map((leg: any, index: number) => 
        `**Leg ${index + 1}:** ${leg.player_name || leg.team} - ${leg.market_type || leg.stat_type} ${leg.line || ''}`
      ).join('\n');
    } else {
      description = `**${pickData.capper_username || 'Unknown'}** Pick`;
    }

    return description;
  }

  /**
   * Post to Discord thread via Discord bot integration
   */
  private async _postToDiscordThread(_threadId: string, _embed: any, _pickData: any): Promise<string> {
    try {
      // Import Discord client and ThreadService
      const { Client, GatewayIntentBits } = await import('discord.js');
      const { supabaseClient: _supabaseClient } = await import('../../services/supabaseClient');
      const { DiscordBotService: _DiscordBotService } = await import('../../services/DiscordBotService');
      
      // Initialize Discord client
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent
        ]
      });

      const discordToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
      if (!discordToken) {
        throw new Error('Discord token not found for thread posting');
      }

      // Login and wait for ready
      await client.login(discordToken);
      await new Promise((resolve) => {
        if (client.isReady()) {
          resolve(void 0);
        } else {
          client.once('ready', () => resolve(void 0));
        }
      });

      // Get the thread channel
      const thread = await client.channels.fetch(_threadId);
      if (!thread || !thread.isThread()) {
        throw new Error(`Thread not found or invalid: ${_threadId}`);
      }

      // Post the embed to the thread
      const message = await thread.send({
        content: '🚨 **NEW PICK ALERT** 🚨',
        embeds: [_embed]
      });

      this.logger.info('Successfully posted to Discord thread', {
        threadId: _threadId,
        pickId: _pickData.id,
        messageId: message.id,
        embedTitle: _embed.title
      });

      // Clean up Discord client
      await client.destroy();

      return message.id;

    } catch (error) {
      this.logger.error('Error posting to Discord thread', {
        threadId: _threadId,
        pickId: _pickData.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update pick with Discord posting information
   */
  private async _updatePickWithDiscordInfo(_pickId: string, _threadId: string | null, _status: string, _messageId?: string): Promise<void> {
    try {
      const supabase = this.deps.supabase;
      
      const updateData: any = {
        updated_at: toISOString(new Date()),
        discord_post_status: _status
      };

      if (_threadId) {
        updateData.thread_id = _threadId;
        updateData.message_id = _messageId || `fallback_${Date.now()}`;
      }

      const { error } = await supabase
        .from('unified_picks')
        .update(updateData)
        .eq('id', _pickId);

      if (error) {
        throw error;
      }

      this.logger.info('Updated pick with Discord info', {
        pickId: _pickId,
        threadId: _threadId,
        messageId: _messageId,
        status: _status
      });

    } catch (error) {
      this.logger.error('Error updating pick with Discord info', {
        pickId: _pickId,
        threadId: _threadId,
        status: _status,
        messageId: _messageId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Send alert to admin channel
   */
  private async sendAdminAlert(title: string, details: any): Promise<void> {
    try {
      this.logger.warn(`ADMIN ALERT: ${title}`, details);
      
      const adminChannelId = process.env.SYSTEM_ALERTS_THREAD_ID || process.env.ADMIN_CHANNEL_ID;
      if (!adminChannelId) {
        this.logger.warn('Admin alerts channel not configured');
        return;
      }

      // Create admin alert embed
      const adminEmbed = {
        color: 0xFF6B6B,
        title: `🚨 ${title}`,
        description: '**Alert Details:**',
        fields: [
          {
            name: '📝 Details',
            value: '```json\n' + JSON.stringify(details, null, 2).substring(0, 1000) + '```',
            inline: false
          },
          {
            name: '⏰ Timestamp',
            value: toISOString(new Date()),
            inline: true
          },
          {
            name: '🤖 Source',
            value: 'RecapAgent',
            inline: true
          }
        ],
        footer: {
          text: 'Unit Talk Admin Alert System'
        },
        timestamp: toISOString(new Date())
      };

      // Import Discord client
      const { Client, GatewayIntentBits } = await import('discord.js');
      
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages
        ]
      });

      const discordToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
      if (!discordToken) {
        throw new Error('Discord token not found for admin alerts');
      }

      await client.login(discordToken);
      await new Promise((resolve) => {
        if (client.isReady()) {
          resolve(void 0);
        } else {
          client.once('ready', () => resolve(void 0));
        }
      });

      // Send to admin channel
      const channel = await client.channels.fetch(adminChannelId);
      if (channel && channel.isTextBased() && 'send' in channel) {
        await channel.send({
          content: '🚨 **SYSTEM ALERT** 🚨',
          embeds: [adminEmbed]
        });

        this.logger.info('Admin alert sent successfully', {
          title,
          channelId: adminChannelId
        });
      } else {
        throw new Error(`Admin channel not found or not text-based: ${adminChannelId}`);
      }

      await client.destroy();

    } catch (error) {
      this.logger.error('Error sending admin alert', {
        title,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}