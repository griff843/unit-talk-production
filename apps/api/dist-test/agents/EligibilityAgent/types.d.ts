import { BaseAgentConfig } from '../BaseAgent/types';
export interface EligibilityAgentConfig extends BaseAgentConfig {
    eligibility?: {
        batchSize?: number;
        eligibilityThreshold?: number;
        maxRetries?: number;
        metricsPort?: number;
    };
}
export interface EligibilityCriteria {
    minGrade?: string;
    minConfidence?: number;
    sports?: string[];
    excludeTypes?: string[];
}
export interface EligibilityResult {
    promoted: number;
    skipped: number;
    failed: number;
    errors?: string[];
}
//# sourceMappingURL=types.d.ts.map