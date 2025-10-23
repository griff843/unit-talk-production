import { EmbedBuilder } from 'discord.js';
import { UnifiedPick } from '../../types/picks';
interface ParlayLeg extends UnifiedPick {
    headshot_url?: string;
}
/**
 * Get player headshot URL based on sport and player ID/name
 */
export declare function getPlayerHeadshotUrl(sport: string, playerId?: string, playerName?: string): string | null;
/**
 * Calculate parlay odds from individual leg odds
 */
export declare function calculateParlayOdds(odds: number[]): number;
/**
 * Build Discord embed for parlay picks
 *
 * @param picks - Array of picks in the parlay
 * @param advice - AI-generated advice for the parlay
 * @param options - Display options for the embed
 */
export declare function buildParlayAlertEmbed(picks: ParlayLeg[], advice: string, _options?: {
    showHeadshots?: boolean;
    headshotStrategy?: 'first' | 'collage' | 'none';
}): EmbedBuilder;
/**
 * Alternative strategy: Create a simple text-based player list with emojis
 * This could be used instead of or in addition to headshots for parlays
 */
export declare function formatParlayPlayerList(picks: ParlayLeg[]): string;
export {};
//# sourceMappingURL=parlayEmbedBuilder.d.ts.map