/**
 * Environment Profile Definitions
 * Sprint: SPRINT-B1-ENV-HARDENING-001B
 */

import { z } from 'zod';

// =============================================================================
// PROFILE DEFINITIONS
// =============================================================================

/**
 * Environment profile schema.
 */
export const EnvProfileSchema = z.enum(['local', 'docker', 'ci', 'production']);

/**
 * Environment profile type.
 */
export type EnvProfile = z.infer<typeof EnvProfileSchema>;

/**
 * Process environment type for Node.js compatibility.
 */
export type ProcessEnvType = Record<string, string | undefined>;

/**
 * Get environment profile from NODE_ENV and CI flag.
 */
export function getEnvProfile(env: ProcessEnvType = process.env): EnvProfile {
  if (env['CI'] === 'true') return 'ci';
  if (env['NODE_ENV'] === 'production') return 'production';

  // Check if running in Docker
  const isDocker =
    env['DOCKER'] === 'true' ||
    env['HOSTNAME']?.includes('unit-talk') ||
    env['container'] === 'docker';

  return isDocker ? 'docker' : 'local';
}

/**
 * Check if profile requires strict runtime validation.
 * CI builds are exempt; production/docker/local require critical vars.
 * SPRINT-B1-ENV-HARDENING-001
 */
export function isRuntimeProfile(profile: EnvProfile): boolean {
  return profile !== 'ci';
}
