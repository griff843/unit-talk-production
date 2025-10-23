import { EmbedBuilder } from 'discord.js';
import { Logger } from '../../shared/logger/types';
import { SlashCommandOptions } from '../../types/picks';
import { RecapAgent } from './index';
/**
 * SlashCommandHandler - Handles Discord slash commands for on-demand recaps
 * Supports /recap command with various options
 */
export declare class SlashCommandHandler {
    private recapAgent;
    private logger;
    constructor(recapAgent: RecapAgent, logger: Logger);
    /**
     * Initialize slash command handler
     */
    initialize(): Promise<void>;
    /**
     * Handle incoming slash command
     */
    handleCommand(options: SlashCommandOptions): Promise<EmbedBuilder>;
    /**
     * Handle daily recap slash command
     */
    private handleDailyRecap;
    /**
     * Handle weekly recap slash command
     */
    private handleWeeklyRecap;
    /**
     * Handle monthly recap slash command
     */
    private handleMonthlyRecap;
    /**
     * Create summary embed for quick overview
     */
    private createSummaryEmbed;
    /**
     * Create error embed for error cases
     */
    private createErrorEmbed;
    /**
     * Setup slash commands
     */
    private setupCommands;
    /**
     * Register slash commands with Discord
     */
    private registerCommands;
}
//# sourceMappingURL=slashCommandHandler.d.ts.map