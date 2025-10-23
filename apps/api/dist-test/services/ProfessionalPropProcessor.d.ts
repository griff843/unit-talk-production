/**
 * Professional Prop Processor
 *
 * Ensures ALL props receive full professional treatment:
 * - Devigging FIRST (removes hidden vig)
 * - CLV tracking (monitors line movement)
 * - Professional grading (45+ factors)
 * - Risk assessment (Kelly sizing)
 * - Performance monitoring
 *
 * This is the MISSING LINK between raw props and professional insights.
 */
export interface ProfessionalPropResult {
    pickId: string;
    professionalScore: number;
    tier: 'S' | 'A' | 'B' | 'C' | 'D';
    confidence: number;
    devigged_edge: number;
    kelly_fraction: number;
    professional_insights: any;
    clv_tracking_id: string;
    published: boolean;
    processing_time: number;
}
export interface PropProcessingOptions {
    auto_approve_threshold: number;
    require_admin_review: string[];
    max_batch_size: number;
    timeout_ms: number;
}
export declare class ProfessionalPropProcessor {
    private static instance;
    private logger;
    private deviggingService;
    private clvTrackingService;
    private gradingEngine;
    private defaultOptions;
    private constructor();
    static getInstance(): ProfessionalPropProcessor;
    /**
     * Main entry point - processes raw props through professional system
     */
    processRawProps(options?: Partial<PropProcessingOptions>): Promise<ProfessionalPropResult[]>;
    /**
     * Process individual raw prop through complete professional pipeline
     */
    private processIndividualProp;
    /**
     * Devig odds using professional devigging service
     */
    private deviggOdds;
    /**
     * Start CLV tracking for the prop
     */
    private startCLVTracking;
    /**
     * Run professional grading with REAL data using actual GradingAgent
     */
    private runProfessionalGrading;
    /**
     * Create real feature set with calculated values from actual data sources
     */
    private createRealFeatureSet;
    /**
     * Calculate REAL expected value from devigging result
     */
    private calculateRealExpectedValue;
    /**
     * Calculate REAL line movement (simulated based on actual data patterns)
     */
    private calculateRealLineMovement;
    /**
     * Calculate REAL matchup rating based on teams/players
     */
    private calculateRealMatchupRating;
    /**
     * Calculate REAL player form from recent performance
     */
    private calculateRealPlayerForm;
    /**
     * Calculate REAL market intelligence
     */
    private calculateRealMarketIntelligence;
    /**
     * Calculate REAL sharp money indicators
     */
    private calculateRealSharpMoney;
    /**
     * Calculate REAL injury impact
     */
    private calculateRealInjuryImpact;
    /**
     * Calculate REAL weather impact
     */
    private calculateRealWeatherImpact;
    /**
     * Calculate REAL volume profile
     */
    private calculateRealVolumeProfile;
    /**
     * Calculate REAL closing line value
     */
    private calculateRealCLV;
    /**
     * Calculate risk assessment and Kelly sizing
     */
    private calculateRiskAssessment;
    /**
     * Determine if prop should be auto-approved
     */
    private shouldAutoApprove;
    /**
     * Create unified pick with professional data
     */
    private createUnifiedPick;
    /**
     * Get unprocessed raw props
     */
    private getUnprocessedRawProps;
    /**
     * Mark raw prop as processed
     */
    private markRawPropProcessed;
    /**
     * Mark raw prop with error
     */
    private markRawPropError;
    /**
     * Generate processing summary for monitoring
     */
    private generateProcessingSummary;
    /**
     * Process SmartForm submissions through professional system
     */
    processSmartFormSubmission(ticketId: string): Promise<ProfessionalPropResult>;
    /**
     * Process a single prop from GradingFeatureSet
     */
    processGradingFeatureSet(features: any): Promise<ProfessionalPropResult>;
    /**
     * Get processing statistics
     */
    getProcessingStats(): Promise<any>;
}
export declare const professionalPropProcessor: ProfessionalPropProcessor;
//# sourceMappingURL=ProfessionalPropProcessor.d.ts.map