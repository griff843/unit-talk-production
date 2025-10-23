/**
 * ScheduledPickProcessor - Handles daily 10 AM EST batch posting
 *
 * Responsibilities:
 * - Query approved picks scheduled for posting
 * - Post picks to individual capper Discord threads
 * - Mark picks as posted to prevent duplicates
 * - Handle live picks for immediate posting
 * - Generate admin summary reports
 */
export declare class ScheduledPickProcessor {
    private supabase;
    constructor();
    /**
     * Main batch processing method - called by scheduler at 10 AM EST
     */
    processDailyBatch(): Promise<void>;
    /**
     * Process live picks immediately
     */
    processLivePick(pickId: string): Promise<void>;
    /**
     * Get picks scheduled for posting
     */
    private getScheduledPicks;
    /**
     * Get individual pick by ID
     */
    private getPickById;
    /**
     * Process individual pick - post to Discord and update status
     */
    private processIndividualPick;
    /**
     * Mark pick as posted in database
     */
    private markPickAsPosted;
    /**
     * Send admin summary of batch processing
     */
    private sendAdminSummary;
    /**
     * Send error alert to system alerts channel
     */
    private sendErrorAlert;
    /**
     * Send message to system alerts channel
     * TODO: Integrate with Discord bot
     */
    private sendToSystemAlerts;
}
//# sourceMappingURL=ScheduledPickProcessor.d.ts.map