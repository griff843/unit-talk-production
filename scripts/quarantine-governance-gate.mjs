#!/usr/bin/env node
/**
 * QUARANTINE-GOVERNANCE-ENFORCEMENT-006: Quarantine Governance Gate
 *
 * Enforces governance/quality/QUARANTINE_POLICY_v1.0.md at CI level:
 * 1. Inventories ALL test files across repo
 * 2. Computes quarantine percentage against 15% hard cap
 * 3. Validates SLA compliance (30-day max)
 * 4. Validates manifest-to-filesystem integrity
 * 5. Generates proof artifacts
 *
 * Exit codes:
 *   0 - All governance checks pass
 *   1 - Governance violation (fail-closed, blocks CI)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuration ──────────────────────────────────────────────────────────
const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'governance', 'quality', 'QUARANTINE_MANIFEST.json');
const REPORT_DIR = path.join(REPO_ROOT, 'out', 'ci');

const WORKSPACE_ROOTS = ['apps', 'packages'];
const TEST_PATTERNS = /\.(test|spec)\.(ts|tsx)$/;
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.next', 'out', '.git', 'coverage']);
const QUARANTINE_DIR_NAME = '__quarantine__';

// ─── Test File Discovery ────────────────────────────────────────────────────
function walkDir(dir, results) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, results);
    } else if (entry.isFile() && TEST_PATTERNS.test(entry.name)) {
      results.push(path.relative(REPO_ROOT, fullPath).replace(/\\/g, '/'));
    }
  }
}

function discoverTestFiles() {
  const allFiles = [];
  for (const root of WORKSPACE_ROOTS) {
    walkDir(path.join(REPO_ROOT, root), allFiles);
  }
  const quarantined = allFiles.filter(f => f.includes(`/${QUARANTINE_DIR_NAME}/`));
  const active = allFiles.filter(f => !f.includes(`/${QUARANTINE_DIR_NAME}/`));
  return { all: allFiles, active, quarantined };
}

// ─── Manifest Loading ───────────────────────────────────────────────────────
function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { error: `Manifest not found: ${MANIFEST_PATH}` };
  }
  try {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    const manifest = JSON.parse(content);

    const required = ['version', 'max_percentage', 'max_days', 'tests'];
    const missing = required.filter(f => !(f in manifest));
    if (missing.length > 0) {
      return { error: `Manifest missing fields: ${missing.join(', ')}` };
    }
    if (!Array.isArray(manifest.tests)) {
      return { error: 'Manifest "tests" must be an array' };
    }

    const entryRequired = ['file_path', 'reason', 'date_quarantined', 'owner', 'restoration_deadline'];
    const invalidEntries = [];
    for (const entry of manifest.tests) {
      const missingFields = entryRequired.filter(f => !entry[f]);
      if (missingFields.length > 0) {
        invalidEntries.push({ file: entry.file_path || 'UNKNOWN', missingFields });
      }
    }
    if (invalidEntries.length > 0) {
      return { error: `${invalidEntries.length} entries have missing fields`, details: invalidEntries };
    }

    return { manifest };
  } catch (e) {
    return { error: `JSON parse error: ${e.message}` };
  }
}

// ─── Percentage Threshold Check ─────────────────────────────────────────────
function checkPercentage(manifest, inventory) {
  const total = inventory.all.length;
  const quarantined = inventory.quarantined.length;
  const percentage = total > 0 ? (quarantined / total) * 100 : 0;
  const threshold = manifest.max_percentage;

  const result = {
    pass: false,
    total_test_count: total,
    quarantined_count: quarantined,
    active_count: inventory.active.length,
    percentage: Math.round(percentage * 100) / 100,
    threshold,
    waiver_active: false,
    details: ''
  };

  // Check for active waiver
  const waiver = manifest.temporary_waiver;
  if (waiver && waiver.active) {
    const waiverExpiry = new Date(waiver.expiration_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    waiverExpiry.setHours(0, 0, 0, 0);

    if (today <= waiverExpiry) {
      result.waiver_active = true;
      result.waiver_baseline = waiver.baseline_count;
      result.waiver_expires = waiver.expiration_date;

      if (quarantined > waiver.baseline_count) {
        result.details = `WAIVER VIOLATION: quarantine grew from ${waiver.baseline_count} to ${quarantined} (no-growth enforced)`;
        return result;
      }

      result.pass = true;
      result.details = `WAIVER ACTIVE: ${quarantined}/${waiver.baseline_count} (no-growth), waiver expires ${waiver.expiration_date}`;
      return result;
    }
    // Waiver expired — fall through to standard check
    result.details = `Waiver expired on ${waiver.expiration_date}`;
  }

  // Standard threshold check
  if (percentage > threshold) {
    result.details = `${result.percentage}% exceeds ${threshold}% threshold`;
    return result;
  }

  result.pass = true;
  result.details = `${result.percentage}% within ${threshold}% threshold`;
  return result;
}

// ─── SLA Compliance Check ───────────────────────────────────────────────────
function checkSLA(manifest) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDays = manifest.max_days;
  const violations = [];

  for (const entry of manifest.tests) {
    const quarantinedDate = new Date(entry.date_quarantined);
    quarantinedDate.setHours(0, 0, 0, 0);
    const ageDays = Math.floor((today - quarantinedDate) / (24 * 60 * 60 * 1000));

    if (ageDays > maxDays) {
      violations.push({
        file_path: entry.file_path,
        age_days: ageDays,
        max_days: maxDays,
        date_quarantined: entry.date_quarantined,
        restoration_deadline: entry.restoration_deadline
      });
    }
  }

  return {
    pass: violations.length === 0,
    checked_count: manifest.tests.length,
    max_days: maxDays,
    oldest_age_days: manifest.tests.reduce((max, e) => {
      const age = Math.floor((today - new Date(e.date_quarantined)) / (24 * 60 * 60 * 1000));
      return Math.max(max, age);
    }, 0),
    violations
  };
}

// ─── Manifest Integrity Check ───────────────────────────────────────────────
function checkIntegrity(manifest, inventory) {
  const manifestPaths = new Set(manifest.tests.map(e => e.file_path));
  const diskPaths = new Set(inventory.quarantined);

  const missingOnDisk = [];
  for (const mp of manifestPaths) {
    if (!diskPaths.has(mp)) {
      missingOnDisk.push(mp);
    }
  }

  const orphanOnDisk = [];
  for (const dp of diskPaths) {
    if (!manifestPaths.has(dp)) {
      orphanOnDisk.push(dp);
    }
  }

  return {
    pass: missingOnDisk.length === 0 && orphanOnDisk.length === 0,
    manifest_count: manifestPaths.size,
    disk_count: diskPaths.size,
    missing_on_disk: missingOnDisk,
    orphan_on_disk: orphanOnDisk
  };
}

// ─── Proof Generation ───────────────────────────────────────────────────────
function generateProofs(inventory, percentageResult, slaResult) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  // proof_test_inventory.json
  fs.writeFileSync(
    path.join(REPORT_DIR, 'proof_test_inventory.json'),
    JSON.stringify({
      generated: new Date().toISOString(),
      sprint: 'QUARANTINE-GOVERNANCE-ENFORCEMENT-006',
      total_test_count: inventory.all.length,
      active_count: inventory.active.length,
      quarantined_count: inventory.quarantined.length,
      active_files: inventory.active,
      quarantined_files: inventory.quarantined
    }, null, 2)
  );

  // proof_quarantine_percentage.json
  fs.writeFileSync(
    path.join(REPORT_DIR, 'proof_quarantine_percentage.json'),
    JSON.stringify({
      generated: new Date().toISOString(),
      sprint: 'QUARANTINE-GOVERNANCE-ENFORCEMENT-006',
      ...percentageResult
    }, null, 2)
  );

  // proof_sla_check.json
  fs.writeFileSync(
    path.join(REPORT_DIR, 'proof_sla_check.json'),
    JSON.stringify({
      generated: new Date().toISOString(),
      sprint: 'QUARANTINE-GOVERNANCE-ENFORCEMENT-006',
      ...slaResult
    }, null, 2)
  );
}

// ─── Report Generation ──────────────────────────────────────────────────────
function generateReport(percentageResult, slaResult, integrityResult) {
  const today = new Date().toISOString().split('T')[0];
  const overall = percentageResult.pass && slaResult.pass && integrityResult.pass;

  const report = `# Quarantine Governance Report

**Date**: ${today}
**Status**: ${overall ? '✅ PASS' : '❌ FAIL'}
**Sprint**: QUARANTINE-GOVERNANCE-ENFORCEMENT-006

---

## Inventory

| Metric | Value |
|--------|-------|
| Total Test Files | ${percentageResult.total_test_count} |
| Active | ${percentageResult.active_count} |
| Quarantined | ${percentageResult.quarantined_count} |
| Percentage | ${percentageResult.percentage}% |
| Threshold | ${percentageResult.threshold}% |
| Waiver Active | ${percentageResult.waiver_active ? 'YES' : 'NO'} |

---

## Checks

| Check | Status | Details |
|-------|--------|---------|
| Percentage | ${percentageResult.pass ? 'PASS' : 'FAIL'} | ${percentageResult.details} |
| SLA | ${slaResult.pass ? 'PASS' : 'FAIL'} | ${slaResult.violations.length} violations, oldest ${slaResult.oldest_age_days}d (max ${slaResult.max_days}d) |
| Integrity | ${integrityResult.pass ? 'PASS' : 'FAIL'} | manifest=${integrityResult.manifest_count}, disk=${integrityResult.disk_count} |

${integrityResult.missing_on_disk.length > 0 ? `\n### Missing on Disk\n${integrityResult.missing_on_disk.map(f => '- ' + f).join('\n')}\n` : ''}
${integrityResult.orphan_on_disk.length > 0 ? `\n### Orphan Files (not in manifest)\n${integrityResult.orphan_on_disk.map(f => '- ' + f).join('\n')}\n` : ''}

---

**Generated by**: quarantine-governance-gate.mjs
`;

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'quarantine_governance_report.md'), report);
}

// ─── Main Execution ─────────────────────────────────────────────────────────
function main() {
  console.log('🔒 QUARANTINE GOVERNANCE GATE');
  console.log('   Sprint: QUARANTINE-GOVERNANCE-ENFORCEMENT-006');
  console.log('   Mode: STRICT (fail-closed)');
  console.log('');

  const errors = [];

  // Load manifest
  const manifestResult = loadManifest();
  if (manifestResult.error) {
    console.log(`❌ Manifest: ${manifestResult.error}`);
    if (manifestResult.details) {
      for (const d of manifestResult.details) {
        console.log(`   - ${d.file}: missing ${d.missingFields.join(', ')}`);
      }
    }
    process.exit(1);
  }
  const manifest = manifestResult.manifest;
  console.log(`✅ Manifest loaded: ${manifest.tests.length} entries`);

  // Discover tests
  const inventory = discoverTestFiles();
  console.log('');
  console.log('📊 Test Inventory:');
  console.log(`   Total: ${inventory.all.length}`);
  console.log(`   Active: ${inventory.active.length}`);
  console.log(`   Quarantined: ${inventory.quarantined.length}`);

  // Percentage check
  const percentageResult = checkPercentage(manifest, inventory);
  console.log('');
  console.log('📊 Percentage Check:');
  console.log(`   ${percentageResult.percentage}% (threshold: ${percentageResult.threshold}%)`);
  if (percentageResult.waiver_active) {
    console.log(`   ⚠️  WAIVER ACTIVE: baseline ${percentageResult.waiver_baseline}, current ${percentageResult.quarantined_count}`);
    console.log(`   ⚠️  Waiver expires: ${percentageResult.waiver_expires}`);
  }
  console.log(`   ${percentageResult.pass ? '✅' : '❌'} ${percentageResult.details}`);
  if (!percentageResult.pass) errors.push(percentageResult.details);

  // SLA check
  const slaResult = checkSLA(manifest);
  console.log('');
  console.log('📊 SLA Check:');
  console.log(`   Entries checked: ${slaResult.checked_count}`);
  console.log(`   Oldest: ${slaResult.oldest_age_days} days (max: ${slaResult.max_days})`);
  console.log(`   ${slaResult.pass ? '✅' : '❌'} ${slaResult.violations.length === 0 ? 'All within SLA' : `${slaResult.violations.length} SLA violations`}`);
  if (!slaResult.pass) {
    for (const v of slaResult.violations) {
      console.log(`   - ${v.file_path}: ${v.age_days}d (deadline: ${v.restoration_deadline})`);
    }
    errors.push(`${slaResult.violations.length} tests exceed ${slaResult.max_days}-day SLA`);
  }

  // Integrity check
  const integrityResult = checkIntegrity(manifest, inventory);
  console.log('');
  console.log('📊 Manifest Integrity:');
  console.log(`   Manifest entries: ${integrityResult.manifest_count}`);
  console.log(`   Disk files: ${integrityResult.disk_count}`);
  console.log(`   ${integrityResult.pass ? '✅' : '❌'} ${integrityResult.pass ? 'Manifest matches filesystem' : 'Integrity mismatch'}`);
  if (!integrityResult.pass) {
    if (integrityResult.missing_on_disk.length > 0) {
      console.log(`   Missing on disk:`);
      for (const f of integrityResult.missing_on_disk) console.log(`     - ${f}`);
      errors.push(`${integrityResult.missing_on_disk.length} manifest entries missing on disk`);
    }
    if (integrityResult.orphan_on_disk.length > 0) {
      console.log(`   Orphan files (not in manifest):`);
      for (const f of integrityResult.orphan_on_disk) console.log(`     - ${f}`);
      errors.push(`${integrityResult.orphan_on_disk.length} quarantined files not in manifest`);
    }
  }

  // Generate proofs and report
  try {
    generateProofs(inventory, percentageResult, slaResult);
    generateReport(percentageResult, slaResult, integrityResult);
    console.log('');
    console.log(`📄 Proofs written to: ${REPORT_DIR}`);
  } catch (e) {
    console.error(`⚠️  Could not write proofs: ${e.message}`);
  }

  // Final verdict
  console.log('');
  if (errors.length === 0) {
    const suffix = percentageResult.waiver_active ? ' (with active waiver)' : '';
    console.log(`✅ QUARANTINE GOVERNANCE GATE PASSED${suffix}`);
    process.exit(0);
  } else {
    console.log('❌ QUARANTINE GOVERNANCE GATE FAILED');
    console.log('');
    console.log('Errors:');
    for (const err of errors) {
      console.log(`   - ${err}`);
    }
    process.exit(1);
  }
}

main();
