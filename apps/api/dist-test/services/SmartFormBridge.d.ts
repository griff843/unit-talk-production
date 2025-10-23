/**
 * SmartFormBridge - Integrates smart form submissions with main platform
 *
 * Responsibilities:
 * - Transform smart_tickets to platform format
 * - Auto-approve capper submissions
 * - Route live picks vs scheduled picks
 * - Generate post-submission insights
 * - Track system-wide data for AI training
 */
export declare class SmartFormBridge {
    private supabase;
    private scoringAgent;
    private bridgeLogger;
    constructor();
    /**
     * Main entry point - processes new smart form submission
     */
    processSubmission(ticketId: string): Promise<void>;
    /**
     * Get smart ticket from database
     */
    private getSmartTicket;
    /**
     * Get capper thread ID from environment configuration
     */
    private getCapperThreadId;
    /**
     * Determine routing target: game thread vs capper thread
     * Routes to game thread if game-specific discussion, capper thread if general pick
     */
    private determineRoutingTarget;
    /**
     * Extract game information from smart ticket
     */
    private extractGameInfo;
    /**
     * Find existing game thread for this game OR create new one
     * ENHANCED: Auto-creates game threads when picks are submitted
     */
    private findGameThread;
    /**
     * Create new game thread for pick submission
     * AUTO-CREATES threads when new games detected from picks
     */
    private createGameThread;
    /**
     * Transform smart ticket to platform daily_picks format
     * Maps to actual database schema columns, not the Pick interface
     */
    private transformToPlatformFormat;
    /**
     * Generate system insights for the submission
     */
    private generateInsights;
    /**
     * Store daily pick to database
     */
    private storeDailyPick;
    /**
     * Store insights for system tracking and AI training
     */
    private storeInsights;
    /**
     * Process live pick - immediate Discord posting
     */
    private processLivePick;
    /**
     * Schedule pick for 10 AM batch posting
     */
    private scheduleForBatchPosting;
    /**
     * Update smart ticket status with insights
     */
    private updateSmartTicketStatus;
    /**
     * Process smart form picks through professional grading system (per Sharp Grading Rules)
     * Replaces auto-promotion bypass with complete professional analysis
     */
    private processThroughProfessionalGrading;
    /**
     * Validate compliance with Sharp Grading Rules (NON_NEGOTIABLE_SHARP_GRADING_RULES.md)
     */
    private validateSharpGradingCompliance;
    /**
     * Promote pick using professional results instead of basic insights
     */
    private promoteWithProfessionalResults;
    /**
     * Mark pick for manual review when professional grading fails
     */
    private markForManualReview;
    /**
     * Promote high-quality picks to unified_picks table for AlertAgent processing
     */
    private promoteToUnifiedPicks;
    /**
     * Send alert to system alerts Discord channel
     */
    private sendSystemAlert;
}
//# sourceMappingURL=SmartFormBridge.d.ts.map