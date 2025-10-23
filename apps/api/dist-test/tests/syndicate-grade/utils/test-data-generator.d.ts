/**
 * Test Data Generator for Syndicate-Grade Testing
 *
 * Generates realistic test data for comprehensive testing scenarios:
 * - Realistic prop submissions with proper market distribution
 * - Market data updates with temporal patterns
 * - User picks with statistical accuracy
 * - Complex scenarios for failure testing
 * - High-volume data streams for performance testing
 *
 * Data Generation Principles:
 * - Realistic market distributions and correlations
 * - Temporal patterns matching real betting markets
 * - Proper statistical distributions for odds and lines
 * - Edge cases and boundary conditions
 * - Reproducible data for consistent testing
 */
export interface TestDataGeneratorConfig {
    testSessionId?: string;
    randomSeed?: number;
    realismLevel?: 'basic' | 'realistic' | 'professional';
    sportDistribution?: Record<string, number>;
    marketDistribution?: Record<string, number>;
    temporalPatterns?: boolean;
}
export interface PickSubmissionConfig {
    submissionId?: string;
    userId?: string;
    pickType?: string;
    sport?: string;
    confidence?: 'low' | 'medium' | 'high';
    professionalFeatures?: Record<string, boolean>;
    includeBias?: boolean;
    includeEdgeCases?: boolean;
}
export interface MarketDataConfig {
    sport?: string;
    updateType?: string;
    significance?: 'low' | 'normal' | 'high';
    includeCorrelations?: boolean;
    timeDistribution?: 'uniform' | 'peak_hours' | 'realistic';
}
export declare class TestDataGenerator {
    private config;
    private random;
    private sportDistribution;
    private marketDistribution;
    private bookDistribution;
    private readonly SPORTS;
    private readonly MARKETS;
    private readonly BOOKS;
    private readonly STAT_TYPES;
    constructor(config?: TestDataGeneratorConfig);
    /**
     * Generate realistic props for performance testing
     */
    generateRealisticProps(count: number, options?: any): any[];
    /**
     * Generate realistic pick submission for integration testing
     */
    generateRealisticPickSubmission(config: PickSubmissionConfig): any;
    /**
     * Generate market data update for real-time testing
     */
    generateMarketDataUpdate(config?: MarketDataConfig): any;
    /**
     * Generate continuous props stream for load testing
     */
    createContinuousLoadStream(propsPerSecond: number, durationMs: number): Promise<void>;
    /**
     * Generate complex pick for grading validation
     */
    generateComplexPickForGrading(options?: any): any;
    /**
     * Generate picks for failure testing scenarios
     */
    generatePicksForFailureTesting(count: number): any[];
    /**
     * Generate user pick for activity simulation
     */
    generateUserPick(): any;
    private selectFromDistribution;
    private selectRandomFromArray;
    private getStatTypesForSport;
    private generatePlayerName;
    private generateTeamName;
    private generateGameTime;
    private generateRealisticLine;
    private generateRealisticOdds;
    private generateLineMovement;
    private generateMarketSize;
    private generateCompetitionLevel;
    private generateProfessionalMetadata;
    private generatePickReasoning;
    private generateBiasFactors;
    private generateEdgeCaseFactors;
    private generateMarketValue;
    private generateChangeMagnitude;
    private generateVolumeChange;
    private generateMarketSentiment;
    private generateImpactScore;
    private generateCorrelatedUpdates;
    private generateHistoricalPerformance;
    private generateSeasonalTrends;
    private generateHeadToHeadStats;
    private generateMarketDynamics;
    private generateCompetitiveLandscape;
    private generatePublicSentiment;
    private generateSteamData;
    private generateCLVContext;
    private generateTimingFactors;
    private generateVolumePatterns;
    private generateMovementHistory;
    private generateBookmakerPatterns;
    private generateEfficiencyMetrics;
    private generateAdvancedIndicators;
    private generateFailureScenarios;
    private generateStandardPickData;
    private calculateFailureProbability;
    private generateRecoveryExpectations;
    private generateCorrelationFactors;
    private generateRiskAssessment;
    private generateIPAddress;
    private generateStake;
    private emitPropToStream;
}
export default TestDataGenerator;
//# sourceMappingURL=test-data-generator.d.ts.map