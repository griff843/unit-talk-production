import { RawProp } from './types';
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
export interface NormalizationResult {
    normalizedProp: RawProp;
    changes: string[];
    warnings: string[];
}
export declare function validateRawProp(prop: any): ValidationResult;
export declare function normalizeRawProp(prop: any): NormalizationResult;
//# sourceMappingURL=validation.d.ts.map