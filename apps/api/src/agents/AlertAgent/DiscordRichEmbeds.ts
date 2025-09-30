import { EmbedBuilder } from 'discord.js';
import { Logger } from '../../shared/logger/types';

// Enhanced alert types with rich embed support
interface EnhancedAlertData {
  type: 'steam' | 'line_movement' | 'injury' | 'hedge' | 'middle' | 'arbitrage' | 'live_ticket' | 'sweat';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  player_name: string;
  stat_type: string;
  sport: string;
  team?: string;
  opponent?: string;
  game_time?: string;
  confidence: number;
  
  // Alert-specific data
  trigger_data: Record<string, any>;
  
  // Financial data
  units?: number;
  potential_payout?: number;
  hedge_amount?: number;
  profit_potential?: number;
  
  // Timing
  time_to_game: number;
  expires_at: string;
}

interface PlayerEnrichmentData {
  headshot_url?: string;
  team_logo_url?: string;
  opponent_logo_url?: string;
  season_stats?: {
    games_played: number;
    avg_stat_value: number;
    hit_rate: number;
    trend: 'up' | 'down' | 'stable';
  };
  injury_status?: {
    status: 'healthy' | 'questionable' | 'doubtful' | 'out';
    injury_type?: string;
    last_update: string;
  };
}

interface HedgeOpportunityEmbed {
  ticket_id: string;
  type: 'full_hedge' | 'middle_opportunity' | 'freeroll';
  player_name: string;
  stat_type: string;
  guaranteed_profit: number;
  hedge_amount_units: number;
  confidence: number;
  execution_window_seconds: number;
  books_available: string[];
  recommended_book: string;
}

interface TicketStateEmbed {
  ticket_id: string;
  ticket_type: 'single' | 'parlay' | 'round_robin';
  state: 'OPEN' | 'LIVE' | 'SWEAT' | 'HEDGE_WINDOW' | 'DONE';
  legs_total: number;
  legs_hit: number;
  legs_pending: number;
  exposure_units: number;
  potential_payout: number;
  cashout_ev_percentage?: number;
}

export class DiscordRichEmbeds {
  private _logger: Logger;
  
  // Color schemes for different alert types
  private readonly ALERT_COLORS = {
    steam: 0xFF0000,        // Red - Urgent steam alerts
    line_movement: 0xFF6600, // Orange - Significant line movement
    injury: 0x800080,       // Purple - Player injury alerts
    hedge: 0x00FF00,        // Green - Hedge opportunities
    middle: 0x00FFFF,       // Cyan - Middle opportunities
    arbitrage: 0xFFD700,    // Gold - Arbitrage opportunities
    live_ticket: 0xFF0000,  // Red - Live ticket alerts
    sweat: 0xFF4500        // Red-orange - Sweat mode alerts
  };

  // Emoji mappings for different contexts
  private readonly EMOJIS = {
    // Alert types
    steam: '🚨',
    line_movement: '📈',
    injury: '🏥',
    hedge: '💰',
    middle: '🎯',
    arbitrage: '⚡',
    live_ticket: '🔴',
    sweat: '😰',
    
    // Sports
    nfl: '🏈',
    nba: '🏀',
    mlb: '⚾',
    nhl: '🏒',
    ncaaf: '🏈',
    ncaab: '🏀',
    
    // Stats
    points: '🏀',
    yards: '🏈',
    touchdowns: '🏈',
    rebounds: '🏀',
    assists: '🏀',
    hits: '⚾',
    saves: '🏒',
    
    // Priority levels
    urgent: '🚨',
    high: '⚡',
    medium: '📊',
    low: '📈',
    
    // Ticket states
    OPEN: '🎫',
    LIVE: '🔴',
    SWEAT: '😰',
    HEDGE_WINDOW: '💰',
    DONE: '✅'
  };

  constructor(logger: Logger) {
    this._logger = logger;
  }

  /**
   * Create enhanced alert embed with player enrichment
   */
  async createEnhancedAlertEmbed(
    alertData: EnhancedAlertData, 
    playerData?: PlayerEnrichmentData,
    advice?: string
  ): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder();
    
    // Set color based on alert type and priority
    embed.setColor(this.ALERT_COLORS[alertData.type] || 0x0099FF);
    
    // Enhanced title with emojis and priority
    const priorityEmoji = this.EMOJIS[alertData.priority] || '📊';
    const typeEmoji = this.EMOJIS[alertData.type] || '📊';
    const sportEmoji = this.EMOJIS[alertData.sport as keyof typeof this.EMOJIS] || '🏈';
    
    embed.setTitle(
      `${priorityEmoji} ${typeEmoji} ${this.formatAlertTypeTitle(alertData.type)} ${sportEmoji}`
    );
    
    // Player headshot thumbnail
    if (playerData?.headshot_url) {
      embed.setThumbnail(playerData.headshot_url);
    }
    
    // Rich description with game context
    const description = this.buildEnhancedDescription(alertData, playerData);
    embed.setDescription(description);
    
    // Main selection field with enhanced formatting
    embed.addFields(
      {
        name: '🎯 Selection',
        value: this.formatSelectionField(alertData, playerData),
        inline: false
      }
    );
    
    // Alert-specific fields
    this.addAlertSpecificFields(embed, alertData);
    
    // Financial information
    if (alertData.units || alertData.potential_payout) {
      embed.addFields({
        name: '💰 Financial Impact',
        value: this.formatFinancialField(alertData),
        inline: true
      });
    }
    
    // Confidence and timing
    embed.addFields(
      {
        name: '📊 Confidence',
        value: this.formatConfidenceField(alertData.confidence),
        inline: true
      },
      {
        name: '⏱️ Timing',
        value: this.formatTimingField(alertData),
        inline: true
      }
    );
    
    // AI Analysis if provided
    if (advice) {
      embed.addFields({
        name: '🧠 AI Analysis',
        value: this.formatAdvice(advice),
        inline: false
      });
    }
    
    // Player stats and context
    if (playerData?.season_stats) {
      embed.addFields({
        name: '📈 Season Context',
        value: this.formatSeasonStats(playerData.season_stats),
        inline: false
      });
    }
    
    // Injury status if relevant
    if (playerData?.injury_status && alertData.type === 'injury') {
      embed.addFields({
        name: '🏥 Injury Status',
        value: this.formatInjuryStatus(playerData.injury_status),
        inline: false
      });
    }
    
    // Team logos in footer
    const footerText = this.buildFooterText(alertData, playerData);
    if (playerData?.team_logo_url) {
      embed.setFooter({ 
        text: footerText,
        iconURL: playerData.team_logo_url
      });
    } else {
      embed.setFooter({ text: footerText });
    }
    
    // Timestamp
    embed.setTimestamp();
    
    return embed;
  }

  /**
   * Create hedge opportunity embed
   */
  async createHedgeOpportunityEmbed(
    hedgeData: HedgeOpportunityEmbed,
    playerData?: PlayerEnrichmentData
  ): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
      .setColor(this.ALERT_COLORS.hedge)
      .setTitle(`💰 ${this.formatHedgeTypeTitle(hedgeData.type)} Opportunity`);
    
    // Player headshot
    if (playerData?.headshot_url) {
      embed.setThumbnail(playerData.headshot_url);
    }
    
    // Description with hedge context
    embed.setDescription(
      `**${hedgeData.player_name}** ${hedgeData.stat_type}\n` +
      `Guaranteed profit opportunity detected for Ticket #${hedgeData.ticket_id.slice(-8)}`
    );
    
    // Hedge details
    embed.addFields(
      {
        name: '🎯 Hedge Details',
        value: 
          `**Player:** ${hedgeData.player_name}\n` +
          `**Market:** ${hedgeData.stat_type}\n` +
          `**Type:** ${hedgeData.type.replace('_', ' ').toUpperCase()}`,
        inline: false
      },
      {
        name: '💰 Profit Analysis',
        value: 
          `**Guaranteed Profit:** ${hedgeData.guaranteed_profit.toFixed(2)} units\n` +
          `**Hedge Amount:** ${hedgeData.hedge_amount_units.toFixed(2)} units\n` +
          `**ROI:** ${((hedgeData.guaranteed_profit / hedgeData.hedge_amount_units) * 100).toFixed(1)}%`,
        inline: true
      },
      {
        name: '⏱️ Execution',
        value: 
          `**Window:** ${Math.floor(hedgeData.execution_window_seconds / 60)}m ${hedgeData.execution_window_seconds % 60}s\n` +
          `**Confidence:** ${this.formatConfidenceField(hedgeData.confidence)}\n` +
          `**Recommended Book:** ${hedgeData.recommended_book}`,
        inline: true
      }
    );
    
    // Available books
    embed.addFields({
      name: '📚 Available Books',
      value: hedgeData.books_available.map(book => `• ${book}`).join('\n'),
      inline: false
    });
    
    // Execution urgency indicator
    const urgency = hedgeData.execution_window_seconds < 300 ? 'URGENT' : 'NORMAL';
    const urgencyEmoji = urgency === 'URGENT' ? '🚨' : '⏰';
    
    embed.addFields({
      name: `${urgencyEmoji} Execution Priority`,
      value: `**${urgency}** - ${urgency === 'URGENT' ? 'Execute immediately!' : 'Execute when ready'}`,
      inline: false
    });
    
    embed.setFooter({ 
      text: 'Unit Talk Hedge Detection Engine • Professional Trading Intelligence' 
    });
    embed.setTimestamp();
    
    return embed;
  }

  /**
   * Create ticket state transition embed
   */
  async createTicketStateEmbed(
    ticketData: TicketStateEmbed,
    fromState?: string,
    trigger?: string
  ): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
      .setColor(this.getStateColor(ticketData.state));
    
    // Title based on state and transition
    if (fromState && fromState !== ticketData.state) {
      embed.setTitle(
        `${this.EMOJIS[ticketData.state]} Ticket State: ${fromState} → ${ticketData.state}`
      );
    } else {
      embed.setTitle(
        `${this.EMOJIS[ticketData.state]} ${ticketData.state} Ticket Alert`
      );
    }
    
    // Ticket overview
    embed.setDescription(
      `**Ticket ID:** #${ticketData.ticket_id.slice(-8)}\n` +
      `**Type:** ${ticketData.ticket_type.toUpperCase()}\n` +
      `**Trigger:** ${trigger || 'Automated'}`
    );
    
    // Leg progress
    const progressBar = this.createProgressBar(ticketData.legs_hit, ticketData.legs_total);
    embed.addFields(
      {
        name: '📊 Leg Progress',
        value: 
          `${progressBar}\n` +
          `**Hit:** ${ticketData.legs_hit}/${ticketData.legs_total} legs\n` +
          `**Pending:** ${ticketData.legs_pending} legs`,
        inline: false
      },
      {
        name: '💰 Financial Status',
        value: 
          `**Exposure:** ${ticketData.exposure_units} units\n` +
          `**Potential Payout:** ${ticketData.potential_payout.toFixed(2)} units\n` +
          `**Multiplier:** ${(ticketData.potential_payout / ticketData.exposure_units).toFixed(2)}x`,
        inline: true
      }
    );
    
    // State-specific information
    if (ticketData.state === 'HEDGE_WINDOW' && ticketData.cashout_ev_percentage) {
      embed.addFields({
        name: '💰 Cashout Analysis',
        value: 
          `**Cashout EV:** ${ticketData.cashout_ev_percentage.toFixed(1)}%\n` +
          `**Status:** ${ticketData.cashout_ev_percentage >= 65 ? '✅ HEDGE RECOMMENDED' : '⏳ MONITORING'}\n` +
          `**Action:** Consider hedge opportunities`,
        inline: true
      });
    }
    
    // State-specific advice
    embed.addFields({
      name: '🎯 Recommended Action',
      value: this.getStateAdvice(ticketData.state),
      inline: false
    });
    
    embed.setFooter({ 
      text: 'Unit Talk State Management • Real-time Ticket Tracking' 
    });
    embed.setTimestamp();
    
    return embed;
  }

  /**
   * Create batch alert summary embed
   */
  async createBatchAlertEmbed(
    alerts: EnhancedAlertData[],
    title: string = 'Alert Summary'
  ): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
      .setTitle(`📋 ${title}`)
      .setColor(0x0099FF)
      .setTimestamp();
    
    if (alerts.length === 0) {
      embed.setDescription('No alerts at this time.');
      return embed;
    }
    
    // Group alerts by type
    const alertsByType = this.groupAlertsByType(alerts);
    
    for (const [type, typeAlerts] of Object.entries(alertsByType)) {
      const emoji = this.EMOJIS[type as keyof typeof this.EMOJIS] || '📊';
      const summaries = typeAlerts.slice(0, 5).map(alert => 
        `• **${alert.player_name}** ${alert.stat_type} (${this.formatConfidenceField(alert.confidence)})`
      ).join('\n');
      
      embed.addFields({
        name: `${emoji} ${this.formatAlertTypeTitle(type)} (${typeAlerts.length})`,
        value: summaries + (typeAlerts.length > 5 ? `\n...and ${typeAlerts.length - 5} more` : ''),
        inline: false
      });
    }
    
    // Summary statistics
    const totalAlerts = alerts.length;
    const urgentAlerts = alerts.filter(a => a.priority === 'urgent').length;
    const highAlerts = alerts.filter(a => a.priority === 'high').length;
    
    embed.addFields({
      name: '📊 Alert Summary',
      value: 
        `**Total Alerts:** ${totalAlerts}\n` +
        `**Urgent:** ${urgentAlerts}\n` +
        `**High Priority:** ${highAlerts}`,
      inline: true
    });
    
    embed.setFooter({ 
      text: `Generated ${new Date().toLocaleString()} • Unit Talk Alert System` 
    });
    
    return embed;
  }

  // Helper Methods

  /**
   * Build enhanced description with game context
   */
  private buildEnhancedDescription(
    alertData: EnhancedAlertData, 
    playerData?: PlayerEnrichmentData
  ): string {
    let description = `**${alertData.player_name}** • ${alertData.stat_type}`;
    
    if (alertData.team && alertData.opponent) {
      description += `\n🏟️ **${alertData.team}** vs **${alertData.opponent}**`;
    }
    
    if (alertData.game_time) {
      const gameTime = new Date(alertData.game_time);
      description += `\n⏰ ${gameTime.toLocaleString()}`;
    }
    
    // Add injury context if relevant
    if (playerData?.injury_status && playerData.injury_status.status !== 'healthy') {
      const statusEmoji = this.getInjuryEmoji(playerData.injury_status.status);
      description += `\n${statusEmoji} **${playerData.injury_status.status.toUpperCase()}**`;
    }
    
    return description;
  }

  /**
   * Format selection field with enhanced information
   */
  private formatSelectionField(
    alertData: EnhancedAlertData, 
    playerData?: PlayerEnrichmentData
  ): string {
    let field = `**${alertData.player_name}**\n${alertData.stat_type}`;
    
    // Add line and odds if available
    if (alertData.trigger_data.line) {
      field += `\n**Line:** ${alertData.trigger_data.line}`;
    }
    
    if (alertData.trigger_data.odds) {
      const odds = alertData.trigger_data.odds;
      field += `\n**Odds:** ${odds > 0 ? '+' : ''}${odds}`;
    }
    
    // Add season average if available
    if (playerData?.season_stats?.avg_stat_value) {
      field += `\n**Season Avg:** ${playerData.season_stats.avg_stat_value.toFixed(1)}`;
    }
    
    return field;
  }

  /**
   * Add alert-specific fields based on type
   */
  private addAlertSpecificFields(embed: EmbedBuilder, alertData: EnhancedAlertData): void {
    switch (alertData.type) {
      case 'steam':
        embed.addFields({
          name: '🚨 Steam Movement',
          value: this.formatSteamField(alertData.trigger_data),
          inline: true
        });
        break;
        
      case 'line_movement':
        embed.addFields({
          name: '📈 Line Movement',
          value: this.formatLineMovementField(alertData.trigger_data),
          inline: true
        });
        break;
        
      case 'injury':
        embed.addFields({
          name: '🏥 Injury Alert',
          value: this.formatInjuryField(alertData.trigger_data),
          inline: true
        });
        break;
        
      case 'arbitrage':
        embed.addFields({
          name: '⚡ Arbitrage Opportunity',
          value: this.formatArbitrageField(alertData.trigger_data),
          inline: true
        });
        break;
    }
  }

  /**
   * Format steam movement field
   */
  private formatSteamField(triggerData: any): string {
    const lineMovement = triggerData.line_movement || 0;
    const oddsMovement = triggerData.odds_movement || 0;
    const direction = lineMovement > 0 ? '📈' : '📉';
    
    return (
      `${direction} **Line:** ${lineMovement > 0 ? '+' : ''}${lineMovement.toFixed(1)}\n` +
      `${direction} **Odds:** ${oddsMovement > 0 ? '+' : ''}${oddsMovement}\n` +
      `🔥 **Sharp Money Detected**`
    );
  }

  /**
   * Format line movement field
   */
  private formatLineMovementField(triggerData: any): string {
    const movement = triggerData.line_movement || 0;
    const direction = movement > 0 ? '📈' : '📉';
    const publicPct = triggerData.public_percentage || 0;
    
    return (
      `${direction} **Movement:** ${movement > 0 ? '+' : ''}${movement.toFixed(1)}\n` +
      `👥 **Public:** ${publicPct.toFixed(0)}%\n` +
      `⚡ **Significance:** ${Math.abs(movement) > 1 ? 'HIGH' : 'MEDIUM'}`
    );
  }

  /**
   * Format injury field
   */
  private formatInjuryField(triggerData: any): string {
    const status = triggerData.injury_status || 'Unknown';
    const type = triggerData.injury_type || 'Unspecified';
    const emoji = this.getInjuryEmoji(status);
    
    return (
      `${emoji} **Status:** ${status.toUpperCase()}\n` +
      `🏥 **Type:** ${type}\n` +
      `⏰ **Updated:** Recently`
    );
  }

  /**
   * Format arbitrage field
   */
  private formatArbitrageField(triggerData: any): string {
    const profit = triggerData.profit_percentage || 0;
    const bookA = triggerData.book_a || 'Book A';
    const bookB = triggerData.book_b || 'Book B';
    
    return (
      `💰 **Profit:** ${(profit * 100).toFixed(1)}%\n` +
      `📚 **Books:** ${bookA} / ${bookB}\n` +
      `⚡ **Execution:** IMMEDIATE`
    );
  }

  /**
   * Format financial field
   */
  private formatFinancialField(alertData: EnhancedAlertData): string {
    let field = '';
    
    if (alertData.units) {
      field += `**Units:** ${alertData.units}\n`;
    }
    
    if (alertData.potential_payout) {
      field += `**Payout:** ${alertData.potential_payout.toFixed(2)} units\n`;
    }
    
    if (alertData.profit_potential) {
      field += `**Profit:** +${alertData.profit_potential.toFixed(2)} units`;
    }
    
    return field || 'N/A';
  }

  /**
   * Format confidence field with visual indicators
   */
  private formatConfidenceField(confidence: number): string {
    const percentage = Math.round(confidence * 100);
    const stars = '★'.repeat(Math.floor(confidence * 5));
    const emptyStars = '☆'.repeat(5 - Math.floor(confidence * 5));
    
    return `${stars}${emptyStars} ${percentage}%`;
  }

  /**
   * Format timing field
   */
  private formatTimingField(alertData: EnhancedAlertData): string {
    const timeToGame = alertData.time_to_game;
    const expires = new Date(alertData.expires_at);
    
    let field = '';
    
    if (timeToGame) {
      if (timeToGame < 60) {
        field += `🔴 **Game:** ${timeToGame}m\n`;
      } else {
        const hours = Math.floor(timeToGame / 60);
        const minutes = timeToGame % 60;
        field += `⏰ **Game:** ${hours}h ${minutes}m\n`;
      }
    }
    
    const expiresIn = Math.floor((expires.getTime() - Date.now()) / 60000);
    field += `⏱️ **Expires:** ${expiresIn}m`;
    
    return field;
  }

  /**
   * Format advice text
   */
  private formatAdvice(advice: string): string {
    // Extract recommendation and reasoning if structured
    const match = advice.match(/^(HOLD|HEDGE|FADE|TAKE):\s*(.+)$/i);
    if (match) {
      const [, recommendation, reasoning] = match;
      return `**${recommendation.toUpperCase()}**\n${reasoning}`;
    }
    return advice;
  }

  /**
   * Format season stats
   */
  private formatSeasonStats(stats: any): string {
    const trend = stats.trend === 'up' ? '📈' : stats.trend === 'down' ? '📉' : '➡️';
    
    return (
      `**Games:** ${stats.games_played}\n` +
      `**Average:** ${stats.avg_stat_value.toFixed(1)}\n` +
      `**Hit Rate:** ${(stats.hit_rate * 100).toFixed(0)}%\n` +
      `**Trend:** ${trend} ${stats.trend.toUpperCase()}`
    );
  }

  /**
   * Format injury status
   */
  private formatInjuryStatus(injury: any): string {
    const emoji = this.getInjuryEmoji(injury.status);
    const updated = new Date(injury.last_update).toLocaleDateString();
    
    return (
      `${emoji} **${injury.status.toUpperCase()}**\n` +
      `${injury.injury_type ? `🏥 ${injury.injury_type}\n` : ''}` +
      `📅 Updated: ${updated}`
    );
  }

  /**
   * Build footer text
   */
  private buildFooterText(alertData: EnhancedAlertData, _playerData?: PlayerEnrichmentData): string {
    let footer = 'Unit Talk Pro Alert System';
    
    if (alertData.team) {
      footer += ` • ${alertData.team}`;
      if (alertData.opponent) {
        footer += ` vs ${alertData.opponent}`;
      }
    }
    
    return footer;
  }

  /**
   * Format alert type title
   */
  private formatAlertTypeTitle(type: string): string {
    const titles: { [key: string]: string } = {
      steam: 'STEAM ALERT',
      line_movement: 'LINE MOVEMENT',
      injury: 'INJURY ALERT',
      hedge: 'HEDGE OPPORTUNITY',
      middle: 'MIDDLE OPPORTUNITY',
      arbitrage: 'ARBITRAGE ALERT',
      live_ticket: 'LIVE TICKET',
      sweat: 'SWEAT MODE'
    };
    
    return titles[type] || type.toUpperCase();
  }

  /**
   * Format hedge type title
   */
  private formatHedgeTypeTitle(type: string): string {
    const titles: { [key: string]: string } = {
      full_hedge: 'FULL HEDGE',
      middle_opportunity: 'MIDDLE',
      freeroll: 'FREEROLL'
    };
    
    return titles[type] || type.replace('_', ' ').toUpperCase();
  }

  /**
   * Get color for ticket state
   */
  private getStateColor(state: string): number {
    const colors: { [key: string]: number } = {
      OPEN: 0x808080,      // Gray
      LIVE: 0xFF0000,      // Red
      SWEAT: 0xFF4500,     // Red-orange
      HEDGE_WINDOW: 0x00FF00, // Green
      DONE: 0x0000FF       // Blue
    };
    
    return colors[state] || 0x0099FF;
  }

  /**
   * Get injury emoji
   */
  private getInjuryEmoji(status: string): string {
    const emojis: { [key: string]: string } = {
      healthy: '✅',
      questionable: '⚠️',
      doubtful: '❌',
      out: '🚫'
    };
    
    return emojis[status] || '❓';
  }

  /**
   * Create progress bar for ticket legs
   */
  private createProgressBar(hit: number, total: number): string {
    const percentage = total > 0 ? hit / total : 0;
    const filled = Math.floor(percentage * 10);
    const empty = 10 - filled;
    
    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${hit}/${total}`;
  }

  /**
   * Get state-specific advice
   */
  private getStateAdvice(state: string): string {
    const advice: { [key: string]: string } = {
      OPEN: '⏳ **Monitor** - Ticket is queued and waiting for game start',
      LIVE: '🔴 **Watch Closely** - Games are live, monitor for line movement',
      SWEAT: '😰 **Sweat Mode** - Last leg in progress, consider hedge options',
      HEDGE_WINDOW: '💰 **Hedge Now** - Optimal hedge window is open',
      DONE: '✅ **Complete** - Ticket has been settled'
    };
    
    return advice[state] || '📊 Monitor ticket status';
  }

  /**
   * Group alerts by type for batch display
   */
  private groupAlertsByType(alerts: EnhancedAlertData[]): { [key: string]: EnhancedAlertData[] } {
    return alerts.reduce((groups, alert) => {
      if (!groups[alert.type]) {
        groups[alert.type] = [];
      }
      groups[alert.type].push(alert);
      return groups;
    }, {} as { [key: string]: EnhancedAlertData[] });
  }
}