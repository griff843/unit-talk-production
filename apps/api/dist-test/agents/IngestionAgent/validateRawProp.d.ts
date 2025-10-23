import { RawProp, ValidationResult } from './types';
/**
 * Validate a raw prop against the schema
 * @param prop - The prop to validate
 * @returns boolean - True if valid, false otherwise
 */
export declare function validateRawProp(prop: unknown): prop is RawProp;
/**
 * Validate a raw prop with detailed error information
 * @param prop - The prop to validate
 * @returns ValidationResult - Detailed validation result
 */
export declare function validateRawPropDetailed(prop: unknown): ValidationResult;
/**
 * Validate required fields for ingestion
 * @param prop - The prop to validate
 * @returns boolean - True if all required fields are present
 */
export declare function validateRequiredFields(prop: RawProp): boolean;
/**
 * Validate business rules for props
 * @param prop - The prop to validate
 * @returns ValidationResult - Business validation result
 */
export declare function validateBusinessRules(prop: RawProp): ValidationResult;
//# sourceMappingURL=validateRawProp.d.ts.map