#!/usr/bin/env node
/**
 * STEP 0: PROJECT ALIGNMENT VERIFICATION
 * Proves that DATABASE_DIRECT_URL and SUPABASE_URL point to the same Supabase project.
 * Per Production Charter v3.0 and System Alignment Spec v3.0
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables with precedence: .env.shared > .env.local > .env
config({ path: '.env' });
config({ path: '.env.local', override: true });
config({ path: '.env.shared', override: true });

const { Pool } = pg;

interface ProjectAlignmentResult {
  timestamp: string;
  git_sha: string;
  charter_version: string;
  spec_version: string;
  supabase_project_ref: string;
  database_cluster_info: {
    server_version: string;
    server_addr: string;
    current_database: string;
    current_user: string;
    cluster_name: string | null;
  };
  canonical_tables: {
    picks_exists: boolean;
    pick_publish_exists: boolean;
  };
  alignment_status: 'ALIGNED' | 'MISALIGNED' | 'UNKNOWN';
  notes: string[];
}

async function main() {
  console.log('🔍 STEP 0: PROJECT ALIGNMENT VERIFICATION');
  console.log('==========================================\n');

  const result: ProjectAlignmentResult = {
    timestamp: new Date().toISOString(),
    git_sha: 'b6086d3',
    charter_version: '3.0',
    spec_version: '3.0',
    supabase_project_ref: '',
    database_cluster_info: {
      server_version: '',
      server_addr: '',
      current_database: '',
      current_user: '',
      cluster_name: null,
    },
    canonical_tables: {
      picks_exists: false,
      pick_publish_exists: false,
    },
    alignment_status: 'UNKNOWN',
    notes: [],
  };

  // 1. Extract project ref from SUPABASE_URL
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    console.error('❌ SUPABASE_URL not set');
    process.exit(1);
  }

  const urlMatch = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  if (!urlMatch) {
    console.error('❌ Invalid SUPABASE_URL format');
    process.exit(1);
  }

  result.supabase_project_ref = urlMatch[1];
  console.log(`✅ SUPABASE_URL project ref: ${result.supabase_project_ref}`);
  result.notes.push(`SUPABASE_URL points to project: ${result.supabase_project_ref}`);

  // 2. Extract project ref from DATABASE_DIRECT_URL
  const databaseUrl = process.env.DATABASE_DIRECT_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_DIRECT_URL not set');
    process.exit(1);
  }

  // Mask the password in the connection string for logging
  const maskedDbUrl = databaseUrl.replace(/:([^@]+)@/, ':***@');
  console.log(`✅ DATABASE_DIRECT_URL: ${maskedDbUrl}`);

  // Extract project ref from DATABASE_DIRECT_URL
  const dbUrlMatch = databaseUrl.match(/postgres\.([a-z0-9]+):/);
  if (!dbUrlMatch) {
    console.error('❌ Could not extract project ref from DATABASE_DIRECT_URL');
    result.notes.push('WARNING: Could not parse project ref from DATABASE_DIRECT_URL');
  } else {
    const dbProjectRef = dbUrlMatch[1];
    console.log(`✅ DATABASE_DIRECT_URL project ref: ${dbProjectRef}`);
    result.notes.push(`DATABASE_DIRECT_URL points to project: ${dbProjectRef}`);

    if (dbProjectRef === result.supabase_project_ref) {
      console.log('✅ PROJECT REFS MATCH - Same Supabase project confirmed');
      result.alignment_status = 'ALIGNED';
      result.notes.push('✅ SUPABASE_URL and DATABASE_DIRECT_URL point to the same project');
    } else {
      console.error('❌ PROJECT REFS MISMATCH');
      result.alignment_status = 'MISALIGNED';
      result.notes.push(`❌ MISMATCH: SUPABASE_URL=${result.supabase_project_ref}, DATABASE_DIRECT_URL=${dbProjectRef}`);
    }
  }

  // 3. Use Supabase client with service role to check tables (bypasses RLS)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('\n📊 Querying database via Supabase client (service role)...');

  try {
    // Check if picks table exists by trying to query it
    const { data: picksData, error: picksError } = await supabase
      .from('picks')
      .select('id')
      .limit(1);

    result.canonical_tables.picks_exists = !picksError || picksError.code !== 'PGRST200';

    if (picksError && picksError.code !== 'PGRST116') { // PGRST116 = no rows, which is OK
      console.log(`  picks table check: ${picksError.message} (code: ${picksError.code})`);
    }

    // Check if pick_publish table exists
    const { data: publishData, error: publishError } = await supabase
      .from('pick_publish')
      .select('id')
      .limit(1);

    result.canonical_tables.pick_publish_exists = !publishError || publishError.code !== 'PGRST200';

    if (publishError && publishError.code !== 'PGRST116') {
      console.log(`  pick_publish table check: ${publishError.message} (code: ${publishError.code})`);
    }

    console.log(`\n📋 Canonical Tables (via Supabase REST API):`);
    console.log(`  picks: ${result.canonical_tables.picks_exists ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  pick_publish: ${result.canonical_tables.pick_publish_exists ? '✅ EXISTS' : '❌ MISSING'}`);

    if (!result.canonical_tables.picks_exists || !result.canonical_tables.pick_publish_exists) {
      result.notes.push('⚠️  Canonical tables missing or not visible to PostgREST - migration/reload required');
    } else {
      result.notes.push('✅ Canonical tables exist and are visible to PostgREST');
    }

  } catch (error: any) {
    console.error('❌ Supabase query failed:', error.message);
    result.notes.push(`ERROR checking tables via Supabase: ${error.message}`);
  }

  // 4. Get database cluster info via direct connection (for metadata only)
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 10000,
    max: 1,
  });

  try {
    console.log('\n📊 Querying database cluster metadata...');

    const client = await pool.connect();

    try {
      const clusterQuery = `
        SELECT
          current_setting('server_version') AS server_version,
          inet_server_addr() AS server_addr,
          current_database() AS current_database,
          current_user AS current_user
      `;

      const res = await client.query(clusterQuery);
      const row = res.rows[0];

      result.database_cluster_info = {
        server_version: row.server_version,
        server_addr: row.server_addr,
        current_database: row.current_database,
        current_user: row.current_user,
        cluster_name: null,
      };

      console.log(`  Server Version: ${row.server_version}`);
      console.log(`  Server Address: ${row.server_addr}`);
      console.log(`  Database: ${row.current_database}`);
      console.log(`  User: ${row.current_user}`);

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.log(`⚠️  Could not query cluster metadata: ${error.message}`);
    result.notes.push(`Note: Could not query cluster metadata (${error.message})`);
  } finally {
    await pool.end();
  }

  // 3. Save artifacts
  const artifactsDir = path.join(process.cwd(), 'out/ops/cutover/metrics/100');
  fs.mkdirSync(artifactsDir, { recursive: true });

  const jsonPath = path.join(artifactsDir, 'STEP_0_PROJECT_ALIGNMENT.json');
  const mdPath = path.join(artifactsDir, 'STEP_0_PROJECT_ALIGNMENT.md');

  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  console.log(`\n💾 Saved JSON: ${jsonPath}`);

  const markdown = `# STEP 0: PROJECT ALIGNMENT VERIFICATION

**Timestamp**: ${result.timestamp}  
**Git SHA**: ${result.git_sha}  
**Charter Version**: ${result.charter_version}  
**Spec Version**: ${result.spec_version}

## Project Identification

- **SUPABASE_URL Project Ref**: \`${result.supabase_project_ref}\`
- **Alignment Status**: **${result.alignment_status}**

## Database Cluster Info

- **Server Version**: ${result.database_cluster_info.server_version}
- **Server Address**: ${result.database_cluster_info.server_addr}
- **Database**: ${result.database_cluster_info.current_database}
- **User**: ${result.database_cluster_info.current_user}
- **Cluster Name**: ${result.database_cluster_info.cluster_name || 'N/A'}

## Canonical Tables

- **picks**: ${result.canonical_tables.picks_exists ? '✅ EXISTS' : '❌ MISSING'}
- **pick_publish**: ${result.canonical_tables.pick_publish_exists ? '✅ EXISTS' : '❌ MISSING'}

## Notes

${result.notes.map(n => `- ${n}`).join('\n')}

---

**Status**: ${result.alignment_status === 'ALIGNED' && result.canonical_tables.picks_exists && result.canonical_tables.pick_publish_exists ? '✅ READY TO PROCEED' : '⚠️  ACTION REQUIRED'}
`;

  fs.writeFileSync(mdPath, markdown);
  console.log(`💾 Saved Markdown: ${mdPath}`);

  // Exit code
  if (result.alignment_status === 'ALIGNED' && result.canonical_tables.picks_exists && result.canonical_tables.pick_publish_exists) {
    console.log('\n✅ PROJECT ALIGNMENT VERIFIED - READY TO PROCEED');
    process.exit(0);
  } else if (!result.canonical_tables.picks_exists || !result.canonical_tables.pick_publish_exists) {
    console.log('\n⚠️  CANONICAL TABLES MISSING - MIGRATION REQUIRED');
    process.exit(2);
  } else {
    console.log('\n❌ PROJECT ALIGNMENT FAILED');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

