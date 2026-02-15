#!/usr/bin/env node
/**
 * Unit Talk DX-OPS Cross-Platform Runner
 *
 * Detects platform and runs the appropriate script (PowerShell on Windows, Bash otherwise).
 *
 * Usage:
 *   node tools/run-ops.mjs <script> [args...]
 *
 * Examples:
 *   node tools/run-ops.mjs health
 *   node tools/run-ops.mjs bootstrap
 *   node tools/run-ops.mjs restart --wipe
 */

import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === "win32";

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node tools/run-ops.mjs <script> [args...]");
  console.error("");
  console.error("Available scripts:");
  console.error("  health     - Run health check diagnostic");
  console.error("  bootstrap  - Bootstrap and bring up the platform");
  console.error("  restart    - Restart services");
  console.error("");
  process.exit(1);
}

const scriptName = args[0];
// Filter out "--" separator that pnpm adds when passing args
let scriptArgs = args.slice(1).filter((arg) => arg !== "--");

// Map Unix-style args to PowerShell style when on Windows
const argMapping = {
  "--wipe": "-Wipe",
  "-w": "-Wipe",
  "--no-wait": "-NoWait",
  "--skip-install": "-SkipInstall",
  "--services": "-Services",
  "--confirm": "-Confirm",
};

if (process.platform === "win32") {
  scriptArgs = scriptArgs.map((arg) => argMapping[arg] || arg);
}

// Map script names to file paths
const scripts = {
  health: { ps1: "health.ps1", sh: "health.sh" },
  bootstrap: { ps1: "bootstrap.ps1", sh: "bootstrap.sh" },
  restart: { ps1: "restart.ps1", sh: "restart.sh" },
};

if (!scripts[scriptName]) {
  console.error(`Unknown script: ${scriptName}`);
  console.error(`Available scripts: ${Object.keys(scripts).join(", ")}`);
  process.exit(1);
}

const script = scripts[scriptName];
let command, commandArgs, scriptPath;

if (isWindows) {
  // Windows: Use PowerShell
  scriptPath = join(__dirname, script.ps1);
  if (!existsSync(scriptPath)) {
    console.error(`Script not found: ${scriptPath}`);
    process.exit(1);
  }

  command = "powershell.exe";
  commandArgs = [
    "-ExecutionPolicy",
    "Bypass",
    "-NoProfile",
    "-File",
    scriptPath,
    ...scriptArgs,
  ];
} else {
  // Unix: Use Bash
  scriptPath = join(__dirname, script.sh);
  if (!existsSync(scriptPath)) {
    console.error(`Script not found: ${scriptPath}`);
    process.exit(1);
  }

  command = "bash";
  commandArgs = [scriptPath, ...scriptArgs];
}

// Run the script
const child = spawn(command, commandArgs, {
  stdio: "inherit",
  cwd: dirname(__dirname), // Run from project root
  env: { ...process.env },
});

child.on("error", (err) => {
  console.error(`Failed to execute ${scriptName}: ${err.message}`);
  process.exit(1);
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});
