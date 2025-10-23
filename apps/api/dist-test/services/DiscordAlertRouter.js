"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordAlertRouter = void 0;
const discord_js_1 = require("discord.js");
const env_1 = require("../config/env");
const logger_1 = require("../shared/logger");
const DiscordBotService_1 = require("./DiscordBotService");
const EnhancedDiscordFormatter_1 = require("./EnhancedDiscordFormatter");
/**
 * DiscordAlertRouter - Routes different alert types to appropriate Discord channels
 *
 * Channel Routing Strategy:
 * - Individual Pick Posts: Capper dedicated threads
 * - Alert Notifications: Dedicated alerts channel (hedge, middle, injury, steam)
 * - System Errors: System alerts thread
 */
class DiscordAlertRouter {
    /**
     * Route alert to appropriate Discord channel based on alert type
     */
    static async routeAlert(alertType, alertData) {
        const routingLogger = logger_1.logger.child({
            alertType,
            pickId: alertData.pickId,
            capper: alertData.capper
        });
        try {
            const channelId = this.getChannelForAlertType(alertType, alertData);
            if (!channelId) {
                throw new Error(`No channel configured for alert type: ${alertType}`);
            }
            routingLogger.info('Routing alert to Discord channel', {
                channelId,
                alertType
            });
            // Route to appropriate channel
            await this.sendToChannel(channelId, alertData, alertType);
        }
        catch (error) {
            routingLogger.error('Failed to route alert', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            // Fallback to system alerts for routing failures
            await this.sendToSystemAlerts('Alert Routing Failed', {
                alertType,
                error: error instanceof Error ? error.message : String(error),
                originalData: alertData
            });
        }
    }
    /**
     * Determine which Discord channel to use based on alert type
     */
    static getChannelForAlertType(alertType, alertData) {
        switch (alertType) {
            // Alert notifications go to dedicated alerts channel
            case 'hedge_opportunity':
            case 'middle_opportunity':
            case 'injury_impact':
            case 'steam_move':
            case 'line_movement':
            case 'stale_line':
                return env_1.env.alertsChannelId;
            // Individual pick posts go to capper threads
            case 'pick_post':
                return env_1.env.capperThreads[alertData.capper] || null;
            // System issues go to system alerts
            case 'system_error':
            case 'processing_error':
                return env_1.env.systemAlertsThreadId;
            default:
                logger_1.logger.warn('Unknown alert type, defaulting to system alerts', { alertType });
                return env_1.env.systemAlertsThreadId;
        }
    }
    /**
     * Send alert to specific Discord channel
     */
    static async sendToChannel(channelId, alertData, alertType) {
        try {
            // Use enhanced Fortune 100-grade formatter
            const embed = EnhancedDiscordFormatter_1.EnhancedDiscordFormatter.createEnhancedPickEmbed(alertData, alertType);
            // Send via Discord bot service
            await DiscordBotService_1.discordBotService.sendEmbed(channelId, embed);
            logger_1.logger.info('Enhanced Discord alert sent successfully', {
                channelId,
                alertType,
                pickId: alertData.pickId,
                tier: alertData.systemGrade,
                isLive: alertData.isLive
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send enhanced Discord alert', {
                channelId,
                alertType,
                error: error instanceof Error ? error.message : String(error),
                pickId: alertData.pickId
            });
            // Fallback to basic formatting if enhanced fails
            try {
                const basicEmbed = this.createBasicFallbackEmbed(alertData, alertType);
                await DiscordBotService_1.discordBotService.sendEmbed(channelId, basicEmbed);
                logger_1.logger.info('Fallback Discord alert sent successfully', { channelId, alertType });
            }
            catch (fallbackError) {
                logger_1.logger.error('Both enhanced and fallback Discord alerts failed', {
                    channelId,
                    alertType,
                    originalError: error instanceof Error ? error.message : String(error),
                    fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
                });
                throw error;
            }
        }
    }
    /**
     * Create basic fallback embed if enhanced formatting fails
     */
    static createBasicFallbackEmbed(alertData, alertType) {
        return new discord_js_1.EmbedBuilder()
            .setTitle(`${this.getAlertTitle(alertType)} - ${alertData.capper}`)
            .setDescription(`${alertData.sport} • ${alertData.selection} ${alertData.odds}`)
            .setColor(this.getAlertColor(alertType))
            .setTimestamp()
            .addFields([
            { name: 'Units', value: String(alertData.units || 1), inline: true },
            { name: 'Confidence', value: `${alertData.confidence || 0}%`, inline: true },
            { name: 'Grade', value: alertData.systemGrade || 'N/A', inline: true }
        ])
            .setFooter({ text: 'Unit Talk Intelligence System' });
    }
    /**
     * Get alert title based on type
     */
    static getAlertTitle(alertType) {
        const titles = {
            hedge_opportunity: '🔄 Hedge Opportunity',
            middle_opportunity: '🎯 Middle Opportunity',
            injury_impact: '🏥 Injury Alert',
            steam_move: '🚀 Steam Move',
            line_movement: '📈 Line Movement',
            stale_line: '⏰ Stale Line',
            pick_post: '📊 Pick Alert',
            system_error: '🚨 System Error',
            processing_error: '⚠️ Processing Error'
        };
        return titles[alertType] || '📢 Alert';
    }
    /**
     * Get alert color based on type
     */
    static getAlertColor(alertType) {
        const colors = {
            hedge_opportunity: 0x00ff00, // Green
            middle_opportunity: 0xffa500, // Orange  
            injury_impact: 0xff0000, // Red
            steam_move: 0x00bfff, // Blue
            line_movement: 0xffff00, // Yellow
            stale_line: 0x800080, // Purple
            pick_post: 0x0099ff, // Blue
            system_error: 0xff0000, // Red
            processing_error: 0xffa500 // Orange
        };
        return colors[alertType] || 0x808080; // Gray default
    }
    /**
     * Send system alert (fallback for routing failures)
     */
    static async sendToSystemAlerts(title, details) {
        logger_1.logger.error('SYSTEM ALERT', {
            title,
            details,
            alertsChannelId: env_1.env.systemAlertsThreadId
        });
        try {
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`🚨 ${title}`)
                .setDescription('System error detected - requires attention')
                .setColor(0xff0000) // Red for errors
                .setTimestamp()
                .setFooter({ text: 'Unit Talk System Alert' })
                .addFields({
                name: '🔍 Error Details',
                value: `\`\`\`json\n${JSON.stringify(details, null, 2).slice(0, 1000)}\`\`\``,
                inline: false
            });
            await DiscordBotService_1.discordBotService.sendEmbed(env_1.env.systemAlertsThreadId, embed);
        }
        catch (error) {
            logger_1.logger.error('Failed to send system alert to Discord', {
                title,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}
exports.DiscordAlertRouter = DiscordAlertRouter;
