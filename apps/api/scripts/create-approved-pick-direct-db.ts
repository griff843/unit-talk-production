import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createApprovedPickDirectDB() {
  console.log('=== CREATING APPROVED PICK VIA SUPABASE (service role) ===\n');

  try {
    // Use the create_pick_with_event RPC that the API uses
    const { data: pickId, error: rpcError } = await supabase.rpc('create_pick_with_event', {
      p_tenant_id: '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a',  // Default tenant
      p_user_id: '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a',  // Use tenant as user
      p_pick_data: {
        selection: 'OVER',
        odds: -110,
        stake: 1.0,
        confidence: 8,
        workflow_stage: 'approved',  // CRITICAL: Set to approved
        metadata: {
          player_name: 'Test Player CANARY E2E',
          league: 'NFL',
          stat_type: 'passing_yards',
          line: 250.5,
          game_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          created_for_test: 'canary_e2e_verification_final',
          test_timestamp: new Date().toISOString()
        }
      },
      p_correlation_id: `canary-e2e-${Date.now()}`
    });

    if (rpcError) {
      console.error('❌ RPC ERROR:', rpcError);
      process.exit(1);
    }

    console.log(`✅ PICK ID RETURNED: ${pickId}`);

    // Fetch the created pick
    const { data: pick, error: fetchError } = await supabase
      .from('picks')
      .select('*')
      .eq('id', pickId)
      .single();

    if (fetchError) {
      console.error('❌ FETCH ERROR:', fetchError);
      process.exit(1);
    }

    console.log('\n✅ PICK CREATED VIA RPC:');
    console.log(`  Pick ID: ${pick.id}`);
    console.log(`  Workflow Stage: ${pick.workflow_stage}`);
    console.log(`  Status: ${pick.status || 'N/A'}`);
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
    console.log(`   Use this Pick ID: ${pick.id}`);
    console.log(`   Command: curl -X POST http://localhost:3000/api/ops/picks/${pick.id}/promote -H "Content-Type: application/json" -H "x-e2e-test: true" -d "{\\"channel\\":\\"CANARY\\"}"`);

  } catch (error) {
    console.error('❌ ERROR:', error);
    process.exit(1);
  }
}

createApprovedPickDirectDB();
