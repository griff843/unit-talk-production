import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Static Analysis: Canonical Metadata Contract Enforcement
 *
 * These tests read the source code of metadata routes and verify that:
 * 1. /api/teams does NOT reference raw_props or games extraction
 * 2. /api/players does NOT reference raw_props or games extraction
 * 3. Both routes use supabaseServer() (not hardcoded credentials)
 * 4. Both routes import from metadata-helpers for standardized shape
 * 5. Both routes include fail-closed error handling (metadataError import)
 */

const SMART_FORM_ROOT = path.resolve(__dirname, '..');

function readRouteSource(routePath: string): string {
  const full = path.join(SMART_FORM_ROOT, routePath);
  return fs.readFileSync(full, 'utf-8');
}

// Forbidden patterns in metadata routes (teams & players)
const FORBIDDEN_PATTERNS = [
  { pattern: /from\(\s*['"]raw_props['"]\s*\)/, description: 'queries raw_props table' },
  { pattern: /from\(\s*['"]games['"]\s*\)/, description: 'queries games table' },
  { pattern: /extract.*team/i, description: 'extracts teams from non-canonical source' },
  { pattern: /\.supabase\.co/, description: 'hardcoded Supabase URL' },
  { pattern: /eyJ[A-Za-z0-9_-]{20,}/, description: 'hardcoded JWT/API key' },
  { pattern: /createClient\s*\(/, description: 'creates ad-hoc Supabase client (should use supabaseServer)' },
];

// Required patterns in metadata routes
// NOTE: trace_id is generated inside metadataError() in metadata-helpers.ts,
// so we only verify metadataError is used (which guarantees trace_id inclusion).
const REQUIRED_PATTERNS = [
  { pattern: /supabaseServer/, description: 'uses supabaseServer() from lib/supabase' },
  { pattern: /metadataError/, description: 'uses metadataError for fail-closed responses (includes trace_id)' },
  { pattern: /metadata-helpers/, description: 'imports from centralized metadata-helpers' },
];

test.describe('Static analysis: /api/teams route source', () => {
  const source = readRouteSource('app/api/teams/route.ts');

  for (const { pattern, description } of FORBIDDEN_PATTERNS) {
    test(`MUST NOT: ${description}`, () => {
      expect(pattern.test(source)).toBe(false);
    });
  }

  for (const { pattern, description } of REQUIRED_PATTERNS) {
    test(`MUST: ${description}`, () => {
      expect(pattern.test(source)).toBe(true);
    });
  }

  test('queries ONLY the canonical teams table', () => {
    expect(source).toContain(".from('teams')");
    expect(source).not.toContain(".from('raw_props')");
    expect(source).not.toContain(".from('games')");
  });
});

test.describe('Static analysis: /api/players route source', () => {
  const source = readRouteSource('app/api/players/route.ts');

  for (const { pattern, description } of FORBIDDEN_PATTERNS) {
    test(`MUST NOT: ${description}`, () => {
      expect(pattern.test(source)).toBe(false);
    });
  }

  for (const { pattern, description } of REQUIRED_PATTERNS) {
    test(`MUST: ${description}`, () => {
      expect(pattern.test(source)).toBe(true);
    });
  }

  test('queries ONLY the canonical players table', () => {
    expect(source).toContain(".from('players')");
    expect(source).not.toContain(".from('raw_props')");
    expect(source).not.toContain(".from('games')");
  });
});

test.describe('Static analysis: metadata-helpers module', () => {
  const source = readRouteSource('lib/metadata-helpers.ts');

  test('exports toTeamOption mapper', () => {
    expect(source).toContain('export function toTeamOption');
  });

  test('exports toPlayerOption mapper', () => {
    expect(source).toContain('export function toPlayerOption');
  });

  test('exports metadataError builder with trace_id', () => {
    expect(source).toContain('export function metadataError');
    expect(source).toContain('trace_id');
  });

  test('exports validateBooleanColumn for schema gating', () => {
    expect(source).toContain('export function validateBooleanColumn');
  });

  test('does NOT reference raw_props or games', () => {
    expect(source).not.toContain('raw_props');
    expect(source).not.toContain("from('games')");
  });
});
