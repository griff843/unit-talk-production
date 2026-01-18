import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createApprovedPick() {
  console.log('=== CREATING APPROVED PICK FOR CANARY TEST ===\n');

  // Create a pick via the API with workflow_stage='approved'
  const apiUrl = 'http://localhost:3000/api/domain/picks';

  const pickData = {
    selection: 'OVER',
    odds: -110,
    stake: 1.0,
    confidence: 8,
    workflow_stage: 'approved',  // CRITICAL: Set to approved during creation
    metadata: {
      player_name: 'Test Player CANARY',
      league: 'NFL',
      stat_type: 'passing_yards',
      line: 250.5,
      game_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),  // Tomorrow
      created_for_test: 'canary_e2e_verification',
      test_timestamp: new Date().toISOString()
    }
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-e2e-test': 'true',
        'x-tenant-id': '00000000-0000-0000-0000-000000000001',
        'x-user-id': '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a'  // Use existing user
      },
      body: JSON.stringify(pickData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ API ERROR:', JSON.stringify(errorData, null, 2));
      process.exit(1);
    }

    const result = await response.json();

    console.log('✅ PICK CREATED VIA API:');
    console.log(`  Pick ID: ${result.data.id}`);
    console.log(`  Workflow Stage: ${result.data.workflow_stage}`);
    console.log(`  Status: ${result.data.status || 'N/A'}`);
    console.log(`  User ID: ${result.data.user_id}`);
    console.log(`  Tenant ID: ${result.data.tenant_id}`);
    console.log(`  Created At: ${result.data.created_at}`);
    console.log(`  Metadata: ${JSON.stringify(result.data.metadata, null, 2)}`);

    // Verify it has no CANARY record
    const { data: publishRecords } = await supabase
      .from('pick_publish')
      .select('id, channel, status')
      .eq('pick_id', result.data.id)
      .eq('channel', 'CANARY');

    if (publishRecords && publishRecords.length > 0) {
      console.log(`\n⚠️ WARNING: Pick already has CANARY record (unexpected)`);
      process.exit(1);
    }

    console.log(`\n✅ VERIFIED: No existing CANARY publish record`);
    console.log(`\n🎯 READY FOR PROMOTION TEST`);
    console.log(`   Use this Pick ID: ${result.data.id}`);
    console.log(`   Command: POST /api/ops/picks/${result.data.id}/promote`);

  } catch (error) {
    console.error('❌ ERROR:', error);
    process.exit(1);
  }
}

createApprovedPick();
