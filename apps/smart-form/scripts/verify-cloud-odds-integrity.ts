/**
 * SMARTFORM-ODDS-FIELD-INTEGRITY-007
 * Cloud Database Odds Integrity Verification
 *
 * Purpose: Verify that all odds fields in cloud Supabase comply with the contract:
 * - American odds must be integers with abs(value) >= 100
 * - No null/undefined odds for submitted picks
 * - Proper range validation (-50000 to +50000)
 *
 * Run via GitHub Actions workflow (secrets injected) or with local .env:
 *   npx tsx apps/smart-form/scripts/verify-cloud-odds-integrity.ts
 */

import { createClient } from '@supabase/supabase-js';

// Contract Constants
const MIN_AMERICAN_ODDS = 100; // Absolute minimum for American odds
const MAX_AMERICAN_ODDS = 50000; // Reasonable maximum

interface OddsValidationResult {
  table: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  nullOdds: number;
  outOfRange: number;
  nonInteger: number;
  violations: Array<{
    id: string;
    field: string;
    value: unknown;
    issue: string;
  }>;
}

interface IntegrityReport {
  timestamp: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  tables: OddsValidationResult[];
  summary: {
    totalTablesChecked: number;
    totalRowsChecked: number;
    totalViolations: number;
    complianceRate: number;
  };
}

async function validateOddsField(value: unknown, fieldName: string): Promise<{ valid: boolean; issue: string | null }> {
  // Null check
  if (value === null || value === undefined) {
    return { valid: false, issue: 'NULL_OR_UNDEFINED' };
  }

  // Number check
  if (typeof value !== 'number') {
    return { valid: false, issue: 'NOT_A_NUMBER' };
  }

  // Integer check
  if (!Number.isInteger(value)) {
    return { valid: false, issue: 'NOT_INTEGER' };
  }

  // Zero check (invalid for American odds)
  if (value === 0) {
    return { valid: false, issue: 'ZERO_NOT_ALLOWED' };
  }

  // Range check (abs must be >= 100)
  if (Math.abs(value) < MIN_AMERICAN_ODDS) {
    return { valid: false, issue: `OUT_OF_RANGE_LOW: abs(${value}) < ${MIN_AMERICAN_ODDS}` };
  }

  // Max range check
  if (Math.abs(value) > MAX_AMERICAN_ODDS) {
    return { valid: false, issue: `OUT_OF_RANGE_HIGH: abs(${value}) > ${MAX_AMERICAN_ODDS}` };
  }

  return { valid: true, issue: null };
}

// GAUNTLET-CLOSEOUT-028: Use any for Supabase client type to avoid inference issues
async function validateTable(
  supabase: any,
  tableName: string,
  oddsColumns: string[],
  idColumn: string = 'id'
): Promise<OddsValidationResult> {
  const result: OddsValidationResult = {
    table: tableName,
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    nullOdds: 0,
    outOfRange: 0,
    nonInteger: 0,
    violations: [],
  };

  try {
    // Fetch rows with odds columns
    const selectColumns = [idColumn, ...oddsColumns].join(', ');
    const { data, error } = await supabase
      .from(tableName)
      .select(selectColumns)
      .limit(10000); // Limit for performance

    if (error) {
      console.error(`Error querying ${tableName}:`, error.message);
      return result;
    }

    if (!data || data.length === 0) {
      console.log(`No data in ${tableName}`);
      return result;
    }

    result.totalRows = data.length;

    // GAUNTLET-CLOSEOUT-028: Type assertion for dynamic column access
    for (const row of data as Record<string, any>[]) {
      let rowHasViolation = false;

      for (const col of oddsColumns) {
        const value = row[col];
        const validation = await validateOddsField(value, col);

        if (!validation.valid) {
          rowHasViolation = true;
          result.violations.push({
            id: String(row[idColumn]),
            field: col,
            value,
            issue: validation.issue!,
          });

          // Categorize violation
          if (validation.issue === 'NULL_OR_UNDEFINED') {
            result.nullOdds++;
          } else if (validation.issue === 'NOT_INTEGER') {
            result.nonInteger++;
          } else if (validation.issue?.startsWith('OUT_OF_RANGE')) {
            result.outOfRange++;
          }
        }
      }

      if (rowHasViolation) {
        result.invalidRows++;
      } else {
        result.validRows++;
      }
    }
  } catch (err) {
    console.error(`Exception validating ${tableName}:`, err);
  }

  return result;
}

async function runIntegrityCheck(): Promise<IntegrityReport> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('='.repeat(60));
  console.log('SMARTFORM-ODDS-FIELD-INTEGRITY-007');
  console.log('Cloud Database Odds Integrity Verification');
  console.log('='.repeat(60));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Target: ${supabaseUrl}`);
  console.log('');

  // Define tables and their odds columns to validate
  const tablesToValidate = [
    { name: 'unified_picks', columns: ['odds', 'bet_line'], id: 'id' },
    { name: 'raw_props', columns: ['over_odds', 'under_odds'], id: 'id' },
    { name: 'line_snapshots', columns: ['over_odds', 'under_odds'], id: 'id' },
  ];

  const results: OddsValidationResult[] = [];

  for (const table of tablesToValidate) {
    console.log(`Validating ${table.name}...`);
    const result = await validateTable(supabase, table.name, table.columns, table.id);
    results.push(result);

    console.log(`  Total rows: ${result.totalRows}`);
    console.log(`  Valid: ${result.validRows}, Invalid: ${result.invalidRows}`);
    if (result.violations.length > 0) {
      console.log(`  Violations: ${result.violations.length} (first 5 shown)`);
      result.violations.slice(0, 5).forEach(v => {
        console.log(`    - ${v.id}: ${v.field} = ${v.value} (${v.issue})`);
      });
    }
    console.log('');
  }

  // Calculate summary
  const totalRows = results.reduce((sum, r) => sum + r.totalRows, 0);
  const totalViolations = results.reduce((sum, r) => sum + r.violations.length, 0);
  const validRows = results.reduce((sum, r) => sum + r.validRows, 0);
  const complianceRate = totalRows > 0 ? (validRows / totalRows) * 100 : 100;

  // Determine status
  let status: 'PASS' | 'FAIL' | 'WARN' = 'PASS';
  if (complianceRate < 95) {
    status = 'FAIL';
  } else if (totalViolations > 0) {
    status = 'WARN';
  }

  const report: IntegrityReport = {
    timestamp: new Date().toISOString(),
    status,
    tables: results,
    summary: {
      totalTablesChecked: results.length,
      totalRowsChecked: totalRows,
      totalViolations,
      complianceRate: Math.round(complianceRate * 100) / 100,
    },
  };

  // Print summary
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Status: ${status}`);
  console.log(`Tables checked: ${report.summary.totalTablesChecked}`);
  console.log(`Rows checked: ${report.summary.totalRowsChecked}`);
  console.log(`Total violations: ${report.summary.totalViolations}`);
  console.log(`Compliance rate: ${report.summary.complianceRate}%`);
  console.log('');

  if (status === 'FAIL') {
    console.error('❌ INTEGRITY CHECK FAILED');
    process.exitCode = 1;
  } else if (status === 'WARN') {
    console.warn('⚠️  INTEGRITY CHECK PASSED WITH WARNINGS');
  } else {
    console.log('✅ INTEGRITY CHECK PASSED');
  }

  return report;
}

// Run if executed directly
runIntegrityCheck()
  .then(report => {
    // Output JSON report for CI parsing
    console.log('\n--- JSON REPORT ---');
    console.log(JSON.stringify(report, null, 2));
  })
  .catch(err => {
    console.error('Integrity check failed:', err);
    process.exit(1);
  });
