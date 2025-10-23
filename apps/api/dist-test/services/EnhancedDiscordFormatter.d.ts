import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { AlertData, AlertType } from './DiscordAlertRouter';
/**
 * Enhanced Fortune 100-grade Discord message formatter
 * Provides premium visual experience with rich analytics, logos, and insights
 */
export declare class EnhancedDiscordFormatter {
    /**
     * Create enhanced pick embed with premium features
     */
    static createEnhancedPickEmbed(alertData: AlertData, alertType: AlertType): EmbedBuilder;
    /**
     * Enhanced pick post with Fortune 100 analytics
     */
    private static formatEnhancedPickPost;
    /**
     * Enhanced alert formatting with rich context
     */
    private static formatEnhancedAlert;
    /**
     * Get tier emoji for visual hierarchy
     */
    private static getTierEmoji;
    /**
     * Get units emoji for bet sizing
     */
    private static getUnitsEmoji;
    /**
     * Generate confidence bar visualization
     */
    private static getConfidenceBar;
    /**
     * Risk level assessment
     */
    private static getRiskLevel;
    /**
     * Alert title mapping
     */
    private static getAlertTitle;
    /**
     * Alert color mapping
     */
    private static getAlertColor;
    /**
     * Generate chart/graph attachments for advanced analytics
     */
    static generateAnalyticsChart(_alertData: AlertData): Promise<AttachmentBuilder | null>;
    /**
     * Create team logo attachment
     */
    static getTeamLogo(teamName: string): Promise<string | null>;
    /**
     * Create player headshot attachment
     */
    static getPlayerHeadshot(_playerName: string): Promise<string | null>;
}
//# sourceMappingURL=EnhancedDiscordFormatter.d.ts.map