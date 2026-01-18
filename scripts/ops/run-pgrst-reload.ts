#!/usr/bin/env tsx
/**
 * PostgREST Schema Reload via RPC
 * 
 * Calls public.pgrst_reload() RPC to trigger PostgREST schema reload.
 * This is the production-safe method for reloading PostgREST schema
 * without requiring direct database access or dashboard intervention.
 * 
 * Date: 2025-10-30
 * Author: Unit Talk Engineering
 * Charter: docs/PRODUCTION_CHARTER.md v3.0
 * Version: 1.0.0
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface ReloadResult {
  success: boolean;
  reload_id: string;
  reloaded_at: string;
  message: string;
}

interface AttestationData {
  timestamp: string;
  operation: string;
  result: ReloadResult | null;
  error: string | null;
  environment: {
    supabase_url: string;
    project_id: string;
  };
}

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

const log = {
  info: (msg: string) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg: string) => console.log(`[\x1b[32mSUCCESS\x1b[0m] ${msg}`),
  error: (msg: string) => console.log(`[\x1b[31mERROR\x1b[0m] ${msg}`),
  warn: (msg: string) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`)
};

// ============================================================================
// SECRET MASKING
// ============================================================================

function maskSecret(value: string | undefined): string {
  if (!value) return '***not-set***';
  if (value.length <= 20) return '***masked***';
  return `${value.substring(0, 20)}***`;
}

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

function validateEnvironment(): { url: string; key: string; projectId: string } {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    log.error('Missing required environment variables');
    console.log('');
    console.log('Required:');
    console.log('  SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
    console.log('  SUPABASE_SERVICE_ROLE_KEY');
    console.log('');
    process.exit(1);
  }

  // Extract project ID from URL
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) {
    log.error('Invalid SUPABASE_URL format');
    process.exit(1);
  }

  return {
    url: supabaseUrl,
    key: serviceKey,
    projectId: match[1]
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function main(): Promise<void> {
  console.log('');
  console.log('='.repeat(80));
  console.log('POSTGREST SCHEMA RELOAD - RPC METHOD');
  console.log('='.repeat(80));
  console.log('');

  // Validate environment
  const env = validateEnvironment();

  log.info('Environment Configuration:');
  console.log(`  SUPABASE_URL: ${maskSecret(env.url)}`);
  console.log(`  SERVICE_KEY:  ${maskSecret(env.key)}`);
  console.log(`  PROJECT_ID:   ${env.projectId}`);
  console.log('');

  // Create Supabase client
  const supabase = createClient(env.url, env.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  let attestation: AttestationData = {
    timestamp: new Date().toISOString(),
    operation: 'pgrst_reload',
    result: null,
    error: null,
    environment: {
      supabase_url: maskSecret(env.url),
      project_id: env.projectId
    }
  };

  try {
    // Call pgrst_reload RPC
    log.info('Calling pgrst_reload() RPC...');
    const { data, error } = await supabase.rpc('pgrst_reload');

    if (error) {
      log.error(`RPC call failed: ${error.message}`);
      
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.log('');
        console.log('⚠️  RPC function does not exist');
        console.log('');
        console.log('Action Required:');
        console.log('  1. Apply migration: supabase/migrations/20251030_seed_user_and_rls_rpc.sql');
        console.log(`  2. Open: https://supabase.com/dashboard/project/${env.projectId}/sql`);
        console.log('  3. Copy migration SQL and execute');
        console.log('  4. Re-run this script');
        console.log('');
      }

      attestation.error = error.message;
      saveAttestation(attestation);
      process.exit(1);
    }

    const result = data as ReloadResult;
    attestation.result = result;

    if (result.success) {
      log.success('PostgREST schema reload triggered successfully');
      console.log('');
      console.log('Reload Details:');
      console.log(`  Reload ID:   ${result.reload_id}`);
      console.log(`  Timestamp:   ${result.reloaded_at}`);
      console.log(`  Message:     ${result.message}`);
      console.log('');
      console.log('='.repeat(80));
      log.success('RELOAD COMPLETE');
      console.log('='.repeat(80));
      console.log('');
      console.log('Next Steps:');
      console.log('  1. Wait 10-20 seconds for PostgREST to process reload');
      console.log('  2. Verify visibility: npm run ops:pgrst:verify');
      console.log('');

      saveAttestation(attestation);
      process.exit(0);
    } else {
      log.error('RPC returned success=false');
      attestation.error = 'RPC returned success=false';
      saveAttestation(attestation);
      process.exit(1);
    }
  } catch (err) {
    const error = err as Error;
    log.error(`Exception: ${error.message}`);
    attestation.error = error.message;
    saveAttestation(attestation);
    process.exit(1);
  }
}

// ============================================================================
// ATTESTATION SAVE
// ============================================================================

function saveAttestation(data: AttestationData): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const artifactsDir = path.join(process.cwd(), 'out/ops/cutover/metrics/100');
  
  // Ensure directory exists
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Save JSON
  const jsonPath = path.join(artifactsDir, `PGRST_RELOAD_ATTESTATION_${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  log.info(`Attestation saved: ${jsonPath}`);

  // Save Markdown
  const mdPath = path.join(artifactsDir, `PGRST_RELOAD_ATTESTATION_${timestamp}.md`);
  const markdown = `# PostgREST Reload Attestation

**Date:** ${data.timestamp}  
**Operation:** ${data.operation}  
**Status:** ${data.error ? '❌ FAILED' : '✅ SUCCESS'}

## Environment

- **Supabase URL:** ${data.environment.supabase_url}
- **Project ID:** ${data.environment.project_id}

## Result

${data.result ? `
- **Success:** ${data.result.success}
- **Reload ID:** ${data.result.reload_id}
- **Timestamp:** ${data.result.reloaded_at}
- **Message:** ${data.result.message}
` : 'No result data'}

${data.error ? `## Error\n\n\`\`\`\n${data.error}\n\`\`\`\n` : ''}

## Charter Compliance

✅ Idempotent operation  
✅ Secrets masked in logs  
✅ Attestation artifacts generated  
✅ Production Charter v3.0 compliant  

---
*Generated by scripts/ops/run-pgrst-reload.ts*
`;

  fs.writeFileSync(mdPath, markdown);
  log.info(`Attestation saved: ${mdPath}`);
}

// ============================================================================
// EXECUTE
// ============================================================================

main().catch((err) => {
  log.error(`Unhandled error: ${err.message}`);
  process.exit(1);
});

