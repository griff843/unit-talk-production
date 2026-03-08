/**
 * Claude OS — File System Utilities
 *
 * Safe, fail-closed file operations. No silent fallback.
 * Every failure is explicit and structured.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileReadResult<T = string> {
  success: boolean;
  path: string;
  content: T | null;
  error: string | null;
}

export interface FailClosedError {
  code: 'FILE_NOT_FOUND' | 'PARSE_ERROR' | 'READ_ERROR' | 'DIR_ERROR';
  path: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Path Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a path relative to the workspace root.
 * The workspace root is determined by walking up from this file
 * to find the directory containing CLAUDE.md.
 */
let _cachedRoot: string | null = null;

export function getWorkspaceRoot(): string {
  if (_cachedRoot) return _cachedRoot;

  let current = path.resolve(__dirname, '..');
  // Walk up at most 10 levels
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(current, 'CLAUDE.md'))) {
      _cachedRoot = current;
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break; // reached filesystem root
    current = parent;
  }

  throw createFailClosedError(
    'DIR_ERROR',
    'workspace root',
    'Could not locate workspace root (no CLAUDE.md found walking up from tools/claude-os)'
  );
}

/** Resolve a repo-relative path to an absolute path */
export function resolveRepoPath(relativePath: string): string {
  return path.resolve(getWorkspaceRoot(), relativePath);
}

/** Normalize path separators to forward slashes for consistency */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

// ---------------------------------------------------------------------------
// File Existence
// ---------------------------------------------------------------------------

/** Check if a file exists. Returns boolean, no exceptions. */
export function fileExists(absolutePath: string): boolean {
  try {
    return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
  } catch {
    return false;
  }
}

/** Check if a directory exists. Returns boolean, no exceptions. */
export function dirExists(absolutePath: string): boolean {
  try {
    return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Safe Reads — No Silent Fallback
// ---------------------------------------------------------------------------

/** Read a text file. Returns structured result, never throws. */
export function safeReadText(absolutePath: string): FileReadResult<string> {
  if (!fileExists(absolutePath)) {
    return {
      success: false,
      path: absolutePath,
      content: null,
      error: `File not found: ${absolutePath}`,
    };
  }

  try {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    return { success: true, path: absolutePath, content, error: null };
  } catch (err) {
    return {
      success: false,
      path: absolutePath,
      content: null,
      error: `Read error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Read and parse a JSON file. Returns structured result, never throws. */
export function safeReadJson<T = unknown>(absolutePath: string): FileReadResult<T> {
  const textResult = safeReadText(absolutePath);
  if (!textResult.success || textResult.content === null) {
    return {
      success: false,
      path: absolutePath,
      content: null,
      error: textResult.error,
    };
  }

  try {
    const parsed = JSON.parse(textResult.content) as T;
    return { success: true, path: absolutePath, content: parsed, error: null };
  } catch (err) {
    return {
      success: false,
      path: absolutePath,
      content: null,
      error: `JSON parse error in ${absolutePath}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Read all files matching a glob pattern in a directory (non-recursive simple glob) */
export function safeReadGlob(dirPath: string, pattern: string): FileReadResult<string>[] {
  if (!dirExists(dirPath)) {
    return [
      {
        success: false,
        path: dirPath,
        content: null,
        error: `Directory not found: ${dirPath}`,
      },
    ];
  }

  try {
    const files = fs.readdirSync(dirPath);
    // Simple glob: convert *.md to regex
    const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);

    return files.filter(f => regex.test(f)).map(f => safeReadText(path.join(dirPath, f)));
  } catch (err) {
    return [
      {
        success: false,
        path: dirPath,
        content: null,
        error: `Glob read error: ${err instanceof Error ? err.message : String(err)}`,
      },
    ];
  }
}

// ---------------------------------------------------------------------------
// Directory Operations
// ---------------------------------------------------------------------------

/** Ensure a directory exists, creating it recursively if needed. */
export function ensureDir(absolutePath: string): { success: boolean; error: string | null } {
  try {
    fs.mkdirSync(absolutePath, { recursive: true });
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: `Failed to create directory ${absolutePath}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Safe Write
// ---------------------------------------------------------------------------

/** Write text to a file, creating parent directories as needed. */
export function safeWriteText(
  absolutePath: string,
  content: string
): { success: boolean; error: string | null } {
  const dirResult = ensureDir(path.dirname(absolutePath));
  if (!dirResult.success) {
    return dirResult;
  }

  try {
    fs.writeFileSync(absolutePath, content, 'utf-8');
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: `Write error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Write a JSON object to a file with pretty formatting. */
export function safeWriteJson(
  absolutePath: string,
  data: unknown
): { success: boolean; error: string | null } {
  try {
    const content = JSON.stringify(data, null, 2) + '\n';
    return safeWriteText(absolutePath, content);
  } catch (err) {
    return {
      success: false,
      error: `JSON serialize error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Error Helpers
// ---------------------------------------------------------------------------

export function createFailClosedError(
  code: FailClosedError['code'],
  filePath: string,
  message: string
): FailClosedError {
  return { code, path: filePath, message };
}
