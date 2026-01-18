#!/usr/bin/env tsx
/**
 * SQL Migration Idempotency Validator
 *
 * Purpose: Ensure all SQL migrations are idempotent and can be safely re-run
 * Usage: npx tsx scripts/ops/validate-migration-idempotency.ts [file1.sql file2.sql ...]
 *
 * Exit Codes:
 *   0 - All migrations are idempotent
 *   1 - Non-idempotent patterns detected (FAIL)
 *   2 - Error during validation
 *
 * Idempotency Patterns (REQUIRED):
 *   - CREATE TABLE IF NOT EXISTS
 *   - CREATE INDEX IF NOT EXISTS
 *   - ALTER TABLE ... ADD COLUMN IF NOT EXISTS (PostgreSQL 9.6+)
 *   - DROP ... IF EXISTS
 *   - DO $$ blocks for conditional logic
 *
 * Non-Idempotent Patterns (BLOCKED):
 *   - CREATE TABLE without IF NOT EXISTS
 *   - CREATE INDEX without IF NOT EXISTS
 *   - ALTER TABLE without IF NOT EXISTS
 *   - INSERT without ON CONFLICT
 *   - DROP without IF EXISTS
 */

import { readFileSync } from 'fs';
import { basename } from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface ValidationResult {
  file: string;
  isIdempotent: boolean;
  issues: ValidationIssue[];
  warnings: ValidationWarning[];
}

interface ValidationIssue {
  line: number;
  statement: string;
  reason: string;
  suggestion: string;
}

interface ValidationWarning {
  line: number;
  statement: string;
  reason: string;
}

// ============================================================================
// IDEMPOTENCY PATTERNS
// ============================================================================

const IDEMPOTENT_PATTERNS = [
  /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i,
  /CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS/i,
  /CREATE\s+(?:OR\s+REPLACE\s+)?(?:VIEW|FUNCTION|PROCEDURE)/i,
  /DROP\s+(?:TABLE|INDEX|VIEW|FUNCTION|PROCEDURE)\s+IF\s+EXISTS/i,
  /ALTER\s+TABLE\s+.*\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i,
  /DO\s+\$\$/i, // DO blocks for conditional logic
  /INSERT\s+INTO\s+.*\s+ON\s+CONFLICT/i,
];

const NON_IDEMPOTENT_PATTERNS = [
  {
    pattern: /CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)(\w+)/i,
    reason: 'CREATE TABLE without IF NOT EXISTS will fail if table exists',
    suggestion: 'Use: CREATE TABLE IF NOT EXISTS {table_name}',
  },
  {
    pattern: /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)(\w+)/i,
    reason: 'CREATE INDEX without IF NOT EXISTS will fail if index exists',
    suggestion: 'Use: CREATE INDEX IF NOT EXISTS {index_name}',
  },
  {
    pattern: /DROP\s+(?:TABLE|INDEX|VIEW|FUNCTION|PROCEDURE)\s+(?!IF\s+EXISTS)(\w+)/i,
    reason: 'DROP without IF EXISTS will fail if object does not exist',
    suggestion: 'Use: DROP {object_type} IF EXISTS {object_name}',
  },
  {
    pattern: /ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)(\w+)/i,
    reason: 'ALTER TABLE ADD COLUMN without IF NOT EXISTS will fail if column exists',
    suggestion: 'Use: ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column}',
  },
  {
    pattern: /INSERT\s+INTO\s+(?!.*ON\s+CONFLICT)(?!.*DO\s+\$\$)/is,
    reason: 'INSERT without ON CONFLICT or DO block may cause duplicates',
    suggestion: 'Use: INSERT INTO ... ON CONFLICT DO NOTHING or wrap in DO block',
  },
];

// ============================================================================
// SQL PARSING HELPERS
// ============================================================================

function removeComments(sql: string): string {
  // Remove single-line comments
  sql = sql.replace(/--.*$/gm, '');

  // Remove multi-line comments
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');

  return sql;
}

function extractStatements(sql: string): { statement: string; line: number }[] {
  const lines = sql.split('\n');
  const statements: { statement: string; line: number }[] = [];

  let currentStatement = '';
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line || line.startsWith('--')) continue;

    if (currentStatement === '') {
      startLine = i + 1;
    }

    currentStatement += ' ' + line;

    // Check for statement terminator
    if (line.endsWith(';')) {
      statements.push({
        statement: currentStatement.trim(),
        line: startLine,
      });
      currentStatement = '';
    }
  }

  // Add remaining statement if any
  if (currentStatement.trim()) {
    statements.push({
      statement: currentStatement.trim(),
      line: startLine,
    });
  }

  return statements;
}

// ============================================================================
// VALIDATION LOGIC
// ============================================================================

function validateMigration(filePath: string): ValidationResult {
  console.log(`\n🔍 Validating: ${basename(filePath)}`);

  const result: ValidationResult = {
    file: filePath,
    isIdempotent: true,
    issues: [],
    warnings: [],
  };

  try {
    // Read and parse SQL file
    const sql = readFileSync(filePath, 'utf-8');
    const cleanSql = removeComments(sql);
    const statements = extractStatements(cleanSql);

    console.log(`   Found ${statements.length} SQL statements`);

    // Validate each statement
    for (const { statement, line } of statements) {
      // Skip empty statements
      if (!statement.trim()) continue;

      // Check for non-idempotent patterns
      for (const { pattern, reason, suggestion } of NON_IDEMPOTENT_PATTERNS) {
        if (pattern.test(statement)) {
          // Check if statement is wrapped in DO block (makes it idempotent)
          if (statement.includes('DO $$') || statement.includes('DO $')) {
            result.warnings.push({
              line,
              statement: statement.substring(0, 100) + '...',
              reason: 'Statement in DO block - verify conditional logic is correct',
            });
            continue;
          }

          result.issues.push({
            line,
            statement: statement.substring(0, 100) + '...',
            reason,
            suggestion,
          });

          result.isIdempotent = false;
        }
      }

      // Check for idempotent patterns (informational)
      for (const pattern of IDEMPOTENT_PATTERNS) {
        if (pattern.test(statement)) {
          console.log(`   ✅ Line ${line}: Idempotent pattern detected`);
          break;
        }
      }
    }

    return result;
  } catch (error) {
    console.error(`❌ Error reading file: ${error instanceof Error ? error.message : String(error)}`);
    result.isIdempotent = false;
    result.issues.push({
      line: 0,
      statement: 'File read error',
      reason: error instanceof Error ? error.message : String(error),
      suggestion: 'Fix file permissions or syntax errors',
    });

    return result;
  }
}

function printResults(results: ValidationResult[]): void {
  console.log('\n========================================');
  console.log('MIGRATION IDEMPOTENCY VALIDATION REPORT');
  console.log('========================================\n');

  let totalIssues = 0;
  let totalWarnings = 0;

  for (const result of results) {
    if (result.isIdempotent && result.issues.length === 0 && result.warnings.length === 0) {
      console.log(`✅ ${basename(result.file)}: IDEMPOTENT`);
      continue;
    }

    console.log(`\n${result.isIdempotent ? '⚠️ ' : '❌'} ${basename(result.file)}`);

    if (result.issues.length > 0) {
      console.log('\n  🚨 ISSUES FOUND:');
      result.issues.forEach((issue, index) => {
        console.log(`\n  ${index + 1}. Line ${issue.line}`);
        console.log(`     Statement: ${issue.statement}`);
        console.log(`     Reason: ${issue.reason}`);
        console.log(`     Suggestion: ${issue.suggestion}`);
      });
      totalIssues += result.issues.length;
    }

    if (result.warnings.length > 0) {
      console.log('\n  ⚠️  WARNINGS:');
      result.warnings.forEach((warning, index) => {
        console.log(`\n  ${index + 1}. Line ${warning.line}`);
        console.log(`     Statement: ${warning.statement}`);
        console.log(`     Reason: ${warning.reason}`);
      });
      totalWarnings += result.warnings.length;
    }
  }

  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log(`Files validated: ${results.length}`);
  console.log(`Idempotent: ${results.filter(r => r.isIdempotent).length}`);
  console.log(`Non-idempotent: ${results.filter(r => !r.isIdempotent).length}`);
  console.log(`Total issues: ${totalIssues}`);
  console.log(`Total warnings: ${totalWarnings}`);
  console.log('========================================\n');

  if (totalIssues > 0) {
    console.log('❌ VALIDATION FAILED - Non-idempotent patterns detected');
    console.log('   Fix the issues above before committing this migration\n');
  } else if (totalWarnings > 0) {
    console.log('✅ VALIDATION PASSED - No issues found');
    console.log('⚠️  Review warnings above to ensure correctness\n');
  } else {
    console.log('✅ VALIDATION PASSED - All migrations are idempotent\n');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/ops/validate-migration-idempotency.ts <file1.sql> [file2.sql ...]');
    process.exit(2);
  }

  console.log('========================================');
  console.log('SQL MIGRATION IDEMPOTENCY VALIDATOR');
  console.log('========================================');
  console.log(`Validating ${args.length} file(s)...\n`);

  const results: ValidationResult[] = [];

  for (const filePath of args) {
    const result = validateMigration(filePath);
    results.push(result);
  }

  printResults(results);

  // Exit with appropriate code
  const hasIssues = results.some(r => !r.isIdempotent || r.issues.length > 0);
  process.exit(hasIssues ? 1 : 0);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(2);
  });
}

// Export for testing
export { validateMigration, ValidationResult };
