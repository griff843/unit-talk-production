/**
 * Command Center Truth Enforcement Tests
 * Sprint: SPRINT-REM-003-COMMAND-CENTER-TRUTH-FIX
 *
 * Validates that the CC derives readiness exclusively from /api/health/summary -> platform_status.
 * No false-green defaults. No mixed-authority derivation. Fail closed on unavailable data.
 *
 * Covers:
 *   1.  Homepage: no hardcoded "Production Ready" or "All systems operational" in source
 *   2.  Homepage: status section references /api/health/summary
 *   3.  Sidebar: default status is 'unknown', not 'healthy'
 *   4.  Sidebar: polls /api/health/summary, not /api/pipeline/health
 *   5.  Sidebar: STATUS_META includes 'unknown' state
 *   6.  OperationalOverview: no hardcoded health simulation
 *   7.  OperationalOverview: fetches from /api/health/summary
 *   8.  OperationalOverview: fail-closed defaults to 'critical', not 'healthy'
 *   9.  Emergency page: no "Operational" hardcoded claim
 *   10. Emergency page: uses honest "Unknown" for platform status
 *   11. No CC component defaults status to 'healthy' before API response
 *   12. Health summary proxy route fails closed to CRITICAL on upstream error
 */

import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

const CC_SRC = path.resolve(__dirname, '..');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(CC_SRC, relativePath), 'utf-8');
}

// ─── Homepage truth enforcement ─────────────────────────────────────────────

describe('Homepage truth enforcement (page.tsx)', () => {
  let src: string;

  it('loads the homepage source', () => {
    src = readSource('app/page.tsx');
    expect(src.length).toBeGreaterThan(0);
  });

  it('does NOT contain hardcoded "Production Ready" text', () => {
    src = src || readSource('app/page.tsx');
    expect(src).not.toContain('Production Ready');
  });

  it('does NOT render "All systems operational" as static HTML (only via API-derived state)', () => {
    src = src || readSource('app/page.tsx');
    // The string may exist in a STATUS_META lookup (shown only when API returns HEALTHY),
    // but it must NOT appear as unconditional static JSX.
    // Verify it's not in a raw <div> without conditional rendering.
    expect(src).not.toMatch(/<div[^>]*>All systems operational<\/div>/);
  });

  it('references /api/health/summary as the canonical data source', () => {
    src = src || readSource('app/page.tsx');
    expect(src).toContain('/api/health/summary');
  });

  it('initializes platform status to UNKNOWN, not HEALTHY', () => {
    src = src || readSource('app/page.tsx');
    // The useState default must be 'UNKNOWN'
    expect(src).toMatch(/useState.*['"]UNKNOWN['"]/);
  });

  it('handles HEALTHY, DEGRADED, CRITICAL, and UNKNOWN states', () => {
    src = src || readSource('app/page.tsx');
    expect(src).toContain("'HEALTHY'");
    expect(src).toContain("'DEGRADED'");
    expect(src).toContain("'CRITICAL'");
    expect(src).toContain("'UNKNOWN'");
  });

  it('shows loading state before API response', () => {
    src = src || readSource('app/page.tsx');
    expect(src).toContain('Checking...');
  });
});

// ─── Sidebar truth enforcement ──────────────────────────────────────────────

describe('Sidebar truth enforcement (sidebar.tsx)', () => {
  let src: string;

  it('loads the sidebar source', () => {
    src = readSource('components/layout/sidebar.tsx');
    expect(src.length).toBeGreaterThan(0);
  });

  it('defaults status to unknown, NOT healthy', () => {
    src = src || readSource('components/layout/sidebar.tsx');
    // Must init with 'unknown'
    expect(src).toMatch(/useState.*['"]unknown['"]/);
    // Must NOT init with 'healthy' as default
    expect(src).not.toMatch(/useState.*\(\s*['"]healthy['"]\s*\)/);
  });

  it('polls /api/health/summary, NOT /api/pipeline/health', () => {
    src = src || readSource('components/layout/sidebar.tsx');
    expect(src).toContain('/api/health/summary');
    expect(src).not.toContain('/api/pipeline/health');
  });

  it('maps platform_status to sidebar states', () => {
    src = src || readSource('components/layout/sidebar.tsx');
    expect(src).toContain('platform_status');
    expect(src).toContain("'HEALTHY'");
    expect(src).toContain("'DEGRADED'");
    expect(src).toContain("'CRITICAL'");
  });

  it('includes unknown state in STATUS_META', () => {
    src = src || readSource('components/layout/sidebar.tsx');
    expect(src).toContain('unknown:');
    expect(src).toContain("'Status Unknown'");
  });

  it('fails closed to unknown on fetch error', () => {
    src = src || readSource('components/layout/sidebar.tsx');
    // catch block should set 'unknown'
    const catchMatch = src.match(/catch\s*\{[\s\S]*?setStatus\(['"](\w+)['"]\)/);
    expect(catchMatch).toBeTruthy();
    expect(catchMatch![1]).toBe('unknown');
  });
});

// ─── OperationalOverview truth enforcement ──────────────────────────────────

describe('OperationalOverview truth enforcement', () => {
  let src: string;

  it('loads the OperationalOverview source', () => {
    src = readSource('components/dashboard/OperationalOverview.tsx');
    expect(src.length).toBeGreaterThan(0);
  });

  it('does NOT contain "Simulate system health data"', () => {
    src = src || readSource('components/dashboard/OperationalOverview.tsx');
    expect(src).not.toContain('Simulate system health data');
  });

  it('does NOT hardcode overall health as healthy', () => {
    src = src || readSource('components/dashboard/OperationalOverview.tsx');
    // Must not have: setHealth({ overall: 'healthy', ... with hardcoded agents
    expect(src).not.toMatch(
      /overall:\s*['"]healthy['"],\s*\n\s*database:\s*\{[^}]*status:\s*['"]connected['"]/
    );
  });

  it('fetches from /api/health/summary', () => {
    src = src || readSource('components/dashboard/OperationalOverview.tsx');
    expect(src).toContain('/api/health/summary');
  });

  it('fail-closed defaults to critical, not healthy', () => {
    src = src || readSource('components/dashboard/OperationalOverview.tsx');
    // The default derivedHealth should be 'critical'
    expect(src).toMatch(/overall:\s*['"]critical['"]/);
  });

  it('derives status from platform_status field', () => {
    src = src || readSource('components/dashboard/OperationalOverview.tsx');
    expect(src).toContain('platform_status');
  });
});

// ─── Emergency page truth enforcement ───────────────────────────────────────

describe('Emergency page truth enforcement', () => {
  let src: string;

  it('loads the emergency page source', () => {
    src = readSource('app/emergency/page.tsx');
    expect(src.length).toBeGreaterThan(0);
  });

  it('does NOT claim "Operational" for basic routing', () => {
    src = src || readSource('app/emergency/page.tsx');
    expect(src).not.toContain('Basic Routing: Operational');
  });

  it('shows honest "Unknown" status for platform health', () => {
    src = src || readSource('app/emergency/page.tsx');
    expect(src).toContain('Unknown');
  });
});

// ─── Cross-cutting: no false-green defaults anywhere ────────────────────────

describe('Cross-cutting: no false-green defaults in status-bearing components', () => {
  const STATUS_FILES = [
    'app/page.tsx',
    'components/layout/sidebar.tsx',
    'components/dashboard/OperationalOverview.tsx',
  ];

  it('no component uses useState("healthy") as initial status state', () => {
    for (const file of STATUS_FILES) {
      const src = readSource(file);
      // Match: useState<SomeType>('healthy') or useState('healthy')
      const falseGreenDefault = src.match(/useState[^(]*\(\s*['"]healthy['"]\s*\)/g);
      expect(falseGreenDefault, `${file} must not default to 'healthy' before API call`).toBeNull();
    }
  });
});

// ─── Health summary proxy: fail-closed ──────────────────────────────────────

describe('Health summary proxy fail-closed behavior', () => {
  it('proxy returns CRITICAL on upstream unavailability', () => {
    const src = readSource('app/api/health/summary/route.ts');
    expect(src).toContain("platform_status: 'CRITICAL'");
    expect(src).toContain('503');
  });
});
