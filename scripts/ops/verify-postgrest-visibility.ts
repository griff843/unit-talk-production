#!/usr/bin/env node
/**
 * Verify PostgREST Visibility of Canonical Tables
 * Per Production Charter v3.0 and System Alignment Spec v3.0
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config({ path: '.env' });
config({ path: '.env.local', override: true });
config({ path: '.env.shared', override: true });

interface VisibilityResult {
  timestamp: string;
  picks_visible: boolean;
  pick_publish_visible: boolean;
  picks_error?: string;
  pick_publish_error?: string;
  status: 'VISIBLE' | 'NOT_VISIBLE' | 'PARTIAL';
}

async function main() {
  console.log('🔍 POSTGREST VISIBILITY CHECK');
  console.log('==============================\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const result: VisibilityResult = {
    timestamp: new Date().toISOString(),
    picks_visible: false,
    pick_publish_visible: false,
    status: 'NOT_VISIBLE',
  };

  // Check picks table
  console.log('Checking picks table...');
  const { data: picksData, error: picksError } = await supabase
    .from('picks')
    .select('id')
    .limit(1);

  if (picksError) {
    result.picks_error = `${picksError.message} (${picksError.code})`;
    console.log(`  ❌ picks: ${picksError.message} (${picksError.code})`);
  } else {
    result.picks_visible = true;
    console.log(`  ✅ picks: VISIBLE`);
  }

  // Check pick_publish table
  console.log('Checking pick_publish table...');
  const { data: publishData, error: publishError } = await supabase
    .from('pick_publish')
    .select('id')
    .limit(1);

  if (publishError) {
    result.pick_publish_error = `${publishError.message} (${publishError.code})`;
    console.log(`  ❌ pick_publish: ${publishError.message} (${publishError.code})`);
  } else {
    result.pick_publish_visible = true;
    console.log(`  ✅ pick_publish: VISIBLE`);
  }

  // Determine overall status
  if (result.picks_visible && result.pick_publish_visible) {
    result.status = 'VISIBLE';
  } else if (result.picks_visible || result.pick_publish_visible) {
    result.status = 'PARTIAL';
  }

  // Save artifacts
  const artifactsDir = path.join(process.cwd(), 'out/ops/cutover/metrics/100');
  fs.mkdirSync(artifactsDir, { recursive: true });

  const jsonPath = path.join(artifactsDir, 'POSTGREST_VISIBILITY.json');
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));

  console.log(`\n💾 Saved: ${jsonPath}`);
  console.log(`\n📊 Status: ${result.status}`);

  if (result.status === 'VISIBLE') {
    console.log('\n✅ ALL CANONICAL TABLES VISIBLE TO POSTGREST');
    process.exit(0);
  } else {
    console.log('\n❌ CANONICAL TABLES NOT FULLY VISIBLE - RELOAD REQUIRED');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

