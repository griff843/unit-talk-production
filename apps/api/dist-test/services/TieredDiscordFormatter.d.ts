import { EmbedBuilder } from 'discord.js';
import { AlertData, AlertType } from './DiscordAlertRouter';
/**
 * Tiered Discord formatting system for different subscription levels
 * Creates distinct user experiences while maintaining aspirational upgrade path
 */
export declare class TieredDiscordFormatter {
    /**
     * Create tier-appropriate embed based on user's subscription level
     */
    static createTieredEmbed(alertData: AlertData, alertType: AlertType, userTier: UserTier): EmbedBuilder;
    /**
     * Free Tier - Basic functionality with upgrade hints
     */
    private static createFreeEmbed;
    /**
     * VIP Tier - Enhanced features that feel premium without overwhelming
     */
    private static createVIPEmbed;
    /**
     * VIP+ Tier - Advanced intelligence without full professional suite
     */
    private static createVIPPlusEmbed;
    /**
     * Black Label Tier - Full Fortune 100 professional experience
     */
    private static createBlackLabelEmbed;
    /**
     * Tier-specific color schemes
     */
    private static getVIPTierColor;
    private static getVIPPlusTierColor;
    /**
     * Tier-specific emoji systems
     */
    private static getVIPTierEmoji;
    private static getVIPPlusTierEmoji;
    /**
     * Shared utility methods
     */
    private static getUnitsEmoji;
    private static getConfidenceBar;
    private static getRiskLevel;
}
export type UserTier = 'free' | 'vip' | 'vip_plus' | 'black_label' | 'capper';
//# sourceMappingURL=TieredDiscordFormatter.d.ts.map