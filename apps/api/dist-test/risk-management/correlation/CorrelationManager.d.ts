/**
 * Correlation Manager
 *
 * Professional-grade correlation analysis and management for betting portfolios.
 * Implements game, player, sport, and time-based correlation tracking with
 * real-time correlation limits and portfolio concentration management.
 */
import { Position, CorrelationMatrix, CorrelationConfig, CorrelationCluster } from '../types';
export interface CorrelationRiskAssessment {
    propId: string;
    overallRisk: number;
    maxCorrelation: number;
    correlatedPositions: string[];
    riskFactors: string[];
    recommendedAdjustment: number;
    gameCorrelations: Record<string, number>;
    playerCorrelations: Record<string, number>;
    sportCorrelations: Record<string, number>;
    timeCorrelations: Record<string, number>;
    marketTypeCorrelations: Record<string, number>;
}
export interface PortfolioCorrelationAnalysis {
    matrix: CorrelationMatrix;
    clusters: CorrelationCluster[];
    riskHotspots: {
        type: 'GAME' | 'PLAYER' | 'SPORT' | 'TIME' | 'MARKET';
        identifier: string;
        exposureAmount: number;
        correlationRisk: number;
        affectedPositions: string[];
    }[];
    diversificationScore: number;
    concentrationWarnings: string[];
}
export declare class CorrelationManager {
    private logger;
    private config;
    private positions;
    private correlationMatrix;
    private clusters;
    private lastUpdate;
    private readonly CORRELATION_THRESHOLDS;
    constructor(config: CorrelationConfig);
    /**
     * Assess correlation risk for a new proposition
     */
    assessCorrelationRisk(prop: {
        propId: string;
        sport: string;
        player: string;
        gameId?: string;
        marketType: string;
        gameTime?: string;
        team?: string;
        opponent?: string;
    }, existingPositions: Position[]): Promise<CorrelationRiskAssessment>;
    /**
     * Add new position to correlation tracking
     */
    addPosition(position: Position): Promise<void>;
    /**
     * Remove position from correlation tracking
     */
    removePosition(position: Position): Promise<void>;
    /**
     * Get current correlation matrix
     */
    getCorrelationMatrix(): CorrelationMatrix;
    /**
     * Get comprehensive portfolio correlation analysis
     */
    getPortfolioCorrelationAnalysis(): Promise<PortfolioCorrelationAnalysis>;
    /**
     * Calculate correlation between two positions
     */
    calculatePairwiseCorrelation(pos1: Position, pos2: Position): number;
    /**
     * Update correlation configuration
     */
    updateConfig(newConfig: Partial<CorrelationConfig>): void;
    /**
     * Calculate all types of correlations for a proposition
     */
    private calculateAllCorrelations;
    /**
     * Calculate correlation between a prop and a position
     */
    private calculatePropPositionCorrelation;
    /**
     * Calculate correlation risk score (0-10)
     */
    private calculateCorrelationRiskScore;
    /**
     * Identify specific correlation risk factors
     */
    private identifyCorrelationRiskFactors;
    /**
     * Calculate recommended stake adjustment based on correlation risk
     */
    private calculateStakeAdjustment;
    /**
     * Update the correlation matrix with current positions
     */
    private updateCorrelationMatrix;
    /**
     * Calculate correlation matrix statistics
     */
    private calculateCorrelationStats;
    /**
     * Update correlation clusters
     */
    private updateCorrelationClusters;
    /**
     * Calculate average correlation within a cluster
     */
    private calculateClusterAverageCorrelation;
    /**
     * Calculate cluster risk contribution
     */
    private calculateClusterRiskContribution;
    /**
     * Identify portfolio risk hotspots
     */
    private identifyRiskHotspots;
    /**
     * Calculate diversification score (0-100)
     */
    private calculateDiversificationScore;
    /**
     * Generate concentration warnings
     */
    private generateConcentrationWarnings;
    private calculateGameExposures;
    private calculatePlayerExposures;
    private calculateSportExposures;
    private calculateTimeDifference;
    private areMarketTypesRelated;
    private areWeatherRelated;
    private areTeammates;
    private isSameTimeWindow;
    private isMatrixStale;
    private initializeEmptyMatrix;
    private createFallbackAssessment;
}
//# sourceMappingURL=CorrelationManager.d.ts.map