/**
 * Claude OS — Profile Loader
 *
 * Loads and validates project profiles from governance artifacts.
 * Fail-closed: unknown profile or missing required fields -> blocked.
 */

import { resolveRepoPath, safeReadJson, fileExists } from './fs-utils.js';

import type { ProjectProfile, ProfileLoadResult } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROFILES_DIR = 'governance/claude-os/profiles';

const REQUIRED_PROFILE_FIELDS: (keyof ProjectProfile)[] = [
  'profileVersion',
  'projectId',
  'projectName',
  'projectType',
  'deprecatedPaths',
  'canonicalWriteTargets',
  'runtimeSensitiveAreas',
  'domainKeywords',
  'verificationDefaults',
  'lifecycleKeywords',
  'schemaKeywords',
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a project identifier to its profile file path (repo-relative).
 */
export function resolveProfilePath(projectId: string): string {
  return `${PROFILES_DIR}/${projectId}.json`;
}

/**
 * Load a project profile by project ID (shorthand).
 * Resolves to governance/claude-os/profiles/<projectId>.json
 */
export function loadProfileById(projectId: string): ProfileLoadResult {
  const relativePath = resolveProfilePath(projectId);
  return loadProfileFromPath(relativePath);
}

/**
 * Load a project profile from a file path (repo-relative or absolute).
 */
export function loadProfileFromPath(filePath: string): ProfileLoadResult {
  const absolutePath = filePath.startsWith('/') ? filePath : resolveRepoPath(filePath);

  if (!fileExists(absolutePath)) {
    return {
      success: false,
      profile: null,
      source: filePath,
      errors: [`Profile file not found: ${filePath}`],
    };
  }

  const readResult = safeReadJson<ProjectProfile>(absolutePath);
  if (!readResult.success || readResult.content === null) {
    return {
      success: false,
      profile: null,
      source: filePath,
      errors: [readResult.error ?? `Failed to read profile: ${filePath}`],
    };
  }

  const validationErrors = validateProfile(readResult.content);
  if (validationErrors.length > 0) {
    return {
      success: false,
      profile: null,
      source: filePath,
      errors: validationErrors,
    };
  }

  return {
    success: true,
    profile: readResult.content,
    source: filePath,
    errors: [],
  };
}

/**
 * Validate that a loaded profile has all required fields.
 * Returns list of validation error messages (empty = valid).
 */
export function validateProfile(data: unknown): string[] {
  const errors: string[] = [];

  if (data === null || data === undefined || typeof data !== 'object') {
    errors.push('Profile data is null or not an object');
    return errors;
  }

  const profile = data as Record<string, unknown>;

  for (const field of REQUIRED_PROFILE_FIELDS) {
    if (!(field in profile) || profile[field] === undefined || profile[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate array fields are actually arrays
  const arrayFields: (keyof ProjectProfile)[] = [
    'deprecatedPaths',
    'canonicalWriteTargets',
    'runtimeSensitiveAreas',
    'lifecycleKeywords',
    'schemaKeywords',
  ];
  for (const field of arrayFields) {
    if (field in profile && !Array.isArray(profile[field])) {
      errors.push(`Field '${field}' must be an array`);
    }
  }

  // Validate domainKeywords is an object
  if (
    'domainKeywords' in profile &&
    (typeof profile.domainKeywords !== 'object' ||
      profile.domainKeywords === null ||
      Array.isArray(profile.domainKeywords))
  ) {
    errors.push("Field 'domainKeywords' must be an object (Record<string, string[]>)");
  }

  // Validate verificationDefaults is an object
  if (
    'verificationDefaults' in profile &&
    (typeof profile.verificationDefaults !== 'object' || profile.verificationDefaults === null)
  ) {
    errors.push("Field 'verificationDefaults' must be an object");
  }

  return errors;
}
