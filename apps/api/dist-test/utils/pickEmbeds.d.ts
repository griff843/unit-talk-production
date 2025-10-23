import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { DailyPick, CapperProfile } from '../db/types/capper';
export interface PickEmbedOptions {
    showAnalysis?: boolean;
    showButtons?: boolean;
    isPreview?: boolean;
    showStats?: boolean;
}
/**
 * Creates a Discord embed for a single pick or parlay
 */
export declare function createPickEmbed(pick: DailyPick, capper?: CapperProfile, options?: PickEmbedOptions): EmbedBuilder;
/**
 * Creates action row with buttons for pick interactions
 */
export declare function createPickButtons(pickId: string, isPreview?: boolean): ActionRowBuilder<ButtonBuilder>;
/**
 * Creates a summary embed for multiple picks (daily publishing)
 */
export declare function createDailyPicksSummaryEmbed(picks: DailyPick[], capper: CapperProfile, date: string): EmbedBuilder;
/**
 * Creates an embed for pick selection (edit/delete commands)
 */
export declare function createPickSelectionEmbed(picks: DailyPick[], action: 'edit' | 'delete'): EmbedBuilder;
/**
 * Creates buttons for pick selection
 */
export declare function createPickSelectionButtons(picks: DailyPick[], action: 'edit' | 'delete'): ActionRowBuilder<ButtonBuilder>[];
//# sourceMappingURL=pickEmbeds.d.ts.map