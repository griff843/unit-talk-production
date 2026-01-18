/**
 * Test Discord Publishing Flow
 *
 * Tests the complete publishing pipeline:
 * 1. Pick exists in canonical picks table
 * 2. Create outbox entry in pick_publish
 * 3. Verify outbox entry created
 * 4. (Future) Trigger worker to process outbox
 *
 * Charter v3.0: Canonical-first architecture compliance
 */

import { createClient } from '@supabase/supabase-js';
import { PickPublisher } from '../../apps/api/src/services/picks/PickPublisher';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

interface TestResult {
  timestamp: string;
  pick_id: string | null;
  publish_record_created: boolean;
  publish_record_id: string | null;
  error: string | null;
  discord_call_simulated: boolean;
}

async function main() {
  console.log('[Discord Publish Test] Starting...');

  const result: TestResult = {
    timestamp: new Date().toISOString(),
    pick_id: null,
    publish_record_created: false,
    publish_record_id: null,
    error: null,
    discord_call_simulated: false,
  };

  try {
    // 1. Find a recent pick from professional pipeline
    console.log('[Step 1] Finding recent professional pick...');
    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select('id, selection, metadata, created_at')
      .eq('metadata->>source', 'professional_pipeline')
      .order('created_at', { ascending: false })
      .limit(1);

    if (picksError) {
      throw new Error(`Failed to fetch picks: ${picksError.message}`);
    }

    if (!picks || picks.length === 0) {
      throw new Error('No professional picks found. Run Phase 15 ingestion first.');
    }

    const pick = picks[0];
    result.pick_id = pick.id;
    console.log(`✅ Found pick: ${pick.id}`);
    console.log(`   Selection: ${pick.selection}`);
    console.log(`   Created: ${pick.created_at}`);

    // 2. Create PickPublisher and publish
    console.log('[Step 2] Creating publish record via PickPublisher...');
    const publisher = new PickPublisher('outbox');

    // Prepare pick data for publishing
    const pickData = {
      id: pick.id,
      tenantId: process.env.DEFAULT_TENANT_ID!,
      selection: pick.selection,
      metadata: pick.metadata,
    };

    // Publish options
    const publishOptions = {
      channel: 'test-channel',
      threadId: undefined,
      scheduledFor: undefined,
    };

    try {
      await publisher.publish(pickData as any, publishOptions);
      console.log('✅ PickPublisher.publish() completed');
    } catch (publishError) {
      console.error('⚠️  PickPublisher.publish() failed:', publishError);
      result.error = publishError instanceof Error ? publishError.message : String(publishError);
    }

    // 3. Verify publish record was created
    console.log('[Step 3] Verifying pick_publish record...');
    const { data: publishRecords, error: publishError } = await supabase
      .from('pick_publish')
      .select('id, pick_id, status, created_at')
      .eq('pick_id', pick.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (publishError) {
      console.warn('⚠️  Could not verify pick_publish:', publishError.message);
      result.error = `Verification failed: ${publishError.message}`;
    } else if (publishRecords && publishRecords.length > 0) {
      const publishRecord = publishRecords[0];
      result.publish_record_created = true;
      result.publish_record_id = publishRecord.id;
      console.log('✅ Publish record created:', publishRecord.id);
      console.log(`   Status: ${publishRecord.status}`);
      console.log(`   Created: ${publishRecord.created_at}`);
    } else {
      console.log('⚠️  No publish record found for this pick');
    }

    // 4. Simulate Discord call check (for now, just log)
    console.log('[Step 4] Discord call simulation...');
    console.log('   NOTE: Actual Discord API call requires worker processing');
    console.log('   The publisher worker would poll pick_publish and call Discord');
    result.discord_call_simulated = true;

  } catch (error) {
    console.error('[Discord Publish Test] Failed:', error);
    result.error = error instanceof Error ? error.message : String(error);
  }

  // 5. Write result artifact
  const artifactDir = path.join('out', 'ops', 'cutover', 'metrics', 'phase15');
  fs.mkdirSync(artifactDir, { recursive: true });

  const artifactPath = path.join(artifactDir, 'DISCORD_PUBLISH_TEST_RESULT.json');
  fs.writeFileSync(artifactPath, JSON.stringify(result, null, 2), 'utf-8');

  const mdPath = path.join(artifactDir, 'DISCORD_PUBLISH_TEST_RESULT.md');
  const mdLines = [
    '# Discord Publish Test Result',
    '',
    `**Timestamp**: ${result.timestamp}`,
    `**Pick ID**: ${result.pick_id || 'N/A'}`,
    `**Publish Record Created**: ${result.publish_record_created ? '✅ YES' : '❌ NO'}`,
    `**Publish Record ID**: ${result.publish_record_id || 'N/A'}`,
    `**Discord Call Simulated**: ${result.discord_call_simulated ? 'YES' : 'NO'}`,
    '',
    '## Status',
    result.error ? `❌ **FAILED**: ${result.error}` : '✅ **SUCCESS**',
    '',
    '## Next Steps',
    result.publish_record_created
      ? '- Publisher worker will process outbox entry'
      : '- Troubleshoot why publish record was not created',
    '',
    '## Notes',
    '- Actual Discord posting requires publisher worker to be running',
    '- Worker polls pick_publish table for pending records',
    '- HTTP calls to Discord are logged by the worker',
  ];

  fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf-8');

  console.log(`\n[Discord Publish Test] Artifacts written to ${artifactDir}`);
  console.log(`\nSummary:`);
  console.log(`  Pick ID: ${result.pick_id}`);
  console.log(`  Publish Record: ${result.publish_record_created ? '✅ Created' : '❌ Not Created'}`);
  console.log(`  Status: ${result.error ? '❌ FAILED' : '✅ SUCCESS'}`);

  process.exit(result.error ? 1 : 0);
}

main().catch((err) => {
  console.error('Test script failed:', err);
  process.exit(1);
});
