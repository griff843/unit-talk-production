/**
 * Parallel Scoring Engine
 * Optimizes the professional scoring pipeline with parallel processing
 * Expected Performance Improvement: 5-7x faster than sequential processing
 */
import { ScoringFeatureSet } from '../../../types/ScoringFeatureSet';
import { ScoringResult } from './scoringEngine';
import type { Logger } from '../../../shared/logger/types';
export interface ParallelScoringTask<T = any> {
    name: string;
    task: () => Promise<T>;
    fallback?: T;
    timeout?: number;
    critical?: boolean;
}
export interface ParallelScoringResult {
    success: boolean;
    results: Record<string, any>;
    errors: Record<string, Error>;
    executionTime: number;
    tasksCompleted: number;
    tasksFailed: number;
}
export declare class ParallelScoringEngine {
    private logger;
    private defaultTimeout;
    constructor(logger: Logger);
    /**
     * Execute professional insights calculation in parallel
     * BEFORE: 7 sequential async calls (~2000ms)
     * AFTER: Parallel execution (~300ms)
     */
    calculateProfessionalInsightsParallel(features: ScoringFeatureSet, gradingEngine: any): Promise<ScoringResult['professionalInsights']>;
    /**
     * Execute multiple grading tasks in parallel with proper error handling
     */
    executeTasksInParallel(tasks: ParallelScoringTask[]): Promise<ParallelScoringResult>;
    /**
     * Transform parallel results into the expected professional insights format
     */
    private transformParallelResults;
    /**
     * Execute professional scoring calculations in parallel
     * Optimizes the calculateProfessionalCapperScore method
     */
    calculateProfessionalScoreParallel(features: ScoringFeatureSet, weights: any, gradingEngine: any): Promise<{
        score: number;
        breakdown: Record<string, number>;
    }>;
    /**
     * Calculate weighted score from parallel results
     */
    private calculateWeightedScore;
}
//# sourceMappingURL=ParallelGradingEngine.d.ts.map