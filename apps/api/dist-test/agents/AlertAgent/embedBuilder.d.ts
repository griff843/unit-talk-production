import { EmbedBuilder } from 'discord.js';
import { UnifiedPick } from '../../types/picks';
export declare function buildAlertEmbed(pick: UnifiedPick, advice: string, playerImageUrl?: string): EmbedBuilder;
export { getPlayerHeadshotUrl } from './parlayEmbedBuilder';
export declare function buildBatchAlertEmbed(picks: UnifiedPick[], title?: string): EmbedBuilder;
//# sourceMappingURL=embedBuilder.d.ts.map