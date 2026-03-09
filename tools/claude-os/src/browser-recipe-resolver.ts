/**
 * Claude OS — Browser Recipe Resolver
 *
 * Browser-specific verification logic. Identifies browser recipes,
 * checks Playwright availability, resolves artifact expectations,
 * and collects artifacts from disk after execution.
 *
 * No hardcoded project flows — all behavior is recipe-driven.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { dirExists } from './fs-utils.js';

import type {
  VerificationRequirement,
  BrowserArtifactExpectation,
  BrowserArtifactEntry,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Recipe ID substrings that identify browser-type recipes */
const BROWSER_RECIPE_ID_PATTERNS = ['browser', 'visual', 'ui_visual'];

/** Playwright availability check timeout */
const PLAYWRIGHT_CHECK_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Browser Recipe Detection
// ---------------------------------------------------------------------------

/**
 * Determine if a recipe/requirement is a browser verification recipe.
 * Uses recipe ID pattern matching — no project-specific logic.
 */
export function isBrowserRecipe(recipe: { recipeId?: string; id?: string }): boolean {
  const id = recipe.recipeId ?? recipe.id ?? '';
  return BROWSER_RECIPE_ID_PATTERNS.some(pattern => id.includes(pattern));
}

// ---------------------------------------------------------------------------
// Playwright Availability
// ---------------------------------------------------------------------------

/**
 * Check if Playwright is installed and available.
 * Runs `npx playwright --version` with a short timeout.
 * Returns structured result — never throws.
 */
export function checkPlaywrightAvailability(): {
  available: boolean;
  version: string | null;
  reason: string;
} {
  try {
    const result = spawnSync('npx', ['playwright', '--version'], {
      shell: true,
      timeout: PLAYWRIGHT_CHECK_TIMEOUT_MS,
      encoding: 'utf-8',
      env: process.env,
    });

    if (result.status === 0 && result.stdout) {
      const version = result.stdout.trim();
      return {
        available: true,
        version,
        reason: `Playwright ${version} available`,
      };
    }

    return {
      available: false,
      version: null,
      reason: result.stderr?.trim() || 'Playwright not found or returned non-zero exit code',
    };
  } catch (err) {
    return {
      available: false,
      version: null,
      reason: `Playwright check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Artifact Expectation Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve expected browser artifacts from a verification requirement.
 * Maps the requirement's outputFile to structured artifact expectations.
 * Returns empty array for non-browser recipes.
 */
export function resolveBrowserArtifactExpectations(
  requirement: VerificationRequirement
): BrowserArtifactExpectation[] {
  if (!isBrowserRecipe(requirement)) {
    return [];
  }

  const expectations: BrowserArtifactExpectation[] = [];
  const outputFile = requirement.outputFile;

  // If outputFile ends with "/" it indicates a directory of artifacts
  if (outputFile && outputFile.endsWith('/')) {
    expectations.push({
      type: 'screenshot',
      pattern: `${outputFile}*.png`,
      required: requirement.failureSeverity !== 'informational',
    });
  }

  return expectations;
}

// ---------------------------------------------------------------------------
// Artifact Collection
// ---------------------------------------------------------------------------

/**
 * Scan disk for browser artifacts matching expectations.
 * Called after browser recipe execution to find files that Playwright wrote.
 *
 * @param artifactRoot - Absolute path to the sprint artifact root
 * @param expectations - Expected artifact patterns
 * @returns Array of found artifact entries
 */
export function collectBrowserArtifacts(
  artifactRoot: string,
  expectations: BrowserArtifactExpectation[]
): BrowserArtifactEntry[] {
  const artifacts: BrowserArtifactEntry[] = [];

  for (const expectation of expectations) {
    // Extract directory from pattern (e.g., "proofs/screenshots/*.png" -> "proofs/screenshots")
    const patternDir = path.dirname(expectation.pattern);
    const absDir = path.resolve(artifactRoot, patternDir);

    if (!dirExists(absDir)) {
      continue;
    }

    // Extract file extension from pattern for filtering
    const ext = path.extname(expectation.pattern);

    try {
      const files = fs.readdirSync(absDir);
      const matchingFiles = ext ? files.filter(f => f.endsWith(ext)) : files;

      for (const file of matchingFiles) {
        const filePath = path.join(absDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            artifacts.push({
              type: expectation.type,
              path: path.posix.join(patternDir, file),
              sizeBytes: stats.size,
              capturedAt: new Date().toISOString(),
            });
          }
        } catch {
          // Skip files we can't stat
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  return artifacts;
}
