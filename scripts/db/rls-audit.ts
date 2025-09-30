#!/usr/bin/env npx tsx

/**
 * Live RLS (Row Level Security) Audit
 * Verifies tenant isolation is properly enforced on all HOT tier tables
 */

import { Client } from 'pg';
import { writeFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

interface RLSAuditResult {
  timestamp: string;
  status: 'compliant' | 'non_compliant' | 'error';
  total_tables_checked: number;
  tables_with_rls: number;
  tables_without_rls: number;
  table_details: Array<{
    table_name: string;
    has_rls: boolean;
    has_org_id_column: boolean;
    policy_count: number;
    policies?: string[];
    compliance_status: 'compliant' | 'missing_rls' | 'missing_org_id' | 'missing_policies';
  }>;
  errors: string[];
}

const HOT_TIER_TABLES = [
  'unified_picks',
  'raw_props',
  'approval_queue',
  'alerts_queue',
  'scoring_explanations',
  'runtime_config',
  'temporal_metrics',
  'audit_log',
  'agent_tasks'
];

async function runRLSAudit(): Promise<RLSAuditResult> {
  const result: RLSAuditResult = {
    timestamp: new Date().toISOString(),
    status: 'compliant',
    total_tables_checked: 0,
    tables_with_rls: 0,
    tables_without_rls: 0,
    table_details: [],
    errors: []
  };

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    for (const tableName of HOT_TIER_TABLES) {
      try {
        result.total_tables_checked++;

        // Check if table exists and has RLS enabled
        const { data: tableInfo, error: tableError } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT
              relname as table_name,
              relrowsecurity as has_rls
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
            AND c.relname = '${tableName}'
            AND c.relkind = 'r'
          `
        });

        if (tableError) {
          result.errors.push(`Error checking table ${tableName}: ${tableError.message}`);
          continue;
        }

        if (!tableInfo || tableInfo.length === 0) {
          result.table_details.push({
            table_name: tableName,
            has_rls: false,
            has_org_id_column: false,
            policy_count: 0,
            compliance_status: 'missing_rls'
          });
          continue;
        }

        const tableData = tableInfo[0];
        const hasRLS = tableData.has_rls;

        // Check for org_id column
        const { data: columnInfo, error: columnError } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = '${tableName}'
            AND column_name = 'org_id'
          `
        });

        const hasOrgIdColumn = columnInfo && columnInfo.length > 0;

        // Check RLS policies
        const { data: policyInfo, error: policyError } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT policyname, cmd, qual
            FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = '${tableName}'
          `
        });

        const policies = policyInfo?.map((p: any) => `${p.policyname} (${p.cmd})`) || [];

        // Determine compliance status
        let complianceStatus: 'compliant' | 'missing_rls' | 'missing_org_id' | 'missing_policies';

        if (!hasRLS) {
          complianceStatus = 'missing_rls';
          result.tables_without_rls++;
        } else if (!hasOrgIdColumn) {
          complianceStatus = 'missing_org_id';
          result.tables_with_rls++;
        } else if (policies.length === 0) {
          complianceStatus = 'missing_policies';
          result.tables_with_rls++;
        } else {
          complianceStatus = 'compliant';
          result.tables_with_rls++;
        }

        result.table_details.push({
          table_name: tableName,
          has_rls: hasRLS,
          has_org_id_column: hasOrgIdColumn,
          policy_count: policies.length,
          policies: policies,
          compliance_status: complianceStatus
        });

      } catch (error) {
        result.errors.push(`Error auditing table ${tableName}: ${error.message}`);
      }
    }

  } catch (error) {
    result.errors.push(`RLS audit failed: ${error.message}`);
    result.status = 'error';
  }

  // Determine overall status
  const nonCompliantTables = result.table_details.filter(
    table => table.compliance_status !== 'compliant'
  ).length;

  if (result.status !== 'error') {
    result.status = nonCompliantTables === 0 ? 'compliant' : 'non_compliant';
  }

  return result;
}

async function main() {
  try {
    const auditResult = await runRLSAudit();

    // Write to output file
    const outputPath = join(process.cwd(), 'out', 'db', 'rls-audit.json');
    writeFileSync(outputPath, JSON.stringify(auditResult, null, 2));

    console.log(`RLS audit completed: ${auditResult.status}`);
    console.log(`Tables checked: ${auditResult.total_tables_checked}`);
    console.log(`Tables with RLS: ${auditResult.tables_with_rls}`);
    console.log(`Tables without RLS: ${auditResult.tables_without_rls}`);
    console.log(`Results written to: ${outputPath}`);

    if (auditResult.status === 'non_compliant' || auditResult.status === 'error') {
      console.error('RLS compliance issues found:');
      auditResult.table_details
        .filter(table => table.compliance_status !== 'compliant')
        .forEach(table => {
          console.error(`- ${table.table_name}: ${table.compliance_status}`);
        });
      process.exit(1);
    }
  } catch (error) {
    console.error('RLS audit script failed:', error);
    process.exit(1);
  }
}

main();