/**
 * Tests for browser-recipe-resolver.ts (Phase C.2)
 *
 * Verifies browser recipe detection, Playwright availability checks,
 * artifact expectation resolution, and artifact collection from disk.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  isBrowserRecipe,
  resolveBrowserArtifactExpectations,
  collectBrowserArtifacts,
} from '../browser-recipe-resolver.js';

import type { VerificationRequirement, BrowserArtifactExpectation } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequirement(
  overrides: Partial<VerificationRequirement> = {}
): VerificationRequirement {
  return {
    recipeId: 'typecheck',
    purpose: 'Type check',
    required: true,
    commandPlaceholder: 'npm run type-check',
    commandResolved: true,
    outputFile: 'proofs/proof_typecheck.txt',
    failureSeverity: 'blocking',
    notes: '',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isBrowserRecipe
// ---------------------------------------------------------------------------

describe('isBrowserRecipe', () => {
  it('should identify ui_visual_check as a browser recipe', () => {
    expect(isBrowserRecipe({ recipeId: 'ui_visual_check' })).toBe(true);
  });

  it('should identify browser_smoke as a browser recipe', () => {
    expect(isBrowserRecipe({ recipeId: 'browser_smoke' })).toBe(true);
  });

  it('should identify visual_regression as a browser recipe', () => {
    expect(isBrowserRecipe({ recipeId: 'visual_regression' })).toBe(true);
  });

  it('should reject non-browser recipes', () => {
    expect(isBrowserRecipe({ recipeId: 'typecheck' })).toBe(false);
    expect(isBrowserRecipe({ recipeId: 'lint' })).toBe(false);
    expect(isBrowserRecipe({ recipeId: 'unit_tests' })).toBe(false);
    expect(isBrowserRecipe({ recipeId: 'runtime_smoke' })).toBe(false);
  });

  it('should work with "id" field (recipe objects)', () => {
    expect(isBrowserRecipe({ id: 'ui_visual_check' })).toBe(true);
    expect(isBrowserRecipe({ id: 'typecheck' })).toBe(false);
  });

  it('should handle missing id gracefully', () => {
    expect(isBrowserRecipe({})).toBe(false);
  });

  it('should prefer recipeId over id when both present', () => {
    expect(isBrowserRecipe({ recipeId: 'browser_smoke', id: 'typecheck' })).toBe(true);
    expect(isBrowserRecipe({ recipeId: 'typecheck', id: 'browser_smoke' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveBrowserArtifactExpectations
// ---------------------------------------------------------------------------

describe('resolveBrowserArtifactExpectations', () => {
  it('should return screenshot expectations for directory output', () => {
    const req = makeRequirement({
      recipeId: 'ui_visual_check',
      outputFile: 'proofs/screenshots/',
      failureSeverity: 'blocking',
    });

    const expectations = resolveBrowserArtifactExpectations(req);

    expect(expectations).toHaveLength(1);
    expect(expectations[0].type).toBe('screenshot');
    expect(expectations[0].pattern).toBe('proofs/screenshots/*.png');
    expect(expectations[0].required).toBe(true);
  });

  it('should return empty array for non-browser recipes', () => {
    const req = makeRequirement({ recipeId: 'typecheck' });
    expect(resolveBrowserArtifactExpectations(req)).toEqual([]);
  });

  it('should return empty array for browser recipe without directory output', () => {
    const req = makeRequirement({
      recipeId: 'browser_smoke',
      outputFile: 'proofs/proof_browser_smoke.txt',
    });
    expect(resolveBrowserArtifactExpectations(req)).toEqual([]);
  });

  it('should mark expectations as not required for informational severity', () => {
    const req = makeRequirement({
      recipeId: 'ui_visual_check',
      outputFile: 'proofs/screenshots/',
      failureSeverity: 'informational',
    });

    const expectations = resolveBrowserArtifactExpectations(req);
    expect(expectations[0].required).toBe(false);
  });

  it('should mark expectations as required for degraded severity', () => {
    const req = makeRequirement({
      recipeId: 'browser_smoke',
      outputFile: 'proofs/screenshots/',
      failureSeverity: 'degraded',
    });

    const expectations = resolveBrowserArtifactExpectations(req);
    expect(expectations[0].required).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// collectBrowserArtifacts
// ---------------------------------------------------------------------------

describe('collectBrowserArtifacts', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-os-browser-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('should find PNG files matching screenshot expectations', () => {
    // Create screenshots directory with files
    const screenshotDir = path.join(tmpRoot, 'proofs', 'screenshots');
    fs.mkdirSync(screenshotDir, { recursive: true });
    fs.writeFileSync(path.join(screenshotDir, 'page-1.png'), 'fake-png-data');
    fs.writeFileSync(path.join(screenshotDir, 'page-2.png'), 'fake-png-data-2');

    const expectations: BrowserArtifactExpectation[] = [
      { type: 'screenshot', pattern: 'proofs/screenshots/*.png', required: true },
    ];

    const artifacts = collectBrowserArtifacts(tmpRoot, expectations);

    expect(artifacts).toHaveLength(2);
    expect(artifacts[0].type).toBe('screenshot');
    expect(artifacts[0].path).toMatch(/proofs\/screenshots\/page-\d\.png/);
    expect(artifacts[0].sizeBytes).toBeGreaterThan(0);
    expect(artifacts[0].capturedAt).toBeTruthy();
  });

  it('should return empty array when directory does not exist', () => {
    const expectations: BrowserArtifactExpectation[] = [
      { type: 'screenshot', pattern: 'proofs/screenshots/*.png', required: true },
    ];

    const artifacts = collectBrowserArtifacts(tmpRoot, expectations);
    expect(artifacts).toEqual([]);
  });

  it('should return empty array when no files match extension', () => {
    const screenshotDir = path.join(tmpRoot, 'proofs', 'screenshots');
    fs.mkdirSync(screenshotDir, { recursive: true });
    fs.writeFileSync(path.join(screenshotDir, 'report.json'), '{}');

    const expectations: BrowserArtifactExpectation[] = [
      { type: 'screenshot', pattern: 'proofs/screenshots/*.png', required: true },
    ];

    const artifacts = collectBrowserArtifacts(tmpRoot, expectations);
    expect(artifacts).toEqual([]);
  });

  it('should return empty array for empty expectations', () => {
    const artifacts = collectBrowserArtifacts(tmpRoot, []);
    expect(artifacts).toEqual([]);
  });

  it('should handle multiple artifact types', () => {
    // Create directories with different types
    const screenshotDir = path.join(tmpRoot, 'proofs', 'screenshots');
    const logsDir = path.join(tmpRoot, 'proofs', 'console');
    fs.mkdirSync(screenshotDir, { recursive: true });
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(screenshotDir, 'snap.png'), 'data');
    fs.writeFileSync(path.join(logsDir, 'output.log'), 'logs');

    const expectations: BrowserArtifactExpectation[] = [
      { type: 'screenshot', pattern: 'proofs/screenshots/*.png', required: true },
      { type: 'console_log', pattern: 'proofs/console/*.log', required: false },
    ];

    const artifacts = collectBrowserArtifacts(tmpRoot, expectations);

    expect(artifacts).toHaveLength(2);
    const types = artifacts.map(a => a.type);
    expect(types).toContain('screenshot');
    expect(types).toContain('console_log');
  });
});
