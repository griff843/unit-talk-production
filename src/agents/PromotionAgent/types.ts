import { BaseAgentConfig } from '../BaseAgent/types';

export interface PromotionAgentConfig extends BaseAgentConfig {
  promotion?: {
    batchSize?: number;
    promotionThreshold?: number;
    maxRetries?: number;
    metricsPort?: number;
  };
}

export interface PromotionCriteria {
  minGrade?: string;
  minConfidence?: number;
  sports?: string[];
  excludeTypes?: string[];
}

export interface PromotionResult {
  promoted: number;
  skipped: number;
  failed: number;
  errors?: string[];
} 