import { ActivityResult, GradingResult } from '../shared/activity-results';

export interface ScoringAgentActivities {
  gradeProp(params: {
    propId: string;
    models: string[];
    options?: Record<string, unknown>;
  }): Promise<GradingResult>;

  validateGrade(params: {
    propId: string;
    grade: string;
    confidence: number;
    options?: Record<string, unknown>;
  }): Promise<ActivityResult<{
    valid: boolean;
    reasons?: string[];
    timestamp: string;
  }>>;

  monitorGrading(params: {
    interval?: number;
    thresholds?: {
      confidence: number;
      quality: number;
    };
  }): Promise<ActivityResult<{
    totalGraded: number;
    avgConfidence: number;
    avgQuality: number;
    timestamp: string;
  }>>;
} 