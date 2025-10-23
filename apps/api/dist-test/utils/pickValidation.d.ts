import { PickLeg } from '../db/types/capper';
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
export interface PickValidationOptions {
    maxUnitsPerPick: number;
    minUnitsPerPick: number;
    maxLegsPerParlay: number;
    minOdds: number;
    maxOdds: number;
    allowedSports: string[];
    submissionCutoffHour: number;
}
export declare const DEFAULT_VALIDATION_OPTIONS: PickValidationOptions;
/**
 * Validates a single pick leg
 */
export declare function validatePickLeg(leg: PickLeg, options?: PickValidationOptions): ValidationResult;
/**
 * Validates multiple pick legs for parlay
 */
export declare function validateParlay(legs: PickLeg[], options?: PickValidationOptions): ValidationResult;
/**
 * Validates submission timing
 */
export declare function validateSubmissionTiming(eventDate: string, options?: PickValidationOptions): ValidationResult;
/**
 * Formats odds for display
 */
export declare function formatOdds(odds: number): string;
/**
 * Calculates parlay odds from individual leg odds
 */
export declare function calculateParlayOdds(legs: PickLeg[]): number;
/**
 * Calculates potential payout for a bet
 */
export declare function calculatePayout(odds: number, units: number): number;
//# sourceMappingURL=pickValidation.d.ts.map