#!/usr/bin/env node
/**
 * QUARANTINE-ENFORCEMENT-LOCK-005: Quarantine Gate Script
 *
 * Enforces constitutional quarantine discipline:
 * 1. CI fails if quarantine expiration date is reached
 * 2. CI fails if quarantine count exceeds cap
 * 3. CI fails if entries missing required fields
 *
 * Exit codes:
 *   0 - All validations pass
 *   1 - Validation failure (blocks CI)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const MANIFEST_PATH = path.resolve(__dirname, '../test/__quarantine__/MANIFEST.json');
const REPORT_OUTPUT_DIR = path.resolve(__dirname, '../../../out/ci');
const REPORT_PATH = path.join(REPORT_OUTPUT_DIR, 'quarantine_report.md');

const REQUIRED_ENTRY_FIELDS = ['file', 'category', 'reason', 'ticket', 'expiration'];
const VALID_REASONS = ['OBSOLETE_API', 'TYPE_DRIFT', 'DEPENDENCY_MISSING'];

// Utilities
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function daysBetween(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((date2 - date1) / oneDay);
}

// Validation results
const results = {
  manifestExists: { status: 'PENDING', message: '' },
  manifestValid: { status: 'PENDING', message: '' },
  expirationNotReached: { status: 'PENDING', message: '' },
  countWithinCap: { status: 'PENDING', message: '' },
  entriesValid: { status: 'PENDING', message: '' },
  entryExpirationsValid: { status: 'PENDING', message: '' }
};

let manifest = null;
let errors = [];
let warnings = [];

// Step 1: Check manifest exists
function checkManifestExists() {
  if (fs.existsSync(MANIFEST_PATH)) {
    results.manifestExists = { status: 'PASS', message: 'Manifest file found' };
    return true;
  } else {
    results.manifestExists = { status: 'FAIL', message: `Manifest not found at ${MANIFEST_PATH}` };
    errors.push(`Manifest file not found: ${MANIFEST_PATH}`);
    return false;
  }
}

// Step 2: Parse and validate JSON
function checkManifestValid() {
  try {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    manifest = JSON.parse(content);

    // Check required top-level fields
    const requiredFields = ['version', 'expiration_date', 'max_quarantined_suites', 'entries'];
    const missingFields = requiredFields.filter(f => !(f in manifest));

    if (missingFields.length > 0) {
      results.manifestValid = { status: 'FAIL', message: `Missing fields: ${missingFields.join(', ')}` };
      errors.push(`Manifest missing required fields: ${missingFields.join(', ')}`);
      return false;
    }

    results.manifestValid = { status: 'PASS', message: 'Valid JSON structure' };
    return true;
  } catch (e) {
    results.manifestValid = { status: 'FAIL', message: `JSON parse error: ${e.message}` };
    errors.push(`Manifest JSON parse error: ${e.message}`);
    return false;
  }
}

// Step 3: Check global expiration date
function checkExpirationNotReached() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiration = new Date(manifest.expiration_date);
  expiration.setHours(0, 0, 0, 0);

  const daysRemaining = daysBetween(today, expiration);

  if (today >= expiration) {
    results.expirationNotReached = {
      status: 'FAIL',
      message: `Expiration date ${manifest.expiration_date} has been reached!`
    };
    errors.push(`QUARANTINE EXPIRED: Expiration date ${manifest.expiration_date} has been reached. All quarantined tests must be FIXED or DELETED.`);
    return false;
  }

  if (daysRemaining <= 7) {
    warnings.push(`WARNING: Quarantine expires in ${daysRemaining} days (${manifest.expiration_date})`);
  }

  results.expirationNotReached = {
    status: 'PASS',
    message: `${daysRemaining} days until expiration (${manifest.expiration_date})`
  };
  return true;
}

// Step 4: Check count against cap
function checkCountWithinCap() {
  const count = manifest.entries.length;
  const cap = manifest.max_quarantined_suites;

  if (count > cap) {
    results.countWithinCap = {
      status: 'FAIL',
      message: `Count ${count} exceeds cap ${cap}`
    };
    errors.push(`QUARANTINE OVERFLOW: ${count} entries exceeds max_quarantined_suites cap of ${cap}. Reduce quarantine or increase cap with justification.`);
    return false;
  }

  const utilization = Math.round((count / cap) * 100);
  if (utilization >= 90) {
    warnings.push(`WARNING: Quarantine at ${utilization}% capacity (${count}/${cap})`);
  }

  results.countWithinCap = {
    status: 'PASS',
    message: `${count}/${cap} (${utilization}% utilized)`
  };
  return true;
}

// Step 5: Validate all entries have required fields
function checkEntriesValid() {
  const invalidEntries = [];

  for (const entry of manifest.entries) {
    const missingFields = REQUIRED_ENTRY_FIELDS.filter(f => !entry[f]);
    if (missingFields.length > 0) {
      invalidEntries.push({ file: entry.file || 'UNKNOWN', missingFields });
    }

    // Validate reason is valid
    if (entry.reason && !VALID_REASONS.includes(entry.reason)) {
      invalidEntries.push({ file: entry.file, invalidReason: entry.reason });
    }
  }

  if (invalidEntries.length > 0) {
    results.entriesValid = {
      status: 'FAIL',
      message: `${invalidEntries.length} entries have validation errors`
    };
    for (const inv of invalidEntries) {
      if (inv.missingFields) {
        errors.push(`Entry "${inv.file}" missing fields: ${inv.missingFields.join(', ')}`);
      }
      if (inv.invalidReason) {
        errors.push(`Entry "${inv.file}" has invalid reason: ${inv.invalidReason}. Valid: ${VALID_REASONS.join(', ')}`);
      }
    }
    return false;
  }

  results.entriesValid = {
    status: 'PASS',
    message: `All ${manifest.entries.length} entries valid`
  };
  return true;
}

// Step 6: Check individual entry expirations
function checkEntryExpirationsValid() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiredEntries = [];

  for (const entry of manifest.entries) {
    if (entry.expiration) {
      const entryExp = new Date(entry.expiration);
      entryExp.setHours(0, 0, 0, 0);

      if (today >= entryExp) {
        expiredEntries.push(entry.file);
      }
    }
  }

  if (expiredEntries.length > 0) {
    results.entryExpirationsValid = {
      status: 'FAIL',
      message: `${expiredEntries.length} entries have expired`
    };
    errors.push(`ENTRIES EXPIRED: The following tests have reached their individual expiration and must be resolved:\n  - ${expiredEntries.join('\n  - ')}`);
    return false;
  }

  results.entryExpirationsValid = {
    status: 'PASS',
    message: 'No individual expirations reached'
  };
  return true;
}

// Generate report
function generateReport() {
  const today = formatDate(new Date());
  const overallStatus = errors.length === 0 ? 'PASS' : 'FAIL';

  // Count by category
  const categoryCount = {};
  const reasonCount = {};
  if (manifest && manifest.entries) {
    for (const entry of manifest.entries) {
      categoryCount[entry.category] = (categoryCount[entry.category] || 0) + 1;
      reasonCount[entry.reason] = (reasonCount[entry.reason] || 0) + 1;
    }
  }

  let report = `# Quarantine Gate Report

**Date**: ${today}
**Status**: ${overallStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}
**Sprint**: QUARANTINE-ENFORCEMENT-LOCK-005

---

## Summary

| Metric | Value |
|--------|-------|
| Quarantined Suites | ${manifest ? manifest.entries.length : 'N/A'} |
| Max Allowed | ${manifest ? manifest.max_quarantined_suites : 'N/A'} |
| Global Expiration | ${manifest ? manifest.expiration_date : 'N/A'} |
| Days Until Expiration | ${manifest ? daysBetween(new Date(), new Date(manifest.expiration_date)) : 'N/A'} |

---

## Validations

| Check | Status | Details |
|-------|--------|---------|
| Manifest exists | ${results.manifestExists.status} | ${results.manifestExists.message} |
| Manifest valid JSON | ${results.manifestValid.status} | ${results.manifestValid.message} |
| Expiration not reached | ${results.expirationNotReached.status} | ${results.expirationNotReached.message} |
| Count within cap | ${results.countWithinCap.status} | ${results.countWithinCap.message} |
| All entries valid | ${results.entriesValid.status} | ${results.entriesValid.message} |
| Entry expirations valid | ${results.entryExpirationsValid.status} | ${results.entryExpirationsValid.message} |

`;

  if (errors.length > 0) {
    report += `---

## Errors (${errors.length})

`;
    for (const err of errors) {
      report += `- ❌ ${err}\n`;
    }
  }

  if (warnings.length > 0) {
    report += `
---

## Warnings (${warnings.length})

`;
    for (const warn of warnings) {
      report += `- ⚠️ ${warn}\n`;
    }
  }

  if (manifest && manifest.entries) {
    report += `
---

## Entries by Category

| Category | Count |
|----------|-------|
`;
    for (const [cat, count] of Object.entries(categoryCount).sort((a, b) => b[1] - a[1])) {
      report += `| ${cat} | ${count} |\n`;
    }

    report += `
---

## Entries by Reason

| Reason | Count |
|--------|-------|
`;
    for (const [reason, count] of Object.entries(reasonCount).sort((a, b) => b[1] - a[1])) {
      report += `| ${reason} | ${count} |\n`;
    }
  }

  report += `
---

**Generated by**: quarantine-gate.mjs
**Enforcement Sprint**: QUARANTINE-ENFORCEMENT-LOCK-005
`;

  return report;
}

// Main execution
async function main() {
  console.log('🔒 QUARANTINE GATE');
  console.log('   Sprint: QUARANTINE-ENFORCEMENT-LOCK-005');
  console.log('   Mode: STRICT (CI enforcement)');
  console.log('');

  // Run validations
  let allPassed = true;

  if (!checkManifestExists()) {
    allPassed = false;
  } else if (!checkManifestValid()) {
    allPassed = false;
  } else {
    // Only run these if manifest loaded successfully
    if (!checkExpirationNotReached()) allPassed = false;
    if (!checkCountWithinCap()) allPassed = false;
    if (!checkEntriesValid()) allPassed = false;
    if (!checkEntryExpirationsValid()) allPassed = false;
  }

  // Generate and write report
  const report = generateReport();

  try {
    fs.mkdirSync(REPORT_OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(REPORT_PATH, report);
    console.log(`📄 Report written to: ${REPORT_PATH}`);
  } catch (e) {
    console.error(`⚠️  Could not write report: ${e.message}`);
  }

  // Print summary
  console.log('');
  console.log('📊 Results:');
  for (const [check, result] of Object.entries(results)) {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏳';
    console.log(`   ${icon} ${check}: ${result.message}`);
  }

  if (warnings.length > 0) {
    console.log('');
    console.log('⚠️  Warnings:');
    for (const warn of warnings) {
      console.log(`   ${warn}`);
    }
  }

  console.log('');

  if (allPassed) {
    console.log('✅ QUARANTINE GATE PASSED');
    process.exit(0);
  } else {
    console.log('❌ QUARANTINE GATE FAILED');
    console.log('');
    console.log('Errors:');
    for (const err of errors) {
      console.log(`   - ${err}`);
    }
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
