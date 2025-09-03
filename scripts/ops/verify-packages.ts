#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

interface PackageVerificationResult {
  name: string;
  resolvedPath: string;
  exportsOk: boolean;
  notes: string[];
}

interface VerificationReport {
  ok: boolean;
  timestamp: string;
  packages: PackageVerificationResult[];
}

async function verifyPackages(): Promise<VerificationReport> {
  const report: VerificationReport = {
    ok: true,
    timestamp: new Date().toISOString(),
    packages: []
  };

  // Get list of packages from packages directory
  const packagesDir = join(process.cwd(), 'packages');
  const packageNames = [
    '@unit-talk/shared-types',
    '@unit-talk/shared-utils', 
    '@unit-talk/database',
    '@unit-talk/config',
    '@unit-talk/telemetry'
  ];

  for (const packageName of packageNames) {
    const result: PackageVerificationResult = {
      name: packageName,
      resolvedPath: '',
      exportsOk: false,
      notes: []
    };

    try {
      // Try to resolve the package
      const resolvedPath = require.resolve(packageName);
      result.resolvedPath = resolvedPath;
      result.notes.push(`Resolved to: ${resolvedPath}`);

      // Try to import the package
      const packageModule = await import(packageName);
      
      // Check if package has exports
      const hasNamedExports = Object.keys(packageModule).length > 0;
      const hasDefaultExport = packageModule.default !== undefined;
      
      if (hasNamedExports || hasDefaultExport) {
        result.exportsOk = true;
        result.notes.push(`Exports found: ${hasNamedExports ? 'named' : ''} ${hasDefaultExport ? 'default' : ''}`);
      } else {
        result.exportsOk = false;
        result.notes.push('No exports found');
        report.ok = false;
      }

    } catch (error) {
      result.exportsOk = false;
      result.notes.push(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
      report.ok = false;
    }

    report.packages.push(result);
  }

  return report;
}

async function main() {
  console.log('🔍 Verifying package exports...');
  
  const report = await verifyPackages();
  
  // Ensure output directory exists
  const outDir = join(process.cwd(), 'out', 'ops');
  mkdirSync(outDir, { recursive: true });
  
  // Write report
  const reportPath = join(outDir, 'verify-packages.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Log results
  console.log(`\n📊 Package Verification Results:`);
  console.log(`Overall Status: ${report.ok ? '✅ PASS' : '❌ FAIL'}`);
  
  for (const pkg of report.packages) {
    console.log(`\n📦 ${pkg.name}:`);
    console.log(`  Status: ${pkg.exportsOk ? '✅' : '❌'}`);
    console.log(`  Path: ${pkg.resolvedPath || 'Not resolved'}`);
    for (const note of pkg.notes) {
      console.log(`  Note: ${note}`);
    }
  }
  
  console.log(`\n📄 Report written to: ${reportPath}`);
  
  process.exit(report.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
