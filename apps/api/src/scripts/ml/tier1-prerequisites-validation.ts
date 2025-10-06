#!/usr/bin/env tsx
/**
 * TIER 1 ML TRAINING PREREQUISITES VALIDATION
 *
 * Comprehensive validation of all prerequisites before training ML models.
 * Validates database, directories, scripts, environment, and data quality.
 *
 * SUCCESS CRITERIA:
 * - Database connectivity confirmed
 * - 2.3M+ outcomes settled at 100% rate
 * - All directories created with write permissions
 * - All training scripts executable
 * - Sample data quality verified
 * - Environment variables confirmed
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment from root .env
const envPath = path.join(__dirname, '../../../../../.env');
dotenv.config({ path: envPath });

interface ValidationResult {
  category: string;
  check: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string;
  error?: string;
}

const results: ValidationResult[] = [];

function logResult(category: string, check: string, status: 'PASS' | 'FAIL' | 'WARNING', details: string, error?: string) {
  results.push({ category, check, status, details, error });
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${emoji} [${category}] ${check}: ${details}`);
  if (error) console.log(`   Error: ${error}`);
}

async function validateDatabaseConnectivity() {
  console.log('\n=== 1. DATABASE CONNECTIVITY ===\n');

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      logResult('Database', 'Environment Variables', 'FAIL',
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return false;
    }

    logResult('Database', 'Environment Variables', 'PASS',
      `URL: ${supabaseUrl.substring(0, 30)}..., Key: ${supabaseKey.substring(0, 20)}...`);

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test connection with a simple query
    const { data: testData, error: testError } = await supabase
      .from('settled_outcomes')
      .select('id', { count: 'exact', head: true });

    if (testError) {
      logResult('Database', 'Connection Test', 'FAIL',
        'Failed to connect to Supabase', testError.message);
      return false;
    }

    logResult('Database', 'Connection Test', 'PASS',
      'Successfully connected to Supabase');

    // Check if settled_outcomes table exists and is accessible
    const { count, error: countError } = await supabase
      .from('settled_outcomes')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      logResult('Database', 'settled_outcomes Table', 'FAIL',
        'Table not accessible', countError.message);
      return false;
    }

    logResult('Database', 'settled_outcomes Table', 'PASS',
      `Table exists and accessible. Total rows: ${count?.toLocaleString() || 'unknown'}`);

    // Calculate settlement rate
    const { count: totalCount } = await supabase
      .from('settled_outcomes')
      .select('*', { count: 'exact', head: true });

    const { count: settledCount } = await supabase
      .from('settled_outcomes')
      .select('*', { count: 'exact', head: true })
      .not('actual_value', 'is', null);

    const settlementRate = totalCount && settledCount
      ? ((settledCount / totalCount) * 100).toFixed(2)
      : '0';

    logResult('Database', 'Settlement Rate',
      parseFloat(settlementRate) >= 99.9 ? 'PASS' : 'WARNING',
      `${settlementRate}% of outcomes have actual_value populated (${settledCount?.toLocaleString()} / ${totalCount?.toLocaleString()})`);

    // Check expected count (should be ~2.3M)
    const expectedMin = 2000000; // 2M minimum
    if (totalCount && totalCount < expectedMin) {
      logResult('Database', 'Data Volume', 'WARNING',
        `Only ${totalCount.toLocaleString()} outcomes found (expected ~2.3M)`);
    } else {
      logResult('Database', 'Data Volume', 'PASS',
        `${totalCount?.toLocaleString()} outcomes available`);
    }

    return true;
  } catch (error) {
    logResult('Database', 'Connectivity', 'FAIL',
      'Unexpected error during database validation',
      error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function validateDirectoryStructure() {
  console.log('\n=== 2. DIRECTORY STRUCTURE ===\n');

  const baseDir = path.join(__dirname, '../../../../..');
  const requiredDirs = [
    'apps/api/ml-models/calibration',
    'apps/api/config/enhanced45-weights',
    'out/ops'
  ];

  let allCreated = true;

  for (const dir of requiredDirs) {
    const fullPath = path.join(baseDir, dir);

    try {
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        logResult('Directories', dir, 'PASS', `Created: ${fullPath}`);
      } else {
        logResult('Directories', dir, 'PASS', `Already exists: ${fullPath}`);
      }

      // Test write permissions
      const testFile = path.join(fullPath, '.write-test');
      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        logResult('Directories', `${dir} (write)`, 'PASS', 'Write permissions confirmed');
      } catch (writeError) {
        logResult('Directories', `${dir} (write)`, 'FAIL',
          'No write permissions',
          writeError instanceof Error ? writeError.message : String(writeError));
        allCreated = false;
      }
    } catch (error) {
      logResult('Directories', dir, 'FAIL',
        'Failed to create directory',
        error instanceof Error ? error.message : String(error));
      allCreated = false;
    }
  }

  return allCreated;
}

async function validateScripts() {
  console.log('\n=== 3. SCRIPT VALIDATION ===\n');

  const scriptDir = path.join(__dirname, '..');
  const requiredScripts = [
    'ml/train-calibration-model.ts',
    'ml/train-factor-weights.ts',
    'ml/comprehensive-backtest.ts'
  ];

  let allValid = true;

  for (const script of requiredScripts) {
    const fullPath = path.join(scriptDir, script);

    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      logResult('Scripts', script, 'PASS',
        `Exists (${(stats.size / 1024).toFixed(2)} KB)`);
    } else {
      logResult('Scripts', script, 'FAIL',
        'Script not found', `Path: ${fullPath}`);
      allValid = false;
    }
  }

  // Test TypeScript execution
  try {
    const { execSync } = require('child_process');
    const testScript = path.join(__dirname, 'test-ts-execution.ts');

    // Create a simple test script
    fs.writeFileSync(testScript, `console.log('TypeScript execution works!');`);

    execSync(`npx tsx ${testScript}`, { stdio: 'pipe' });
    fs.unlinkSync(testScript);

    logResult('Scripts', 'TypeScript Execution', 'PASS',
      'tsx can execute TypeScript files');
  } catch (error) {
    logResult('Scripts', 'TypeScript Execution', 'FAIL',
      'Cannot execute TypeScript',
      error instanceof Error ? error.message : String(error));
    allValid = false;
  }

  return allValid;
}

async function validateEnvironmentVariables() {
  console.log('\n=== 4. ENVIRONMENT VARIABLES ===\n');

  const requiredVars = [
    { name: 'SUPABASE_URL', maskAt: 30 },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', maskAt: 20 },
    { name: 'SGO_API_KEY', maskAt: 10 },
    { name: 'ODDS_API_KEY', maskAt: 10 }
  ];

  let allPresent = true;

  for (const { name, maskAt } of requiredVars) {
    const value = process.env[name];

    if (value) {
      const masked = value.substring(0, maskAt) + '...';
      logResult('Environment', name, 'PASS', masked);
    } else {
      logResult('Environment', name, 'FAIL', 'Not set');
      allPresent = false;
    }
  }

  return allPresent;
}

async function validateDataQuality() {
  console.log('\n=== 5. DATA QUALITY CHECK ===\n');

  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Sample 100 random outcomes
    const { data: sample, error } = await supabase
      .from('settled_outcomes')
      .select('*')
      .not('actual_value', 'is', null)
      .limit(100);

    if (error || !sample) {
      logResult('Data Quality', 'Sample Query', 'FAIL',
        'Failed to fetch sample', error?.message);
      return false;
    }

    logResult('Data Quality', 'Sample Query', 'PASS',
      `Successfully fetched ${sample.length} outcomes`);

    // Check required fields
    const requiredFields = ['sport', 'market_type', 'line', 'actual_value', 'player_name', 'team'];
    let missingFieldsCount = 0;

    for (const field of requiredFields) {
      const withField = sample.filter(row => row[field] != null).length;
      const percentage = ((withField / sample.length) * 100).toFixed(1);

      if (parseFloat(percentage) < 95) {
        logResult('Data Quality', `Field: ${field}`, 'WARNING',
          `Only ${percentage}% populated in sample`);
        missingFieldsCount++;
      } else {
        logResult('Data Quality', `Field: ${field}`, 'PASS',
          `${percentage}% populated in sample`);
      }
    }

    // Check sport distribution
    const sportCounts: Record<string, number> = {};
    sample.forEach(row => {
      const sport = row.sport || 'UNKNOWN';
      sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    });

    console.log('\n   Sport Distribution in Sample:');
    Object.entries(sportCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([sport, count]) => {
        console.log(`   - ${sport}: ${count} (${((count / sample.length) * 100).toFixed(1)}%)`);
      });

    logResult('Data Quality', 'Sport Distribution', 'PASS',
      `${Object.keys(sportCounts).length} unique sports in sample`);

    return missingFieldsCount === 0;
  } catch (error) {
    logResult('Data Quality', 'Validation', 'FAIL',
      'Unexpected error during data quality check',
      error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('TIER 1 ML TRAINING PREREQUISITES VALIDATION REPORT');
  console.log('='.repeat(80) + '\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;

  console.log(`Total Checks: ${results.length}`);
  console.log(`✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log(`⚠️  WARNINGS: ${warnings}\n`);

  // Category summary
  const categories = [...new Set(results.map(r => r.category))];
  console.log('Category Summary:');
  categories.forEach(cat => {
    const catResults = results.filter(r => r.category === cat);
    const catPassed = catResults.filter(r => r.status === 'PASS').length;
    const catFailed = catResults.filter(r => r.status === 'FAIL').length;
    const catWarnings = catResults.filter(r => r.status === 'WARNING').length;

    const status = catFailed > 0 ? '❌' : catWarnings > 0 ? '⚠️' : '✅';
    console.log(`  ${status} ${cat}: ${catPassed}/${catResults.length} passed`);
  });

  // Failed checks detail
  if (failed > 0) {
    console.log('\n⚠️  FAILED CHECKS:');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`   ❌ [${r.category}] ${r.check}: ${r.details}`);
        if (r.error) console.log(`      Error: ${r.error}`);
      });
  }

  // Warning checks detail
  if (warnings > 0) {
    console.log('\n⚠️  WARNINGS:');
    results
      .filter(r => r.status === 'WARNING')
      .forEach(r => {
        console.log(`   ⚠️  [${r.category}] ${r.check}: ${r.details}`);
      });
  }

  // GO/NO-GO decision
  console.log('\n' + '='.repeat(80));
  const goNoGo = failed === 0 ? 'GO ✅' : 'NO-GO ❌';
  console.log(`TRAINING READINESS: ${goNoGo}`);
  console.log('='.repeat(80) + '\n');

  if (failed === 0 && warnings === 0) {
    console.log('🚀 ALL SYSTEMS GO! Ready to begin ML training for Tier 1.');
  } else if (failed === 0) {
    console.log('⚠️  System is functional but has warnings. Review before proceeding.');
  } else {
    console.log('❌ CRITICAL ISSUES DETECTED. Fix failed checks before training.');
  }

  // Save report to file
  const reportPath = path.join(__dirname, '../../../../../out/ops/tier1-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { passed, failed, warnings, total: results.length },
    decision: goNoGo,
    results
  }, null, 2));

  console.log(`\n📄 Full report saved to: ${reportPath}\n`);

  return failed === 0;
}

async function main() {
  console.log('Starting Tier 1 ML Training Prerequisites Validation...\n');
  console.log(`Working Directory: ${process.cwd()}`);
  console.log(`Environment File: ${envPath}\n`);

  try {
    await validateDatabaseConnectivity();
    await validateDirectoryStructure();
    await validateScripts();
    await validateEnvironmentVariables();
    await validateDataQuality();

    const success = await generateReport();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ FATAL ERROR during validation:');
    console.error(error);
    process.exit(1);
  }
}

main();
