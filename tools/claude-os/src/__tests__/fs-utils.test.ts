/**
 * Tests for fs-utils.ts
 *
 * Verifies ESM-safe path resolution and fail-closed file operations.
 */

import * as path from 'node:path';

import { describe, it, expect } from 'vitest';

import {
  getWorkspaceRoot,
  resolveRepoPath,
  fileExists,
  dirExists,
  safeReadText,
  safeReadJson,
} from '../fs-utils.js';

describe('fs-utils', () => {
  describe('getWorkspaceRoot', () => {
    it('should resolve workspace root without ReferenceError', () => {
      // This test catches the ESM __dirname regression.
      // If getWorkspaceRoot uses __dirname instead of import.meta.url,
      // this will throw ReferenceError at runtime.
      expect(() => getWorkspaceRoot()).not.toThrow();
    });

    it('should return a directory containing CLAUDE.md', () => {
      const root = getWorkspaceRoot();
      expect(typeof root).toBe('string');
      expect(root.length).toBeGreaterThan(0);

      // Verify CLAUDE.md exists at the resolved root
      const claudeMdPath = path.join(root, 'CLAUDE.md');
      expect(fileExists(claudeMdPath)).toBe(true);
    });

    it('should return a consistent value on repeated calls', () => {
      const root1 = getWorkspaceRoot();
      const root2 = getWorkspaceRoot();
      expect(root1).toBe(root2);
    });
  });

  describe('resolveRepoPath', () => {
    it('should resolve a known repo file', () => {
      const resolved = resolveRepoPath('CLAUDE.md');
      expect(fileExists(resolved)).toBe(true);
    });

    it('should resolve a known governance file', () => {
      const resolved = resolveRepoPath('governance/claude-os/SYSTEM_LAWS.md');
      expect(fileExists(resolved)).toBe(true);
    });
  });

  describe('fileExists', () => {
    it('should return true for an existing file', () => {
      const root = getWorkspaceRoot();
      expect(fileExists(path.join(root, 'CLAUDE.md'))).toBe(true);
    });

    it('should return false for a non-existent file', () => {
      expect(fileExists('/nonexistent/path/file.txt')).toBe(false);
    });
  });

  describe('dirExists', () => {
    it('should return true for an existing directory', () => {
      const root = getWorkspaceRoot();
      expect(dirExists(path.join(root, 'governance'))).toBe(true);
    });

    it('should return false for a non-existent directory', () => {
      expect(dirExists('/nonexistent/path/')).toBe(false);
    });
  });

  describe('safeReadText', () => {
    it('should read a known file', () => {
      const result = safeReadText(resolveRepoPath('CLAUDE.md'));
      expect(result.success).toBe(true);
      expect(result.content).not.toBeNull();
      expect(result.content!.length).toBeGreaterThan(0);
    });

    it('should fail gracefully for a missing file', () => {
      const result = safeReadText('/nonexistent/file.txt');
      expect(result.success).toBe(false);
      expect(result.error).not.toBeNull();
      expect(result.content).toBeNull();
    });
  });

  describe('safeReadJson', () => {
    it('should read and parse a known JSON file', () => {
      const result = safeReadJson(
        resolveRepoPath('governance/claude-os/context/context-manifest.json')
      );
      expect(result.success).toBe(true);
      expect(result.content).not.toBeNull();
    });

    it('should fail gracefully for a missing JSON file', () => {
      const result = safeReadJson('/nonexistent/file.json');
      expect(result.success).toBe(false);
      expect(result.error).not.toBeNull();
    });
  });
});
