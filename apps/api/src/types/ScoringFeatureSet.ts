/**
 * ScoringFeatureSet - Core scoring feature set interface
 * Extends GradingFeatureSet with additional scoring-specific features
 */

import { GradingFeatureSet } from './GradingFeatureSet';

export interface ScoringFeatureSet extends GradingFeatureSet {
  // Additional scoring-specific features
  scoringAlgorithm?: string;
  scoringVersion?: string;
  scoringConfidence?: number;

  // Enhanced scoring metrics
  edgeScore?: number;
  valueScore?: number;
  qualityScore?: number;

  // Professional scoring features
  professionalScore?: number;
  tierRating?: 'S' | 'A' | 'B' | 'C' | 'D';

  // Advanced analytics
  mlPredictions?: {
    model: string;
    prediction: number;
    confidence: number;
  }[];

  // Feature importance scores
  featureImportance?: Record<string, number>;

  // Ensemble model results
  ensembleScore?: number;
  consensusRating?: number;
}