/**
 * Receipt Validator (Sprint 4 — PROOF_RECEIPT_STANDARD.md)
 *
 * Validates that proof receipts registered against a sprint actually have
 * corresponding artifact files on disk, are non-empty, live inside the
 * `out/` directory, and match the SHA256 hash stored at registration time.
 *
 * Exports:
 *   computeFileHash    — SHA256 hex digest of a file (null on error)
 *   validateReceipt    — validate a single FoundReceipt
 *   validateAllReceipts — aggregate validation for all receipts in a sprint
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

import { resolveRepoPath, normalizePath } from './fs-utils.js';

import type {
  ActiveSprintState,
  FoundReceipt,
  ReceiptValidationEntry,
  ReceiptValidationReport,
} from './types.js';

// ---------------------------------------------------------------------------
// Hash Computation
// ---------------------------------------------------------------------------

/**
 * Compute the SHA256 hex digest of a file.
 * Returns null if the file cannot be read (missing, permission error, etc.).
 */
export function computeFileHash(absolutePath: string): string | null {
  try {
    const data = fs.readFileSync(absolutePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Single-Receipt Validation
// ---------------------------------------------------------------------------

/**
 * Validate a single FoundReceipt.
 *
 * Checks (in order):
 *   1. artifact_path is non-empty
 *   2. artifact_path starts with 'out/' (normalized, repo-relative)
 *   3. File exists at resolveRepoPath(artifact_path)
 *   4. File size > 0 bytes
 *   5. If sha256_hash is set: recompute and compare → hash_match true/false
 *      If sha256_hash is NOT set: hash_match = null (legacy receipt, not a failure)
 *
 * valid = file_exists && file_size_bytes > 0 && path_in_out && hash_match !== false
 */
export function validateReceipt(receipt: FoundReceipt): ReceiptValidationEntry {
  const errors: string[] = [];

  // 1. Non-empty path
  if (!receipt.artifact_path || receipt.artifact_path.trim() === '') {
    errors.push('artifact_path is empty');
    return {
      receipt,
      file_exists: false,
      file_size_bytes: 0,
      path_in_out: false,
      hash_match: null,
      errors,
      valid: false,
    };
  }

  // 2. Path must start with 'out/'
  const normalizedPath = normalizePath(receipt.artifact_path);
  const path_in_out = normalizedPath.startsWith('out/');
  if (!path_in_out) {
    errors.push(`artifact_path does not start with 'out/' (got: ${receipt.artifact_path})`);
  }

  // 3. File existence
  const absolutePath = resolveRepoPath(receipt.artifact_path);
  let file_exists = false;
  let file_size_bytes = 0;

  try {
    const stat = fs.statSync(absolutePath);
    file_exists = true;
    file_size_bytes = stat.size;
  } catch {
    file_exists = false;
  }

  if (!file_exists) {
    errors.push(`artifact file does not exist: ${receipt.artifact_path}`);
  } else if (file_size_bytes === 0) {
    errors.push(`artifact file is empty (0 bytes): ${receipt.artifact_path}`);
  }

  // 4. Hash verification
  let hash_match: boolean | null = null;
  if (receipt.sha256_hash !== undefined && receipt.sha256_hash !== null) {
    if (file_exists) {
      const recomputed = computeFileHash(absolutePath);
      if (recomputed === null) {
        hash_match = false;
        errors.push('could not recompute file hash for verification');
      } else if (recomputed !== receipt.sha256_hash) {
        hash_match = false;
        errors.push('SHA256 hash mismatch — file may have been modified after registration');
      } else {
        hash_match = true;
      }
    } else {
      // File is missing; cannot verify hash
      hash_match = false;
    }
  }

  const valid = file_exists && file_size_bytes > 0 && path_in_out && hash_match !== false;

  return {
    receipt,
    file_exists,
    file_size_bytes,
    path_in_out,
    hash_match,
    errors,
    valid,
  };
}

// ---------------------------------------------------------------------------
// Aggregate Validation
// ---------------------------------------------------------------------------

/**
 * Validate all receipts registered against a sprint.
 *
 * report.valid is true iff:
 *   - every ReceiptValidationEntry is valid, AND
 *   - state.missing_receipts is empty (all required classes have a receipt)
 */
export function validateAllReceipts(state: ActiveSprintState): ReceiptValidationReport {
  const entries: ReceiptValidationEntry[] = state.found_receipts.map(validateReceipt);

  const valid_count = entries.filter(e => e.valid).length;
  const invalid_count = entries.filter(e => !e.valid).length;

  // Overall validity: all entries valid AND no required classes missing
  const allEntriesValid = entries.every(e => e.valid);
  const noMissingClasses = state.missing_receipts.length === 0;
  const valid = allEntriesValid && noMissingClasses;

  return {
    sprint_id: state.sprint_id,
    valid,
    checked_count: entries.length,
    valid_count,
    invalid_count,
    entries,
    generated_at: new Date().toISOString(),
  };
}
