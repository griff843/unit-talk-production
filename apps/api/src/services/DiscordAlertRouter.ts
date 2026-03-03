import { EmbedBuilder } from 'discord.js';

import { env } from '../config/env';
import { autopilotGuard } from '../lib/AutopilotGuard';
import { logger } from '../shared/logger';

import { discordBotService } from './DiscordBotService';
import { EnhancedDiscordFormatter } from './EnhancedDiscordFormatter';

/**
 * DiscordAlertRouter - Routes different alert types to appropriate Discord channels
 * Phase 6.5: All alerts MUST go through AutopilotGuard
 *
 * Channel Routing Strategy:
 * - Individual Pick Posts: Capper dedicated threads
 * - Alert Notifications: Dedicated alerts channel (hedge, middle, injury, steam)
 * - System Errors: System alerts thread
 */
export class DiscordAlertRouter {
  /**
   * Route alert to appropriate Discord channel based on alert type
   * Phase 6.5: AutopilotGuard is the sole authority for all Discord side effects
   */
  static async routeAlert(alertType: AlertType, alertData: AlertData): Promise<void> {
    const routingLogger = logger.child({
      alertType,
      pickId: alertData.pickId,
      capper: alertData.capper,
    });

    // Phase 6.5: AutopilotGuard is the SOLE authority for side effects
    const guardAction = alertType === 'pick_post' ? 'DISCORD_POST' : 'DISCORD_ALERT';
    const guardResult = await autopilotGuard.assertMayPerformSideEffect({
      action: guardAction,
      agent_name: 'DiscordAlertRouter',
      pick_id: alertData.pickId,
      metadata: { alertType, capper: alertData.capper, sport: alertData.sport },
    });

    if (!guardResult.allowed) {
      routingLogger.info('Alert blocked by AutopilotGuard', {
        reason: guardResult.reason,
        mode: guardResult.mode,
        decision: guardResult.decision,
      });
      return;
    }

    try {
      const channelId = this.getChannelForAlertType(alertType, alertData);

      if (!channelId) {
        throw new Error(`No channel configured for alert type: ${alertType}`);
      }

      routingLogger.info('Routing alert to Discord channel', {
        channelId,
        alertType,
      });

      // Route to appropriate channel
      await this.sendToChannel(channelId, alertData, alertType);
    } catch (error) {
      routingLogger.error('Failed to route alert', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Fallback to system alerts for routing failures
      await this.sendToSystemAlerts('Alert Routing Failed', {
        alertType,
        error: error instanceof Error ? error.message : String(error),
        originalData: alertData,
      });
    }
  }

  /**
   * Determine which Discord channel to use based on alert type
   */
  private static getChannelForAlertType(alertType: AlertType, alertData: AlertData): string | null {
    switch (alertType) {
      // Alert notifications go to dedicated alerts channel
      case 'hedge_opportunity':
      case 'middle_opportunity':
      case 'injury_impact':
      case 'steam_move':
      case 'line_movement':
      case 'stale_line':
        return env.alertsChannelId;

      // Individual pick posts go to capper threads
      case 'pick_post':
        return (env.capperThreads as any)[alertData.capper] || null;

      // System issues go to system alerts
      case 'system_error':
      case 'processing_error':
        return env.systemAlertsThreadId;

      default:
        logger.warn('Unknown alert type, defaulting to system alerts', { alertType });
        return env.systemAlertsThreadId;
    }
  }

  /**
   * Send alert to specific Discord channel
   */
  private static async sendToChannel(
    channelId: string,
    alertData: AlertData,
    alertType: AlertType
  ): Promise<void> {
    try {
      // Use enhanced Fortune 100-grade formatter
      const embed = EnhancedDiscordFormatter.createEnhancedPickEmbed(alertData, alertType);

      // Send via Discord bot service
      await discordBotService.sendEmbed(channelId, embed);

      logger.info('Enhanced Discord alert sent successfully', {
        channelId,
        alertType,
        pickId: alertData.pickId,
        tier: alertData.systemGrade,
        isLive: alertData.isLive,
      });
    } catch (error) {
      logger.error('Failed to send enhanced Discord alert', {
        channelId,
        alertType,
        error: error instanceof Error ? error.message : String(error),
        pickId: alertData.pickId,
      });

      // Fallback to basic formatting if enhanced fails
      try {
        const basicEmbed = this.createBasicFallbackEmbed(alertData, alertType);
        await discordBotService.sendEmbed(channelId, basicEmbed);
        logger.info('Fallback Discord alert sent successfully', { channelId, alertType });
      } catch (fallbackError) {
        logger.error('Both enhanced and fallback Discord alerts failed', {
          channelId,
          alertType,
          originalError: error instanceof Error ? error.message : String(error),
          fallbackError:
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        });
        throw error;
      }
    }
  }

  /**
   * Create basic fallback embed if enhanced formatting fails
   */
  private static createBasicFallbackEmbed(
    alertData: AlertData,
    alertType: AlertType
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`${this.getAlertTitle(alertType)} - ${alertData.capper}`)
      .setDescription(`${alertData.sport} • ${alertData.selection} ${alertData.odds}`)
      .setColor(this.getAlertColor(alertType))
      .setTimestamp()
      .addFields([
        { name: 'Units', value: String(alertData.units || 1), inline: true },
        { name: 'Confidence', value: `${alertData.confidence || 0}%`, inline: true },
        { name: 'Grade', value: alertData.systemGrade || 'N/A', inline: true },
      ])
      .setFooter({ text: 'Unit Talk Intelligence System' });
  }

  /**
   * Get alert title based on type
   */
  private static getAlertTitle(alertType: AlertType): string {
    const titles = {
      hedge_opportunity: '🔄 Hedge Opportunity',
      middle_opportunity: '🎯 Middle Opportunity',
      injury_impact: '🏥 Injury Alert',
      steam_move: '🚀 Steam Move',
      line_movement: '📈 Line Movement',
      stale_line: '⏰ Stale Line',
      pick_post: '📊 Pick Alert',
      system_error: '🚨 System Error',
      processing_error: '⚠️ Processing Error',
    };

    return titles[alertType] || '📢 Alert';
  }

  /**
   * Get alert color based on type
   */
  private static getAlertColor(alertType: AlertType): number {
    const colors = {
      hedge_opportunity: 0x00ff00, // Green
      middle_opportunity: 0xffa500, // Orange
      injury_impact: 0xff0000, // Red
      steam_move: 0x00bfff, // Blue
      line_movement: 0xffff00, // Yellow
      stale_line: 0x800080, // Purple
      pick_post: 0x0099ff, // Blue
      system_error: 0xff0000, // Red
      processing_error: 0xffa500, // Orange
    };

    return colors[alertType] || 0x808080; // Gray default
  }

  /**
   * Send system alert (fallback for routing failures)
   */
  private static async sendToSystemAlerts(title: string, details: any): Promise<void> {
    logger.error('SYSTEM ALERT', {
      title,
      details,
      alertsChannelId: env.systemAlertsThreadId,
    });

    try {
      const embed = new EmbedBuilder()
        .setTitle(`🚨 ${title}`)
        .setDescription('System error detected - requires attention')
        .setColor(0xff0000) // Red for errors
        .setTimestamp()
        .setFooter({ text: 'Unit Talk System Alert' })
        .addFields({
          name: '🔍 Error Details',
          value: `\`\`\`json\n${JSON.stringify(details, null, 2).slice(0, 1000)}\`\`\``,
          inline: false,
        });

      await discordBotService.sendEmbed(env.systemAlertsThreadId, embed);
    } catch (error) {
      logger.error('Failed to send system alert to Discord', {
        title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Type definitions
export type AlertType =
  | 'hedge_opportunity'
  | 'middle_opportunity'
  | 'injury_impact'
  | 'steam_move'
  | 'line_movement'
  | 'stale_line'
  | 'pick_post'
  | 'system_error'
  | 'processing_error';

export interface AlertData {
  pickId: string;
  capper: string;
  sport: string;
  selection: string;
  odds: string;
  units?: number;
  confidence?: number;
  systemGrade?: string;
  pickType?: string;
  isLive?: boolean;

  // Alert-specific data
  hedgeDetails?: string;
  expectedProfit?: string;
  middleSetup?: string;
  potentialWin?: string;
  injuryDetails?: string;
  impact?: string;
  steamDetails?: string;

  // Additional context
  timestamp?: string;
  metadata?: Record<string, any>;
}
