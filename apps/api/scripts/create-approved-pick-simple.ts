import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createApprovedPickSimple() {
  console.log('=== CREATING APPROVED PICK (Direct Insert) ===\n');

  try {
    const pickId = uuidv4();
    const now = new Date().toISOString();

    // Insert directly into picks table with service role (bypasses RLS)
    const { data: pick, error } = await supabase
      .from('picks')
      .insert({
        id: pickId,
        tenant_id: '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a',
        user_id: '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a',
        selection: 'OVER',
        odds: -110,
        stake: 1.0,
        confidence: 8,
        workflow_stage: 'approved',  // Set to approved
        status: 'pending',  // Status pending for fresh pick
        metadata: {
          player_name: 'Test Player CANARY E2E',
          league: 'NFL',
          stat_type: 'passing_yards',
          line: 250.5,
          game_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          created_for_test: 'canary_e2e_verification_final',
          test_timestamp: now
        },
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error) {
      console.error('❌ INSERT ERROR:', error);
      process.exit(1);
    }

    console.log('✅ PICK CREATED:');
    console.log(`  Pick ID: ${pick.id}`);
    console.log(`  Workflow Stage: ${pick.workflow_stage}`);
    console.log(`  Status: ${pick.status}`);
    console.log(`  User ID: ${pick.user_id}`);
    console.log(`  Tenant ID: ${pick.tenant_id}`);
    console.log(`  Created At: ${pick.created_at}`);

    // Verify no CANARY record
    const { data: publishRecords } = await supabase
      .from('pick_publish')
      .select('id, channel, status')
      .eq('pick_id', pick.id)
      .eq('channel', 'CANARY');

    if (publishRecords && publishRecords.length > 0) {
      console.log(`\n⚠️ WARNING: Pick already has CANARY record`);
      process.exit(1);
    }

    console.log(`\n✅ VERIFIED: No existing CANARY publish record`);
    console.log(`\n🎯 READY FOR PROMOTION TEST`);
    console.log(`\nCurl command to promote:`);
    console.log(`curl -X POST http://localhost:3000/api/ops/picks/${pick.id}/promote \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -H "x-e2e-test: true" \\`);
    console.log(`  -d '{"channel":"CANARY"}'`);
    console.log(`\nPowerShell command:`);
    console.log(`$pickId = "${pick.id}"; Invoke-RestMethod -Uri "http://localhost:3000/api/ops/picks/$pickId/promote" -Method POST -Headers @{'Content-Type'='application/json';'x-e2e-test'='true'} -Body '{"channel":"CANARY"}'`);

  } catch (error) {
    console.error('❌ ERROR:', error);
    process.exit(1);
  }
}

createApprovedPickSimple();
