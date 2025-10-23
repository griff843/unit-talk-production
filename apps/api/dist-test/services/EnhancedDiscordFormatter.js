"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedDiscordFormatter = void 0;
const discord_js_1 = require("discord.js");
/**
 * Enhanced Fortune 100-grade Discord message formatter
 * Provides premium visual experience with rich analytics, logos, and insights
 */
class EnhancedDiscordFormatter {
    /**
     * Create enhanced pick embed with premium features
     */
    static createEnhancedPickEmbed(alertData, alertType) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTimestamp()
            .setFooter({
            text: 'Unit Talk Intelligence System • Fortune 100 Analytics',
            iconURL: 'https://cdn.discordapp.com/attachments/your-cdn/unit-talk-logo.png'
        });
        // Set color based on tier and live status
        const colors = {
            'S-tier': alertData.isLive ? 0xFF0000 : 0xFFD700, // Red for live, Gold for S-tier
            'A-tier': alertData.isLive ? 0xFF4500 : 0x00FF00, // OrangeRed for live, Green for A-tier
            'B-tier': alertData.isLive ? 0xFF6347 : 0x1E90FF, // Tomato for live, Blue for B-tier
            'C-tier': alertData.isLive ? 0xFF69B4 : 0x9370DB, // Hot pink for live, Purple for C-tier
        };
        const tierColor = colors[alertData.systemGrade] || 0x808080;
        embed.setColor(tierColor);
        if (alertType === 'pick_post') {
            return this.formatEnhancedPickPost(embed, alertData);
        }
        else {
            return this.formatEnhancedAlert(embed, alertData, alertType);
        }
    }
    /**
     * Enhanced pick post with Fortune 100 analytics
     */
    static formatEnhancedPickPost(embed, alertData) {
        const isLive = alertData.isLive;
        const liveIndicator = isLive ? '🔴 **LIVE**' : '';
        embed
            .setTitle(`${liveIndicator} ${this.getTierEmoji(alertData.systemGrade)} ${alertData.pickType?.toUpperCase()} PICK`)
            .setDescription(`**${alertData.capper}** • ${alertData.sport}${isLive ? ' • **LIVE BETTING**' : ''}`);
        // Main selection with enhanced formatting
        embed.addFields({
            name: '🎯 Selection',
            value: `**${alertData.selection}** \`${alertData.odds}\``,
            inline: false
        });
        // Core metrics in premium layout
        embed.addFields([
            {
                name: '💎 System Grade',
                value: `${this.getTierEmoji(alertData.systemGrade)} **${alertData.systemGrade}**`,
                inline: true
            },
            {
                name: '🎲 Units',
                value: `**${alertData.units}** ${this.getUnitsEmoji(alertData.units || 1)}`,
                inline: true
            },
            {
                name: '📊 Confidence',
                value: `**${alertData.confidence}%** ${this.getConfidenceBar(alertData.confidence || 0)}`,
                inline: true
            }
        ]);
        // Enhanced analytics section (if available in metadata)
        if (alertData.metadata?.analysis) {
            embed.addFields({
                name: '🧠 AI Analysis',
                value: `${alertData.metadata.analysis}`,
                inline: false
            });
        }
        // Add advanced metrics if available
        if (alertData.metadata?.edgeScore) {
            embed.addFields([
                {
                    name: '⚡ Edge Score',
                    value: `**${alertData.metadata.edgeScore}%**`,
                    inline: true
                },
                {
                    name: '🎯 Expected Value',
                    value: `**+${alertData.metadata.expectedValue || 'N/A'}%**`,
                    inline: true
                },
                {
                    name: '📈 Kelly %',
                    value: `**${alertData.metadata.kellyFraction || 'N/A'}%**`,
                    inline: true
                }
            ]);
        }
        // Risk assessment
        if (alertData.metadata?.riskScore) {
            const riskLevel = this.getRiskLevel(alertData.metadata.riskScore);
            embed.addFields({
                name: '⚠️ Risk Assessment',
                value: `${riskLevel.emoji} **${riskLevel.label}** Risk (${alertData.metadata.riskScore}/10)`,
                inline: false
            });
        }
        return embed;
    }
    /**
     * Enhanced alert formatting with rich context
     */
    static formatEnhancedAlert(embed, alertData, alertType) {
        switch (alertType) {
            case 'hedge_opportunity':
                return embed
                    .setTitle('🔄 **HEDGE OPPORTUNITY DETECTED**')
                    .setDescription(`**${alertData.capper}** • ${alertData.sport} • ${this.getTierEmoji(alertData.systemGrade)} **${alertData.systemGrade}**`)
                    .addFields([
                    {
                        name: '🎯 Original Position',
                        value: `**${alertData.selection}** \`${alertData.odds}\` • ${alertData.units} units`,
                        inline: false
                    },
                    {
                        name: '🔄 Hedge Setup',
                        value: alertData.hedgeDetails || 'Arbitrage opportunity detected',
                        inline: false
                    },
                    {
                        name: '💰 Guaranteed Profit',
                        value: `${alertData.expectedProfit || 'Profit calculation available'}`,
                        inline: false
                    },
                    {
                        name: '⏰ Action Required',
                        value: '**Move quickly** - hedge opportunities close fast!',
                        inline: false
                    }
                ])
                    .setColor(0x00FF00);
            case 'injury_impact':
                return embed
                    .setTitle('🏥 **INJURY IMPACT ALERT**')
                    .setDescription(`**${alertData.capper}** • ${alertData.sport} • High Impact Detected`)
                    .addFields([
                    {
                        name: '🎯 Affected Pick',
                        value: `**${alertData.selection}** \`${alertData.odds}\` • ${alertData.units} units • ${this.getTierEmoji(alertData.systemGrade)} ${alertData.systemGrade}`,
                        inline: false
                    },
                    {
                        name: '⚠️ Injury Report',
                        value: alertData.injuryDetails || 'Significant player status change detected',
                        inline: false
                    },
                    {
                        name: '📊 Impact Analysis',
                        value: alertData.impact || 'Analyzing impact on pick probability...',
                        inline: false
                    },
                    {
                        name: '🎯 Recommendation',
                        value: '**Monitor closely** - Consider position adjustment if status confirmed',
                        inline: false
                    }
                ])
                    .setColor(0xFF0000);
            case 'steam_move':
                return embed
                    .setTitle('🚀 **STEAM MOVE DETECTED**')
                    .setDescription(`**${alertData.capper}** • ${alertData.sport} • Sharp Money Alert`)
                    .addFields([
                    {
                        name: '🎯 Target Pick',
                        value: `**${alertData.selection}** \`${alertData.odds}\` • ${alertData.units} units • ${this.getTierEmoji(alertData.systemGrade)} ${alertData.systemGrade}`,
                        inline: false
                    },
                    {
                        name: '📊 Sharp Action Detected',
                        value: alertData.steamDetails || 'Coordinated professional betting activity detected',
                        inline: false
                    },
                    {
                        name: '⚡ Market Intelligence',
                        value: '**Professional syndicates** moving significant volume on this line',
                        inline: false
                    },
                    {
                        name: '🎯 Action Window',
                        value: '**ACT IMMEDIATELY** - Steam moves create narrow windows of opportunity',
                        inline: false
                    }
                ])
                    .setColor(0x00BFFF);
            case 'middle_opportunity':
                return embed
                    .setTitle('🎯 **MIDDLE OPPORTUNITY DETECTED**')
                    .setDescription(`**${alertData.capper}** • ${alertData.sport} • Win-Win Scenario`)
                    .addFields([
                    {
                        name: '🎲 Middle Setup',
                        value: alertData.middleSetup || 'Both sides of spread available for middle',
                        inline: false
                    },
                    {
                        name: '💵 Win Scenario',
                        value: alertData.potentialWin || 'Potential to win both bets',
                        inline: false
                    },
                    {
                        name: '📊 Probability Analysis',
                        value: 'Calculating optimal bet sizing for maximum expected value...',
                        inline: false
                    }
                ])
                    .setColor(0xFFA500);
            default:
                return embed
                    .setTitle(this.getAlertTitle(alertType))
                    .setDescription(`**${alertData.capper}** • ${alertData.sport}`)
                    .setColor(this.getAlertColor(alertType));
        }
    }
    /**
     * Get tier emoji for visual hierarchy
     */
    static getTierEmoji(tier) {
        const emojis = {
            'S-tier': '👑',
            'A-tier': '💎',
            'B-tier': '🔥',
            'C-tier': '⭐',
            'D-tier': '📊'
        };
        return emojis[tier] || '📊';
    }
    /**
     * Get units emoji for bet sizing
     */
    static getUnitsEmoji(units) {
        if (units >= 5) {
            return '🚀';
        }
        if (units >= 3) {
            return '💪';
        }
        if (units >= 2) {
            return '👍';
        }
        return '📝';
    }
    /**
     * Generate confidence bar visualization
     */
    static getConfidenceBar(confidence) {
        const bars = Math.floor(confidence / 10);
        const filled = '█'.repeat(Math.min(bars, 10));
        const empty = '░'.repeat(10 - Math.min(bars, 10));
        return `\`${filled}${empty}\``;
    }
    /**
     * Risk level assessment
     */
    static getRiskLevel(riskScore) {
        if (riskScore <= 3) {
            return { emoji: '🟢', label: 'Low' };
        }
        if (riskScore <= 6) {
            return { emoji: '🟡', label: 'Moderate' };
        }
        if (riskScore <= 8) {
            return { emoji: '🟠', label: 'High' };
        }
        return { emoji: '🔴', label: 'Very High' };
    }
    /**
     * Alert title mapping
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
     * Alert color mapping
     */
    static getAlertColor(alertType) {
        const colors = {
            hedge_opportunity: 0x00FF00, // Green
            middle_opportunity: 0xFFA500, // Orange  
            injury_impact: 0xFF0000, // Red
            steam_move: 0x00BFFF, // Blue
            line_movement: 0xFFFF00, // Yellow
            stale_line: 0x800080, // Purple
            pick_post: 0x0099FF, // Blue
            system_error: 0xFF0000, // Red
            processing_error: 0xFFA500 // Orange
        };
        return colors[alertType] || 0x808080;
    }
    /**
     * Generate chart/graph attachments for advanced analytics
     */
    static async generateAnalyticsChart(_alertData) {
        // TODO: Implement chart generation using Chart.js or similar
        // This would generate confidence trends, risk breakdowns, etc.
        return null;
    }
    /**
     * Create team logo attachment
     */
    static async getTeamLogo(teamName) {
        // TODO: Implement team logo lookup
        // Integration with ESPN API, team logo databases, or local assets
        const logoMappings = {
            'Lakers': 'https://cdn.nba.com/logos/nba/1610612747/global/L/logo.svg',
            'Celtics': 'https://cdn.nba.com/logos/nba/1610612738/global/L/logo.svg',
            'Chiefs': 'https://static.www.nfl.com/league/api/clubs/logos/KC.svg',
            'Yankees': 'https://www.mlbstatic.com/team-logos/147.svg',
            // Add more teams as needed
        };
        return logoMappings[teamName] || null;
    }
    /**
     * Create player headshot attachment
     */
    static async getPlayerHeadshot(_playerName) {
        // TODO: Implement player headshot lookup
        // Integration with sports APIs or headshot databases
        return null;
    }
}
exports.EnhancedDiscordFormatter = EnhancedDiscordFormatter;
