"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TieredDiscordFormatter = void 0;
const discord_js_1 = require("discord.js");
/**
 * Tiered Discord formatting system for different subscription levels
 * Creates distinct user experiences while maintaining aspirational upgrade path
 */
class TieredDiscordFormatter {
    /**
     * Create tier-appropriate embed based on user's subscription level
     */
    static createTieredEmbed(alertData, alertType, userTier) {
        switch (userTier) {
            case 'free':
                return this.createFreeEmbed(alertData, alertType);
            case 'vip':
                return this.createVIPEmbed(alertData, alertType);
            case 'vip_plus':
                return this.createVIPPlusEmbed(alertData, alertType);
            case 'black_label':
                return this.createBlackLabelEmbed(alertData, alertType);
            default:
                return this.createFreeEmbed(alertData, alertType);
        }
    }
    /**
     * Free Tier - Basic functionality with upgrade hints
     */
    static createFreeEmbed(alertData, alertType) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTimestamp()
            .setFooter({ text: 'Unit Talk • Upgrade to VIP for enhanced analytics' })
            .setColor(0x808080); // Gray for free tier
        if (alertType === 'pick_post') {
            embed
                .setTitle(`📊 ${alertData.pickType?.toUpperCase()} PICK`)
                .setDescription(`**${alertData.capper}** • ${alertData.sport}`)
                .addFields([
                {
                    name: '🎯 Selection',
                    value: `**${alertData.selection}** \`${alertData.odds}\``,
                    inline: false
                },
                {
                    name: '💰 Details',
                    value: [
                        `**Units:** ${alertData.units}`,
                        `**Confidence:** ${alertData.confidence}%`,
                        `**Grade:** ${alertData.systemGrade}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '⬆️ Upgrade for More',
                    value: 'VIP members see detailed analytics, AI insights, and risk assessment!',
                    inline: true
                }
            ]);
        }
        return embed;
    }
    /**
     * VIP Tier - Enhanced features that feel premium without overwhelming
     */
    static createVIPEmbed(alertData, alertType) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTimestamp()
            .setFooter({
            text: 'Unit Talk VIP • Unlock AI coaching with VIP+',
            iconURL: 'https://cdn.discordapp.com/attachments/your-cdn/vip-badge.png'
        });
        // VIP tier colors - elevated but not premium
        const tierColor = this.getVIPTierColor(alertData.systemGrade);
        embed.setColor(tierColor);
        if (alertType === 'pick_post') {
            embed
                .setTitle(`${this.getVIPTierEmoji(alertData.systemGrade)} ${alertData.pickType?.toUpperCase()} PICK`)
                .setDescription(`**${alertData.capper}** • ${alertData.sport}${alertData.isLive ? ' • 🔴 **LIVE**' : ''}`);
            // Core selection
            embed.addFields({
                name: '🎯 Selection',
                value: `**${alertData.selection}** \`${alertData.odds}\``,
                inline: false
            });
            // Enhanced VIP metrics
            embed.addFields([
                {
                    name: '💎 System Grade',
                    value: `${this.getVIPTierEmoji(alertData.systemGrade)} **${alertData.systemGrade}**`,
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
            // VIP-level analysis (basic AI insight)
            if (alertData.metadata?.analysis) {
                const basicAnalysis = alertData.metadata.analysis.split('.')[0] + '.'; // First sentence only
                embed.addFields({
                    name: '🧠 Quick Analysis',
                    value: basicAnalysis,
                    inline: false
                });
            }
            // Risk indicator for VIP
            if (alertData.metadata?.riskScore) {
                const riskLevel = this.getRiskLevel(alertData.metadata.riskScore);
                embed.addFields({
                    name: '⚠️ Risk Level',
                    value: `${riskLevel.emoji} **${riskLevel.label}**`,
                    inline: true
                });
            }
            // Upgrade hint for VIP+ features
            embed.addFields({
                name: '⬆️ VIP+ Features',
                value: 'Edge scores • Kelly fractions • Advanced AI analysis',
                inline: true
            });
        }
        return embed;
    }
    /**
     * VIP+ Tier - Advanced intelligence without full professional suite
     */
    static createVIPPlusEmbed(alertData, alertType) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTimestamp()
            .setFooter({
            text: 'Unit Talk VIP+ • AI-Powered Intelligence',
            iconURL: 'https://cdn.discordapp.com/attachments/your-cdn/vip-plus-badge.png'
        });
        // VIP+ premium colors
        const tierColor = this.getVIPPlusTierColor(alertData.systemGrade, alertData.isLive);
        embed.setColor(tierColor);
        if (alertType === 'pick_post') {
            const liveIndicator = alertData.isLive ? '🔴 **LIVE** ' : '';
            embed
                .setTitle(`${liveIndicator}${this.getVIPPlusTierEmoji(alertData.systemGrade)} ${alertData.pickType?.toUpperCase()} PICK`)
                .setDescription(`**${alertData.capper}** • ${alertData.sport}${alertData.isLive ? ' • **LIVE BETTING**' : ''}`);
            // Main selection
            embed.addFields({
                name: '🎯 Selection',
                value: `**${alertData.selection}** \`${alertData.odds}\``,
                inline: false
            });
            // VIP+ core metrics
            embed.addFields([
                {
                    name: '💎 System Grade',
                    value: `${this.getVIPPlusTierEmoji(alertData.systemGrade)} **${alertData.systemGrade}**`,
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
            // VIP+ advanced analytics
            if (alertData.metadata?.edgeScore || alertData.metadata?.expectedValue) {
                embed.addFields([
                    {
                        name: '⚡ Edge Score',
                        value: `**${alertData.metadata.edgeScore || 'N/A'}%**`,
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
            // Enhanced AI analysis for VIP+
            if (alertData.metadata?.analysis) {
                embed.addFields({
                    name: '🧠 AI Analysis',
                    value: alertData.metadata.analysis,
                    inline: false
                });
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
            // Black Label teaser
            embed.addFields({
                name: '🖤 Black Label Preview',
                value: 'Portfolio impact • Scenario analysis • Professional intelligence',
                inline: false
            });
        }
        return embed;
    }
    /**
     * Black Label Tier - Full Fortune 100 professional experience
     */
    static createBlackLabelEmbed(alertData, alertType) {
        // Use the existing EnhancedDiscordFormatter for Black Label
        const { EnhancedDiscordFormatter } = require('./EnhancedDiscordFormatter');
        return EnhancedDiscordFormatter.createEnhancedPickEmbed(alertData, alertType);
    }
    /**
     * Tier-specific color schemes
     */
    static getVIPTierColor(tier) {
        const colors = {
            'S-tier': 0xC0C0C0, // Silver for VIP S-tier
            'A-tier': 0x32CD32, // Lime green
            'B-tier': 0x4169E1, // Royal blue
            'C-tier': 0x9370DB // Medium purple
        };
        return colors[tier] || 0x808080;
    }
    static getVIPPlusTierColor(tier, isLive) {
        if (isLive) {
            return tier === 'S-tier' ? 0xFF4500 : 0xFF6347; // Orange red for live
        }
        const colors = {
            'S-tier': 0xFFD700, // Gold for VIP+ S-tier
            'A-tier': 0x00FF7F, // Spring green
            'B-tier': 0x1E90FF, // Dodger blue
            'C-tier': 0xBA55D3 // Medium orchid
        };
        return colors[tier] || 0x808080;
    }
    /**
     * Tier-specific emoji systems
     */
    static getVIPTierEmoji(tier) {
        const emojis = {
            'S-tier': '⭐', // Star for VIP
            'A-tier': '💎',
            'B-tier': '🔥',
            'C-tier': '📊'
        };
        return emojis[tier] || '📊';
    }
    static getVIPPlusTierEmoji(tier) {
        const emojis = {
            'S-tier': '🌟', // Glowing star for VIP+
            'A-tier': '💎',
            'B-tier': '🔥',
            'C-tier': '⭐'
        };
        return emojis[tier] || '📊';
    }
    /**
     * Shared utility methods
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
    static getConfidenceBar(confidence) {
        const bars = Math.floor(confidence / 10);
        const filled = '█'.repeat(Math.min(bars, 10));
        const empty = '░'.repeat(10 - Math.min(bars, 10));
        return `\`${filled}${empty}\``;
    }
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
}
exports.TieredDiscordFormatter = TieredDiscordFormatter;
