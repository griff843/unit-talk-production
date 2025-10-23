/**
 * Feature-Flagged Scoring Agent
 *
 * Orchestrates between Enhanced 45-factor Engine and Legacy Scoring System
 * with comprehensive A/B testing, performance monitoring, and automatic rollback
 */
import { BaseAgent } from '../BaseAgent';
import { ScoringFeatureSet } from '../../types/ScoringFeatureSet';
import { Enhanced45FactorResult } from './scoring/Enhanced45FactorEngine';
import { SupabaseClient } from '@supabase/supabase-js';
export interface LegacyScoringResult {
    totalScore: number;
    tier: 'S' | 'A' | 'B' | 'C' | 'D';
    confidence: number;
    kellyFraction: number;
    expectedValue: number;
    processingTimeMs: number;
    timestamp: string;
    version: string;
}
export interface ScoringComparisonResult {
    propId: string;
    userId?: string;
    flagEnabled: boolean;
    variant: 'control' | 'treatment';
    abTestGroup?: string;
    legacyResult: LegacyScoringResult;
    legacyProcessingTime: number;
    enhancedResult?: Enhanced45FactorResult;
    enhancedProcessingTime?: number;
    performanceDelta: number;
    accuracyComparison?: number;
    selectedResult: Enhanced45FactorResult | LegacyScoringResult;
    selectionReason: string;
    timestamp: string;
    environment: string;
}
export declare class FeatureFlaggedScoringAgent extends BaseAgent {
    private logger;
    private enhanced45FactorEngine?;
    private featureFlagService;
    private abTestingEngine;
    private performanceMetrics;
    constructor(supabase: SupabaseClient);
    /**
     * Score a prop using feature-flagged approach
     */
    scoreProp(features: ScoringFeatureSet, context?: {
        userId?: string;
        sessionId?: string;
        metadata?: Record<string, any>;
    }): Promise<ScoringComparisonResult>;
    /**
     * Run legacy scoring system
     */
    private runLegacyScoring;
    /**
     * Determine which system to use based on A/B test assignment
     */
    private determineSelectionStrategy;
    /**
     * Calculate accuracy comparison between systems
     */
    private calculateAccuracyComparison;
    /**
     * Track A/B testing events for both systems
     */
    private trackABTestingEvents;
    /**
     * Update internal performance metrics
     */
    private updatePerformanceMetrics;
    /**
     * Store comparison result for analysis
     */
    private storeComparisonResult;
    /**
     * Initialize enhanced engine with feature dependencies
     */
    private initializeEnhancedEngine;
    /**
     * Start performance monitoring
     */
    private startPerformanceMonitoring;
    /**
     * Emit performance metrics for monitoring
     */
    private emitPerformanceMetrics;
    /**
     * Reset performance metrics
     */
    private resetPerformanceMetrics;
    private calculateLegacyBaseScore;
    private applyLegacyAdjustments;
    private determineLegacyTier;
    private calculateLegacyConfidence;
    private calculateLegacyKelly;
    private calculateLegacyEV;
    private calculateHoursToGame;
    /**
     * Get agent health status
     */
    getHealthStatus(): {
        healthy: boolean;
        metrics: typeof this.performanceMetrics;
        enhancedEngineReady: boolean;
    };
    /**
     * Get A/B test analysis for the scoring engine
     */
    getABTestAnalysis(): Promise<any>;
    /**
     * Generate comprehensive scoring system report
     */
    generateSystemReport(): Promise<any>;
}
//# sourceMappingURL=FeatureFlaggedScoringAgent.d.ts.map