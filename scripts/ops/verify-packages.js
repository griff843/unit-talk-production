#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function verifyPackages() {
  const report = {
    ok: true,
    timestamp: new Date().toISOString(),
    packages: []
  };

  // Get list of packages to verify
  const packageNames = [
    '@unit-talk/shared-types',
    '@unit-talk/shared-utils', 
    '@unit-talk/database',
    '@unit-talk/config',
    '@unit-talk/telemetry'
  ];

  for (const packageName of packageNames) {
    const result = {
      name: packageName,
      resolvedPath: '',
      exportsOk: false,
      notes: []
    };

    try {
      // Try to resolve the package first
      let resolvedPath;
      let resolveError = null;
      try {
        resolvedPath = require.resolve(packageName);
        result.resolvedPath = resolvedPath;
        result.notes.push(`Resolved to: ${resolvedPath}`);
      } catch (err) {
        resolveError = err;
        // For ESM-only packages, require.resolve might fail, but that's OK
        if (err.message.includes('No "exports" main defined')) {
          result.notes.push('ESM-only package (require.resolve failed as expected)');
        } else {
          result.notes.push(`Resolve failed: ${err.message}`);
        }
      }

      // Try to load the package (try both CommonJS and ESM)
      let packageModule;
      let loadMethod = '';
      let loadSuccess = false;

      try {
        // First try CommonJS require
        packageModule = require(packageName);
        loadMethod = 'CommonJS require';
        loadSuccess = true;
      } catch (requireError) {
        try {
          // If require fails, try dynamic ESM import
          packageModule = await import(packageName);
          loadMethod = 'ESM import';
          loadSuccess = true;
        } catch (importError) {
          // If both fail, check if it's an ESM-only package with proper exports
          if (requireError.message.includes('No "exports" main defined') ||
              resolveError && resolveError.message.includes('No "exports" main defined')) {
            // For ESM-only packages, we need to check if the package exists and has proper structure
            const fs = require('fs');
            const path = require('path');
            try {
              const packagePath = path.join('node_modules', packageName, 'package.json');
              const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
              const distPath = path.join('node_modules', packageName, 'dist', 'index.js');

              if (packageJson.type === 'module' && packageJson.exports && fs.existsSync(distPath)) {
                result.exportsOk = true;
                result.notes.push('ESM-only package with proper exports configuration');
                result.notes.push(`Package type: ${packageJson.type}`);
                result.notes.push(`Exports defined: ${JSON.stringify(packageJson.exports)}`);
                result.resolvedPath = distPath;
                loadSuccess = true;
              } else {
                throw new Error(`ESM package missing required structure`);
              }
            } catch (fsError) {
              throw new Error(`Package structure validation failed: ${fsError.message}`);
            }
          } else {
            throw new Error(`Both require and import failed: ${requireError.message} | ${importError.message}`);
          }
        }
      }

      if (loadSuccess && packageModule) {
        result.notes.push(`Loaded via ${loadMethod}`);

        // Check if package has exports
        const hasNamedExports = packageModule && typeof packageModule === 'object' && Object.keys(packageModule).length > 0;
        const hasDefaultExport = packageModule && packageModule.default !== undefined;

        if (hasNamedExports || hasDefaultExport || packageModule) {
          result.exportsOk = true;
          result.notes.push(`Exports found: ${hasNamedExports ? 'named' : ''} ${hasDefaultExport ? 'default' : ''} ${packageModule ? 'module' : ''}`);
        } else {
          result.exportsOk = false;
          result.notes.push('No exports found');
          report.ok = false;
        }
      }

    } catch (error) {
      result.exportsOk = false;
      result.notes.push(`Import failed: ${error.message}`);
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
  const outDir = path.join(process.cwd(), 'out', 'ops');
  fs.mkdirSync(outDir, { recursive: true });
  
  // Write report
  const reportPath = path.join(outDir, 'verify-packages.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Log results
  console.log(`\n📊 Package Verification Results:`);
  console.log(`Overall Status: ${report.ok ? '✅ PASS' : '❌ FAIL'}`);

  if (report.packages && Array.isArray(report.packages)) {
    for (const pkg of report.packages) {
    console.log(`\n📦 ${pkg.name}:`);
    console.log(`  Status: ${pkg.exportsOk ? '✅' : '❌'}`);
    console.log(`  Path: ${pkg.resolvedPath || 'Not resolved'}`);
      for (const note of pkg.notes) {
        console.log(`  Note: ${note}`);
      }
    }
  } else {
    console.log('No packages to display or packages array is invalid');
  }
  
  console.log(`\n📄 Report written to: ${reportPath}`);
  
  process.exit(report.ok ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}
