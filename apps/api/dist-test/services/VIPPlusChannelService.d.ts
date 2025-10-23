/**
 * VIPPlusChannelService - Manages all VIP+ exclusive channel content
 *
 * Channels:
 * - exclusive-insights: Advanced pick analysis (S/A-tier only)
 * - trader-insights: Market movement and sharp money tracking
 * - best-bets: Daily curated top picks compilation
 * - game-threads: Live game discussion and betting opportunities
 * - strategy-room: AI coaching and advanced strategies
 */
export declare class VIPPlusChannelService {
    private supabase;
    private discordBot;
    private readonly channels;
    constructor();
    /**
     * Post advanced analytics to exclusive-insights (S/A-tier picks only)
     */
    postExclusiveAnalysis(pick: any, insights: any, correlationId: string): Promise<void>;
    /**
     * Post market movement analysis to trader-insights
     */
    postMarketMovement(marketData: any, correlationId: string): Promise<void>;
    /**
     * Post daily curated picks to best-bets
     */
    postDailyBestBets(picks: any[], correlationId: string): Promise<void>;
    /**
     * Route pick content to existing game threads (FIXED IMPLEMENTATION)
     * This routes capper picks to the correct game discussion threads
     */
    routeToGameThread(pick: any, threadId: string, correlationId: string): Promise<void>;
    /**
     * Create sport-specific pick embeds that match actual games
     */
    private createPickEmbed;
    /**
     * Post per-period live updates to game threads (YOUR BRAINSTORMED IDEA)
     */
    postPerPeriodUpdate(gameId: string, threadId: string, updateData: any, correlationId: string): Promise<void>;
    /**
     * Handle user-requested AI coaching (FIXED - Personal, not public)
     * Responds to user requests based on their submitted picks and results
     */
    handleUserCoachingRequest(userId: string, userPicks: any[], correlationId: string): Promise<void>;
    /**
     * Post trivia with rewards (YOUR BRAINSTORMED IDEA)
     */
    postGameTrivia(gameId: string, threadId: string, triviaData: any, correlationId: string): Promise<void>;
    /**
     * Helper methods
     */
    private getRiskLevel;
    private generateLineMovement;
    private generateReverseLineAnalysis;
    /**
     * Helper methods for sport-specific content
     */
    private getSportEmoji;
    private getPeriodName;
    private generatePeriodStats;
    private analyzePickImpact;
    private analyzeUserPerformance;
    private findBestSport;
    private calculateAverageUnits;
    private generatePersonalRecommendations;
    private storeTriviaQuestion;
    /**
     * Post live game updates to VIP+ channels
     */
    postLiveGameUpdate(gameData: any, correlationId: string): Promise<void>;
    /**
     * Post AI coaching recommendations to VIP+ members
     */
    postAICoaching(coachingData: any, correlationId: string): Promise<void>;
    /**
     * Test all VIP+ channels with sample content
     */
    runTestPosts(correlationId: string): Promise<void>;
}
//# sourceMappingURL=VIPPlusChannelService.d.ts.map