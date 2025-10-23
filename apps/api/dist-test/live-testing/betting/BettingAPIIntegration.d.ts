/**
 * Phase 9: Betting API Integration
 *
 * Handles real money betting through sportsbook APIs with comprehensive
 * risk management and controls for live testing validation.
 */
import { EventEmitter } from 'events';
import { BettingAPIConfig, LiveBet, BetRecommendation } from '../types';
import { ProfessionalFeaturesResult } from '../../professional/types';
export declare class BettingAPIIntegration extends EventEmitter {
    private logger;
    private config;
    private bookConnections;
    private rateLimiters;
    private activeBets;
    constructor(config: BettingAPIConfig);
    private initializeConnections;
    placeLiveBet(recommendation: BetRecommendation, professionalFeatures: ProfessionalFeaturesResult, testingPhase: 'PHASE_9A' | 'PHASE_9B' | 'PHASE_9C' | 'PHASE_9D'): Promise<LiveBet>;
    private validateBet;
    private calculateDailyRisk;
    private checkCorrelationLimits;
    private calculateRiskLevel;
    private calculateCorrelationRisk;
    private calculatePortfolioImpact;
    monitorBets(): Promise<void>;
    private settleBet;
    emergencyStopAll(): Promise<void>;
    private generateBetId;
    private generatePropId;
    private generateCLVTrackingId;
    private extractSport;
    private extractGame;
    private extractPlayer;
    private calculateCLV;
    getActiveBets(): LiveBet[];
    getBet(betId: string): LiveBet | undefined;
    getBookStatus(): Record<string, boolean>;
    getDailyStats(): {
        totalBets: number;
        totalStaked: number;
        wins: number;
        losses: number;
        pending: number;
        netPnL: number;
    };
}
//# sourceMappingURL=BettingAPIIntegration.d.ts.map