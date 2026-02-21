#!/usr/bin/env node
/**
 * CANONICAL ENTRYPOINT: pnpm ops:day
 * SPRINT-OPS-DAY-HEALTH-TIMEOUTS-101A
 *
 * Cross-platform wrapper that works from ANY shell:
 *   - Windows PowerShell
 *   - Windows CMD
 *   - Windows Git Bash
 *   - macOS/Linux bash
 *
 * THE ONE TRUE WAY to start a production workday locally.
 * All other entrypoints (dev.sh, etc.) are DEPRECATED.
 *
 * Usage:
 *   pnpm ops:day          # cloud mode (default)
 *   pnpm ops:day local    # local mode with postgres container
 *
 * Exit codes:
 *   0 - Production Day Ready
 *   1 - Fatal error (any failure = non-zero)
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse arguments: first positional arg is DB mode
const args = process.argv.slice(2);
const dbMode = args[0] || 'cloud';

// Validate DB mode
if (!['cloud', 'local'].includes(dbMode)) {
  console.error(`[FAIL] Invalid DB_MODE: ${dbMode} (must be 'cloud' or 'local')`);
  process.exit(1);
}

/**
 * Detect if pwsh (PowerShell Core) is available
 * Falls back to powershell.exe if not
 */
async function findPowerShell() {
  return new Promise((resolve) => {
    const pwsh = spawn('pwsh', ['--version'], {
      stdio: 'pipe',
      shell: false,
    });
    pwsh.on('error', () => resolve('powershell.exe'));
    pwsh.on('close', (code) => {
      resolve(code === 0 ? 'pwsh' : 'powershell.exe');
    });
  });
}

/**
 * Run on Windows via PowerShell
 */
async function runWindows() {
  const ps1Path = join(__dirname, 'day.ps1');

  if (!existsSync(ps1Path)) {
    console.error(`[FAIL] PowerShell script not found: ${ps1Path}`);
    process.exit(1);
  }

  const psExe = await findPowerShell();
  console.log(`[INFO] Runner: Windows -> ${psExe}`);
  console.log(`[INFO] Script: ops/day.ps1`);
  console.log(`[INFO] DB Mode: ${dbMode}`);
  console.log('');

  const child = spawn(
    psExe,
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1Path, '-DbMode', dbMode],
    {
      stdio: 'inherit',
      shell: false,
      cwd: join(__dirname, '..'),
    }
  );

  child.on('error', (err) => {
    console.error(`[FAIL] Failed to start PowerShell: ${err.message}`);
    process.exit(1);
  });

  child.on('close', (code) => {
    process.exit(code ?? 1);
  });
}

/**
 * Run on Unix via bash
 */
function runUnix() {
  const shPath = join(__dirname, 'day.sh');

  if (!existsSync(shPath)) {
    console.error(`[FAIL] Bash script not found: ${shPath}`);
    process.exit(1);
  }

  console.log(`[INFO] Runner: Unix -> bash`);
  console.log(`[INFO] Script: ops/day.sh`);
  console.log(`[INFO] DB Mode: ${dbMode}`);
  console.log('');

  const child = spawn('bash', [shPath, dbMode], {
    stdio: 'inherit',
    shell: false,
    cwd: join(__dirname, '..'),
  });

  child.on('error', (err) => {
    console.error(`[FAIL] Failed to start bash: ${err.message}`);
    process.exit(1);
  });

  child.on('close', (code) => {
    process.exit(code ?? 1);
  });
}

// Main execution
console.log('========================================');
console.log('  UNIT TALK - Cross-Platform Entrypoint');
console.log('  SPRINT-OPS-DAY-HEALTH-TIMEOUTS-101A');
console.log('========================================');

if (process.platform === 'win32') {
  runWindows();
} else {
  runUnix();
}
