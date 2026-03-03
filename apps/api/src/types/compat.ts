/**
 * Compatibility layer for database schema evolution
 *
 * This module provides type-safe compatibility helpers for transitioning
 * between database schema versions, particularly for the professional_score
 * field migration.
 *
 * @module types/compat
 * @since Phase 4 - Compile Green Stabilization
 */

/**
 * Augments a type with an optional professional_score field
 * for backward compatibility during schema migration.
 *
 * @template T - Base type that must have a score field
 */
export type WithProfessionalScore<T extends { score: number }> = T & {
  professional_score?: number;
};

/**
 * Safely extracts the professional score from an object,
 * falling back to the standard score field if professional_score
 * is not available.
 *
 * This function provides a migration path for code that needs to
 * work with both old and new database schemas.
 *
 * @template T - Type with a score field
 * @param x - Object that may have professional_score
 * @returns The professional_score if available, otherwise score
 *
 * @example
 * ```typescript
 * const pick = { score: 85, professional_score: 92 };
 * const score = professionalScoreOf(pick); // Returns 92
 *
 * const oldPick = { score: 85 };
 * const oldScore = professionalScoreOf(oldPick); // Returns 85
 * ```
 */
export function professionalScoreOf<T extends { score: number }>(
  x: T | WithProfessionalScore<T>
): number {
  return (x as any).professional_score ?? x.score;
}

/**
 * Type guard to check if an object has a professional_score field
 *
 * @template T - Type with a score field
 * @param x - Object to check
 * @returns True if the object has a professional_score field
 */
export function hasProfessionalScore<T extends { score: number }>(
  x: T | WithProfessionalScore<T>
): x is WithProfessionalScore<T> & { professional_score: number } {
  return (x as any).professional_score !== undefined;
}

/**
 * Normalizes a score object to always include professional_score
 *
 * @template T - Type with a score field
 * @param x - Object to normalize
 * @returns Object with professional_score set
 */
export function normalizeProfessionalScore<T extends { score: number }>(
  x: T | WithProfessionalScore<T>
): WithProfessionalScore<T> & { professional_score: number } {
  return {
    ...x,
    professional_score: professionalScoreOf(x),
  };
}
