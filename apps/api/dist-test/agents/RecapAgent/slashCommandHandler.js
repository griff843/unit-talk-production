"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlashCommandHandler = void 0;
const discord_js_1 = require("discord.js");
const picks_1 = require("../../types/picks");
/**
 * SlashCommandHandler - Handles Discord slash commands for on-demand recaps
 * Supports /recap command with various options
 */
class SlashCommandHandler {
    // Remove unused commands property
    // private commands: Map<string, any> = new Map();
    constructor(recapAgent, logger) {
        this.recapAgent = recapAgent;
        this.logger = logger;
        this.setupCommands();
    }
    /**
     * Initialize slash command handler
     */
    async initialize() {
        try {
            // Register slash commands with Discord
            await this.registerCommands();
            this.logger.info('Slash command handler initialized successfully');
        }
        catch (error) {
            throw new picks_1.RecapError({
                code: 'SLASH_INIT_FAILED',
                message: `Failed to initialize slash commands: ${error}`,
                timestamp: new Date().toISOString(),
                severity: 'medium'
            });
        }
    }
    /**
     * Handle incoming slash command
     */
    async handleCommand(options) {
        try {
            const { period, date, capper, format } = options;
            switch (period) {
                case 'daily':
                    return await this.handleDailyRecap(date, capper, format);
                case 'weekly':
                    return await this.handleWeeklyRecap(date, capper, format);
                case 'monthly':
                    return await this.handleMonthlyRecap(date, capper, format);
                default:
                    throw new Error(`Invalid period: ${period}`);
            }
        }
        catch (error) {
            throw new picks_1.RecapError({
                code: 'SLASH_COMMAND_FAILED',
                message: `Slash command failed: ${error}`,
                timestamp: new Date().toISOString(),
                context: { ...options },
                severity: 'medium'
            });
        }
    }
    /**
     * Handle daily recap slash command
     */
    async handleDailyRecap(date, capper, format) {
        const targetDate = date || new Date().toISOString().split('T')[0];
        const summary = await this.recapAgent.getRecapService().getDailyRecapData(targetDate);
        if (!summary) {
            return this.createErrorEmbed(`No data found for ${targetDate}`);
        }
        // Filter by capper if specified
        if (capper) {
            summary.capperBreakdown = summary.capperBreakdown.filter((c) => c.capper.toLowerCase().includes(capper.toLowerCase()));
        }
        const parlayGroups = await this.recapAgent.getRecapService().getParlayGroups(targetDate);
        if (format === 'summary') {
            return this.createSummaryEmbed(summary, 'daily');
        }
        return this.recapAgent.getRecapFormatter().buildDailyRecapEmbed(summary, parlayGroups);
    }
    /**
     * Handle weekly recap slash command
     */
    async handleWeeklyRecap(date, capper, format) {
        // Calculate week range
        const now = date ? new Date(date) : new Date();
        const dayOfWeek = now.getDay();
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek + 1);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        const summary = await this.recapAgent.getRecapService().getWeeklyRecapData(startDateStr, endDateStr);
        if (!summary) {
            return this.createErrorEmbed(`No data found for week of ${startDateStr}`);
        }
        // Filter by capper if specified
        if (capper) {
            summary.capperBreakdown = summary.capperBreakdown.filter((c) => c.capper.toLowerCase().includes(capper.toLowerCase()));
        }
        // const parlayGroups = await this.recapAgent.getRecapService().getParlayGroups(startDateStr, endDateStr);
        if (format === 'summary') {
            return this.createSummaryEmbed(summary, 'weekly');
        }
        return this.recapAgent.getRecapFormatter().buildWeeklyRecapEmbed(summary);
    }
    /**
     * Handle monthly recap slash command
     */
    async handleMonthlyRecap(date, capper, format) {
        // Calculate month range
        const now = date ? new Date(date) : new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        const summary = await this.recapAgent.getRecapService().getMonthlyRecapData(startDateStr, endDateStr);
        if (!summary) {
            return this.createErrorEmbed(`No data found for month of ${startDateStr}`);
        }
        // Filter by capper if specified
        if (capper) {
            summary.capperBreakdown = summary.capperBreakdown.filter((c) => c.capper.toLowerCase().includes(capper.toLowerCase()));
        }
        // const parlayGroups = await this.recapAgent.getRecapService().getParlayGroups(startDateStr, endDateStr);
        if (format === 'summary') {
            return this.createSummaryEmbed(summary, 'monthly');
        }
        return this.recapAgent.getRecapFormatter().buildMonthlyRecapEmbed(summary);
    }
    /**
     * Create summary embed for quick overview
     */
    createSummaryEmbed(summary, period) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`📊 ${period.toUpperCase()} RECAP SUMMARY`)
            .setColor(summary.netUnits >= 0 ? 0x00ff00 : 0xff0000)
            .setTimestamp();
        const unitsText = summary.netUnits >= 0 ? `+${summary.netUnits.toFixed(1)}U` : `${summary.netUnits.toFixed(1)}U`;
        embed.addFields({
            name: '📈 Performance',
            value: `**Record:** ${summary.wins}W-${summary.losses}L\n` +
                `**Net Units:** ${unitsText}\n` +
                `**ROI:** ${summary.roi.toFixed(1)}%\n` +
                `**Win Rate:** ${summary.winRate.toFixed(1)}%`,
            inline: true
        });
        if (summary.capperBreakdown.length > 0) {
            const topCapper = summary.capperBreakdown[0];
            if (topCapper) {
                embed.addFields({
                    name: '👑 Top Capper',
                    value: `**${topCapper.capper}**\n` +
                        `${topCapper.wins}W-${topCapper.losses}L\n` +
                        `${topCapper.netUnits > 0 ? '+' : ''}${topCapper.netUnits.toFixed(1)}U`,
                    inline: true
                });
            }
        }
        return embed;
    }
    /**
     * Create error embed for error cases
     */
    createErrorEmbed(message) {
        return new discord_js_1.EmbedBuilder()
            .setTitle('❌ Recap Error')
            .setDescription(message)
            .setColor(0xff0000)
            .setTimestamp();
    }
    /**
     * Setup slash commands
     */
    setupCommands() {
        // Implement command setup logic
    }
    /**
     * Register slash commands with Discord
     */
    async registerCommands() {
        // Implement command registration logic
    }
}
exports.SlashCommandHandler = SlashCommandHandler;
