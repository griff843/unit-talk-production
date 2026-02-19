#!/usr/bin/env npx tsx
/**
 * LIFECYCLE CI GATE
 * Sprint: LIFECYCLE-CONTRACT-LOCK-037
 *
 * CI gate that validates lifecycle contract compliance.
 * Run: npx tsx apps/api/src/lib/lifecycle/ci-gate.ts
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { runSingleWriterGate } from './single-writer-gate';
import { getAllowlistCount } from './single-writer-allowlist';

// ============================================================
// TYPES
// ============================================================

interface GateResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string[];
}

interface CIGateReport {
  timestamp: string;
  commit?: string;
  passed: boolean;
  gates: GateResult[];
}

// ============================================================
// GATE RUNNERS
// ============================================================

function runContractTests(): GateResult {
  console.log('\n📋 Running contract tests...');

  try {
    const output = execSync(
      'npx vitest run --reporter=verbose src/lib/lifecycle/__tests__/lifecycle.test.ts',
      {
        cwd: path.join(__dirname, '../../..'),
        encoding: 'utf-8',
        stdio: 'pipe',
      }
    );

    // Parse test results
    const passMatch = output.match(/(\d+) passed/);
    const failMatch = output.match(/(\d+) failed/);

    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const failed = failMatch ? parseInt(failMatch[1]) : 0;

    if (failed > 0) {
      return {
        name: 'Contract Tests',
        passed: false,
        message: `${failed} contract tests failed`,
        details: [output],
      };
    }

    return {
      name: 'Contract Tests',
      passed: true,
      message: `All ${passed} contract tests passed`,
    };
  } catch (error: any) {
    return {
      name: 'Contract Tests',
      passed: false,
      message: 'Contract tests failed to run',
      details: [error.stdout || error.message],
    };
  }
}

function runSingleWriterCheck(): GateResult {
  console.log('\n🔒 Running single-writer gate...');

  const srcDir = path.join(__dirname, '../../..');
  const result = runSingleWriterGate(srcDir);
  const allowlistCount = getAllowlistCount();

  if (result.violations.length > 0) {
    return {
      name: 'Single-Writer Gate',
      passed: false,
      message: `${result.violations.length} unauthorized writes detected`,
      details: result.violations.map(
        (v) => `${v.file}:${v.line} - ${v.reason}`
      ),
    };
  }

  return {
    name: 'Single-Writer Gate',
    passed: true,
    message: `No new violations (${allowlistCount} allowlisted for migration)`,
  };
}

function checkContractDocumentation(): GateResult {
  console.log('\n📄 Checking contract documentation...');

  const contractPath = path.join(
    __dirname,
    '../../../../../docs/contracts/PICK_LIFECYCLE_CONTRACT.md'
  );

  if (!fs.existsSync(contractPath)) {
    return {
      name: 'Contract Documentation',
      passed: false,
      message: 'PICK_LIFECYCLE_CONTRACT.md not found',
      details: [`Expected at: ${contractPath}`],
    };
  }

  const content = fs.readFileSync(contractPath, 'utf-8');

  // Check for required sections (numbered format)
  const requiredSections = [
    'Entities in Scope',
    'State Transitions',
    'Single-Writer Authority',
    'Invariants',
    'Error',
  ];

  const missingSections = requiredSections.filter(
    (section) => !content.includes(section)
  );

  if (missingSections.length > 0) {
    return {
      name: 'Contract Documentation',
      passed: false,
      message: 'Contract document missing required sections',
      details: missingSections,
    };
  }

  return {
    name: 'Contract Documentation',
    passed: true,
    message: 'Contract documentation complete',
  };
}

function checkLifecycleModuleExports(): GateResult {
  console.log('\n📦 Checking lifecycle module exports...');

  const indexPath = path.join(__dirname, './index.ts');

  if (!fs.existsSync(indexPath)) {
    return {
      name: 'Module Exports',
      passed: false,
      message: 'Lifecycle module index.ts not found',
    };
  }

  const content = fs.readFileSync(indexPath, 'utf-8');

  // Check for required exports
  const requiredExports = [
    'deriveLifecycleStage',
    'assertTransition',
    'validateInvariants',
    'assertWriterAuthority',
    'validateWrite',
    'lifecycleInsert',
    'lifecycleUpdate',
    'atomicClaimForPost',
    'atomicClaimForSettle',
  ];

  const missingExports = requiredExports.filter(
    (exp) => !content.includes(exp)
  );

  if (missingExports.length > 0) {
    return {
      name: 'Module Exports',
      passed: false,
      message: 'Lifecycle module missing required exports',
      details: missingExports,
    };
  }

  return {
    name: 'Module Exports',
    passed: true,
    message: `All ${requiredExports.length} required exports present`,
  };
}

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           LIFECYCLE CONTRACT CI GATE                     ║');
  console.log('║           Sprint: LIFECYCLE-CONTRACT-LOCK-037            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const report: CIGateReport = {
    timestamp: new Date().toISOString(),
    passed: true,
    gates: [],
  };

  // Get commit info if in git repo
  try {
    report.commit = execSync('git rev-parse --short HEAD', {
      encoding: 'utf-8',
    }).trim();
  } catch {
    report.commit = 'unknown';
  }

  // Run all gates
  const gates = [
    checkContractDocumentation,
    checkLifecycleModuleExports,
    runContractTests,
    runSingleWriterCheck,
  ];

  for (const gate of gates) {
    const result = gate();
    report.gates.push(result);
    if (!result.passed) {
      report.passed = false;
    }
  }

  // Print results
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                      RESULTS                             ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  for (const gate of report.gates) {
    const icon = gate.passed ? '✅' : '❌';
    console.log(`${icon} ${gate.name}: ${gate.message}`);
    if (gate.details && gate.details.length > 0 && !gate.passed) {
      for (const detail of gate.details.slice(0, 5)) {
        console.log(`   └─ ${detail}`);
      }
      if (gate.details.length > 5) {
        console.log(`   └─ ... and ${gate.details.length - 5} more`);
      }
    }
  }

  console.log('\n════════════════════════════════════════════════════════════');

  if (report.passed) {
    console.log('✅ ALL GATES PASSED');
    console.log(`   Commit: ${report.commit}`);
    console.log(`   Timestamp: ${report.timestamp}`);
    console.log('════════════════════════════════════════════════════════════\n');
    process.exit(0);
  } else {
    console.log('❌ GATES FAILED');
    console.log(`   Commit: ${report.commit}`);
    console.log(`   Timestamp: ${report.timestamp}`);
    console.log('════════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error running CI gate:', err);
  process.exit(1);
});
