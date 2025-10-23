/**
 * Utility functions for recap formatting and calculations
 */
/**
 * Format units with proper decimal places and sign
 */
export declare function formatUnits(units: number): string;
/**
 * Format ROI as percentage
 */
export declare function formatROI(roi: number): string;
/**
 * Format win rate as percentage
 */
export declare function formatWinRate(winRate: number): string;
/**
 * Get streak emoji based on streak length
 */
export declare function getStreakEmoji(wins: number, losses: number): string;
/**
 * Get tier emoji
 */
export declare function getTierEmoji(tier: string): string;
/**
 * Get outcome emoji
 */
export declare function getOutcomeEmoji(outcome?: string): string;
/**
 * Calculate hot streak level and emoji
 */
export declare function calculateHotStreakEmoji(streakLength: number): string;
/**
 * Format odds display
 */
export declare function formatOdds(odds: number): string;
/**
 * Calculate implied probability from odds
 */
export declare function calculateImpliedProbability(odds: number): number;
/**
 * Format market type for display
 */
export declare function formatMarketType(marketType: string): string;
/**
 * Get capper display name
 */
export declare function getCapperDisplayName(capper: string): string;
/**
 * Calculate streak type and length from recent picks
 */
export declare function calculateStreak(picks: any[]): {
    type: 'win' | 'loss' | 'none';
    length: number;
};
/**
 * Format pick description for display
 */
export declare function formatPickDescription(pick: any): string;
/**
 * Calculate parlay odds from individual picks
 */
export declare function calculateParlayOdds(picks: any[]): number;
/**
 * Format parlay odds for display
 */
export declare function formatParlayOdds(totalOdds: number): string;
/**
 * Get date range label
 */
export declare function getDateRangeLabel(startDate: string, endDate: string, type: 'daily' | 'weekly' | 'monthly'): string;
/**
 * Calculate profit in dollars (assuming $100 per unit)
 */
export declare function calculateProfitDollars(netUnits: number, unitValue?: number): string;
/**
 * Get performance color based on units
 */
export declare function getPerformanceColor(netUnits: number): number;
/**
 * Truncate text to fit Discord embed limits
 */
export declare function truncateText(text: string, maxLength?: number): string;
/**
 * Group picks by parlay ID
 */
export declare function groupPicksByParlay(picks: any[]): Map<string, any[]>;
/**
 * Calculate win rate with proper handling of pushes
 */
export declare function calculateWinRate(wins: number, losses: number): number;
/**
 * Calculate ROI
 */
export declare function calculateROI(netUnits: number, totalUnits: number): number;
/**
 * Format large numbers with commas
 */
export declare function formatNumber(num: number): string;
/**
 * Get time period label
 */
export declare function getTimePeriodLabel(type: 'daily' | 'weekly' | 'monthly', date: string): string;
/**
 * Validate pick data
 */
export declare function validatePickData(pick: any): boolean;
/**
 * Sort cappers by performance
 */
export declare function sortCappersByPerformance(cappers: any[]): any[];
/**
 * Get medal emoji for rankings
 */
export declare function getMedalEmoji(position: number): string;
/**
 * Calculate average edge professional_score
 */
export declare function calculateAverageEdge(picks: any[]): number;
//# sourceMappingURL=recapUtils.d.ts.map