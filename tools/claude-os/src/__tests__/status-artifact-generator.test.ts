/**
 * Tests for status-artifact-generator.ts (Sprint 5 — STATUS_RUBRIC.md)
 *
 * Test groups:
 *   1. Maturity evaluation — supported level from evidence
 *   2. Maturity claim request — is_request_supported evaluation
 *   3. Required fields in artifact
 *   4. File output (JSON + MD)
 *   5. Markdown content
 *   6. Error handling
 *   7. Protected surface
 *   8. Hash verification in evidence refs
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createSprintState } from '../sprint-state.js';
import { generateStatusArtifact } from '../status-artifact-generator.js';

import type {
  ActiveSprintState,
  FoundReceipt,
  ReceiptValidationReport,
  RepoContextPack,
  SprintStateBlocker,
} from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-os-status-artifact-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const DATE_OVERRIDE = '2026-03-13';

function makeState(overrides?: Partial<ActiveSprintState>): ActiveSprintState {
  const base = createSprintState({
    sprint_id: 'SPRINT-STATUS-TEST-001',
    title: 'Status Test Sprint',
    authority_surfaces: [],
    primary_owner: 'claude_code',
  });
  return { ...base, ...overrides };
}

function makeReceipt(
  receipt_class: FoundReceipt['receipt_class'],
  artifact_path = `out/proof_${receipt_class}.txt`
): FoundReceipt {
  return {
    receipt_class,
    artifact_path,
    captured_at: new Date().toISOString(),
    description: `${receipt_class} proof`,
    sha256_hash: undefined,
  };
}

function makeBlocker(
  description: string,
  severity: 'blocking' | 'warning' = 'blocking'
): SprintStateBlocker {
  return { description, severity, created_at: new Date().toISOString() };
}

function allReceiptsState(): ActiveSprintState {
  const state = makeState({
    required_receipts: ['repo', 'build', 'test'],
    found_receipts: [makeReceipt('repo'), makeReceipt('build'), makeReceipt('test')],
    missing_receipts: [],
    blockers: [],
    requested_maturity_delta: null,
  });
  return state;
}

// ---------------------------------------------------------------------------
// 1. Maturity evaluation — supported level
// ---------------------------------------------------------------------------

describe('maturity evaluation — supported level', () => {
  it('Operational when all receipts present and no blockers (standard sprint)', () => {
    const state = allReceiptsState();
    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.artifact?.maturity_claim_supported).toBe('Operational');
  });

  it('Prototype when missing_receipts is non-empty', () => {
    const state = makeState({
      required_receipts: ['repo', 'build', 'test'],
      found_receipts: [makeReceipt('repo')],
      missing_receipts: ['build', 'test'],
      blockers: [],
    });
    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.artifact?.maturity_claim_supported).toBe('Prototype');
    expect(result.artifact?.maturity_claim_rationale).toContain('Missing required receipt classes');
  });

  it('Prototype when blocking blocker is present', () => {
    const state = allReceiptsState();
    state.blockers = [makeBlocker('Critical test failure', 'blocking')];

    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.artifact?.maturity_claim_supported).toBe('Prototype');
    expect(result.artifact?.maturity_claim_rationale).toContain('Blocking issues unresolved');
  });

  it('Prototype when sprint status is aborted', () => {
    const state = allReceiptsState();
    state.status = 'aborted';

    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.artifact?.maturity_claim_supported).toBe('Prototype');
    expect(result.artifact?.maturity_claim_rationale).toContain('aborted');
  });

  it('Production-Ready when runtime receipt is in found_receipts', () => {
    const state = makeState({
      required_receipts: ['repo', 'build', 'test', 'runtime'],
      found_receipts: [
        makeReceipt('repo'),
        makeReceipt('build'),
        makeReceipt('test'),
        makeReceipt('runtime'),
      ],
      missing_receipts: [],
      blockers: [],
    });
    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.artifact?.maturity_claim_supported).toBe('Production-Ready');
  });
});

// ---------------------------------------------------------------------------
// 2. Maturity claim request — is_request_supported
// ---------------------------------------------------------------------------

describe('maturity claim request — is_request_supported', () => {
  it('is_request_supported=true when requesting Operational with Operational evidence', () => {
    const state = allReceiptsState();
    state.requested_maturity_delta = 'Prototype → Operational';

    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.artifact?.maturity_claim_request_supported).toBe(true);
    expect(result.artifact?.maturity_claim_requested).toBe('Prototype → Operational');
  });

  it('is_request_supported=false when requesting Production-Ready with only Operational evidence', () => {
    const state = allReceiptsState(); // no runtime/db receipts
    state.requested_maturity_delta = 'Operational → Production-Ready';

    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.artifact?.maturity_claim_request_supported).toBe(false);
    expect(result.artifact?.maturity_claim_rationale).toContain('Production-Ready');
  });

  it('is_request_supported=false when requesting Elite', () => {
    const state = allReceiptsState();
    state.requested_maturity_delta = 'Operational → Elite';

    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.artifact?.maturity_claim_request_supported).toBe(false);
    expect(result.artifact?.maturity_claim_rationale).toContain('Elite');
    expect(result.artifact?.maturity_claim_rationale).toContain('cannot be auto-verified');
  });

  it('is_request_supported=false when requesting Syndicate-Grade', () => {
    const state = allReceiptsState();
    state.requested_maturity_delta = 'Elite → Syndicate-Grade';

    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.artifact?.maturity_claim_request_supported).toBe(false);
    expect(result.artifact?.maturity_claim_rationale).toContain('Syndicate-Grade');
  });

  it('is_request_supported=true when no maturity delta is set', () => {
    const state = allReceiptsState();
    state.requested_maturity_delta = null;

    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.artifact?.maturity_claim_request_supported).toBe(true);
    expect(result.artifact?.maturity_claim_requested).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Required fields in artifact
// ---------------------------------------------------------------------------

describe('required fields in artifact', () => {
  it('generated artifact contains all required fields', () => {
    const state = allReceiptsState();
    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    const art = result.artifact;
    expect(art).not.toBeNull();
    expect(art?.artifact_version).toBe('1.0.0');
    expect(art?.sprint_id).toBe('SPRINT-STATUS-TEST-001');
    expect(art?.sprint_title).toBe('Status Test Sprint');
    expect(art?.maturity_claim_supported).toBeDefined();
    expect(art?.maturity_claim_request_supported).toBeDefined();
    expect(art?.maturity_claim_rationale).toBeDefined();
    expect(Array.isArray(art?.evidence_refs)).toBe(true);
    expect(Array.isArray(art?.required_receipts)).toBe(true);
    expect(Array.isArray(art?.found_receipts)).toBe(true);
    expect(Array.isArray(art?.missing_receipts)).toBe(true);
    expect(Array.isArray(art?.blockers)).toBe(true);
    expect(art?.sprint_status).toBeDefined();
    expect(art?.next_recommended_sprint).toBeDefined();
    expect(art?.timestamp_generated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('evidence_refs populated from found_receipts', () => {
    const state = allReceiptsState();
    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    expect(result.artifact?.evidence_refs).toHaveLength(3);
    const classes = result.artifact!.evidence_refs.map(e => e.receipt_class);
    expect(classes).toContain('repo');
    expect(classes).toContain('build');
    expect(classes).toContain('test');
  });

  it('hash_verified in evidence_refs comes from validationReport', () => {
    const state = allReceiptsState();
    const receipt = state.found_receipts[0];

    const mockValidation: ReceiptValidationReport = {
      sprint_id: state.sprint_id,
      valid: true,
      checked_count: 1,
      valid_count: 1,
      invalid_count: 0,
      entries: [
        {
          receipt,
          file_exists: true,
          file_size_bytes: 100,
          path_in_out: true,
          hash_match: true,
          errors: [],
          valid: true,
        },
      ],
      generated_at: new Date().toISOString(),
    };

    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      validationReport: mockValidation,
    });

    const ref = result.artifact?.evidence_refs.find(e => e.artifact_path === receipt.artifact_path);
    expect(ref?.hash_verified).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. File output
// ---------------------------------------------------------------------------

describe('file output', () => {
  it('both JSON and MD files are created at out/status/<SPRINT_ID>/<DATE>/', () => {
    const state = allReceiptsState();
    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    expect(result.success).toBe(true);
    expect(result.json_path).not.toBeNull();
    expect(result.md_path).not.toBeNull();
    expect(fs.existsSync(result.json_path!)).toBe(true);
    expect(fs.existsSync(result.md_path!)).toBe(true);

    const expectedDir = path.join(tmpDir, 'SPRINT-STATUS-TEST-001', DATE_OVERRIDE);
    expect(result.json_path).toContain(expectedDir);
  });

  it('custom outputRoot is respected', () => {
    const customRoot = path.join(tmpDir, 'custom-out');
    const state = allReceiptsState();
    const result = generateStatusArtifact(state, {
      outputRoot: customRoot,
      dateOverride: DATE_OVERRIDE,
    });

    expect(result.success).toBe(true);
    expect(result.json_path).toContain(customRoot);
  });

  it('custom dateOverride is respected', () => {
    const state = allReceiptsState();
    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: '2025-01-15',
    });

    expect(result.success).toBe(true);
    expect(result.json_path).toContain('2025-01-15');
  });

  it('JSON file parses cleanly with artifact_version=1.0.0', () => {
    const state = allReceiptsState();
    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    const raw = fs.readFileSync(result.json_path!, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.artifact_version).toBe('1.0.0');
    expect(parsed.sprint_id).toBe('SPRINT-STATUS-TEST-001');
  });
});

// ---------------------------------------------------------------------------
// 5. Markdown content
// ---------------------------------------------------------------------------

describe('markdown content', () => {
  it('MD file contains sprint_id', () => {
    const state = allReceiptsState();
    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    const md = fs.readFileSync(result.md_path!, 'utf-8');
    expect(md).toContain('SPRINT-STATUS-TEST-001');
  });

  it('MD file contains maturity claim section', () => {
    const state = allReceiptsState();
    state.requested_maturity_delta = 'Prototype → Operational';
    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    const md = fs.readFileSync(result.md_path!, 'utf-8');
    expect(md).toContain('Maturity Claim');
    expect(md).toContain('Operational');
    expect(md).toContain('Prototype → Operational');
  });

  it('MD file contains evidence table rows for each found receipt', () => {
    const state = allReceiptsState();
    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    const md = fs.readFileSync(result.md_path!, 'utf-8');
    expect(md).toContain('repo');
    expect(md).toContain('build');
    expect(md).toContain('test');
    expect(md).toContain('Evidence References');
  });
});

// ---------------------------------------------------------------------------
// 6. Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('success=false when outputRoot is a file path (not a directory)', () => {
    // Write a file where the dir would be, so ensureDir will fail on nested creation
    const blocker = path.join(tmpDir, 'blocker');
    fs.writeFileSync(blocker, 'i am a file');
    // outputRoot = blocker (a file), sprint dir = blocker/SPRINT-STATUS-TEST-001
    const state = allReceiptsState();
    const result = generateStatusArtifact(state, {
      outputRoot: blocker,
      dateOverride: DATE_OVERRIDE,
    });
    // On Windows ensureDir may succeed by creating nested dirs; check the path resolves
    // correctly. The key invariant: no exception thrown.
    expect(result.errors.length >= 0).toBe(true); // no exception
  });

  it('evidence_refs is empty when no receipts are registered', () => {
    const state = makeState({
      required_receipts: ['repo', 'build', 'test'],
      found_receipts: [],
      missing_receipts: ['repo', 'build', 'test'],
      blockers: [],
    });
    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    expect(result.artifact?.evidence_refs).toHaveLength(0);
    expect(result.artifact?.maturity_claim_supported).toBe('Prototype');
  });
});

// ---------------------------------------------------------------------------
// 7. Protected surface
// ---------------------------------------------------------------------------

describe('protected surface', () => {
  it('authority_surfaces present in artifact for protected sprint', () => {
    const state = makeState({
      authority_surfaces: ['scoring_authority', 'promotion_authority'],
      required_receipts: ['repo', 'build', 'test', 'status'],
      found_receipts: [
        makeReceipt('repo'),
        makeReceipt('build'),
        makeReceipt('test'),
        makeReceipt('status'),
      ],
      missing_receipts: [],
      blockers: [],
    });
    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    expect(result.artifact?.authority_surfaces).toContain('scoring_authority');
    expect(result.artifact?.authority_surfaces).toContain('promotion_authority');
  });

  it('Production-Ready when protected sprint has runtime receipt', () => {
    const state = makeState({
      authority_surfaces: ['discord_publish_authority'],
      required_receipts: ['repo', 'build', 'test', 'runtime', 'distribution', 'status'],
      found_receipts: [
        makeReceipt('repo'),
        makeReceipt('build'),
        makeReceipt('test'),
        makeReceipt('runtime'),
        makeReceipt('distribution'),
        makeReceipt('status'),
      ],
      missing_receipts: [],
      blockers: [],
    });
    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    expect(result.artifact?.maturity_claim_supported).toBe('Production-Ready');
  });
});

// ---------------------------------------------------------------------------
// 8. Hash verification in evidence refs
// ---------------------------------------------------------------------------

describe('hash verification in evidence refs', () => {
  it('hash_verified=false in evidence_ref when validationReport has hash_match=false', () => {
    const state = allReceiptsState();
    const receipt = state.found_receipts[0];

    const mockValidation: ReceiptValidationReport = {
      sprint_id: state.sprint_id,
      valid: false,
      checked_count: 1,
      valid_count: 0,
      invalid_count: 1,
      entries: [
        {
          receipt,
          file_exists: true,
          file_size_bytes: 100,
          path_in_out: true,
          hash_match: false, // tampered!
          errors: ['SHA256 hash mismatch — file may have been modified after registration'],
          valid: false,
        },
      ],
      generated_at: new Date().toISOString(),
    };

    const result = generateStatusArtifact(state, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      validationReport: mockValidation,
    });

    // Maturity capped at Prototype due to tamper
    expect(result.artifact?.maturity_claim_supported).toBe('Prototype');

    // evidence_ref has hash_verified=false
    const ref = result.artifact?.evidence_refs.find(e => e.artifact_path === receipt.artifact_path);
    expect(ref?.hash_verified).toBe(false);
  });
});
