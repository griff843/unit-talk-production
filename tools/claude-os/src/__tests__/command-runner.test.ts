/**
 * Tests for command-runner.ts
 *
 * Verifies safe shell command execution with structured results.
 */

import { describe, it, expect } from 'vitest';

import { runCommand } from '../command-runner.js';

describe('command-runner', () => {
  it('should return exit code 0 for successful command', () => {
    const result = runCommand('echo hello');
    expect(result.exitCode).toBe(0);
  });

  it('should capture stdout', () => {
    const result = runCommand('echo hello');
    expect(result.stdout.trim()).toBe('hello');
  });

  it('should capture stderr', () => {
    const result = runCommand('node -e "console.error(\'oops\')"');
    expect(result.stderr.trim()).toBe('oops');
  });

  it('should return non-zero exit code for failing command', () => {
    const result = runCommand('node -e "process.exit(42)"');
    expect(result.exitCode).toBe(42);
  });

  it('should detect timeout', () => {
    // Use a very short timeout on a sleep command
    const result = runCommand('node -e "setTimeout(()=>{},10000)"', {
      timeoutMs: 500,
    });
    expect(result.timedOut).toBe(true);
  });

  it('should measure duration', () => {
    const result = runCommand('echo fast');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeLessThan(10000);
  });

  it('should record the command string', () => {
    const result = runCommand('echo test-cmd');
    expect(result.command).toBe('echo test-cmd');
  });

  it('should support shell operators', () => {
    const result = runCommand('echo a && echo b');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('a');
    expect(result.stdout).toContain('b');
  });
});
