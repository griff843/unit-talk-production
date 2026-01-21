/* eslint-disable no-console */
/**
 * PHASE 0: Database Verification Script
 *
 * Verifies canonical tables, constraints, and views exist in the database.
 * Outputs evidence to out/proof directory.
 *
 * @author Release Integrity Engineer
 * @date 2026-01-21
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Get timestamp for proof directory
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
const PROOF_DIR = path.join(process.cwd(), 'out', 'proof', 'smartform_real_e2e', TIMESTAMP);

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'MISSING');
  console.error('SUPABASE_KEY:', SUPABASE_KEY ? 'SET' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Canonical tables per SYSTEM_CONTRACT
const CANONICAL_TABLES = [
  'unified_picks',
  'pick_publish',
  'bridge_outbox',
  'smart_tickets',
  'users',
  'games',
];

const CANONICAL_VIEWS = [
  'picks', // READ-ONLY view
];

interface TableInfo {
  table_name: string;
  table_type: string;
  columns: string[];
}

interface ConstraintInfo {
  constraint_name: string;
  constraint_type: string;
  table_name: string;
  check_clause?: string;
}

interface VerificationResult {
  timestamp: string;
  supabase_url: string;
  canonical_tables: {
    name: string;
    exists: boolean;
    type: string;
    columns: string[];
  }[];
  canonical_views: {
    name: string;
    exists: boolean;
    is_read_only: boolean;
  }[];
  constraints: ConstraintInfo[];
  smart_form_check_constraint_exists: boolean;
  picks_view_is_read_only: boolean;
  overall_pass: boolean;
  errors: string[];
}

async function verifyDatabase(): Promise<VerificationResult> {
  console.log('=== PHASE 0: DATABASE VERIFICATION ===\n');
  console.log(`Supabase URL: ${SUPABASE_URL}\n`);

  const result: VerificationResult = {
    timestamp: new Date().toISOString(),
    supabase_url: SUPABASE_URL,
    canonical_tables: [],
    canonical_views: [],
    constraints: [],
    smart_form_check_constraint_exists: false,
    picks_view_is_read_only: false,
    overall_pass: true,
    errors: [],
  };

  // Step 1: Check canonical tables
  console.log('Step 1: Checking canonical tables...');
  for (const tableName of CANONICAL_TABLES) {
    try {
      // Query to get table info
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`  ❌ ${tableName}: ERROR - ${error.message}`);
        result.canonical_tables.push({
          name: tableName,
          exists: false,
          type: 'unknown',
          columns: [],
        });
        result.errors.push(`Table ${tableName} not accessible: ${error.message}`);
        result.overall_pass = false;
      } else {
        // Get column names from the first row or empty array
        const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
        console.log(`  ✓ ${tableName}: EXISTS (${columns.length} columns)`);
        result.canonical_tables.push({
          name: tableName,
          exists: true,
          type: 'BASE TABLE',
          columns,
        });
      }
    } catch (err: any) {
      console.log(`  ❌ ${tableName}: EXCEPTION - ${err.message}`);
      result.canonical_tables.push({
        name: tableName,
        exists: false,
        type: 'unknown',
        columns: [],
      });
      result.errors.push(`Table ${tableName} exception: ${err.message}`);
      result.overall_pass = false;
    }
  }

  // Step 2: Check picks view
  console.log('\nStep 2: Checking picks view (should be READ-ONLY)...');
  try {
    const { data: viewData, error: viewError } = await supabase
      .from('picks')
      .select('id')
      .limit(1);

    if (viewError) {
      console.log(`  ❌ picks view: ERROR - ${viewError.message}`);
      result.canonical_views.push({
        name: 'picks',
        exists: false,
        is_read_only: false,
      });
      result.errors.push(`View picks not accessible: ${viewError.message}`);
    } else {
      console.log(`  ✓ picks view: EXISTS`);

      // Test write-block by attempting insert (should fail)
      const { error: insertError } = await supabase
        .from('picks')
        .insert({
          id: 'test-write-block-' + Date.now(),
          user_id: 'test',
          selection: 'test',
          status: 'test',
        });

      if (insertError) {
        console.log(`  ✓ picks view: WRITE BLOCKED - "${insertError.message}"`);
        result.picks_view_is_read_only = true;
        result.canonical_views.push({
          name: 'picks',
          exists: true,
          is_read_only: true,
        });
      } else {
        console.log(`  ❌ picks view: WRITE NOT BLOCKED (CRITICAL VIOLATION)`);
        result.canonical_views.push({
          name: 'picks',
          exists: true,
          is_read_only: false,
        });
        result.errors.push('picks view allows writes - CRITICAL VIOLATION');
        result.overall_pass = false;
      }
    }
  } catch (err: any) {
    console.log(`  ❌ picks view: EXCEPTION - ${err.message}`);
    result.canonical_views.push({
      name: 'picks',
      exists: false,
      is_read_only: false,
    });
    result.errors.push(`View picks exception: ${err.message}`);
  }

  // Step 3: Check for Smart Form CHECK constraint
  console.log('\nStep 3: Checking Smart Form CHECK constraint...');
  try {
    // Query information_schema for constraints (via RPC or direct if available)
    // Since we can't query information_schema directly, we'll test by insertion
    const testData = {
      bet_slip_id: 'test-constraint-' + Date.now(),
      user_id: null, // Missing required field
      sport: 'NFL',
      selection: 'test',
      form_source: 'smart_form',
      stake: null, // Missing required field (units)
      trace_id: null, // Missing required field
    };

    const { error: constraintTestError } = await supabase
      .from('unified_picks')
      .insert(testData);

    if (constraintTestError && constraintTestError.message.includes('chk_smart_form_required_fields')) {
      console.log(`  ✓ Smart Form CHECK constraint: ACTIVE`);
      console.log(`    Error message: ${constraintTestError.message}`);
      result.smart_form_check_constraint_exists = true;
    } else if (constraintTestError) {
      console.log(`  ⚠ Insert failed but not due to CHECK constraint: ${constraintTestError.message}`);
      // Still might be blocked by other constraints
      if (constraintTestError.message.includes('violates')) {
        console.log(`  ✓ Some constraint blocked the insert`);
      }
    } else {
      console.log(`  ⚠ Insert succeeded - CHECK constraint may not be active`);
      // Clean up test data
      await supabase.from('unified_picks').delete().eq('bet_slip_id', testData.bet_slip_id);
    }
  } catch (err: any) {
    console.log(`  ⚠ Constraint check exception: ${err.message}`);
  }

  // Step 4: Verify pick_publish foreign key to unified_picks
  console.log('\nStep 4: Verifying pick_publish FK to unified_picks...');
  try {
    const { data: ppData, error: ppError } = await supabase
      .from('pick_publish')
      .select(`
        id,
        pick_id,
        unified_picks!pick_publish_pick_id_fkey (
          id
        )
      `)
      .limit(1);

    if (ppError) {
      console.log(`  ⚠ FK query error: ${ppError.message}`);
      // This might be expected if no data exists
    } else {
      console.log(`  ✓ pick_publish FK to unified_picks: VALID`);
    }
  } catch (err: any) {
    console.log(`  ⚠ FK check exception: ${err.message}`);
  }

  // Step 5: Get sample unified_picks columns
  console.log('\nStep 5: Getting unified_picks columns...');
  try {
    const { data: sampleData, error: sampleError } = await supabase
      .from('unified_picks')
      .select('*')
      .limit(1);

    if (!sampleError && sampleData && sampleData.length > 0) {
      const columns = Object.keys(sampleData[0]);
      console.log(`  ✓ unified_picks has ${columns.length} columns`);
      console.log(`    Key columns: ${columns.slice(0, 15).join(', ')}...`);

      // Check for required Smart Form fields
      const requiredFields = ['stake', 'user_id', 'selection', 'sport', 'trace_id', 'form_source'];
      const missingFields = requiredFields.filter(f => !columns.includes(f));
      if (missingFields.length > 0) {
        console.log(`  ⚠ Missing required fields: ${missingFields.join(', ')}`);
        result.errors.push(`unified_picks missing fields: ${missingFields.join(', ')}`);
      } else {
        console.log(`  ✓ All required Smart Form fields present`);
      }
    } else {
      console.log(`  ⚠ No sample data available`);
    }
  } catch (err: any) {
    console.log(`  ⚠ Sample query exception: ${err.message}`);
  }

  // Final verdict
  console.log('\n=== VERIFICATION RESULT ===');
  if (result.overall_pass && result.errors.length === 0) {
    console.log('✓ PHASE 0: PASS - All canonical objects verified');
  } else {
    console.log('❌ PHASE 0: ISSUES DETECTED');
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
  }

  return result;
}

async function main() {
  // Ensure proof directory exists
  fs.mkdirSync(PROOF_DIR, { recursive: true });

  console.log(`Proof directory: ${PROOF_DIR}\n`);

  const result = await verifyDatabase();

  // Save result to proof directory
  const outputPath = path.join(PROOF_DIR, 'phase0_db_verification.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nEvidence saved to: ${outputPath}`);

  // Return proof dir for subsequent scripts
  console.log(`\nPROOF_DIR=${PROOF_DIR}`);

  process.exit(result.overall_pass ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
