/**
 * Data Validation Gates
 * Comprehensive validation system to prevent corrupted data from entering the system
 * Production-ready data integrity enforcement
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    correctedData?: any;
}
export interface PropValidationRules {
    requiredFields: string[];
    numericFields: string[];
    stringFields: string[];
    maxStringLength: number;
    validSports: string[];
    validStatTypes: string[];
    oddsRange: {
        min: number;
        max: number;
    };
}
export declare class DataValidationGates {
    private static readonly PROP_VALIDATION_RULES;
    /**
     * Validate raw prop data before processing
     */
    static validateRawProp(propData: any): ValidationResult;
    /**
     * Validate pick data before processing
     */
    static validatePickData(pickData: any): ValidationResult;
    /**
     * Check for suspicious content in strings
     */
    private static containsSuspiciousContent;
    /**
     * Calculate implied probability from American odds
     */
    private static calculateImpliedProbability;
    /**
     * Validate UUID format
     */
    private static isValidUUID;
    /**
     * Batch validate multiple props
     */
    static validatePropBatch(props: any[]): {
        validProps: any[];
        invalidProps: {
            prop: any;
            validation: ValidationResult;
        }[];
        correctedProps: any[];
    };
}
//# sourceMappingURL=dataValidationGates.d.ts.map