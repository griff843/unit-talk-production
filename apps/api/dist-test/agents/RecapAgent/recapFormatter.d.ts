import { EmbedBuilder } from 'discord.js';
import { RecapSummary, ParlayGroup, MicroRecapData, RecapConfig } from '../../types/picks';
/**
 * Enhanced RecapFormatter with production-ready features
 * Handles Discord embed generation with configurable features
 */
export declare class RecapFormatter {
    private config;
    constructor(config?: Partial<RecapConfig>);
    /**
     * Build daily recap embed with enhanced features
     */
    buildDailyRecapEmbed(summary: RecapSummary, parlayGroups?: ParlayGroup[]): EmbedBuilder;
    /**
     * Build weekly recap embed
     */
    buildWeeklyRecapEmbed(summary: RecapSummary): EmbedBuilder;
    /**
     * Build monthly recap embed
     */
    buildMonthlyRecapEmbed(summary: RecapSummary): EmbedBuilder;
    /**
     * Build micro-recap embed for is_instant notifications
     */
    buildMicroRecapEmbed(microData: MicroRecapData): EmbedBuilder;
    private buildSoloPicksText;
    private buildParlayText;
    private buildCapperBreakdownText;
    private buildWeeklyCapperText;
    private buildHotStreaksText;
    private buildTierBreakdownText;
    private buildWeeklyHighlights;
    private buildMonthlyHighlights;
    private getSoloStats;
    private getSoloWinRate;
    private getParlayStats;
    private getParlayWinRate;
    private formatPick;
    private formatDate;
    private getLegendFooter;
    getConfig(): RecapConfig;
    updateConfig(newConfig: Partial<RecapConfig>): void;
}
//# sourceMappingURL=recapFormatter.d.ts.map