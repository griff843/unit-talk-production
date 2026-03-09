/**
 * Claude OS — Envelope Loader
 *
 * Loads and validates task execution envelopes.
 * Fail-closed: invalid envelope -> blocked.
 */

import { resolveRepoPath, safeReadJson, fileExists } from './fs-utils.js';
import { isValidSprintType } from './verification-resolver.js';

import type { TaskEnvelope, EnvelopeLoadResult, SprintExecutionRequest } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUIRED_ENVELOPE_FIELDS: (keyof TaskEnvelope)[] = [
  'envelopeVersion',
  'taskId',
  'taskType',
  'projectId',
  'objective',
  'summary',
  'touchedAreas',
  'killConditions',
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load a task envelope from a file path (repo-relative or absolute).
 */
export function loadEnvelope(filePath: string): EnvelopeLoadResult {
  const absolutePath = filePath.startsWith('/') ? filePath : resolveRepoPath(filePath);

  if (!fileExists(absolutePath)) {
    return {
      success: false,
      envelope: null,
      source: filePath,
      errors: [`Envelope file not found: ${filePath}`],
    };
  }

  const readResult = safeReadJson<TaskEnvelope>(absolutePath);
  if (!readResult.success || readResult.content === null) {
    return {
      success: false,
      envelope: null,
      source: filePath,
      errors: [readResult.error ?? `Failed to read envelope: ${filePath}`],
    };
  }

  const validationErrors = validateEnvelope(readResult.content);
  if (validationErrors.length > 0) {
    return {
      success: false,
      envelope: null,
      source: filePath,
      errors: validationErrors,
    };
  }

  return {
    success: true,
    envelope: readResult.content,
    source: filePath,
    errors: [],
  };
}

/**
 * Validate that a loaded envelope has all required fields.
 * Returns list of validation error messages (empty = valid).
 */
export function validateEnvelope(data: unknown): string[] {
  const errors: string[] = [];

  if (data === null || data === undefined || typeof data !== 'object') {
    errors.push('Envelope data is null or not an object');
    return errors;
  }

  const envelope = data as Record<string, unknown>;

  for (const field of REQUIRED_ENVELOPE_FIELDS) {
    if (!(field in envelope) || envelope[field] === undefined || envelope[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate taskType is a valid SprintType
  if ('taskType' in envelope && typeof envelope.taskType === 'string') {
    if (!isValidSprintType(envelope.taskType)) {
      errors.push(`Invalid taskType '${envelope.taskType}'. Must be a valid sprint type.`);
    }
  }

  // Validate array fields
  const arrayFields: (keyof TaskEnvelope)[] = ['touchedAreas', 'killConditions'];
  for (const field of arrayFields) {
    if (field in envelope && !Array.isArray(envelope[field])) {
      errors.push(`Field '${field}' must be an array`);
    }
  }

  // Validate verificationTierOverride if present
  if ('verificationTierOverride' in envelope && envelope.verificationTierOverride !== undefined) {
    const validTiers = ['T1', 'T2', 'T3', 'T4'];
    if (!validTiers.includes(envelope.verificationTierOverride as string)) {
      errors.push(
        `Invalid verificationTierOverride '${envelope.verificationTierOverride}'. Must be T1-T4.`
      );
    }
  }

  return errors;
}

/**
 * Convert a TaskEnvelope into a SprintExecutionRequest,
 * suitable for passing to the existing sprint planner.
 */
export function envelopeToRequest(envelope: TaskEnvelope): SprintExecutionRequest {
  return {
    sprintId: envelope.taskId,
    sprintType: envelope.taskType,
    summary: envelope.summary,
    objective: envelope.objective,
    touchedAreas: envelope.touchedAreas,
    requestedArtifactDate: envelope.artifactDate,
    runtimeProofRequired: envelope.runtimeProofRequired,
  };
}
