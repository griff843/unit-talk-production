/**
 * Tests for receipt-validator.ts (Sprint 4 — Proof Receipt Validation)
 *
 * Test groups:
 *   1. computeFileHash
 *   2. validateReceipt — path_in_out check
 *   3. validateReceipt — file existence check
 *   4. validateReceipt — empty file check
 *   5. validateReceipt — hash verification
 *   6. validateReceipt — tamper detection
 *   7. validateAllReceipts
 *   8. validateReceipt — empty artifact_path guard
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { computeFileHash, validateReceipt, validateAllReceipts } from '../receipt-validator.js';
import { createSprintState } from '../sprint-state.js';

import type { ActiveSprintState, FoundReceipt } from '../types.js';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-os-receipt-validator-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Write a file to tmpDir, returning its absolute path. */
function writeArtifact(name: string, content: string): string {
  const absPath = path.join(tmpDir, name);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content);
  return absPath;
}

/** Build a minimal FoundReceipt with required fields. */
function makeReceipt(overrides: Partial<FoundReceipt> & { artifact_path: string }): FoundReceipt {
  return {
    receipt_class: 'test',
    captured_at: new Date().toISOString(),
    description: 'test receipt',
    ...overrides,
  };
}

function makeSprintState(overrides?: Partial<ActiveSprintState>): ActiveSprintState {
  const base = createSprintState({
    sprint_id: 'SPRINT-RECEIPT-TEST-001',
    title: 'Receipt Validation Test Sprint',
    authority_surfaces: [],
    primary_owner: 'claude_code',
  });
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// 1. computeFileHash
// ---------------------------------------------------------------------------

describe('computeFileHash', () => {
  it('returns a consistent 64-char hex string for the same file', () => {
    const absPath = writeArtifact('proof.txt', 'hello world');
    const hash1 = computeFileHash(absPath);
    const hash2 = computeFileHash(absPath);
    expect(hash1).not.toBeNull();
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  it('returns null for a missing file', () => {
    expect(computeFileHash(path.join(tmpDir, 'does-not-exist.txt'))).toBeNull();
  });

  it('returns different hashes for different content', () => {
    const a = writeArtifact('a.txt', 'content A');
    const b = writeArtifact('b.txt', 'content B');
    expect(computeFileHash(a)).not.toBe(computeFileHash(b));
  });
});

// ---------------------------------------------------------------------------
// 2. validateReceipt — path_in_out check
// ---------------------------------------------------------------------------

describe('validateReceipt — path_in_out check', () => {
  it('path_in_out=true for repo-relative path starting with out/', () => {
    // 'out/...' relative path: resolveRepoPath resolves it to workspace/out/...
    // File won't exist at that real path, but path_in_out should still be true
    const receipt = makeReceipt({ artifact_path: 'out/proofs/proof_test.txt' });
    const entry = validateReceipt(receipt);
    expect(entry.path_in_out).toBe(true);
  });

  it('path_in_out=false for path not starting with out/', () => {
    const receipt = makeReceipt({ artifact_path: 'proofs/proof_test.txt' });
    const entry = validateReceipt(receipt);
    expect(entry.path_in_out).toBe(false);
    expect(entry.valid).toBe(false);
    expect(entry.errors.some(e => e.includes('out/'))).toBe(true);
  });

  it('path_in_out=false for governance/ prefixed path', () => {
    const receipt = makeReceipt({ artifact_path: 'governance/claude-os/state/file.json' });
    const entry = validateReceipt(receipt);
    expect(entry.path_in_out).toBe(false);
    expect(entry.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. validateReceipt — file existence check
// ---------------------------------------------------------------------------

describe('validateReceipt — file existence check', () => {
  it('file_exists=true and file_size_bytes>0 for existing non-empty file', () => {
    // Use absolute path: path.resolve(workspaceRoot, absPath) === absPath (Node.js behavior)
    const absPath = writeArtifact('proof.txt', 'test output\n');
    const receipt = makeReceipt({ artifact_path: absPath });
    const entry = validateReceipt(receipt);

    expect(entry.file_exists).toBe(true);
    expect(entry.file_size_bytes).toBeGreaterThan(0);
  });

  it('file_exists=false and valid=false when file does not exist', () => {
    const receipt = makeReceipt({ artifact_path: 'out/missing-artifact.txt' });
    const entry = validateReceipt(receipt);
    expect(entry.file_exists).toBe(false);
    expect(entry.valid).toBe(false);
  });

  it('error message includes artifact path when file is missing', () => {
    const receipt = makeReceipt({ artifact_path: 'out/gone.txt' });
    const entry = validateReceipt(receipt);
    const hasPathInError = entry.errors.some(e => e.includes('out/gone.txt'));
    expect(hasPathInError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. validateReceipt — empty file check
// ---------------------------------------------------------------------------

describe('validateReceipt — empty file check', () => {
  it('file_size_bytes=0 and valid=false for zero-byte file', () => {
    const absPath = writeArtifact('empty.txt', '');
    const receipt = makeReceipt({ artifact_path: absPath });
    const entry = validateReceipt(receipt);

    expect(entry.file_size_bytes).toBe(0);
    expect(entry.valid).toBe(false);
    expect(entry.errors.some(e => e.includes('empty'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. validateReceipt — hash verification
// ---------------------------------------------------------------------------

describe('validateReceipt — hash verification', () => {
  it('hash_match=null when no sha256_hash is stored (legacy receipt)', () => {
    const absPath = writeArtifact('proof.txt', 'content');
    const receipt = makeReceipt({ artifact_path: absPath }); // no sha256_hash
    const entry = validateReceipt(receipt);
    expect(entry.hash_match).toBeNull();
  });

  it('hash_match=true when stored hash matches recomputed hash', () => {
    const content = 'verified content';
    const absPath = writeArtifact('verified.txt', content);
    const storedHash = crypto.createHash('sha256').update(content).digest('hex');

    const receipt = makeReceipt({ artifact_path: absPath, sha256_hash: storedHash });
    const entry = validateReceipt(receipt);
    expect(entry.hash_match).toBe(true);
  });

  it('legacy receipt without sha256_hash is not treated as invalid', () => {
    // Missing file makes it invalid regardless; but hash_match=null is not itself a failure
    const absPath = writeArtifact('legacy.txt', 'content');
    const receipt = makeReceipt({ artifact_path: absPath }); // sha256_hash absent
    const entry = validateReceipt(receipt);
    // hash_match=null should not add an error
    expect(entry.hash_match).toBeNull();
    expect(entry.errors.every(e => !e.includes('hash'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. validateReceipt — tamper detection
// ---------------------------------------------------------------------------

describe('validateReceipt — tamper detection', () => {
  it('hash_match=false when file is modified after hash was stored', () => {
    const originalContent = 'original proof content';
    const absPath = writeArtifact('tampered.txt', originalContent);
    const storedHash = crypto.createHash('sha256').update(originalContent).digest('hex');

    // Simulate tampering
    fs.writeFileSync(absPath, 'tampered content — different from original');

    const receipt = makeReceipt({ artifact_path: absPath, sha256_hash: storedHash });
    const entry = validateReceipt(receipt);

    expect(entry.hash_match).toBe(false);
    expect(entry.valid).toBe(false);
  });

  it('errors include mismatch message when tampering detected', () => {
    const absPath = writeArtifact('tamper2.txt', 'original');
    const storedHash = crypto.createHash('sha256').update('original').digest('hex');
    fs.writeFileSync(absPath, 'changed');

    const receipt = makeReceipt({ artifact_path: absPath, sha256_hash: storedHash });
    const entry = validateReceipt(receipt);

    expect(
      entry.errors.some(
        e => e.toLowerCase().includes('hash') || e.toLowerCase().includes('mismatch')
      )
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. validateAllReceipts
// ---------------------------------------------------------------------------

describe('validateAllReceipts', () => {
  it('report is empty and valid when no receipts and no missing classes', () => {
    const state = makeSprintState({
      required_receipts: [],
      found_receipts: [],
      missing_receipts: [],
    });
    const report = validateAllReceipts(state);
    expect(report.valid).toBe(true);
    expect(report.checked_count).toBe(0);
    expect(report.valid_count).toBe(0);
    expect(report.invalid_count).toBe(0);
  });

  it('report.valid=false when any receipt entry is invalid', () => {
    const state = makeSprintState({ missing_receipts: [] });
    state.found_receipts = [
      {
        receipt_class: 'repo',
        artifact_path: 'out/nonexistent.txt',
        captured_at: new Date().toISOString(),
        description: 'missing file',
      },
    ];

    const report = validateAllReceipts(state);
    expect(report.valid).toBe(false);
    expect(report.invalid_count).toBeGreaterThan(0);
    expect(report.checked_count).toBe(1);
  });

  it('report.valid=false when missing_receipts is non-empty even if entries are valid', () => {
    // Simulate a state where receipts list is empty but required classes are missing
    const state = makeSprintState({
      required_receipts: ['repo', 'build', 'test'],
      found_receipts: [],
      missing_receipts: ['repo', 'build', 'test'],
    });

    const report = validateAllReceipts(state);
    expect(report.valid).toBe(false);
    expect(report.checked_count).toBe(0);
  });

  it('report includes sprint_id and generated_at', () => {
    const state = makeSprintState({ missing_receipts: [] });
    const report = validateAllReceipts(state);
    expect(report.sprint_id).toBe('SPRINT-RECEIPT-TEST-001');
    expect(typeof report.generated_at).toBe('string');
    expect(report.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ---------------------------------------------------------------------------
// 8. validateReceipt — empty artifact_path guard
// ---------------------------------------------------------------------------

describe('validateReceipt — empty artifact_path guard', () => {
  it('returns valid=false and error when artifact_path is empty string', () => {
    const receipt = makeReceipt({ artifact_path: '' });
    const entry = validateReceipt(receipt);

    expect(entry.valid).toBe(false);
    expect(entry.path_in_out).toBe(false);
    expect(entry.file_exists).toBe(false);
    expect(entry.errors.some(e => e.includes('empty'))).toBe(true);
  });

  it('returns valid=false when artifact_path is whitespace only', () => {
    const receipt = makeReceipt({ artifact_path: '   ' });
    const entry = validateReceipt(receipt);

    expect(entry.valid).toBe(false);
    expect(entry.errors.length).toBeGreaterThan(0);
  });
});
